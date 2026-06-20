/**
 * Conformance tests for evidence-scoring.plain (spec §13).
 */
import { describe, it, expect } from "vitest";
import { scoreVault, ScoringInput } from "../src/engine/scoring/scoring";

function base(partial: Partial<ScoringInput> = {}): ScoringInput {
  return {
    hasOrderProof: false,
    hasPaymentProof: false,
    hasFulfilmentProof: false,
    hasDeliveryProof: false,
    hasTracking: false,
    addressMatch: "absent",
    hasProductSnapshot: false,
    hasProductName: false,
    hasPolicySnapshot: false,
    customerMessages: 0,
    merchantReplies: 0,
    refundIssued: false,
    conflicts: [],
    ...partial,
  };
}

/** The seeded order #1048 evidence profile (spec §24). */
const order1048 = base({
  hasOrderProof: true,
  hasPaymentProof: true,
  hasFulfilmentProof: true,
  hasDeliveryProof: true,
  hasTracking: true,
  addressMatch: "match",
  hasProductName: true, // product name captured, but no product page snapshot
  hasPolicySnapshot: false,
  customerMessages: 1, // a single "where is my order" message, no merchant reply
  merchantReplies: 0,
});

describe("evidence-scoring.plain", () => {
  it("scores a vault with order, payment, fulfilment, delivery proof and matching address at least 90", () => {
    const r = scoreVault(
      base({
        hasOrderProof: true,
        hasPaymentProof: true,
        hasFulfilmentProof: true,
        hasDeliveryProof: true,
        addressMatch: "match",
      })
    );
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("scores the seeded order #1048 at exactly 92 with status dispute_ready (spec §24)", () => {
    const r = scoreVault(order1048);
    expect(r.score).toBe(92);
    expect(r.status).toBe("dispute_ready");
  });

  it("reports the seeded #1048 weak/strongest/missing breakdown like the spec §13 example", () => {
    const r = scoreVault(order1048);
    expect(r.missing).toEqual([]);
    expect(r.weak).toContain("customer_message_history");
    expect(r.strongest_evidence).toEqual([
      "order_confirmation",
      "payment_confirmation",
      "tracking_delivered",
      "address_match",
    ]);
  });

  it("scores a vault missing delivery proof lower than an otherwise identical vault that has it", () => {
    const withDelivery = scoreVault(order1048);
    const withoutDelivery = scoreVault({ ...order1048, hasDeliveryProof: false });
    expect(withoutDelivery.score).toBeLessThan(withDelivery.score);
    expect(withoutDelivery.status).toBe("missing_delivery_proof");
  });

  it("labels a vault with score >= 90 and no missing critical evidence dispute_ready", () => {
    const r = scoreVault(
      base({
        hasOrderProof: true,
        hasPaymentProof: true,
        hasFulfilmentProof: true,
        hasDeliveryProof: true,
        addressMatch: "match",
        hasProductSnapshot: true,
        hasPolicySnapshot: true,
        customerMessages: 1,
        merchantReplies: 1,
      })
    );
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.status).toBe("dispute_ready");
  });

  it("explicitly lists missing and weak evidence so a merchant can act before a dispute arrives", () => {
    const r = scoreVault(base({ hasOrderProof: true, hasPaymentProof: true, customerMessages: 2, merchantReplies: 0 }));
    expect(r.missing).toContain("delivery_proof");
    expect(r.missing).toContain("fulfilment_proof");
    expect(r.weak).toContain("customer_message_history");
  });
});
