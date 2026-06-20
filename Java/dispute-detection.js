// src/lib/dispute-detection.ts
/**
 * Dispute signal detection — identifies disputed or at-risk orders
 * 
 * Detects from messages: payment disputes, chargebacks, refund requests,
 * missing/damaged items, not-as-described complaints, duplicate charges,
 * repeat claimants, and unclear cases.
 */

export interface DisputeSignal {
  id: string;
  orderId: string;
  type: 'payment_dispute' | 'chargeback' | 'refund_request' |
         'missing_item' | 'damaged_item' | 'not_as_described' |
         'duplicate_charge' | 'repeat_claimant' | 'unclear';
  reason: string;
  disputedAmount: number;
  currency: string;
  deadline?: Date;
  processor: string;
  createdAt: Date;
}

const DISPUTE_KEYWORDS: Record<string, RegExp[]> = {
  'payment_dispute': [
    /\b(dispute|disputes|contested|challenged)\b/,
    /\b(stripe|microsoft pay|paypal|afterpay)\s+dispute\b/i,
    /\b(request for|requesting)\s+(refund|reversal)/i,
  ],
  'chargeback': [
    /\b(chargeback|chargebacks)\b/,
    /\b(cardholder\s+dispute)/i,
    /\b(network\s+dispute)/i,
  ],
  'refund_request': [
    /\b(request for|requested)\s+(full|partial)\s+refund\b/i,
    /\b(would like|want)\s+to\s+request\s+a\s+refund\b/i,
    /\b(cancel|cancelled|cancellation)\s+order\s+for\s+refund/i,
  ],
  'missing_item': [
    /\b(missing|lost|no|not\s+received)\s+(item|product|goods)/i,
    /\b(didn't\s+receive|did not receive)\s+\w+\s+item/i,
    /\b(expect|expected)\s+to\s+get\s+but\s+didn't\b/i,
  ],
  'damaged_item': [
    /\b(damaged|broken|rusted|cracked|spoiled)/i,
    /\b(arrived\s+(in|as)\s+(bad|poor)\s+condition)/i,
    /\b(product\s+not\s+fit\s+for\s+purpose)/i,
  ],
  'not_as_described': [
    /\b(not as described|description不符)/i,
    /\b(wrong|incorrect)\s+(product|item|version)/i,
    /\b(specs not met|specification mismatch)/i,
  ],
  'duplicate_charge': [
    /\b(duplicate|double)\s+charge/i,
    /\b(charge\s+twice|charged twice)/i,
    /\b(unauthorized|unapproved)\s+transaction/i,
  ],
  'repeat_claimant': [
    /\b(previous\s+dispute|previously disputed)/i,
    /\b(history of\s+(disputes|claims))/i,
    /\b(repeat|multiple)\s+(claimant|claimer)/i,
  ],
};

/**
 * Detects dispute signals in a message
 * @param message - Message to analyze
 * @returns Dispute signal or null
 */
export function detectDisputeSignal(message: SourceMessage): DisputeSignal | null {
  // Extract potential order identifiers from message
  const extracted = extractCommerceEvents(message);
  
  if (!extracted || !extracted.order) {
    return null; // No order context - can't determine dispute
  }

  // Check for any dispute keywords
  let detectedType: keyof typeof DISPUTE_KEYWORDS | null = null;
  let confidence = 0;
  
  for (const [type, patterns] of Object.entries(DISPUTE_KEYWORDS)) {
    let typeConfidence = 0;
    
    for (const pattern of patterns) {
      if (pattern.test(message.text)) {
        typeConfidence += 1;
      }
    }
    
    if (typeConfidence > confidence) {
      detectedType = type as keyof typeof DISPUTE_KEYWORDS;
      confidence = typeConfsystem
    }
  }

  if (!detectedType || confidence < 0.5) {
    return null; // Not confident enough
  }

  // Parse disputed amount and currency from message
  const amountMatch = message.text.match(/\$(\d+[\.\d]*)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : extracted.order.total || 0;
  const currency = amountMatch ? 'USD' : extracted.order.currency || 'USD';
  
  // Determine deadline (if mentioned)
  let deadline: Date | undefined;
  const dateMatches = message.text.match(/\b(?:due|by)\s+(\w+\s+\d+|\d+\s+\w+)\b/i);
  if (dateMatches && dateMatches[1]) {
    try {
      deadline = new Date(dateMatches[1]);
    } catch {
      // Invalid date format - ignore
    }
  }

  return {
    id: `signal:${Date.now()}:${extracted.order.id}`,
    orderId: extracted.order.id,
    type: detectedType,
    reason: message.text.split('.')[0].trim(),
    disputedAmount: amount,
    currency,
    deadline,
    processor: extracted.payment?.processor || 'unknown',
    createdAt: new Date(),
  };
}

/**
 * Links a dispute signal to an existing order vault
 * @param signal - Detected dispute signal
 * @param vaults - Existing vault candidates
 * @returns Linked vault or null
 */
export function linkSignalToVault(signal: DisputeSignal, vaults: OrderEvidenceVault[]): void {
  const matchingVault = vaults.find(v => v.orderId === signal.orderId);
  
  if (matchingVault) {
    // Update vault with new signal
    matchingVault.signals.push(signal);
    
    // If status is 'dispute_ready', auto-generate evidence pack
    if (matchingVault.status === 'dispute_ready') {
      generateEvidencePack(matchingVault, signal);
    }
    
    return;
  }
  
  // No existing vault - queue for review
  queueForReview(signal, vaults);
}