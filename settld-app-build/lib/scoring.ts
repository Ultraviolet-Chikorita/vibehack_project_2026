// Evidence scoring — calculates dispute-readiness score
// 10 weighted dimensions from spec §13

export interface ScoreResult {
  score: number
  status:
    | 'dispute_ready'
    | 'mostly_ready'
    | 'missing_delivery_proof'
    | 'missing_policy_snapshot'
    | 'missing_product_snapshot'
    | 'needs_review'
    | 'weak_evidence'
  missing: string[]
  weak: string[]
  strongest: string[]
  dimensions: Record<string, number>
}

export const scoringWeights = [
  { id: 'order', weight: 0.25, label: 'Order Proof' },
  { id: 'payment', weight: 0.2, label: 'Payment Proof' },
  { id: 'product', weight: 0.15, label: 'Product Proof' },
  { id: 'policy', weight: 0.1, label: 'Policy Proof' },
  { id: 'fulfilment', weight: 0.1, label: 'Fulfilment Proof' },
  { id: 'delivery', weight: 0.1, label: 'Delivery Proof' },
  { id: 'address', weight: 0.03, label: 'Address Match' },
  { id: 'communication', weight: 0.03, label: 'Communication History' },
  { id: 'refund', weight: 0.02, label: 'Refund History' },
  { id: 'conflict', weight: 0.02, label: 'Conflict Detection' },
]

export function calculateScore(vault: any): ScoreResult {
  const scoresByDimension: Record<string, number> = {}
  const missing: string[] = []
  const weak: string[] = []
  let totalScore = 0

  for (const dim of scoringWeights) {
    const evidenceItems = (vault.evidence ?? []).filter((e: any) => e.category === dim.id)
    if (evidenceItems.length === 0) {
      missing.push(dim.label)
      scoresByDimension[dim.id] = 0
    } else {
      const dimScore =
        evidenceItems.reduce((sum: number, e: any) => sum + (e.relevance ?? 0.5), 0) /
        evidenceItems.length
      scoresByDimension[dim.id] = dimScore
      if (dimScore < 0.5) weak.push(dim.label)
    }
    totalScore += scoresByDimension[dim.id] * dim.weight
  }

  let status: ScoreResult['status'] = 'dispute_ready'
  if (missing.includes('Delivery Proof')) status = 'missing_delivery_proof'
  else if (missing.includes('Policy Proof')) status = 'missing_policy_snapshot'
  else if (missing.includes('Product Proof')) status = 'missing_product_snapshot'
  else if (missing.length > 0) status = 'needs_review'
  else if (totalScore < 0.5) status = 'weak_evidence'

  return {
    score: Math.round(totalScore * 100),
    status,
    missing: missing.map((m) => m.replace(' Proof', '')),
    weak: weak.map((w) => w.replace(' Proof', '')),
    strongest: Object.entries(scoresByDimension)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => scoringWeights.find((d) => d.id === key)?.label ?? key),
    dimensions: scoresByDimension,
  }
}
