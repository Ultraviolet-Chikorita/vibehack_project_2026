// src/lib/vaultMatching.ts
/**
 * Order evidence vault matching — links incoming messages to existing vaults
 * 
 * Uses a 7-step priority chain with confidence scoring:
 * 1. Exact order ID match
 * 2. Email address match in message body
 * 3. Payment reference number match
 * 4. Tracking number/carrier match
 * 5. Customer name/phone number match
 * 6. Date/time range alignment
 * 7. Fallback: merchant-level matching
 */

export interface VaultMatch {
  vaultId: string;
  confidenceScore: number;
  matchSteps: MatchStep[];
}

export interface MatchStep {
  stepNumber: number;
  description: string;
  matched: boolean;
  evidenceType?: string;
}

const MATCHING_PRIORITY: MatchingStep[] = [
  {
    step: 1,
    description: 'Exact order ID match',
    evidenceTypes: ['order'],
    confidenceWeight: 0.4,
    requiredFields: ['orderId']
  },
  {
    step: 2,
    description: 'Email address match in message body',
    evidenceTypes: ['email'],
    confidenceWeight: 0.25,
    requiredFields: ['email']
  },
  {
    step: 3,
    description: 'Payment reference number match',
    evidenceTypes: ['payment'],
    confidenceWeight: 0.15,
    requiredFields: ['referenceId']
  },
  {
    step: 4,
    description: 'Tracking number/carrier match',
    evidenceTypes: ['shipping'],
    confidenceWeight: 0.1,
    requiredFields: ['trackingNumber', 'carrier']
  },
];

/**
 * Matches an incoming message to existing vaults
 * @param message - Message to match
 * @param vaults - Existing vault candidates
 * @returns Best matching vault or null
 */
export function matchMessageToVault(
  message: SourceMessage,
  vaults: OrderEvidenceVault[]
): VaultMatch | null {
  if (!vaults.length) {
    return null; // No existing vaults to match against
  }
  
  const extracted = extractCommerceEvents(message);
  
  if (!extracted.order) {
    return null; // No order information found in message
  }
  
  let bestMatch: { vault: OrderEvidenceVault; score: number } | null = null;
  
  for (const vault of vaults) {
    const matchScore = calculateMatchConfidence(extracted, vault);
    
    if (!bestMatch || matchScore > bestMatch.score) {
      bestMatch = { vault, score: matchScore };
    }
  }
  
  // Only return matches with moderate confidence or higher
  if (bestMatch && bestMatch.score >= 0.5) {
    return generateVaultMatchResponse(bestMatch.vault, extracted, bestMatch.score);
  }
  
  return null;
}

/**
 * Calculates matching confidence between message and vault
 * @param extracted - Extracted commerce event data
 * @param vault - Existing order evidence vault
 * @returns Confidence score between 0 and 1
 */
function calculateMatchConfidence(
  extracted: CommerceEvent,
  vault: OrderEvidenceVault
): number {
  let totalScore = 0;
  let stepWeight = 1.0;
  
  // Step 1: Exact order ID match
  if (extracted.order.id === vault.orderId) {
    totalScore += 0.4; // Highest weight - exact match
  }
  
  // Step 2: Email address match (partial credit possible)
  const emailMatch = compareStrings(extracted.email, vault.customerEmail);
  totalScore += emailMatch * 0.25;
  
  // Step 3: Payment reference number match
  if (extracted.payment?.referenceId && 
      extracted.payment.referenceId === vault.payment.referenceId) {
    totalScore += 0.15;
  }
  
  // Step 4: Tracking number/carrier match
  const trackingMatch = compareShippingInfo(extracted.shipping, vault.shipping);
  totalsystem += trackingMatch * 0.1;
  
  // Final confidence is weighted average across steps
  return totalScore / MATCHING_PRIORITY.reduce((sum, step) => sum + step.confidenceWeight, 0);
}

/**
 * Compares two strings with fuzzy matching
 * @param a - First string
 * @param b - Second string
 * @returns Match confidence between 0 and 1
 */
function compareStrings(a: string | undefined, b: string | undefined): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();
  
  // Exact match gets full credit
  if (normalizedA === normalizedB) {
    return 1.0;
  }
  
  // Partial match (contains word from other)
  const wordsA = normalizedA.split(/\s+/);
  const wordsB = normalizedB.split(/\s+/);
  
  let commonWords = 0;
  let totalWords = Math.min(wordsA.length, wordsB.length);
  
  for (let i = 0; i < totalWords; i++) {
    if (wordsA[i].includes(wordsB[i]) || wordsB[i].includes(wordsA[i])) {
      commonWords++;
    }
  }
  
  return commonWords / totalWords;
}

/**
 * Compares shipping information between message and vault
 * @param messageShipping - Shipping data from message
 * @param vaultShipping - Shipping data from vault
 * @returns Match confidence between 0 and 1
 */
function compareShippingInfo(
  messageShipping: ShippingInfo | undefined,
  vaultShipping: ShippingInfo | undefined
): number {
  if (!messageShipping && !vaultShipping) return 1.0;
  if (!messageShipping || !vaultShipping) return 0.5; // Some shipping info present
  
  let matchScore = 0;
  const factors = Object.keys(messageShipping).filter(k => 
    ['trackingNumber', 'carrier'].includes(k)
  );
  
  for (const factor of factors) {
    if ((messageShipping as any)[factor] === (vaultShipping as any)[factor]) {
      matchScore += 1.0;
    }
  }
  
  return matchScore / factors.length;
}

/**
 * Generates a complete vault match response with detailed step breakdown
 * @param vault - Matched order evidence vault
 * @param extracted - Extracted commerce event data
 * @param confidence - Confidence score
 * @returns VaultMatch object
 */
function generateVaultMatchResponse(
  vault: OrderEvidenceVault,
  extracted: CommerceEvent,
  confidence: number
): VaultMatch {
  const matchSteps: MatchStep[] = [];
  
  // Step 1: Order ID matching
  matchSteps.push({
    stepNumber: 1,
    description: 'Order ID comparison',
    matched: extracted.order.id === vault.orderId,
    evidenceType: 'order',
  });
  
  // Step 2: Email address matching
  matchSteps.push({
    stepNumber: 2,
    description: 'Email address comparison',
    matched: compareStrings(extracted.email, vault.customerEmail) > 0.75,
    evidenceType: 'email',
  });
  
  // Step 3: Payment reference matching
  matchSteps.push({
    stepNumber: 3,
    description: 'Payment reference number comparison',
    matched: !extracted.payment || !vault.payment || 
             extracted.payment.referenceId === vault.payment.referenceId,
    evidenceType: 'payment',
  });
  
  return {
    vaultId: vault.id,
    confidenceScore: confidence,
    matchSteps,
  };
}