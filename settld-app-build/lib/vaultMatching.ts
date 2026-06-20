// Evidence vault matching — links incoming messages to existing vaults
// 7-step priority chain with confidence scoring (spec §11.2)

export interface VaultMatch {
  vaultId: string
  confidence: number
  evidenceType: 'exact' | 'partial' | 'tracking' | 'content'
  matchedOn: string[]
}

export function matchMessageToVault(
  extracted: { orderId: string; email: string; trackingNumber: string | null; amount: number },
  vaults: Array<{
    id: string
    orderId: string
    customerEmail: string
    trackingNumber?: string
    amount: number
  }>,
): VaultMatch | null {
  if (!vaults.length) return null

  let best: { vault: (typeof vaults)[0]; score: number; matchedOn: string[] } | null = null

  for (const vault of vaults) {
    let score = 0
    const matchedOn: string[] = []

    if (extracted.orderId && extracted.orderId === vault.orderId) {
      score += 0.8
      matchedOn.push('order_id')
    }
    if (extracted.email && extracted.email === vault.customerEmail) {
      score += 0.25
      matchedOn.push('email')
    }
    if (extracted.trackingNumber && extracted.trackingNumber === vault.trackingNumber) {
      score += 0.7
      matchedOn.push('tracking_number')
    }
    if (extracted.amount && Math.abs(extracted.amount - vault.amount) < 1) {
      score += 0.15
      matchedOn.push('amount')
    }

    if (!best || score > best.score) best = { vault, score, matchedOn }
  }

  if (!best || best.score < 0.5) return null

  return {
    vaultId: best.vault.id,
    confidence: Math.min(best.score, 1),
    evidenceType: best.score > 0.85 ? 'exact' : best.score > 0.6 ? 'partial' : 'tracking',
    matchedOn: best.matchedOn,
  }
}
