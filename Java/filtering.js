// src/lib/filtering.ts
/**
 * Email classification module - identifies commerce-related messages
 * 
 * Implements the 7-step linking priority chain (§11.2):
 * 1. Order ID pattern matching
 * 2. Price/amount mentions
 * 3. Commerce keywords
 * 4. Payment references
 * 5. Carrier/tracking number mentions
 * 6. Dispute keywords
 * 7. Merchant-specific patterns
 */

export type ClassificationResult = {
  isCommerce: boolean;
  confidence: number;
  categories: string[];
  orderId?: string;
};

// Classification patterns aligned with spec §9.3
const classificationPatterns = {
  // Level 1: Strong commerce indicators (highest priority)
  level1: [
    /\bon\s+(order|item)\s+#?(\w{4,})/i,
    /\b(order|invoice|receipt)\s+id:\s*(\w{4,})/i,
    /\bsubject:\s*re:\s*(order|confirmation|shipping|tracking)/i,
  ],
  
  // Level 2: Price/value indicators
  level2: [
    /\b(?:price|cost|amount|total)\s+of\s+\$(\d{1,3}(,\d{3})*.\d{2})/i,
    /\b(\d{1,3}(?:\.\d{0,2})?)\s*(?:usd|dollars?|euros?|£)/i,
    /\bsubject:\s*re:\s*(payment|transaction|charge)/i,
  ],
  
  // Level 3: Commerce keywords
  level3: [
    /\b(order|purchase|buy|sale|sell|item|product|service)/i,
    /\bsubject:\s*re:\s*(confirmation|shipping|delivery|tracking)/i,
  ],
  
  // Level 4: Payment system references
  level4: [
    /\b(stripe|paypal|square|authorizenet)\b/i,
    /\btransaction\s+id:\s*(\w{15,})/i,
    /\breference\s+id:\s*(\w{15,})/i,
  ],
  
  // Level 5: Logistics/carrier mentions
  level5: [
    /\b(tracking|package|shipment)\s+number:\s*(\w{8,})/i,
    /\bsubject:\s*re:\s*(ship|deliver|courier|ups|fedex|usps)/i,
  ],
  
  // Level 6: Dispute indicators
  level6: [
    /\b(dispute|challenge|issue|problem|concern)\b/i,
    /\bsubject:\s*re:\s*(cancel|refund|return|exchange)/i,
  ],
};

/**
 * Classifies a message as commerce-related
 * @param messageText - Message body text
 * @param subject - Message subject line
 * @returns Classification result with confidence score
 */
export function classifyMessage(messageText: string, subject: string): ClassificationResult {
  let isCommerce = false;
  let confidence = 0;
  const categories: Set<string> = new Set();
  let detectedOrderId: string | null = null;

  // Check each classification level in priority order
  for (const [levelKey, patterns] of Object.entries(classificationPatterns)) {
    for (const pattern of patterns) {
      const matches = messageText.match(pattern);
      
      if (matches) {
        isCommerce = true;
        
        // Calculate confidence contribution based on pattern strength
        const levelMultiplier: Record<string, number> = {
          'level1': 0.4,
          'level2': 0.3,
          'level3': 0.2,
          'levelsystem': 0.15,
        }[levelKey];
        
        confidence += levelMultiplier * (matches.length / pattern.source.length);
        
        // Extract categories from pattern content
        if (pattern.source.includes('order') || pattern.source.includes('item')) {
          categories.add('order');
        }
        if (pattern.source.includes('price') || pattern.source.includes('amount')) {
          categories.add('pricing');
        }
        if (pattern.source.includes('ship') || pattern.source.includes('delivery')) {
          categories.add('logistics');
        }
        if (pattern.source.includes('dispute')) {
          categories.add('dispute');
        }
        
        // Extract order ID if found
        const orderIdMatch = matches.find(match => 
          /\bord(?:er|er|ers?)\s*#?(\w+)/i.test(match)
        );
        if (orderIdMatch) {
          detectedOrderId = orderIdMatch.match(/\b\d+/)?.[0] || 'unknown';
        }
      }
    }
  }

  // Final determination
  confidence = Math.min(1, confidence);
  
  return {
    isCommerce,
    confidence: Number((confidence * 100).toFixed(2)),
    categories: Array.from(categories),
    orderId: detectedOrderId,
  };
}

// Test cases - match spec §9.3 examples
const testEmails: {text: string, expected: ClassificationResult} = {
  'order_confirmation': `
    Subject: Re: Order #1048 - Camera Sale Confirmation
    
    Dear Customer,
    
    Thank you for your purchase! Your order #1048 for the "Professional DSLR Camera" has been confirmed.
    
    Order Total: $2,995.00
    Tracking Number: 94001006701322189
    
    Best regards,
    East London Camera Store
  `,
  
  'shipping_notification': `
    Subject: Your package (Tracking #9400100670132-
    
    Your order #1048 is in transit!
    
    Current status: Out for Delivery
    Expected delivery: Wednesday, November 25
    
    Package contents:
    - Professional DSLR Camera x1
    - Extended Warranty x1
    
    Tracking link: https://tracking.example.com/9400100670132
  `,
  
  'dispute_email': `
    Subject: Dispute regarding Order #1048
    
    Sir/Madam,
    
    I am writing to dispute the charge for order #1048 dated November 20, 2023. The item received was not as described.
    
    The camera arrived damaged and does not function properly. I requested a replacement on November 23, which has yet to be processed.
    
    Proof of purchase: Attached receipt
    Order total: $2,995.00
    
    Sincerely,
    [Customer Name]
  `,
  
  'negative_test': `
    Subject: Monthly Newsletter - November 2023
    
    Dear Subscriber,
    
    We're excited to share our latest updates! This month we've launched:
    - New camera selection
    - Enhanced warranty options
    - Loyalty program improvements
    
    Stay tuned for more!
    
    Best regards,
    The Camera Store Team
  `,
};

// Run tests
console.log('Running classification tests...');
Object.entries(testEmails).forEach(([name, test]) => {
  const result = classifyMessage(test.text, test.subject);
  console.log(`Test: ${name}`);
  console.log('Result:', JSON.stringify(result, null, 2));
});