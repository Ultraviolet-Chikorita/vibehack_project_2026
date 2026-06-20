/**
 * Conformance tests for billing-metering.plain (spec §23).
 */
import { describe, it, expect } from "vitest";
import { Billing, aggregateUsage, computeInvoice, PLANS } from "../src/engine/billing/billing";
import { BillingEvent } from "../src/engine/core/types";

describe("billing-metering.plain · metering events", () => {
  it("emits exactly one evidence_pack_generated event carrying the disputed amount", () => {
    const e = Billing.evidencePackGenerated("merchant_001", "pack_001", 420, "GBP");
    expect(e.event_type).toBe("evidence_pack_generated");
    expect(e.quantity).toBe(1);
    expect(e.amount_disputed).toBe(420);
    expect(e.case_id).toBe("pack_001");
  });

  it("emits a mailbox_scan_completed event recording emails scanned and relevant messages found", () => {
    const e = Billing.mailboxScanCompleted("merchant_001", {
      emails_scanned: 184,
      relevant_messages: 39,
      order_vaults_created: 12,
      dispute_signals_detected: 3,
    });
    expect(e.event_type).toBe("mailbox_scan_completed");
    expect(e.emails_scanned).toBe(184);
    expect(e.relevant_messages).toBe(39);
  });
});

describe("billing-metering.plain · plans, quotas and fees", () => {
  it("charges the overage rate only beyond the included pack quota", () => {
    // Starter includes 5 packs at £3/extra pack.
    const events: BillingEvent[] = [];
    for (let i = 0; i < 7; i++) events.push(Billing.evidencePackGenerated("m", `pack_${i}`, 100, "GBP"));
    const usage = aggregateUsage(events);
    expect(usage.evidence_packs_generated).toBe(7);

    const invoice = computeInvoice("Starter", usage);
    // 7 packs - 5 included = 2 overage * £3 = £6.
    expect(invoice.overage.packs).toBe(2);
    expect(invoice.overage.pack_charge).toBe(6);
    expect(invoice.total).toBe(PLANS.Starter.base_fee + 6);
  });

  it("does not charge overage when usage is within the included quota", () => {
    const events = [Billing.evidencePackGenerated("m", "pack_0", 100, "GBP")];
    const invoice = computeInvoice("Starter", aggregateUsage(events));
    expect(invoice.overage.pack_charge).toBe(0);
    expect(invoice.total).toBe(PLANS.Starter.base_fee);
  });

  it("applies the configured success-fee percentage to recovered revenue (won dispute)", () => {
    // Growth plan: 5% recovered revenue fee.
    const events = [Billing.recoveredRevenueLogged("m", "pack_001", 420, "GBP")];
    const usage = aggregateUsage(events);
    expect(usage.recovered_revenue).toBe(420);

    const invoice = computeInvoice("Growth", usage);
    expect(invoice.success_fee).toBe(21); // 5% of 420
    expect(invoice.total).toBe(PLANS.Growth.base_fee + 21);
  });
});
