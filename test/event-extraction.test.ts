/**
 * Conformance tests for event-extraction.plain (spec §10).
 */
import { describe, it, expect } from "vitest";
import { extractCommerceEvent } from "../src/engine/extraction/extract";
import { SourceMessage } from "../src/engine/core/types";

function msg(partial: Partial<SourceMessage>): SourceMessage {
  return {
    id: "msg_test",
    merchant_id: "merchant_001",
    provider: "gmail",
    external_message_id: "ext_test",
    sender: "no-reply@shopify.com",
    subject: "",
    received_at: "2026-06-10T10:15:00Z",
    ...partial,
  };
}

describe("event-extraction.plain", () => {
  it("extracts order id 1048 from subject 'Order #1048 confirmed'", () => {
    const ev = extractCommerceEvent(msg({ subject: "Order #1048 confirmed" }), "order_confirmation");
    expect(ev.order_id).toBe("1048");
  });

  it("extracts tracking number and a delivery timestamp from a Royal Mail delivery email", () => {
    const ev = extractCommerceEvent(
      msg({
        sender: "no-reply@royalmail.com",
        subject: "Royal Mail delivered: RN123456789GB",
        received_at: "2026-06-12T11:03:00Z",
      }),
      "delivery_confirmation"
    );
    expect(ev.tracking_number).toBe("RN123456789GB");
    expect(ev.carrier).toBe("Royal Mail");
    expect(ev.delivery_status).toBe("delivered");
    expect(ev.occurred_at).toBe("2026-06-12T11:03:00Z");
  });

  it("leaves fields not present in the source empty rather than fabricating them", () => {
    const ev = extractCommerceEvent(msg({ subject: "Order #1048 confirmed" }), "order_confirmation");
    expect(ev.tracking_number).toBeUndefined();
    expect(ev.dispute_reason).toBeUndefined();
    expect(ev.refund_amount).toBeUndefined();
  });

  it("records the source message id on every extracted event (traceability)", () => {
    const ev = extractCommerceEvent(
      msg({ id: "msg_001", subject: "Order #1048 confirmed" }),
      "order_confirmation"
    );
    expect(ev.source_message_id).toBe("msg_001");
  });

  it("extracts amount, currency and customer email from a body", () => {
    const ev = extractCommerceEvent(
      msg({
        subject: "Order #1048 confirmed",
        body: "Customer: customer@example.com\nTotal: £420.00\nProduct: Refurbished Camera Lens",
      }),
      "order_confirmation"
    );
    expect(ev.amount).toBe(420);
    expect(ev.currency).toBe("GBP");
    expect(ev.customer_email).toBe("customer@example.com");
    expect(ev.product_name).toBe("Refurbished Camera Lens");
  });

  it("extracts dispute reason and deadline from a dispute notification", () => {
    const ev = extractCommerceEvent(
      msg({
        sender: "notifications@stripe.com",
        subject: "Stripe dispute opened: Order #1048",
        body: "Reason: item not received\nDisputed amount: £420\nRespond by: 2026-06-22",
      }),
      "dispute_notification"
    );
    expect(ev.dispute_reason).toBe("item_not_received");
    expect(ev.dispute_deadline).toBe("2026-06-22");
    expect(ev.processor).toBe("Stripe");
  });
});
