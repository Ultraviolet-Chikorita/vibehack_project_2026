/**
 * Conformance tests for pack-generation.plain (spec §15, §20).
 */
import { describe, it, expect } from "vitest";
import { generatePack, PackContext, DISPUTE_READINESS_THRESHOLD } from "../src/engine/packs/generation";
import { DisputeSignal, EvidenceItem, OrderEvidenceVault } from "../src/engine/core/types";

function vault(partial: Partial<OrderEvidenceVault> = {}): OrderEvidenceVault {
  return {
    id: "vault_1048",
    merchant_id: "merchant_001",
    order_id: "1048",
    customer_email: "customer@example.com",
    amount: 420,
    currency: "GBP",
    status: "fulfilled",
    evidence_score: 92,
    evidence_status: "dispute_ready",
    missing: [],
    weak: ["customer_message_history"],
    strongest_evidence: ["order_confirmation", "payment_confirmation", "tracking_delivered", "address_match"],
    created_at: "2026-06-10T10:15:00Z",
    last_updated: "2026-06-16T09:42:00Z",
    created_from: "gmail",
    ...partial,
  };
}

function signal(partial: Partial<DisputeSignal> = {}): DisputeSignal {
  return {
    id: "sig_001",
    merchant_id: "merchant_001",
    vault_id: "vault_1048",
    source_message_id: "msg_dispute",
    signal_type: "stripe_dispute_opened",
    category: "payment_dispute",
    reason: "item_not_received",
    disputed_amount: 420,
    currency: "GBP",
    deadline: "2026-06-22",
    detected_from_subject: "Stripe dispute opened: Order #1048",
    detected_at: "2026-06-16T09:41:00Z",
    ...partial,
  };
}

function evidence(): EvidenceItem[] {
  const make = (type: string, msg: string, ts: string): EvidenceItem => ({
    id: `ev_${type}`,
    merchant_id: "merchant_001",
    vault_id: "vault_1048",
    type,
    source_message_id: msg,
    captured_at: ts,
    event_timestamp: ts,
    strength: "strong",
    summary: `${type} (source: ${msg})`,
  });
  return [
    make("order_confirmation", "msg_001", "2026-06-10T10:14:00Z"),
    make("payment_confirmation", "msg_002", "2026-06-10T10:15:00Z"),
    make("fulfilment_confirmation", "msg_003", "2026-06-10T14:20:00Z"),
    make("tracking_number", "msg_004", "2026-06-10T14:22:00Z"),
    make("tracking_delivered", "msg_005", "2026-06-12T11:03:00Z"),
  ];
}

const ctx = (overrides: Partial<PackContext> = {}): PackContext => ({
  vault: vault(),
  signal: signal(),
  evidence: evidence(),
  messageIndex: new Map(),
  ...overrides,
});

describe("pack-generation.plain", () => {
  it("auto-generates a ready pack for a vault scoring 92 (>= threshold)", () => {
    const pack = generatePack(ctx());
    expect(pack.status).toBe("ready_for_review");
    expect(pack.vault_id).toBe("vault_1048");
  });

  it("recommends contest at 0.82 confidence for item_not_received with delivery proven (spec §24)", () => {
    const pack = generatePack(ctx());
    expect(pack.recommendation).toBe("contest");
    expect(pack.recommendation_confidence).toBe(0.82);
  });

  it("marks the pack needs_human_review when the vault scores below 60", () => {
    const weakVault = vault({ evidence_score: 45, evidence_status: "weak_evidence", strongest_evidence: [], missing: ["delivery_proof"] });
    const pack = generatePack(ctx({ vault: weakVault, evidence: [] }));
    expect(pack.status).toBe("needs_human_review");
    expect(weakVault.evidence_score).toBeLessThan(DISPUTE_READINESS_THRESHOLD);
  });

  it("includes a summary, timeline, evidence table, missing warnings, recommendation, submission text and checklist", () => {
    const pack = generatePack(ctx());
    expect(pack.dispute_summary).toContain("1048");
    expect(pack.order_summary).toContain("92");
    expect(pack.timeline.length).toBeGreaterThan(0);
    expect(pack.evidence_table.length).toBe(5);
    expect(pack.recommendation_confidence).toBeGreaterThan(0);
    expect(pack.submission_text.length).toBeGreaterThan(0);
    expect(pack.attachments_checklist.length).toBeGreaterThan(0);
  });

  it("cites the order, payment, fulfilment, tracking and delivery evidence captured before the dispute", () => {
    const pack = generatePack(ctx());
    const t = pack.submission_text.toLowerCase();
    expect(t).toContain("order confirmation");
    expect(t).toContain("payment confirmation");
    expect(t).toContain("fulfilment confirmation");
    expect(t).toContain("tracking number");
    expect(t).toContain("delivery confirmation");
    expect(t).toContain("before the dispute was opened");
  });

  it("separates facts from the recommendation and never guarantees the outcome", () => {
    const pack = generatePack(ctx());
    expect(pack.recommendation_rationale.length).toBeGreaterThan(0);
    expect(pack.disclaimer.toLowerCase()).toContain("does not guarantee");
    expect(pack.disclaimer.toLowerCase()).toContain("approval");
  });

  it("starts unapproved — no approval recorded at generation time", () => {
    const pack = generatePack(ctx());
    expect(pack.approved_at).toBeUndefined();
    expect(["ready_for_review", "needs_human_review"]).toContain(pack.status);
  });
});
