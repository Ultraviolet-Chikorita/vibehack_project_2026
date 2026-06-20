/**
 * Evidence scoring — dispute-readiness score and status (evidence-scoring.plain;
 * spec §13).
 *
 * Score dimensions (spec §13): order proof, payment proof, product proof, policy
 * proof, fulfilment proof, delivery proof, address match, communication history,
 * refund history, conflict detection.
 *
 * Weighting (transparent and auditable):
 *   Critical pillars (sum 90): order 18, payment 16, fulfilment 14, delivery 24,
 *   address 18 — so a vault with all five present and a matching address scores
 *   at least 90 (evidence-scoring.plain acceptance test).
 *   Supporting bonuses (sum 10): product 4, policy 4, communication 2.
 *   Penalties: conflicting evidence and an issued refund subtract from the total.
 *
 * Worked example — seeded order #1048 (spec §24): order+payment+fulfilment+
 * delivery+address = 90, product name only (no snapshot) = +2, policy snapshot
 * absent = 0, a lone customer message (no merchant reply) = +0 but flagged weak,
 * no conflicts/refunds → score 92, status dispute_ready, weak
 * [customer_message_history]. Matches the spec §13/§24 example exactly.
 */
import { EvidenceScoreResult, VaultStatus } from "../core/types";

export type AddressMatch = "match" | "partial" | "mismatch" | "absent";

/** Inputs to the scorer, derived from a vault's evidence items and events. */
export interface ScoringInput {
  hasOrderProof: boolean;
  hasPaymentProof: boolean;
  hasFulfilmentProof: boolean;
  hasDeliveryProof: boolean;
  hasTracking: boolean;
  addressMatch: AddressMatch;
  hasProductSnapshot: boolean;
  hasProductName: boolean;
  hasPolicySnapshot: boolean;
  customerMessages: number;
  merchantReplies: number;
  /** A refund already issued for this order, which would undercut a contest. */
  refundIssued: boolean;
  /** Descriptions of contradictory evidence detected in the vault. */
  conflicts: string[];
}

const W = {
  order: 18,
  payment: 16,
  fulfilment: 14,
  delivery: 24,
  address: 18,
  product: 4,
  policy: 4,
  communication: 2,
} as const;

const CONFLICT_PENALTY = 15;
const REFUND_PENALTY = 10;

/** The curated "pillars" reported as strongest evidence (matches spec §13 example). */
const PILLARS: { key: string; present: (i: ScoringInput) => boolean }[] = [
  { key: "order_confirmation", present: (i) => i.hasOrderProof },
  { key: "payment_confirmation", present: (i) => i.hasPaymentProof },
  { key: "tracking_delivered", present: (i) => i.hasDeliveryProof },
  { key: "address_match", present: (i) => i.addressMatch === "match" },
];

export function scoreVault(input: ScoringInput): EvidenceScoreResult {
  const dimensions: EvidenceScoreResult["dimensions"] = {};
  const add = (name: string, weight: number, earned: number, note: string) => {
    dimensions[name] = { weight, earned: Number(earned.toFixed(2)), note };
  };

  add("order_proof", W.order, input.hasOrderProof ? W.order : 0, input.hasOrderProof ? "order confirmation captured" : "no order confirmation");
  add("payment_proof", W.payment, input.hasPaymentProof ? W.payment : 0, input.hasPaymentProof ? "payment confirmation captured" : "no payment confirmation");
  add("fulfilment_proof", W.fulfilment, input.hasFulfilmentProof ? W.fulfilment : 0, input.hasFulfilmentProof ? "fulfilment confirmation captured" : "no fulfilment confirmation");
  add("delivery_proof", W.delivery, input.hasDeliveryProof ? W.delivery : 0, input.hasDeliveryProof ? "carrier delivery confirmation captured" : "no delivery confirmation");

  const addressEarned =
    input.addressMatch === "match" ? W.address : input.addressMatch === "partial" ? W.address / 2 : 0;
  add("address_match", W.address, addressEarned, `address ${input.addressMatch}`);

  const productEarned = input.hasProductSnapshot ? W.product : input.hasProductName ? W.product / 2 : 0;
  add(
    "product_proof",
    W.product,
    productEarned,
    input.hasProductSnapshot ? "product page snapshot captured" : input.hasProductName ? "product name only (no snapshot)" : "no product evidence"
  );

  add("policy_proof", W.policy, input.hasPolicySnapshot ? W.policy : 0, input.hasPolicySnapshot ? "policy snapshot captured" : "no policy snapshot");

  const commFull = input.customerMessages > 0 && input.merchantReplies > 0;
  add(
    "communication_history",
    W.communication,
    commFull ? W.communication : 0,
    commFull ? "two-way customer communication" : input.customerMessages > 0 ? "customer message only (thin history)" : "no communication"
  );

  // Penalties (conflict detection, refund history).
  const conflictPenalty = input.conflicts.length > 0 ? CONFLICT_PENALTY : 0;
  add("conflict_detection", 0, -conflictPenalty, input.conflicts.length > 0 ? `conflicts: ${input.conflicts.join("; ")}` : "no conflicts detected");
  const refundPenalty = input.refundIssued ? REFUND_PENALTY : 0;
  add("refund_history", 0, -refundPenalty, input.refundIssued ? "refund already issued (undercuts contest)" : "no adverse refund history");

  const raw = Object.values(dimensions).reduce((sum, d) => sum + d.earned, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  // Missing critical evidence (drives "missing" + status).
  const missing: string[] = [];
  if (!input.hasOrderProof) missing.push("order_proof");
  if (!input.hasPaymentProof) missing.push("payment_proof");
  if (!input.hasFulfilmentProof) missing.push("fulfilment_proof");
  if (!input.hasDeliveryProof) missing.push("delivery_proof");
  if (input.addressMatch === "absent" || input.addressMatch === "mismatch") missing.push("address_match");

  // Weak evidence.
  const weak: string[] = [];
  if (input.customerMessages > 0 && input.merchantReplies === 0) weak.push("customer_message_history");
  if (input.addressMatch === "partial") weak.push("address_match");

  const strongest_evidence = PILLARS.filter((p) => p.present(input)).map((p) => p.key);

  const status = deriveStatus(input, score, missing);

  return { score, status, missing, weak, strongest_evidence, dimensions };
}

function deriveStatus(input: ScoringInput, score: number, missing: string[]): VaultStatus {
  if (input.conflicts.length > 0) return "needs_review";
  if (score >= 90 && missing.length === 0) return "dispute_ready";
  if (!input.hasDeliveryProof) return "missing_delivery_proof";
  if (!input.hasPolicySnapshot) return "missing_policy_snapshot";
  if (!input.hasProductSnapshot && !input.hasProductName) return "missing_product_snapshot";
  if (score >= 75) return "mostly_ready";
  if (score < 40) return "weak_evidence";
  return "needs_review";
}
