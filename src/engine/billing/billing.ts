/**
 * Solvimon billing — usage-based and outcome-based metering (billing-metering.plain;
 * spec §23).
 *
 * FRs:
 *  - Emit a :BillingEvent: for each billable action (emails scanned, relevant
 *    messages processed, vaults created, evidence items captured, snapshots
 *    stored, dispute signals detected, evidence packs generated, recovered
 *    revenue logged).
 *  - Support usage-based plans with included quotas and per-unit overage, plus an
 *    optional success fee on recovered revenue.
 */
import { BillingEvent, BillingEventType, PlanName } from "../core/types";
import { nextId } from "../core/ids";

// --- billing event factories -----------------------------------------------

function event(
  merchantId: string,
  type: BillingEventType,
  fields: Partial<BillingEvent> = {}
): BillingEvent {
  return {
    id: nextId("bill_evt"),
    merchant_id: merchantId,
    event_type: type,
    quantity: fields.quantity ?? 1,
    created_at: new Date().toISOString(),
    ...fields,
  };
}

export const Billing = {
  mailboxScanCompleted(
    merchantId: string,
    counts: { emails_scanned: number; relevant_messages: number; order_vaults_created: number; dispute_signals_detected: number }
  ): BillingEvent {
    return event(merchantId, "mailbox_scan_completed", { quantity: 1, ...counts });
  },
  orderVaultCreated(merchantId: string, vaultId: string): BillingEvent {
    return event(merchantId, "order_vault_created", { case_id: vaultId });
  },
  evidenceItemCaptured(merchantId: string, evidenceId: string): BillingEvent {
    return event(merchantId, "evidence_item_captured", { case_id: evidenceId });
  },
  snapshotStored(merchantId: string, ref: string): BillingEvent {
    return event(merchantId, "snapshot_stored", { case_id: ref });
  },
  disputeSignalDetected(merchantId: string, signalId: string, amountDisputed?: number, currency?: string): BillingEvent {
    return event(merchantId, "dispute_signal_detected", { case_id: signalId, amount_disputed: amountDisputed, currency });
  },
  /** Exactly one per generated pack, carrying the disputed amount (spec §23). */
  evidencePackGenerated(merchantId: string, packId: string, amountDisputed?: number, currency?: string): BillingEvent {
    return event(merchantId, "evidence_pack_generated", { case_id: packId, amount_disputed: amountDisputed, currency });
  },
  /** Outcome-based: recovered revenue logged for a won dispute (success fee basis). */
  recoveredRevenueLogged(merchantId: string, caseId: string, amountRecovered: number, currency?: string): BillingEvent {
    return event(merchantId, "recovered_revenue_logged", { case_id: caseId, amount_recovered: amountRecovered, currency });
  },
};

// --- plans (spec §23) -------------------------------------------------------

export interface Plan {
  name: PlanName;
  base_fee: number;
  currency: string;
  included: { emails_scanned: number; order_vaults: number; dispute_packs: number };
  overage: {
    per_pack: number;
    per_1000_emails?: number;
    per_1000_vaults?: number;
  };
  /** Success fee on recovered revenue, as a fraction (e.g. 0.05 = 5%). */
  recovered_revenue_fee_pct: number;
}

export const PLANS: Record<PlanName, Plan> = {
  Starter: {
    name: "Starter",
    base_fee: 49,
    currency: "GBP",
    included: { emails_scanned: 250, order_vaults: 50, dispute_packs: 5 },
    overage: { per_pack: 3 },
    recovered_revenue_fee_pct: 0,
  },
  Growth: {
    name: "Growth",
    base_fee: 149,
    currency: "GBP",
    included: { emails_scanned: 2500, order_vaults: 500, dispute_packs: 50 },
    overage: { per_pack: 3 },
    recovered_revenue_fee_pct: 0.05,
  },
  "High Volume": {
    name: "High Volume",
    base_fee: 499,
    currency: "GBP",
    included: { emails_scanned: 0, order_vaults: 0, dispute_packs: 0 },
    overage: { per_pack: 2, per_1000_emails: 4, per_1000_vaults: 20 },
    recovered_revenue_fee_pct: 0.05,
  },
};

// --- usage aggregation & invoicing -----------------------------------------

export interface UsageSummary {
  emails_scanned: number;
  relevant_messages: number;
  order_vaults_created: number;
  evidence_items_captured: number;
  snapshots_stored: number;
  dispute_signals_detected: number;
  evidence_packs_generated: number;
  disputed_value: number;
  recovered_revenue: number;
  currency: string;
}

/** Aggregate raw billing events into usage totals for a merchant. */
export function aggregateUsage(events: BillingEvent[]): UsageSummary {
  const u: UsageSummary = {
    emails_scanned: 0,
    relevant_messages: 0,
    order_vaults_created: 0,
    evidence_items_captured: 0,
    snapshots_stored: 0,
    dispute_signals_detected: 0,
    evidence_packs_generated: 0,
    disputed_value: 0,
    recovered_revenue: 0,
    currency: "GBP",
  };
  for (const e of events) {
    switch (e.event_type) {
      case "mailbox_scan_completed":
        u.emails_scanned += e.emails_scanned ?? 0;
        u.relevant_messages += e.relevant_messages ?? 0;
        break;
      case "order_vault_created":
        u.order_vaults_created += e.quantity;
        break;
      case "evidence_item_captured":
        u.evidence_items_captured += e.quantity;
        break;
      case "snapshot_stored":
        u.snapshots_stored += e.quantity;
        break;
      case "dispute_signal_detected":
        u.dispute_signals_detected += e.quantity;
        break;
      case "evidence_pack_generated":
        u.evidence_packs_generated += e.quantity;
        u.disputed_value += e.amount_disputed ?? 0;
        break;
      case "recovered_revenue_logged":
        u.recovered_revenue += e.amount_recovered ?? 0;
        break;
    }
    if (e.currency) u.currency = e.currency;
  }
  return u;
}

export interface Invoice {
  plan: PlanName;
  currency: string;
  base_fee: number;
  overage: {
    packs: number;
    pack_charge: number;
    emails: number;
    email_charge: number;
    vaults: number;
    vault_charge: number;
  };
  success_fee: number;
  total: number;
}

/**
 * Compute an invoice from a plan and usage. Overage is charged only beyond the
 * included quota; the success fee applies the plan's percentage to recovered
 * revenue.
 */
export function computeInvoice(planName: PlanName, usage: UsageSummary): Invoice {
  const plan = PLANS[planName];

  const overagePacks = Math.max(0, usage.evidence_packs_generated - plan.included.dispute_packs);
  const pack_charge = round2(overagePacks * plan.overage.per_pack);

  const overageEmails = Math.max(0, usage.emails_scanned - plan.included.emails_scanned);
  const email_charge = round2(((overageEmails / 1000) * (plan.overage.per_1000_emails ?? 0)));

  const overageVaults = Math.max(0, usage.order_vaults_created - plan.included.order_vaults);
  const vault_charge = round2(((overageVaults / 1000) * (plan.overage.per_1000_vaults ?? 0)));

  const success_fee = round2(usage.recovered_revenue * plan.recovered_revenue_fee_pct);

  const total = round2(plan.base_fee + pack_charge + email_charge + vault_charge + success_fee);

  return {
    plan: plan.name,
    currency: plan.currency,
    base_fee: plan.base_fee,
    overage: {
      packs: overagePacks,
      pack_charge,
      emails: overageEmails,
      email_charge,
      vaults: overageVaults,
      vault_charge,
    },
    success_fee,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
