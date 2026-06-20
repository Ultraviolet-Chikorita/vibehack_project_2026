// Structured event extraction — pulls commerce data from emails

export interface CommerceEvent {
  orderId: string
  email: string
  amount: number
  currency: string
  trackingNumber: string | null
  carrier: string | null
  disputeReason: string | null
  deadline: Date | null
  processor: string | null
}

export function extractCommerceEvent(text: string): CommerceEvent {
  // Order ID
  const orderIdMatch = text.match(/\b(order\s+id|order\s+#)\s*[:\-]?\s*(\w+)/i)
  // Email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  // Amount
  const amountMatches = text.match(/[£$](\d+(?:\.\d{1,2})?)/g)
  const amountValue = amountMatches ? parseFloat(amountMatches[0].replace(/[£$]/, '')) : 0
  // Tracking
  const trackingMatch = text.match(/\b(tracking\s+number|tracking\s+#)\s*[:\-]?\s*(\w{6,20})/i)

  return {
    orderId: orderIdMatch?.[2] ?? '',
    email: emailMatch?.[1] ?? '',
    amount: isNaN(amountValue) ? 0 : amountValue,
    currency: inferCurrency(text),
    trackingNumber: trackingMatch?.[2] ?? null,
    carrier: null,
    disputeReason: null,
    deadline: null,
    processor: null,
  }
}

export function inferCurrency(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('gbp') || lower.includes('£')) return 'GBP'
  if (lower.includes('eur') || lower.includes('€')) return 'EUR'
  if (lower.includes('cad')) return 'CAD'
  if (lower.includes('aud')) return 'AUD'
  return 'USD'
}
