/**
 * In-memory datastore, keyed by :Merchant:.
 *
 * dispute-engine-core.plain · implementation reqs:
 *  - Persists Merchant, OrderEvidenceVault, EvidenceItem, DisputeSignal,
 *    EvidencePack, BillingEvent, and SyncCursor records keyed by :Merchant:.
 *  - Every record carries the :Merchant: identifier so data from different
 *    merchants is never mixed.
 *  - Supports deleting all data for a :Merchant: on request (spec §22).
 *
 * A single process-wide store is sufficient for the hackathon demo; the shape
 * mirrors what a per-merchant keyed database would hold.
 */
import {
  AccessLogEntry,
  BillingEvent,
  CommerceEvent,
  DisputeSignal,
  EvidenceItem,
  EvidencePack,
  Merchant,
  OrderEvidenceVault,
  ReviewQueueItem,
  StoredMessageRef,
  SyncCursor,
} from "./types";

interface MerchantBucket {
  merchant: Merchant;
  messages: Map<string, StoredMessageRef>; // by internal id
  externalSeen: Set<string>; // external_message_id de-dupe (spec §19)
  commerceEvents: Map<string, CommerceEvent>;
  vaults: Map<string, OrderEvidenceVault>; // by vault id
  vaultByOrderId: Map<string, string>; // order_id -> vault id
  evidence: Map<string, EvidenceItem>;
  signals: Map<string, DisputeSignal>;
  packs: Map<string, EvidencePack>;
  packBySignal: Map<string, string>; // signal id -> pack id
  billing: BillingEvent[];
  reviewQueue: ReviewQueueItem[];
  accessLog: AccessLogEntry[];
  cursor: SyncCursor;
}

function emptyBucket(merchant: Merchant): MerchantBucket {
  return {
    merchant,
    messages: new Map(),
    externalSeen: new Set(),
    commerceEvents: new Map(),
    vaults: new Map(),
    vaultByOrderId: new Map(),
    evidence: new Map(),
    signals: new Map(),
    packs: new Map(),
    packBySignal: new Map(),
    billing: [],
    reviewQueue: [],
    accessLog: [],
    cursor: {
      merchant_id: merchant.id,
      last_message_id: null,
      last_received_at: null,
      updated_at: new Date(0).toISOString(),
    },
  };
}

export class Store {
  private buckets = new Map<string, MerchantBucket>();

  upsertMerchant(merchant: Merchant): Merchant {
    const existing = this.buckets.get(merchant.id);
    if (existing) {
      existing.merchant = { ...existing.merchant, ...merchant };
      return existing.merchant;
    }
    this.buckets.set(merchant.id, emptyBucket(merchant));
    return merchant;
  }

  getMerchant(merchantId: string): Merchant | undefined {
    return this.buckets.get(merchantId)?.merchant;
  }

  listMerchants(): Merchant[] {
    return [...this.buckets.values()].map((b) => b.merchant);
  }

  /** Returns the bucket, creating an anonymous merchant if needed. */
  private bucket(merchantId: string): MerchantBucket {
    let b = this.buckets.get(merchantId);
    if (!b) {
      b = emptyBucket({
        id: merchantId,
        name: merchantId,
        platforms: [],
        mail_provider: "gmail",
        plan: "Growth",
        mailbox_connected: false,
      });
      this.buckets.set(merchantId, b);
    }
    return b;
  }

  // --- de-duplication (spec §19: dedupe by mailbox message id) -------------
  hasSeenExternal(merchantId: string, externalMessageId: string): boolean {
    return this.bucket(merchantId).externalSeen.has(externalMessageId);
  }
  markSeenExternal(merchantId: string, externalMessageId: string): void {
    this.bucket(merchantId).externalSeen.add(externalMessageId);
  }

  // --- messages ------------------------------------------------------------
  putMessageRef(ref: StoredMessageRef): void {
    this.bucket(ref.merchant_id).messages.set(ref.id, ref);
  }
  getMessageRef(merchantId: string, id: string): StoredMessageRef | undefined {
    return this.bucket(merchantId).messages.get(id);
  }
  listMessageRefs(merchantId: string): StoredMessageRef[] {
    return [...this.bucket(merchantId).messages.values()];
  }

  // --- commerce events -----------------------------------------------------
  putCommerceEvent(ev: CommerceEvent): void {
    this.bucket(ev.merchant_id).commerceEvents.set(ev.id, ev);
  }
  listCommerceEvents(merchantId: string): CommerceEvent[] {
    return [...this.bucket(merchantId).commerceEvents.values()];
  }

  // --- vaults --------------------------------------------------------------
  putVault(vault: OrderEvidenceVault): void {
    const b = this.bucket(vault.merchant_id);
    b.vaults.set(vault.id, vault);
    b.vaultByOrderId.set(vault.order_id, vault.id);
  }
  getVault(merchantId: string, vaultId: string): OrderEvidenceVault | undefined {
    return this.bucket(merchantId).vaults.get(vaultId);
  }
  getVaultByOrderId(merchantId: string, orderId: string): OrderEvidenceVault | undefined {
    const b = this.bucket(merchantId);
    const id = b.vaultByOrderId.get(orderId);
    return id ? b.vaults.get(id) : undefined;
  }
  listVaults(merchantId: string): OrderEvidenceVault[] {
    return [...this.bucket(merchantId).vaults.values()];
  }

  // --- evidence items ------------------------------------------------------
  putEvidence(item: EvidenceItem): void {
    this.bucket(item.merchant_id).evidence.set(item.id, item);
  }
  listEvidence(merchantId: string): EvidenceItem[] {
    return [...this.bucket(merchantId).evidence.values()];
  }
  listEvidenceForVault(merchantId: string, vaultId: string): EvidenceItem[] {
    return this.listEvidence(merchantId).filter((e) => e.vault_id === vaultId);
  }
  /** True when this vault already has an evidence item of `type` from `sourceMessageId`. */
  hasEvidence(merchantId: string, vaultId: string, type: string, sourceMessageId: string): boolean {
    return this.listEvidenceForVault(merchantId, vaultId).some(
      (e) => e.type === type && e.source_message_id === sourceMessageId
    );
  }

  // --- dispute signals -----------------------------------------------------
  putSignal(signal: DisputeSignal): void {
    this.bucket(signal.merchant_id).signals.set(signal.id, signal);
  }
  listSignals(merchantId: string): DisputeSignal[] {
    return [...this.bucket(merchantId).signals.values()];
  }
  hasSignalFromMessage(merchantId: string, sourceMessageId: string): boolean {
    return this.listSignals(merchantId).some((s) => s.source_message_id === sourceMessageId);
  }

  // --- packs ---------------------------------------------------------------
  putPack(pack: EvidencePack): void {
    const b = this.bucket(pack.merchant_id);
    b.packs.set(pack.id, pack);
    b.packBySignal.set(pack.signal_id, pack.id);
  }
  getPack(merchantId: string, packId: string): EvidencePack | undefined {
    return this.bucket(merchantId).packs.get(packId);
  }
  getPackForSignal(merchantId: string, signalId: string): EvidencePack | undefined {
    const b = this.bucket(merchantId);
    const id = b.packBySignal.get(signalId);
    return id ? b.packs.get(id) : undefined;
  }
  listPacks(merchantId: string): EvidencePack[] {
    return [...this.bucket(merchantId).packs.values()];
  }

  // --- billing -------------------------------------------------------------
  putBilling(event: BillingEvent): void {
    this.bucket(event.merchant_id).billing.push(event);
  }
  listBilling(merchantId: string): BillingEvent[] {
    return [...this.bucket(merchantId).billing];
  }

  // --- review queue --------------------------------------------------------
  putReviewItem(item: ReviewQueueItem): void {
    this.bucket(item.merchant_id).reviewQueue.push(item);
  }
  listReviewQueue(merchantId: string): ReviewQueueItem[] {
    return [...this.bucket(merchantId).reviewQueue];
  }

  // --- access log (spec §22) ----------------------------------------------
  putAccessLog(entry: AccessLogEntry): void {
    this.bucket(entry.merchant_id).accessLog.push(entry);
  }
  listAccessLog(merchantId: string): AccessLogEntry[] {
    return [...this.bucket(merchantId).accessLog];
  }

  // --- sync cursor ---------------------------------------------------------
  getCursor(merchantId: string): SyncCursor {
    return { ...this.bucket(merchantId).cursor };
  }
  setCursor(cursor: SyncCursor): void {
    this.bucket(cursor.merchant_id).cursor = { ...cursor };
  }

  // --- deletion (spec §22: delete all data for a merchant) -----------------
  deleteMerchant(merchantId: string): boolean {
    return this.buckets.delete(merchantId);
  }

  /** Wipe the entire store (used by tests and demo reseeding). */
  reset(): void {
    this.buckets.clear();
  }
}
