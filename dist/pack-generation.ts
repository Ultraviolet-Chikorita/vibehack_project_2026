// ============================================================
// pack-generation — evidence pack generation
// Generated from: pack-generation.plain (spec §15)
// ============================================================

import {
  DisputeSignal,
  OrderEvidenceVault,
  EvidencePack,
  Recommendation,
  TimelineEntry,
  EvidenceItem,
} from "./types";
import { v4 as uuidv4 } from "uuid";

// Minimum EvidenceScore for automatic pack generation
export const DISPUTE_READINESS_THRESHOLD = 60;

/**
 * Generates an EvidencePack for a DisputeSignal.
 * Packs below the readiness threshold are marked needs_human_review.
 * Never submits or sends — always requires explicit Merchant approval.
 */
export function generateEvidencePack(
  signal: DisputeSignal,
  vault: OrderEvidenceVault
): EvidencePack {
  const status = vault.evidenceScore >= DISPUTE_READINESS_THRESHOLD ? "auto_generated" : "needs_human_review";
  const { recommendation, confidence } = deriveRecommendation(signal, vault);

  const timeline = buildTimeline(vault.evidenceItems);
  const missingWarnings = vault.missingEvidence.map(
    (c) => `Missing evidence: ${c.replace(/_/g, " ")}`
  );
  const attachmentsChecklist = buildAttachmentsChecklist(vault.evidenceItems);
  const submissionText = buildSubmissionText(signal, vault, recommendation);

  return {
    id: uuidv4(),
    merchantId: vault.merchantId,
    disputeSignalId: signal.id,
    vaultId: vault.id,
    disputeSummary: buildDisputeSummary(signal),
    orderSummary: buildOrderSummary(vault),
    evidenceTimeline: timeline,
    evidenceTable: vault.evidenceItems,
    missingEvidenceWarnings: missingWarnings,
    recommendation,
    recommendationConfidence: confidence,
    submissionText,
    attachmentsChecklist,
    status,
    generatedAt: new Date(),
  };
}

// ── Internal builders ────────────────────────────────────────

function deriveRecommendation(
  signal: DisputeSignal,
  vault: OrderEvidenceVault
): { recommendation: Recommendation; confidence: number } {
  const hasDelivery = vault.evidenceItems.some(
    (i) => i.category === "delivery_proof" && i.strength === "strong"
  );
  const hasOrder = vault.evidenceItems.some(
    (i) => i.category === "order_proof" && i.strength === "strong"
  );
  const hasPayment = vault.evidenceItems.some(
    (i) => i.category === "payment_proof" && i.strength === "strong"
  );
  const hasFullfilment = vault.evidenceItems.some(
    (i) => i.category === "fulfilment_proof" && i.strength === "strong"
  );

  if (
    (signal.disputeType === "item_not_received" || signal.disputeType === "payment_dispute") &&
    hasDelivery && hasOrder && hasPayment && hasFullfilment
  ) {
    return { recommendation: "contest", confidence: 0.82 };
  }
  if (vault.evidenceScore >= 80) {
    return { recommendation: "contest", confidence: 0.7 };
  }
  if (vault.evidenceScore >= 60) {
    return { recommendation: "request_more_evidence", confidence: 0.65 };
  }
  return { recommendation: "refund", confidence: 0.5 };
}

function buildTimeline(items: EvidenceItem[]): TimelineEntry[] {
  return items
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
    .map((item) => ({
      timestamp: item.capturedAt,
      description: item.summary,
      sourceMessageId: item.sourceMessageId,
    }));
}

function buildAttachmentsChecklist(items: EvidenceItem[]): string[] {
  const checklist: string[] = [];
  const categories = new Set(items.map((i) => i.category));
  if (categories.has("order_proof")) checklist.push("Order confirmation email");
  if (categories.has("payment_proof")) checklist.push("Payment confirmation / receipt");
  if (categories.has("fulfilment_proof")) checklist.push("Fulfilment / dispatch notification");
  if (categories.has("delivery_proof")) checklist.push("Delivery confirmation / tracking screenshot");
  if (categories.has("product_proof")) checklist.push("Product listing / description screenshot");
  if (categories.has("policy_proof")) checklist.push("Returns or refund policy");
  if (categories.has("communication_history")) checklist.push("Customer communication history");
  return checklist;
}

function buildDisputeSummary(signal: DisputeSignal): string {
  return (
    `Dispute type: ${signal.disputeType.replace(/_/g, " ")}. ` +
    (signal.disputeReason ? `Reason: ${signal.disputeReason}. ` : "") +
    (signal.disputedAmount ? `Disputed amount: ${signal.disputedAmount}. ` : "") +
    (signal.deadline ? `Respond by: ${signal.deadline.toDateString()}.` : "")
  );
}

function buildOrderSummary(vault: OrderEvidenceVault): string {
  return (
    `Order ID: ${vault.orderId}. ` +
    `Evidence score: ${vault.evidenceScore}/100. ` +
    `Status: ${vault.status.replace(/_/g, " ")}.`
  );
}

function buildSubmissionText(
  signal: DisputeSignal,
  vault: OrderEvidenceVault,
  recommendation: Recommendation
): string {
  const lines = [
    `We are responding to the ${signal.disputeType.replace(/_/g, " ")} raised against order ${vault.orderId}.`,
    "",
    "Evidence captured prior to this dispute:",
  ];

  for (const item of vault.evidenceItems.filter((i) => i.strength === "strong")) {
    lines.push(`- ${item.summary}`);
  }

  lines.push("");
  lines.push(
    `Based on the above evidence, our recommended action is: ${recommendation.replace(/_/g, " ")}.`
  );
  lines.push(
    "Note: This response is based on evidence captured automatically from merchant communications. " +
    "The outcome of the dispute cannot be guaranteed."
  );

  return lines.join("\n");
}
