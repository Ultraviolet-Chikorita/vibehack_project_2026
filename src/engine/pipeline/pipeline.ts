/**
 * Processing pipeline (processing-pipeline.plain; spec §19).
 *
 * For each fetched message, in order:
 * normalise → filter → classify → extract :CommerceEvent: → link or create an
 * :OrderEvidenceVault: → store :EvidenceItem: → update :EvidenceScore: → detect
 * :DisputeSignal: → generate :EvidencePack: when ready → emit :BillingEvent:.
 *
 * Idempotent on `external_message_id`: the same message is processed once, and
 * re-processing a batch creates no duplicate vaults, evidence items, or packs.
 */
import {
  CommerceEvent,
  DisputeSignal,
  MailProvider,
  OrderEvidenceVault,
  SourceMessage,
  StoredMessageRef,
} from "../core/types";
import { Store } from "../core/store";
import { nextId } from "../core/ids";
import { firstPassFilter, classify } from "../filtering/filter";
import { extractCommerceEvent } from "../extraction/extract";
import { buildProfile, createVaultFromEvent, evidenceItemFromEvent } from "../vaults/vaults";
import { findLink, tokenSimilarity } from "../vaults/linking";
import { AddressMatch, scoreVault, ScoringInput } from "../scoring/scoring";
import { detectDisputeSignal } from "../disputes/detection";
import { generatePack } from "../packs/generation";
import { Billing } from "../billing/billing";

export interface ProcessResult {
  merchant_id: string;
  processed: number;
  skipped_duplicates: number;
  relevant: number;
  irrelevant: number;
  vaults_created: string[];
  evidence_items_created: number;
  signals_created: string[];
  packs_created: string[];
  review_queue_added: number;
}

export function processBatch(
  store: Store,
  merchantId: string,
  rawMessages: SourceMessage[],
  provider: MailProvider = "gmail"
): ProcessResult {
  const result: ProcessResult = {
    merchant_id: merchantId,
    processed: 0,
    skipped_duplicates: 0,
    relevant: 0,
    irrelevant: 0,
    vaults_created: [],
    evidence_items_created: 0,
    signals_created: [],
    packs_created: [],
    review_queue_added: 0,
  };

  // Process in chronological order so evidence accumulates before any dispute.
  const messages = [...rawMessages].sort(
    (a, b) => Date.parse(a.received_at) - Date.parse(b.received_at)
  );

  let newestProcessed: { id: string; received_at: string } | null = null;

  for (const raw of messages) {
    // 0. De-duplicate by mailbox message id.
    if (store.hasSeenExternal(merchantId, raw.external_message_id)) {
      result.skipped_duplicates++;
      continue;
    }
    store.markSeenExternal(merchantId, raw.external_message_id);

    // 1. Normalise.
    const message: SourceMessage = {
      ...raw,
      merchant_id: merchantId,
      provider,
      sender: (raw.sender ?? "").trim(),
      subject: (raw.subject ?? "").trim(),
    };
    result.processed++;
    newestProcessed = { id: message.id, received_at: message.received_at };

    // 2. First-pass filter.
    const filter = firstPassFilter(message);
    if (!filter.relevant) {
      // Store only minimal metadata for irrelevant messages and stop.
      result.irrelevant++;
      store.putMessageRef(minimalRef(message, "irrelevant", 0));
      continue;
    }
    result.relevant++;

    // 3. Classify.
    const { classification, confidence } = classify(message);
    store.putMessageRef(minimalRef(message, classification, confidence, true));

    // 4. Extract commerce event.
    const event = extractCommerceEvent(message, classification);
    store.putCommerceEvent(event);

    // 5. Link to or create a vault.
    const vault = linkOrCreateVault(store, merchantId, message, event, classification, provider, result);

    // 6. Store an evidence item when the classification counts as evidence.
    if (vault) {
      const item = evidenceItemFromEvent(event, vault.id, classification, message.subject);
      if (item && !store.hasEvidence(merchantId, vault.id, item.type, item.source_message_id)) {
        store.putEvidence(item);
        result.evidence_items_created++;
        store.putBilling(Billing.evidenceItemCaptured(merchantId, item.id));

        // 7. Update the vault score.
        recomputeVaultScore(store, vault);
      }
    }

    // 8. Detect a dispute signal.
    const priorDisputes = event.customer_email
      ? store.listSignals(merchantId).filter((s) => signalCustomerEmail(store, merchantId, s) === event.customer_email).length
      : 0;
    const detected = detectDisputeSignal({
      subject: message.subject,
      body: message.body,
      sender: message.sender,
      classification,
      event,
      priorDisputesForCustomer: priorDisputes,
    });

    if (detected && !store.hasSignalFromMessage(merchantId, message.id)) {
      const linkedVault = vault ?? (event.order_id ? store.getVaultByOrderId(merchantId, event.order_id) : undefined);
      const signal: DisputeSignal = {
        id: nextId("sig"),
        merchant_id: merchantId,
        vault_id: linkedVault ? linkedVault.id : null,
        source_message_id: message.id,
        signal_type: detected.signal_type,
        category: detected.category,
        reason: detected.reason,
        disputed_amount: detected.disputed_amount,
        currency: detected.currency,
        deadline: detected.deadline,
        detected_from_subject: message.subject,
        detected_at: message.received_at,
      };
      store.putSignal(signal);
      result.signals_created.push(signal.id);
      store.putBilling(Billing.disputeSignalDetected(merchantId, signal.id, signal.disputed_amount, signal.currency));

      if (!linkedVault) {
        // Queue unmatched signals for review instead of dropping them.
        store.putReviewItem({
          id: nextId("review"),
          merchant_id: merchantId,
          kind: "unmatched_dispute_signal",
          source_message_id: message.id,
          reason: "Dispute signal matched no existing order vault",
          created_at: new Date().toISOString(),
        });
        result.review_queue_added++;
      } else {
        // 9. Generate an evidence pack for the linked signal.
        const existing = store.getPackForSignal(merchantId, signal.id);
        if (!existing) {
          recomputeVaultScore(store, linkedVault);
          const pack = generatePack({
            vault: linkedVault,
            signal,
            evidence: store.listEvidenceForVault(merchantId, linkedVault.id),
            messageIndex: buildMessageIndex(store, merchantId),
          });
          store.putPack(pack);
          result.packs_created.push(pack.id);
          store.putBilling(
            Billing.evidencePackGenerated(merchantId, pack.id, signal.disputed_amount, signal.currency)
          );
          // Reflect the dispute in the vault lifecycle status.
          linkedVault.status = "disputed";
          linkedVault.last_updated = new Date().toISOString();
          store.putVault(linkedVault);
        }
      }
    }
  }

  // 10. Emit one mailbox_scan_completed billing event for the batch.
  if (result.processed > 0) {
    store.putBilling(
      Billing.mailboxScanCompleted(merchantId, {
        emails_scanned: result.processed,
        relevant_messages: result.relevant,
        order_vaults_created: result.vaults_created.length,
        dispute_signals_detected: result.signals_created.length,
      })
    );
  }

  // 11. Advance the sync cursor to the newest processed message.
  if (newestProcessed) {
    const current = store.getCursor(merchantId);
    const newer =
      !current.last_received_at || Date.parse(newestProcessed.received_at) >= Date.parse(current.last_received_at);
    if (newer) {
      store.setCursor({
        merchant_id: merchantId,
        last_message_id: newestProcessed.id,
        last_received_at: newestProcessed.received_at,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return result;
}

// Helpers

function minimalRef(
  message: SourceMessage,
  classification: StoredMessageRef["classification"],
  confidence: number,
  relevant = false
): StoredMessageRef {
  // Content-minimised: subject/sender metadata only, never the body (spec §22).
  return {
    id: message.id,
    merchant_id: message.merchant_id,
    provider: message.provider,
    external_message_id: message.external_message_id,
    sender: message.sender,
    subject: message.subject,
    received_at: message.received_at,
    classification,
    confidence,
    relevant,
    processed: true,
  };
}

function linkOrCreateVault(
  store: Store,
  merchantId: string,
  message: SourceMessage,
  event: CommerceEvent,
  classification: StoredMessageRef["classification"],
  provider: MailProvider,
  result: ProcessResult
): OrderEvidenceVault | null {
  // Order confirmations ensure a vault exists for the order.
  if (classification === "order_confirmation" && event.order_id) {
    const existing = store.getVaultByOrderId(merchantId, event.order_id);
    if (existing) {
      event.linked_vault_id = existing.id;
      store.putCommerceEvent(event);
      return existing;
    }
    const vault = createVaultFromEvent(event, provider);
    store.putVault(vault);
    result.vaults_created.push(vault.id);
    store.putBilling(Billing.orderVaultCreated(merchantId, vault.id));
    event.linked_vault_id = vault.id;
    store.putCommerceEvent(event);
    return vault;
  }

  // Otherwise, link to an existing vault using :LinkingKeys:.
  const profiles = store.listVaults(merchantId).map((v) =>
    buildProfile(v, store.listCommerceEvents(merchantId).filter((e) => e.linked_vault_id === v.id))
  );
  const decision = findLink(event, profiles);

  if (decision.vault_id) {
    event.linked_vault_id = decision.vault_id;
    store.putCommerceEvent(event);
    return store.getVault(merchantId, decision.vault_id) ?? null;
  }

  if (decision.candidate_vault_id) {
    // Low-confidence link → review queue, not auto-applied.
    store.putReviewItem({
      id: nextId("review"),
      merchant_id: merchantId,
      kind: "low_confidence_link",
      source_message_id: message.id,
      commerce_event_id: event.id,
      candidate_vault_id: decision.candidate_vault_id,
      link_confidence: decision.link_confidence,
      reason: `Link confidence ${decision.link_confidence} below threshold (matched: ${decision.matched_on.join(", ")})`,
      created_at: new Date().toISOString(),
    });
    result.review_queue_added++;
  }
  return null;
}

/** Build scorer input for a vault from its evidence items and events. */
export function buildScoringInput(store: Store, vault: OrderEvidenceVault): ScoringInput {
  const items = store.listEvidenceForVault(vault.merchant_id, vault.id);
  const events = store.listCommerceEvents(vault.merchant_id).filter((e) => e.linked_vault_id === vault.id);

  const hasType = (t: string) => items.some((i) => i.type === t);
  const addresses: string[] = [];
  let hasProductName = false;
  let refundIssued = false;
  for (const e of events) {
    if (e.shipping_address) addresses.push(e.shipping_address);
    if (e.billing_address) addresses.push(e.billing_address);
    if (e.product_name) hasProductName = true;
    if (e.refund_amount && e.event_type === "refund_issued") refundIssued = true;
  }

  const conflicts = detectConflicts(items, events);

  return {
    hasOrderProof: hasType("order_confirmation"),
    hasPaymentProof: hasType("payment_confirmation"),
    hasFulfilmentProof: hasType("fulfilment_confirmation"),
    hasDeliveryProof: hasType("tracking_delivered"),
    hasTracking: hasType("tracking_number"),
    addressMatch: computeAddressMatch(addresses),
    hasProductSnapshot: hasType("product_snapshot"),
    hasProductName,
    hasPolicySnapshot: hasType("policy_snapshot"),
    customerMessages: items.filter((i) => i.type === "customer_message").length,
    merchantReplies: items.filter((i) => i.type === "merchant_reply").length,
    refundIssued,
    conflicts,
  };
}

function recomputeVaultScore(store: Store, vault: OrderEvidenceVault): void {
  const input = buildScoringInput(store, vault);
  const score = scoreVault(input);
  vault.evidence_score = score.score;
  vault.evidence_status = score.status;
  vault.missing = score.missing;
  vault.weak = score.weak;
  vault.strongest_evidence = score.strongest_evidence;
  // Lifecycle status reflects the furthest stage reached.
  if (input.hasDeliveryProof) vault.status = "delivered";
  else if (input.hasFulfilmentProof || input.hasTracking) vault.status = "fulfilled";
  else if (input.hasPaymentProof) vault.status = "paid";
  else vault.status = "created";
  vault.last_updated = new Date().toISOString();
  store.putVault(vault);
}

function computeAddressMatch(addresses: string[]): AddressMatch {
  const present = addresses.map((a) => a.trim()).filter(Boolean);
  if (present.length === 0) return "absent";
  if (present.length === 1) return "match"; // Single confirmed address, no contradiction.
  const allSimilar = present.every((a) => tokenSimilarity(a, present[0]) >= 0.5);
  return allSimilar ? "match" : "mismatch";
}

function detectConflicts(
  items: { type: string }[],
  events: CommerceEvent[]
): string[] {
  const conflicts: string[] = [];
  // Contradiction: delivered confirmation alongside a "returned to sender" status.
  const delivered = items.some((i) => i.type === "tracking_delivered");
  const returned = events.some((e) => (e.delivery_status ?? "").toLowerCase().includes("returned"));
  if (delivered && returned) conflicts.push("delivery confirmed but a return-to-sender status was also seen");
  // Contradiction: two different tracking numbers on the same order.
  const trackings = new Set(events.map((e) => e.tracking_number).filter(Boolean));
  if (trackings.size > 1) conflicts.push("multiple distinct tracking numbers on one order");
  return conflicts;
}

function buildMessageIndex(store: Store, merchantId: string): Map<string, { subject: string; received_at: string }> {
  const map = new Map<string, { subject: string; received_at: string }>();
  for (const ref of store.listMessageRefs(merchantId)) {
    map.set(ref.id, { subject: ref.subject, received_at: ref.received_at });
  }
  return map;
}

function signalCustomerEmail(store: Store, merchantId: string, signal: DisputeSignal): string | undefined {
  if (!signal.vault_id) return undefined;
  return store.getVault(merchantId, signal.vault_id)?.customer_email;
}

export { recomputeVaultScore };
