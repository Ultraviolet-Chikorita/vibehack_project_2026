// Dispute signal detection — identifies disputed or at-risk orders

export type DisputeSignalType =
  | 'payment_dispute'
  | 'chargeback'
  | 'refund_request'
  | 'missing_item'
  | 'damaged_item'
  | 'not_as_described'
  | 'duplicate_charge'
  | 'repeat_claimant'
  | 'unclear'

export interface DisputeSignal {
  id: string
  orderId: string
  signalType: DisputeSignalType
  reason?: string
  disputedAmount?: number
  currency?: string
  deadline?: Date
  timestamp: Date
  confidence: number
}

const DISPUTE_KEYWORDS: Record<string, RegExp[]> = {
  payment_dispute: [/\b(dispute|disputes|contested|challenged)\b/, /\bstripe\s+dispute\b/i],
  chargeback: [/\b(chargeback|chargebacks)\b/, /\bcardholder\s+dispute/i],
  refund_request: [/\brequest\s+(full|partial)\s+refund\b/i, /\bwould like\s+a\s+refund\b/i],
  missing_item: [/\b(missing|not\s+received)\s+(item|product)/i, /\bdid not receive\b/i],
  damaged_item: [/\b(damaged|broken|cracked)/i, /\barrived\s+in\s+bad\s+condition/i],
  not_as_described: [/\bnot as described\b/i, /\bwrong\s+(product|item)\b/i],
  duplicate_charge: [/\b(duplicate|double)\s+charge\b/i, /\bcharged twice\b/i],
  repeat_claimant: [/\bprevious\s+dispute\b/i, /\brepeat\s+claimant\b/i],
}

export function detectDisputeSignal(
  text: string,
  orderId: string,
  amount: number,
  currency: string,
): DisputeSignal | null {
  let detectedType: string | null = null
  let bestScore = 0

  for (const [type, patterns] of Object.entries(DISPUTE_KEYWORDS)) {
    const score = patterns.filter((p) => p.test(text)).length
    if (score > bestScore) {
      bestScore = score
      detectedType = type
    }
  }

  if (!detectedType || bestScore === 0) return null

  return {
    id: `sig_${Date.now()}_${orderId}`,
    orderId,
    signalType: detectedType as DisputeSignalType,
    reason: text.split('.')[0].trim(),
    disputedAmount: amount,
    currency,
    timestamp: new Date(),
    confidence: Math.min(bestScore / 3, 1),
  }
}
