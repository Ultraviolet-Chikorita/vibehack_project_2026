/**
 * Conformance tests for email-filtering.plain (spec §9).
 * Each test maps to an acceptance test bullet in the .plain module.
 */
import { describe, it, expect } from "vitest";
import { firstPassFilter, classify } from "../src/engine/filtering/filter";

describe("email-filtering.plain · first-pass filter", () => {
  it("marks a Shopify order confirmation relevant (sender + subject allow-list)", () => {
    const r = firstPassFilter({ sender: "no-reply@shopify.com", subject: "Order #1048 confirmed" });
    expect(r.relevant).toBe(true);
    expect(r.senderAllowed).toBe(true);
  });

  it("marks a message irrelevant when its subject matches the ignore list, even with other terms present", () => {
    // Subject contains an allow term ("order confirmed") AND an ignore term ("newsletter").
    const r = firstPassFilter({
      sender: "no-reply@shopify.com",
      subject: "Newsletter: your order confirmed deals this week",
    });
    expect(r.relevant).toBe(false);
    expect(r.reason).toContain("ignore list");
  });

  it("marks a clearly off-topic message irrelevant", () => {
    const r = firstPassFilter({ sender: "team@socialapp.example", subject: "You have 3 new followers" });
    expect(r.relevant).toBe(false);
  });

  it("treats a customer subject-line match (where is my order) as relevant even off allow-list sender", () => {
    const r = firstPassFilter({ sender: "buyer@gmail.com", subject: "Where is my order #1048?" });
    expect(r.relevant).toBe(true);
    expect(r.matchedSubjectTerms).toContain("where is my order");
  });
});

describe("email-filtering.plain · classification", () => {
  it("classifies a Shopify order confirmation as order_confirmation with confidence >= 0.8", () => {
    const c = classify({ sender: "no-reply@shopify.com", subject: "Order #1048 confirmed" });
    expect(c.classification).toBe("order_confirmation");
    expect(c.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies a Stripe payment email as payment_confirmation", () => {
    const c = classify({ sender: "receipts@stripe.com", subject: "Your payment for Order #1048 was received" });
    expect(c.classification).toBe("payment_confirmation");
  });

  it("classifies a Royal Mail delivered email as delivery_confirmation", () => {
    const c = classify({ sender: "no-reply@royalmail.com", subject: "Royal Mail delivered: RN123456789GB" });
    expect(c.classification).toBe("delivery_confirmation");
  });

  it("classifies a Stripe dispute email as dispute_notification", () => {
    const c = classify({ sender: "notifications@stripe.com", subject: "Stripe dispute opened: Order #1048" });
    expect(c.classification).toBe("dispute_notification");
  });

  it("assigns needs_review (not a guess) when it cannot confidently classify", () => {
    const c = classify({ sender: "ops@stripe.com", subject: "Account statement available" });
    expect(c.classification).toBe("needs_review");
    expect(c.confidence).toBeLessThan(0.5);
  });
});
