// ============================================================
// evidence-scoring — dispute-readiness score and status
// Generated from: evidence-scoring.plain (spec §13)
// ============================================================

import { OrderEvidenceVault, EvidenceCategory, VaultStatus } from "./types";

// Weights for each evidence dimension (sum = 100)
const DIMENSION_WEIGHTS: Record<EvidenceCategory, number> = {
  order_proof: 15,
  payment_proof: 15,
  product_proof: 10,
  policy_proof: 8,
  fulfilment_proof: 12,
  delivery_proof: 15,
  address_match: 8,
  communication_history: 7,
  refund_history: 5,
  conflict_detection: 5,
};

const STRENGTH_MULTIPLIERS = {
  strong: 1.0,
  weak: 0.4,
  missing: 0.0,
  contradictory: -0.2,
  irrelevant: 0.0,
};

export interface ScoringResult {
  score: number;
  status: VaultStatus;
  missingEvidence: EvidenceCategory[];
  weakEvidence: EvidenceCategory[];
  strongestEvidence: EvidenceCategory[];
}

/**
 * Computes an EvidenceScore (0–100) and assigns a VaultStatus.
 */
export function scoreVault(vault: OrderEvidenceVault): ScoringResult {
  const allCategories = Object.keys(DIMENSION_WEIGHTS) as EvidenceCategory[];
  const categoryScores: Record<EvidenceCategory, number> = {} as any;

  // Find best evidence item per category
  for (const category of allCategories) {
    const items = vault.evidenceItems.filter((i) => i.category === category);
    if (items.length === 0) {
      categoryScores[category] = 0;
    } else {
      const best = items.reduce((a, b) =>
        (STRENGTH_MULTIPLIERS[a.strength] ?? 0) >= (STRENGTH_MULTIPLIERS[b.strength] ?? 0) ? a : b
      );
      categoryScores[category] = Math.max(
        0,
        DIMENSION_WEIGHTS[category] * (STRENGTH_MULTIPLIERS[best.strength] ?? 0)
      );
    }
  }

  const rawScore = Object.values(categoryScores).reduce((sum, v) => sum + v, 0);
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  const missingEvidence = allCategories.filter(
    (c) => vault.evidenceItems.filter((i) => i.category === c).length === 0
  );

  const weakEvidence = allCategories.filter((c) => {
    const items = vault.evidenceItems.filter((i) => i.category === c);
    return items.length > 0 && items.every((i) => i.strength === "weak" || i.strength === "irrelevant");
  });

  const strongestEvidence = allCategories
    .filter((c) => vault.evidenceItems.some((i) => i.category === c && i.strength === "strong"))
    .sort((a, b) => DIMENSION_WEIGHTS[b] - DIMENSION_WEIGHTS[a])
    .slice(0, 3);

  const status = deriveStatus(score, missingEvidence);

  return { score, status, missingEvidence, weakEvidence, strongestEvidence };
}

function deriveStatus(score: number, missing: EvidenceCategory[]): VaultStatus {
  if (score >= 90 && missing.length === 0) return "dispute_ready";
  if (score >= 90) return "mostly_ready";
  if (missing.includes("delivery_proof")) return "missing_delivery_proof";
  if (missing.includes("policy_proof")) return "missing_policy_snapshot";
  if (missing.includes("product_proof")) return "missing_product_snapshot";
  if (score >= 60) return "mostly_ready";
  if (score >= 30) return "weak_evidence";
  return "needs_review";
}

/**
 * Applies scoring result back to the vault in-place.
 */
export function applyScore(vault: OrderEvidenceVault, result: ScoringResult): void {
  vault.evidenceScore = result.score;
  vault.status = result.status;
  vault.missingEvidence = result.missingEvidence;
  vault.weakEvidence = result.weakEvidence;
  vault.updatedAt = new Date();
}
