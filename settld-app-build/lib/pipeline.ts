import { classifyEmail, type EmailClassification } from './filtering'
import { extractCommerceEvent } from './extraction'
import { matchMessageToVault } from './vaultMatching'
import { calculateScore, type ScoreResult } from './scoring'
import { detectDisputeSignal, type DisputeSignal } from './dispute-detection'
import {
  applyCodeplainRules,
  deriveRecommendation,
  type RuleResult,
} from './rules-engine'
import type { OrderSummary, OrderVault, SourceMessage } from './types'

export interface VaultAnalysis {
  score: ScoreResult
  rules: RuleResult[]
  recommendation: { action: 'contest' | 'refund' | 'review'; confidence: number }
  hasSignal: boolean
}

// Runs the scoring + rules pipeline against a single (already-built) vault.
export function analyzeVault(vault: OrderVault): VaultAnalysis {
  const score = calculateScore(vault)
  const hasSignal = vault.disputeStatus !== 'none'
  const rules = applyCodeplainRules(score.score, score.missing, hasSignal)
  const recommendation = deriveRecommendation(rules)
  return { score, rules, recommendation, hasSignal }
}

export interface ProcessedMessage {
  messageId: string
  subject: string
  classification: EmailClassification
  matchedVaultId: string | null
  matchConfidence: number
  disputeSignal: DisputeSignal | null
}

export interface ProcessResult {
  merchantId: string
  scanned: number
  relevant: number
  processed: ProcessedMessage[]
  signals: DisputeSignal[]
}

// Maps a vault to a dashboard row using the scoring + rules engine.
export function buildOrderSummary(vault: OrderVault, merchant: string): OrderSummary {
  const { score, recommendation } = analyzeVault(vault)
  let status: OrderSummary['status']
  if (vault.disputeStatus === 'disputed') status = 'disputed'
  else if (vault.disputeStatus === 'signal') status = 'signal'
  else if (score.score >= 80) status = 'ready'
  else status = 'incomplete'

  return {
    id: vault.orderId,
    orderNumber: vault.orderId,
    merchant,
    customerName: vault.customer,
    customerEmail: vault.customerEmail,
    amount: vault.amount,
    currency: vault.currency,
    status,
    winScore: score.score,
    recommendation: recommendation.action,
    updatedAt: vault.latestEventAt,
  }
}

export function buildOrderSummaries(vaults: OrderVault[], merchant: string): OrderSummary[] {
  return vaults
    .map((v) => buildOrderSummary(v, merchant))
    .sort((a, b) => {
      const rank = (s: OrderSummary['status']) =>
        s === 'disputed' ? 0 : s === 'signal' ? 1 : s === 'incomplete' ? 2 : 3
      const r = rank(a.status) - rank(b.status)
      return r !== 0 ? r : b.amount - a.amount
    })
}

// Full read pipeline: filter → extract → match → detect signal.
// Mirrors the spec pipeline used by the "Run scan" action.
export function runPipeline(
  merchantId: string,
  messages: SourceMessage[],
  vaults: OrderVault[],
): ProcessResult {
  const vaultIndex = vaults.map((v) => ({
    id: v.id,
    orderId: v.orderId,
    customerEmail: v.customerEmail,
    trackingNumber: v.trackingNumber,
    amount: v.amount,
  }))

  const processed: ProcessedMessage[] = []
  const signals: DisputeSignal[] = []
  let relevant = 0

  for (const msg of messages) {
    const text = `${msg.subject}\n${msg.body}`
    const classification = classifyEmail(text)
    if (classification.isCommerce) relevant += 1

    const extracted = extractCommerceEvent(text)
    const match = matchMessageToVault(extracted, vaultIndex)

    const signal = detectDisputeSignal(
      text,
      extracted.orderId || match?.vaultId || 'unknown',
      extracted.amount,
      extracted.currency,
    )
    if (signal) signals.push(signal)

    processed.push({
      messageId: msg.id,
      subject: msg.subject,
      classification,
      matchedVaultId: match?.vaultId ?? null,
      matchConfidence: match?.confidence ?? 0,
      disputeSignal: signal,
    })
  }

  return {
    merchantId,
    scanned: messages.length,
    relevant,
    processed,
    signals,
  }
}
