/**
 * Conformance tests for dispute-detection.plain (spec §14).
 * (Vault linkage is covered by the processing-pipeline tests.)
 */
import { describe, it, expect } from "vitest";
import { detectDisputeSignal } from "../src/engine/disputes/detection";
import { CommerceEvent } from "../src/engine/core/types";

function ev(partial: Partial<CommerceEvent> = {}): CommerceEvent {
  return {
    id: "evt_x",
    merchant_id: "merchant_001",
    source_message_id: "msg_x",
    event_type: "dispute_opened",
    ...partial,
  };
}

describe("dispute-detection.plain", () => {
  it("produces a payment_dispute signal from 'Stripe dispute opened: Order #1048'", () => {
    const sig = detectDisputeSignal({
      subject: "Stripe dispute opened: Order #1048",
      sender: "notifications@stripe.com",
      classification: "dispute_notification",
      event: ev(),
    });
    expect(sig).not.toBeNull();
    expect(sig!.category).toBe("payment_dispute");
    expect(sig!.signal_type).toBe("stripe_dispute_opened");
  });

  it("records the dispute reason, disputed amount and deadline when present", () => {
    const sig = detectDisputeSignal({
      subject: "Stripe dispute opened: Order #1048",
      body: "Reason: item not received\nDisputed amount: £420\nRespond by: 2026-06-22",
      sender: "notifications@stripe.com",
      classification: "dispute_notification",
      event: ev({ dispute_reason: "item_not_received", amount: 420, currency: "GBP", dispute_deadline: "2026-06-22" }),
    });
    expect(sig!.reason).toBe("item_not_received");
    expect(sig!.disputed_amount).toBe(420);
    expect(sig!.deadline).toBe("2026-06-22");
  });

  it("detects a chargeback", () => {
    const sig = detectDisputeSignal({
      subject: "Chargeback created for your payment",
      sender: "notifications@stripe.com",
      classification: "dispute_notification",
      event: ev(),
    });
    expect(sig!.category).toBe("chargeback");
  });

  it("detects an explicit missing-item complaint but not a neutral delivery inquiry", () => {
    const claim = detectDisputeSignal({
      subject: "My item never arrived",
      sender: "buyer@gmail.com",
      classification: "customer_complaint",
      event: ev({ event_type: "customer_message" }),
    });
    expect(claim!.category).toBe("missing_item_complaint");

    const inquiry = detectDisputeSignal({
      subject: "Where is my order #1048?",
      sender: "buyer@gmail.com",
      classification: "customer_complaint",
      event: ev({ event_type: "customer_message" }),
    });
    expect(inquiry).toBeNull();
  });

  it("detects a refund request", () => {
    const sig = detectDisputeSignal({
      subject: "Refund request for order 1048",
      sender: "buyer@gmail.com",
      classification: "refund_request",
      event: ev({ refund_amount: 420 }),
    });
    expect(sig!.category).toBe("refund_request");
  });

  it("flags repeat-claimant risk when the customer has disputed before", () => {
    const sig = detectDisputeSignal({
      subject: "Refund request for order 2050",
      sender: "buyer@gmail.com",
      classification: "refund_request",
      event: ev({ refund_amount: 80 }),
      priorDisputesForCustomer: 1,
    });
    expect(sig!.category).toBe("repeat_claimant_risk");
  });
});
