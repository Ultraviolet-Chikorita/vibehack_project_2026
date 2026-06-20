/**
 * Engine facade used by the server and demo.
 *
 * Wraps the per-merchant {@link Store} and processing pipeline, and exposes the
 * higher-level operations from the spec: sync cursors (§18.4/§19), pack
 * approval/override with no autonomous submission (§15, §21), dashboard and
 * digest metrics (§16), usage/invoicing (§23), and merchant data deletion (§22).
 */
import { Store } from "./core/store";
import { nextId } from "./core/ids";
import {
  AccessLogEntry,
  BillingEvent,
  DisputeSignal,
  EvidencePack,
  Merchant,
  OrderEvidenceVault,
  Recommendation,
  ReviewQueueItem,
  SourceMessage,
  StoredMessageRef,
} from "./core/types";
import { processBatch, ProcessResult } from "./pipeline/pipeline";
import { aggregateUsage, Billing, computeInvoice, Invoice, PLANS, UsageSummary } from "./billing/billing";

/** First sync (no cursor) fetches the 30 most recent messages. */
export const INITIAL_FETCH_COUNT = 30;

export interface SyncCursorResponse {
  merchant_id: string;
  mode: "initial_scan" | "incremental";
  fetch_count?: number;
  since?: string | null;
  last_message_id?: string | null;
}

export interface DashboardMetrics {
  emails_scanned: number;
  relevant_messages_found: number;
  order_vaults_created: number;
  evidence_items_captured: number;
  orders_dispute_ready: number;
  orders_missing_evidence: number;
  new_dispute_signals: number;
  packs_ready_for_review: number;
  disputed_value: number;
  estimated_recoverable_value: number;
  currency: string;
}

export class Engine {
  readonly store: Store;

  constructor(store?: Store) {
    this.store = store ?? new Store();
  }

  // Merchants
  upsertMerchant(merchant: Merchant): Merchant {
    return this.store.upsertMerchant(merchant);
  }
  getMerchant(merchantId: string): Merchant | undefined {
    return this.store.getMerchant(merchantId);
  }
  listMerchants(): Merchant[] {
    return this.store.listMerchants();
  }

  // Sync contract (spec §18.4, §19)
  /**
   * Returns the current :SyncCursor: state for a merchant. First sync returns
   * the 30 most recent messages; later syncs return the latest processed
   * timestamp.
   */
  getSyncCursor(merchantId: string): SyncCursorResponse {
    const cursor = this.store.getCursor(merchantId);
    if (!cursor.last_message_id) {
      return { merchant_id: merchantId, mode: "initial_scan", fetch_count: INITIAL_FETCH_COUNT };
    }
    return {
      merchant_id: merchantId,
      mode: "incremental",
      since: cursor.last_received_at,
      last_message_id: cursor.last_message_id,
    };
  }

  // Processing
  process(merchantId: string, messages: SourceMessage[], provider: Merchant["mail_provider"] = "gmail"): ProcessResult {
    return processBatch(this.store, merchantId, messages, provider);
  }

  /** Bounded resync / fallback scan over recent messages (spec §18.4). */
  resync(merchantId: string, messages: SourceMessage[], provider: Merchant["mail_provider"] = "gmail"): ProcessResult {
    return processBatch(this.store, merchantId, messages, provider);
  }

  // Vaults, signals, packs, review
  listVaults(merchantId: string): OrderEvidenceVault[] {
    return this.store.listVaults(merchantId);
  }
  getVault(merchantId: string, vaultId: string): OrderEvidenceVault | undefined {
    return this.store.getVault(merchantId, vaultId);
  }
  listSignals(merchantId: string): DisputeSignal[] {
    return this.store.listSignals(merchantId);
  }
  listPacks(merchantId: string): EvidencePack[] {
    return this.store.listPacks(merchantId);
  }
  listReviewQueue(merchantId: string): ReviewQueueItem[] {
    return this.store.listReviewQueue(merchantId);
  }
  listMessages(merchantId: string): StoredMessageRef[] {
    return this.store.listMessageRefs(merchantId);
  }
  listEvidence(merchantId: string, vaultId: string) {
    return this.store.listEvidenceForVault(merchantId, vaultId);
  }

  /** Read a pack and log the access (spec §22). */
  readPack(merchantId: string, packId: string, actor = "merchant"): EvidencePack | undefined {
    const pack = this.store.getPack(merchantId, packId);
    if (pack) {
      const entry: AccessLogEntry = {
        id: nextId("access"),
        merchant_id: merchantId,
        pack_id: packId,
        actor,
        at: new Date().toISOString(),
      };
      this.store.putAccessLog(entry);
    }
    return pack;
  }
  listAccessLog(merchantId: string): AccessLogEntry[] {
    return this.store.listAccessLog(merchantId);
  }

  /** Record explicit merchant approval. Nothing is submitted autonomously; the pack is only marked for merchant action. */
  approvePack(merchantId: string, packId: string, approvedBy = "merchant"): EvidencePack | undefined {
    const pack = this.store.getPack(merchantId, packId);
    if (!pack) return undefined;
    pack.status = "approved";
    pack.approved_at = new Date().toISOString();
    pack.approved_by = approvedBy;
    this.store.putPack(pack);
    return pack;
  }

  /** Merchant overrides the recommendation (for example, choose refund instead). */
  overridePack(merchantId: string, packId: string, recommendation: Recommendation, by = "merchant"): EvidencePack | undefined {
    const pack = this.store.getPack(merchantId, packId);
    if (!pack) return undefined;
    pack.recommendation = recommendation;
    pack.status = "overridden";
    pack.approved_at = new Date().toISOString();
    pack.approved_by = by;
    this.store.putPack(pack);
    return pack;
  }

  /** Log recovered revenue for a won dispute (outcome-based billing, spec §23). Approval should already be recorded. */
  logRecoveredRevenue(merchantId: string, packId: string, amount: number, currency = "GBP"): BillingEvent | undefined {
    const pack = this.store.getPack(merchantId, packId);
    if (!pack) return undefined;
    const event = Billing.recoveredRevenueLogged(merchantId, packId, amount, currency);
    this.store.putBilling(event);
    return event;
  }

  // Billing
  listBilling(merchantId: string): BillingEvent[] {
    return this.store.listBilling(merchantId);
  }
  usage(merchantId: string): UsageSummary {
    return aggregateUsage(this.store.listBilling(merchantId));
  }
  invoice(merchantId: string): Invoice {
    const merchant = this.store.getMerchant(merchantId);
    const plan = merchant?.plan ?? "Growth";
    return computeInvoice(plan, this.usage(merchantId));
  }
  plans() {
    return PLANS;
  }

  // Dashboard and digest (spec §16)
  dashboard(merchantId: string): DashboardMetrics {
    const usage = this.usage(merchantId);
    const vaults = this.store.listVaults(merchantId);
    const signals = this.store.listSignals(merchantId);
    const packs = this.store.listPacks(merchantId);

    const disputeReady = vaults.filter((v) => v.evidence_status === "dispute_ready").length;
    const missingEvidence = vaults.filter((v) =>
      ["missing_delivery_proof", "missing_policy_snapshot", "missing_product_snapshot", "weak_evidence"].includes(
        v.evidence_status
      )
    ).length;

    const disputedValue = signals.reduce((sum, s) => sum + (s.disputed_amount ?? 0), 0);
    const recoverable = packs
      .filter((p) => p.recommendation === "contest")
      .reduce((sum, p) => {
        const sig = signals.find((s) => s.id === p.signal_id);
        return sum + (sig?.disputed_amount ?? 0);
      }, 0);

    return {
      emails_scanned: usage.emails_scanned,
      relevant_messages_found: usage.relevant_messages,
      order_vaults_created: vaults.length,
      evidence_items_captured: usage.evidence_items_captured,
      orders_dispute_ready: disputeReady,
      orders_missing_evidence: missingEvidence,
      new_dispute_signals: signals.length,
      packs_ready_for_review: packs.filter((p) => p.status === "ready_for_review").length,
      disputed_value: disputedValue,
      estimated_recoverable_value: recoverable,
      currency: usage.currency,
    };
  }

  /** Daily digest text and figures (spec §16.5). */
  digest(merchantId: string) {
    const d = this.dashboard(merchantId);
    const vaults = this.store.listVaults(merchantId);
    const packs = this.store.listPacks(merchantId);
    return {
      emails_scanned: d.emails_scanned,
      relevant_merchant_emails: d.relevant_messages_found,
      order_vaults_created: vaults.length,
      delivery_confirmations_captured: this.store
        .listEvidence(merchantId)
        .filter((e) => e.type === "tracking_delivered").length,
      orders_dispute_ready: d.orders_dispute_ready,
      new_dispute_signals: d.new_dispute_signals,
      ready_packs: packs.filter((p) => p.status === "ready_for_review").length,
      needs_review: packs.filter((p) => p.status === "needs_human_review").length,
      disputed_value: d.disputed_value,
      estimated_recoverable_value: d.estimated_recoverable_value,
      currency: d.currency,
    };
  }

  // Data deletion (spec §22)
  deleteMerchant(merchantId: string): boolean {
    return this.store.deleteMerchant(merchantId);
  }
}

export * from "./core/types";
export { processBatch } from "./pipeline/pipeline";
