// Email filtering/classification — identifies commerce emails
// Uses regex patterns to classify emails as order confirmations, shipment
// notifications, dispute communications, or other.

export interface EmailClassification {
  isCommerce: boolean
  confidence: number
  category: 'order' | 'shipment' | 'dispute' | 'invoice' | 'other'
}

const COMMERCE_KEYWORDS = [
  '\\b(order|purchase|buy|transaction)\\b',
  '\\b(confirmation|confirmed|confirmation)\\b',
  '\\b(thank you|thanks)\\b',
  '\\b(ship|shipping|delivery)\\b',
  '\\b(tracking|package|tracking #)\\b',
  '\\b(arrive|arrived|delivered)\\b',
  '\\b(dispute|complaint|issue|problem)\\b',
  '\\b(claim|claims|refund)\\b',
  '\\b(invoice|bill|receipt|charge)\\b',
  '\\b(amount|total|price|cost)\\b',
]

export function classifyEmail(text: string): EmailClassification {
  let commerceScore = 0
  let keywordMatches = 0
  for (const pattern of COMMERCE_KEYWORDS) {
    if (new RegExp(pattern, 'i').test(text)) keywordMatches++
  }
  if (keywordMatches >= 3) commerceScore = Math.min(keywordMatches * 20, 100)
  const orderConfirmationPatterns = [
    /\border\s+#?\s*\w+/i,
    /received\s+your\s+order/i,
    /thank\s+you\s+for\s+purchasing/i,
    /your\s+order\s+is\s+processing/i,
  ]
  for (const pattern of orderConfirmationPatterns) {
    if (pattern.test(text)) {
      commerceScore = Math.min(commerceScore + 30, 100)
      break
    }
  }
  const textLengthWeight = Math.max(0, Math.min(text.length, 500)) / 500
  commerceScore = commerceScore * textLengthWeight
  const confidence = commerceScore / 100
  const isCommerce = confidence > 0.25
  if (!isCommerce) return { isCommerce: false, confidence, category: 'other' }
  const categoryPatterns: Record<string, RegExp[]> = {
    order: [/\border\s+#?\s*\w+/i, /received\s+your\s+order/i, /thank\s+you\s+for\s+purchasing/i],
    shipment: [/\btracking\s+#?\s*\w+/i, /package\s+delivered/i, /ship\s+date/i, /courier/i],
    dispute: [/\bdispute\s+received/i, /complaint\s+submitted/i, /issue\s+report/i, /claim\s+made/i],
    invoice: [/\binvoice\s+#?\s*\w+/i, /payment\s+due/i, /amount\s+owed/i, /receipt/i],
  }
  const categoryScore: Record<string, number> = { order: 0, shipment: 0, dispute: 0, invoice: 0 }
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) categoryScore[category]++
    }
  }
  const maxCategory = Object.keys(categoryScore).reduce((a, b) =>
    categoryScore[a] > categoryScore[b] ? a : b,
  )
  return { isCommerce: true, confidence, category: maxCategory as EmailClassification['category'] }
}
