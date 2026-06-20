// Codeplain Rules — inspectable dispute-readiness rules engine
// This is the codeplain track centrepiece: rules are visible to judges

export interface Rule {
  id: string
  description: string
  severity: 'info' | 'warning' | 'error'
  ruleType:
    | 'dispute_ready'
    | 'recommend_contest'
    | 'needs_human_review'
    | 'recommend_refund'
    | 'auto_generate_pack_if'
}

export interface RuleResult {
  rule: Rule
  fired: boolean
  reason: string
}

export const CODEPLAIN_RULES: Rule[] = [
  {
    id: 'order_has_full_evidence',
    description: 'Order has complete evidence package — auto-approve for contest',
    severity: 'info',
    ruleType: 'dispute_ready',
  },
  {
    id: 'payment_confirmed_with_receipt',
    description: 'Payment confirmed with receipt evidence',
    severity: 'info',
    ruleType: 'dispute_ready',
  },
  {
    id: 'strong_evidence_with_signal',
    description: 'Strong evidence (score ≥ 75) and dispute signal detected',
    severity: 'warning',
    ruleType: 'recommend_contest',
  },
  {
    id: 'delivery_proof_present',
    description: 'Delivery proof captured before dispute — recommend contest',
    severity: 'warning',
    ruleType: 'recommend_contest',
  },
  {
    id: 'score_between_50_and_74',
    description: 'Score 50–74: uncertain evidence strength — flag for human review',
    severity: 'warning',
    ruleType: 'needs_human_review',
  },
  {
    id: 'missing_critical_evidence',
    description: 'Critical evidence dimensions missing and score ≤ 85',
    severity: 'error',
    ruleType: 'needs_human_review',
  },
  {
    id: 'weak_evidence_high_risk',
    description: 'Weak evidence (score ≤ 50) — recommend refund',
    severity: 'error',
    ruleType: 'recommend_refund',
  },
  {
    id: 'auto_generate_if_score_gt_90',
    description: 'Auto-generate pack when evidence score ≥ 90',
    severity: 'info',
    ruleType: 'auto_generate_pack_if',
  },
]

export function applyCodeplainRules(
  score: number,
  missing: string[],
  hasSignal: boolean,
): RuleResult[] {
  return CODEPLAIN_RULES.map((rule) => {
    let fired = false
    let reason = ''
    switch (rule.id) {
      case 'order_has_full_evidence':
        fired = score >= 90 && missing.length === 0
        reason = `Score ${score}, no missing evidence`
        break
      case 'payment_confirmed_with_receipt':
        fired = !missing.includes('Payment')
        reason = 'Payment proof present'
        break
      case 'strong_evidence_with_signal':
        fired = score >= 75 && hasSignal
        reason = `Score ${score} ≥ 75 and signal detected`
        break
      case 'delivery_proof_present':
        fired = !missing.includes('Delivery')
        reason = 'Delivery proof captured'
        break
      case 'score_between_50_and_74':
        fired = score >= 50 && score < 75
        reason = `Score ${score} in uncertain range`
        break
      case 'missing_critical_evidence':
        fired = missing.length > 0 && score <= 85
        reason = `Missing: ${missing.join(', ')}`
        break
      case 'weak_evidence_high_risk':
        fired = score <= 50
        reason = `Score ${score} too weak to contest`
        break
      case 'auto_generate_if_score_gt_90':
        fired = score >= 90
        reason = `Score ${score} exceeds auto-generate threshold`
        break
    }
    return { rule, fired, reason }
  })
}

export function deriveRecommendation(ruleResults: RuleResult[]): {
  action: 'contest' | 'refund' | 'review'
  confidence: number
} {
  const fired = ruleResults.filter((r) => r.fired).map((r) => r.rule.ruleType)
  if (fired.includes('recommend_refund')) return { action: 'refund', confidence: 0.85 }
  if (fired.includes('needs_human_review')) return { action: 'review', confidence: 0.6 }
  if (fired.includes('recommend_contest')) return { action: 'contest', confidence: 0.82 }
  if (fired.includes('dispute_ready')) return { action: 'contest', confidence: 0.92 }
  return { action: 'review', confidence: 0.5 }
}
