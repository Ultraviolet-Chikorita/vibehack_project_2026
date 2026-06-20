// src/lib/filtering.ts
/**
 * Email filtering/classification — identifies commerce emails
 * 
 * Uses regex patterns to classify emails as order confirmations, shipment
 * notifications, dispute communications, or other. Tolerates real email
 * variation including common redactions and formatting differences.
 */

export interface EmailClassification {
  isCommerce: boolean;
  confidence: number;
  category: 'order' | 'shipment' | 'dispute' | 'invoice' | 'other';
}

const COMMERCE_KEYWORDS = [
  // Order confirmation keywords
  '\\b(order|purchase|buy|transaction)\\b',
  '\\b(confIRMATION|confirmed|confirmation)\\b',
  '\\b(thank you|thanks)\\b',
  
  // Shipment keywords
  '\\b(ship|shipping|delivery)\\b',
  '\\b(tracking|package|tracking #)\\b',
  '\\b(arrive|arrived|delivered)\\b',
  
  // Dispute keywords
  '\\b(dispute|complaint|issue|problem)\\b',
  '\\b(claim|claims|refund)\\b',
  '\\b(strike|struck|cancelled)\\b',
  
  // Invoice keywords
  '\\b(invoice|bill|receipt|charge)\\b',
  '\\b(amount|total|price|cost)\\b',
];

/**
 * Classifies an email as commerce-related or not
 * @param text - Email body text
 * @returns Classification result
 */
export function classifyEmail(text: string): EmailClassification {
  let commerceScore = 0;
  let keywordMatches = 0;
  
  // Check for commerce keywords
  for (const pattern of COMMERCE_KEYWORDS) {
    if (new RegExp(pattern, 'i').test(text)) {
      keywordMatches++;
    }
  }
  
  // Scoring: each keyword is worth 1 point, we need at least 3 to consider
  if (keywordMatches >= 3) {
    commerceScore = Math.min(keywordMatches * 20, 100);
  }
  
  // Look for order confirmation patterns (strong indicator)
  const orderConfirmationPatterns = [
    /\border\s+#?\s*\w+/i,
    /received\s+your\s+order/i,
    /thank\s+you\s+for\s+purchasing/i,
    /your\s+order\s+is\s+processing/i,
  ];
  
  for (const pattern of orderConfirmationPatterns) {
    if (pattern.test(text)) {
      commerceScore = Math.min(commerceScore + 30, 100);
      break; // Strong match found
    }
  }
  
  // Adjust score based on content length (short emails less likely to be commerce)
  const textLengthWeight = Math.max(0, Math.min(text.length, 500)) / 500;
  commerceScore = commerceScore * textLengthWeight;
  
  // Determine confidence and category
  const confidence = commerceScore / 100;
  const isCommerce = confidence > 0.25;
  
  if (!isCommerce) {
    return { isCommerce: false, confidence: confidence, category: 'other' };
  }
  
  // Category determination based on strongest patterns
  const categoryPatterns: Record<string, RegExp[]> = {
    order: [
      /\border\s+#?\s*\w+/i,
      /received\s+your\s+order/i,
      /thank\s+you\s+for\s+purchasing/i,
    ],
    shipment: [
      /\btracking\s+#?\s*\w+/i,
      /package\s+delivered/i,
      /ship\s+date/i,
      /courier/i,
    ],
    dispute: [
      /\bdispute\s+received/i,
      /complaint\s+submitted/i,
      /issue\s+report/i,
      /claim\s+made/i,
    ],
    invoice: [
      /\binvoice\s+#?\s*\w+/i,
      /payment\s+due/i,
      /amount\s+owed/i,
      /receipt/i,
    ]
  };
  
  let categoryScore = {
    order: 0,
    shipment: 0,
    dispute: 0,
    invoice: 0,
  };
  
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
      categoryScore[category as keyof typeof categoryScore]++;
    }
    }
  }
  
  // Find highest scoring category
  const maxCategory = Object.keys(categoryScore).reduce((a, b) => 
    categoryScore[a as keyof typeof categoryScore] > categoryScore[b as keyof typeof categoryScore] ? a : b
  );
  
  return {
    isCommerce: true,
    confidence: confidence,
    category: maxCategory as 'order' | 'shipment' | 'dispute' | 'invoice',
  };
}