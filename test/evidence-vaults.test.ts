/**
 * Conformance tests for evidence-vaults.plain (spec §11).
 */
import { describe, it, expect } from "vitest";
import { CommerceEvent } from "../src/engine/core/types";
import { createVaultFromEvent, buildProfile, evidenceItemFromEvent } from "../src/engine/vaults/vaults";
import { findLink, LINK_REVIEW_THRESHOLD } from "../src/engine/vaults/linking";

function event(partial: Partial<CommerceEvent>): CommerceEvent {
  return {
    id: "evt_x",
    merchant_id: "merchant_001",
    source_message_id: "msg_x",
    event_type: "commerce_event",
    occurred_at: "2026-06-10T10:14:00Z",
    ...partial,
  };
}

describe("evidence-vaults.plain · linking", () => {
  const vault = createVaultFromEvent(
    event({
      order_id: "1048",
      customer_email: "customer@example.com",
      amount: 420,
      currency: "GBP",
    }),
    "gmail"
  );
  const linkedEvents = [
    event({ order_id: "1048", tracking_number: "RN123456789GB", customer_email: "customer@example.com", amount: 420 }),
  ];
  const profile = buildProfile(vault, linkedEvents);

  it("links a delivery email sharing the tracking number to vault 1048, recording the matched key", () => {
    const decision = findLink(
      event({ tracking_number: "RN123456789GB", event_type: "delivered" }),
      [profile]
    );
    expect(decision.vault_id).toBe("vault_1048");
    expect(decision.matched_on).toContain("tracking_number");
    expect(decision.link_confidence).toBeGreaterThanOrEqual(LINK_REVIEW_THRESHOLD);
  });

  it("lets the higher-priority key decide when two keys disagree", () => {
    // order_number points at 1048; tracking points at a different vault 2000.
    const otherVault = createVaultFromEvent(event({ order_id: "2000" }), "gmail");
    const otherProfile = buildProfile(
      otherVault,
      [event({ order_id: "2000", tracking_number: "RN999GB" })]
    );
    const decision = findLink(
      event({ order_id: "1048", tracking_number: "RN999GB" }),
      [profile, otherProfile]
    );
    // order_number (priority 1) on vault_1048 wins over tracking_number on vault_2000.
    expect(decision.vault_id).toBe("vault_1048");
    expect(decision.matched_on[0]).toBe("order_number");
  });

  it("routes a low-confidence link to review rather than auto-applying it", () => {
    // Only a weak product_name + timestamp match is available (confidence 0.5 < 0.6).
    const decision = findLink(
      event({ product_name: "Refurbished Camera Lens", customer_email: undefined, order_id: undefined }),
      [buildProfile(vault, [event({ product_name: "Refurbished Camera Lens", order_id: "1048" })])]
    );
    expect(decision.autoApply).toBe(false);
    expect(decision.vault_id).toBeNull();
    expect(decision.candidate_vault_id).toBe("vault_1048");
  });
});

describe("evidence-vaults.plain · evidence items", () => {
  it("stores a delivery confirmation as a strong evidence item with a summary referencing its source", () => {
    const item = evidenceItemFromEvent(
      event({ source_message_id: "msg_842", carrier: "Royal Mail", event_type: "delivered" }),
      "vault_1048",
      "delivery_confirmation",
      "Royal Mail delivered: RN123456789GB"
    );
    expect(item).not.toBeNull();
    expect(item!.strength).toBe("strong");
    expect(item!.type).toBe("tracking_delivered");
    expect(item!.source_message_id).toBe("msg_842");
    expect(item!.summary).toContain("msg_842");
  });

  it("does not create an evidence item for a dispute notification (that becomes a signal)", () => {
    const item = evidenceItemFromEvent(event({}), "vault_1048", "dispute_notification", "Stripe dispute opened");
    expect(item).toBeNull();
  });
});
