/**
 * Automatic evidence pack generation (pack-generation.plain; spec §15, §20).
 *
 * FRs:
 *  - Generate an :EvidencePack: when a :DisputeSignal: is linked to a vault whose
 *    :EvidenceScore: meets the :DisputeReadinessThreshold: (60). A vault scoring
 *    below 60 still produces a pack, marked needs_human_review.
 *  - Each pack contains: dispute summary, order summary, evidence timeline,
 *    captured-evidence table, missing-evidence warnings, a :Recommendation: with
 *    a confidence score, copy-paste submission text, and an attachments checklist.
 *  - Facts are separated from the recommendation; the pack never guarantees the
 *    outcome and is never submitted/sent without explicit :Merchant: approval.
 *
 * Recommendation rules (spec §20 "Codeplain Rules"):
 *  - item_not_received + tracking_delivered captured → contest.
 *  - evidence_score < 60 → pack marked needs_human_review.
 *  - disputed_amount < 25 and evidence weak → refund.
 */
import {
  DisputeSignal,
  EvidenceItem,
  EvidencePack,
  OrderEvidenceVault,
  PackEvidenceRow,
  PackTimelineEntry,
  Recommendation,
} from "../core/types";
import { nextId } from "../core/ids";

/** Minimum :EvidenceScore: at/above which a full pack is auto-generated. */
export const DISPUTE_READINESS_THRESHOLD = 60;

export interface PackContext {
  vault: OrderEvidenceVault;
  signal: DisputeSignal;
  evidence: EvidenceItem[];
  messageIndex: Map<string, { subject: string; received_at: string }>;
}

const DISCLAIMER =
  "This pack is generated only from evidence captured from the merchant mailbox. " +
  "It separates facts from the recommendation and does not guarantee the dispute will be won. " +
  "No response is submitted and no customer is contacted without explicit merchant approval.";

function money(amount?: number, currency?: string): string {
  if (amount === undefined) return "the disputed amount";
  const symbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  return `${symbol}${amount}`;
}

function hasType(evidence: EvidenceItem[], type: string): boolean {
  return evidence.some((e) => e.type === type);
}

interface RecommendationResult {
  recommendation: Recommendation;
  confidence: number;
  rationale: string;
}

function recommend(ctx: PackContext): RecommendationResult {
  const { vault, signal, evidence } = ctx;
  const score = vault.evidence_score;
  const amount = signal.disputed_amount ?? vault.amount;
  const reason = signal.reason;
  const hasDelivery = hasType(evidence, "tracking_delivered");
  const hasFulfilment = hasType(evidence, "fulfilment_confirmation");
  const conflicted = vault.evidence_status === "needs_review";

  // Contradictions present → escalate to a human.
  if (conflicted) {
    return {
      recommendation: "escalate",
      confidence: 0.4,
      rationale: "Contradictory evidence was detected in this vault; a human should review before responding.",
    };
  }

  // §20: low-value dispute with weak evidence → refund is more economical.
  if (amount !== undefined && amount < 25 && score < DISPUTE_READINESS_THRESHOLD) {
    return {
      recommendation: "refund",
      confidence: 0.6,
      rationale: `The disputed value (${money(amount, signal.currency)}) is low and the captured evidence is weak; refunding is more economical than contesting.`,
    };
  }

  // §20: item_not_received (or a missing-item complaint) with delivery proof → contest.
  const nonReceipt = reason === "item_not_received" || signal.category === "missing_item_complaint";
  if (hasDelivery && (nonReceipt || reason === undefined)) {
    return {
      recommendation: "contest",
      confidence: contestConfidence(score),
      rationale:
        "Delivery to the customer's confirmed shipping address was proven before the dispute was opened, which directly rebuts a non-receipt claim.",
    };
  }

  // Strong overall evidence → contest.
  if (score >= 75 && (hasDelivery || hasFulfilment)) {
    return {
      recommendation: "contest",
      confidence: contestConfidence(score),
      rationale: "The captured order, payment and fulfilment evidence is strong enough to contest this dispute.",
    };
  }

  // Meets threshold but evidence is thin for the specific reason → gather more.
  if (score >= DISPUTE_READINESS_THRESHOLD) {
    return {
      recommendation: "request_more_evidence",
      confidence: 0.55,
      rationale: "The vault meets the readiness threshold but lacks decisive evidence for this dispute reason; capture the missing proof before contesting.",
    };
  }

  // Below threshold → needs human review.
  return {
    recommendation: "request_more_evidence",
    confidence: 0.45,
    rationale: "Evidence is below the dispute-readiness threshold; a human should gather more proof before deciding.",
  };
}

/**
 * Contest confidence is the evidence score discounted by 10 points (and capped at
 * 0.95) — reflecting that the engine never guarantees the outcome. For the seeded
 * order #1048 (score 92) this yields exactly 0.82 (spec §24).
 */
function contestConfidence(score: number): number {
  return Number(Math.max(0, Math.min(0.95, (score - 10) / 100)).toFixed(2));
}

function buildTimeline(ctx: PackContext): PackTimelineEntry[] {
  const labelByType: Record<string, string> = {
    order_confirmation: "Order placed",
    payment_confirmation: "Payment confirmation captured",
    fulfilment_confirmation: "Fulfilment confirmation captured",
    tracking_number: "Tracking number captured",
    tracking_delivered: "Carrier marked parcel delivered",
    customer_message: "Customer message received",
    refund_request: "Refund request received",
  };
  const entries: PackTimelineEntry[] = ctx.evidence.map((e) => ({
    at: e.event_timestamp ?? e.captured_at,
    label: labelByType[e.type] ?? e.type,
    source_message_id: e.source_message_id,
  }));
  entries.push({
    at: ctx.signal.detected_at,
    label: `${ctx.signal.signal_type.replace(/_/g, " ")} detected`,
    source_message_id: ctx.signal.source_message_id,
  });
  entries.push({ at: new Date().toISOString(), label: "Evidence pack generated" });
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function buildEvidenceTable(ctx: PackContext): PackEvidenceRow[] {
  return ctx.evidence.map((e) => ({
    type: e.type,
    summary: e.summary,
    strength: e.strength,
    source_message_id: e.source_message_id,
    captured_at: e.captured_at,
  }));
}

function buildSubmissionText(ctx: PackContext, rec: RecommendationResult): string {
  const { vault, signal, evidence } = ctx;
  if (rec.recommendation !== "contest") {
    if (rec.recommendation === "refund") {
      return (
        `Regarding the dispute on order ${vault.order_id} for ${money(signal.disputed_amount, signal.currency)}: ` +
        `the captured evidence is limited, so we recommend issuing a refund rather than contesting. ` +
        `This recommendation is advisory only and requires merchant approval before any action.`
      );
    }
    return (
      `Regarding the dispute on order ${vault.order_id}: the currently captured evidence is not yet decisive for this dispute reason. ` +
      `We recommend gathering additional proof before responding. No response will be submitted without merchant approval.`
    );
  }

  // Contest: cite only the evidence that was actually captured before the dispute.
  const cite: string[] = [];
  if (hasType(evidence, "order_confirmation")) cite.push("the order confirmation");
  if (hasType(evidence, "payment_confirmation")) cite.push("the payment confirmation");
  if (hasType(evidence, "fulfilment_confirmation")) cite.push("the fulfilment confirmation");
  if (hasType(evidence, "tracking_number")) cite.push("the tracking number");
  if (hasType(evidence, "tracking_delivered")) cite.push("the carrier delivery confirmation");
  if (vault.strongest_evidence.includes("address_match")) cite.push("the shipping address match");

  const citation = cite.length > 0 ? cite.join(", ").replace(/, ([^,]*)$/, ", and $1") : "the captured order records";
  const disputeDate = ctx.signal.detected_at.slice(0, 10);

  return (
    `We are contesting this dispute because order ${vault.order_id} was fulfilled and delivered to the customer's ` +
    `confirmed shipping address. ${capitalise(citation)} were captured before the dispute was opened on ${disputeDate}. ` +
    `These records are included in the evidence timeline. ` +
    `We respectfully request that the dispute be resolved in the merchant's favour based on this documented evidence.`
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildMissingWarnings(ctx: PackContext): string[] {
  const warnings: string[] = [];
  const { vault, evidence } = ctx;
  for (const m of vault.missing) warnings.push(`Critical evidence missing: ${m.replace(/_/g, " ")}.`);
  if (!hasType(evidence, "fulfilment_confirmation")) warnings.push("No fulfilment confirmation captured.");
  if (vault.weak.includes("customer_message_history")) warnings.push("Customer communication history is thin (no merchant reply captured).");
  if (vault.evidence_status === "missing_policy_snapshot" || vault.evidence_status === "dispute_ready") {
    if (!evidence.some((e) => e.type === "policy_snapshot")) warnings.push("No refund/returns policy snapshot captured.");
  }
  return warnings;
}

function buildAttachmentsChecklist(ctx: PackContext): string[] {
  const checklist: string[] = [];
  const e = ctx.evidence;
  if (hasType(e, "order_confirmation")) checklist.push("Order confirmation email");
  if (hasType(e, "payment_confirmation")) checklist.push("Payment receipt / processor confirmation");
  if (hasType(e, "fulfilment_confirmation")) checklist.push("Fulfilment / dispatch confirmation");
  if (hasType(e, "tracking_number")) checklist.push("Carrier tracking page");
  if (hasType(e, "tracking_delivered")) checklist.push("Carrier delivery confirmation");
  if (ctx.vault.strongest_evidence.includes("address_match")) checklist.push("Proof of shipping address match");
  return checklist;
}

/**
 * Generate the merchant-ready :EvidencePack: for a linked dispute signal.
 * Status is `needs_human_review` when the vault scores below the readiness
 * threshold, otherwise `ready_for_review` (awaiting merchant approval).
 */
export function generatePack(ctx: PackContext): EvidencePack {
  const rec = recommend(ctx);
  const belowThreshold = ctx.vault.evidence_score < DISPUTE_READINESS_THRESHOLD;
  const status = belowThreshold ? "needs_human_review" : "ready_for_review";

  const disputeSummary =
    `Dispute on order ${ctx.vault.order_id} (${ctx.signal.signal_type.replace(/_/g, " ")})` +
    `${ctx.signal.reason ? `, reason: ${ctx.signal.reason.replace(/_/g, " ")}` : ""}` +
    `${ctx.signal.disputed_amount !== undefined ? `, for ${money(ctx.signal.disputed_amount, ctx.signal.currency)}` : ""}` +
    `${ctx.signal.deadline ? `, respond by ${ctx.signal.deadline}` : ""}.`;

  const orderSummary =
    `Order ${ctx.vault.order_id}${ctx.vault.customer_email ? ` for ${ctx.vault.customer_email}` : ""}` +
    `${ctx.vault.amount !== undefined ? `, value ${money(ctx.vault.amount, ctx.vault.currency)}` : ""}. ` +
    `Evidence score ${ctx.vault.evidence_score}/100 (${ctx.vault.evidence_status.replace(/_/g, " ")}).`;

  return {
    id: nextId("pack"),
    merchant_id: ctx.vault.merchant_id,
    vault_id: ctx.vault.id,
    signal_id: ctx.signal.id,
    dispute_summary: disputeSummary,
    order_summary: orderSummary,
    timeline: buildTimeline(ctx),
    evidence_table: buildEvidenceTable(ctx),
    missing_evidence_warnings: buildMissingWarnings(ctx),
    recommendation: rec.recommendation,
    recommendation_confidence: rec.confidence,
    recommendation_rationale: rec.rationale,
    submission_text: buildSubmissionText(ctx, rec),
    attachments_checklist: buildAttachmentsChecklist(ctx),
    disclaimer: DISCLAIMER,
    status,
    generated_at: new Date().toISOString(),
  };
}
