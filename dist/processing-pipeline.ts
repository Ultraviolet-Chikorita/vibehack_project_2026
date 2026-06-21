// ============================================================
// processing-pipeline — orchestration, sync endpoint, process endpoint
// Generated from: processing-pipeline.plain (spec §18.4, §18.5, §19)
// ============================================================

import { SourceMessage, OrderEvidenceVault, DisputeSignal, BillingEvent, SyncCursor } from "./types";
import { filterMessage, classifyMessage } from "./email-filtering";
import { extractCommerceEvent } from "./event-extraction";
import { createVault, linkEventToVault, storeEvidenceItem, inferEvidenceCategory } from "./evidence-vaults";
import { scoreVault, applyScore } from "./evidence-scoring";
import { detectDisputeSignal, createDisputeSignal } from "./dispute-detection";
import { generateEvidencePack, DISPUTE_READINESS_THRESHOLD } from "./pack-generation";
import {
  emitEmailsScanned,
  emitRelevantMessageProcessed,
  emitVaultCreated,
  emitEvidenceItemCaptured,
  emitDisputeSignalDetected,
  emitEvidencePackGenerated,
  emitMailboxScanCompleted,
} from "./billing-metering";

export interface SyncRequest {
  merchantId: string;
}

export interface SyncResponse {
  cursor?: SyncCursor;
  fetchStrategy: "recent_30" | "from_cursor";
  fromTimestamp?: Date;
}

export interface ProcessRequest {
  merchantId: string;
  messages: SourceMessage[];
}

export interface ProcessResponse {
  processedCount: number;
  skippedCount: number;
  vaults: OrderEvidenceVault[];
  newDisputeSignals: DisputeSignal[];
  billingEvents: BillingEvent[];
  reviewQueue: string[]; // sourceMessageIds that need human review
}

/**
 * Sync-cursor endpoint: tells the Gmail add-on where to start fetching.
 */
export function getSyncCursor(
  request: SyncRequest,
  cursors: SyncCursor[]
): SyncResponse {
  const cursor = cursors.find((c) => c.merchantId === request.merchantId);
  if (!cursor || !cursor.lastProcessedAt) {
    return { fetchStrategy: "recent_30" };
  }
  return {
    cursor,
    fetchStrategy: "from_cursor",
    fromTimestamp: cursor.lastProcessedAt,
  };
}

/**
 * Process endpoint: runs a batch of SourceMessages through the full pipeline.
 * Idempotent on SourceMessage.id — duplicate messages are skipped.
 */
export function processBatch(
  request: ProcessRequest,
  state: {
    vaults: OrderEvidenceVault[];
    processedMessageIds: Set<string>;
    cursors: SyncCursor[];
  }
): ProcessResponse {
  const { merchantId, messages } = request;
  const billingEvents: BillingEvent[] = [];
  const newDisputeSignals: DisputeSignal[] = [];
  const reviewQueue: string[] = [];

  let processedCount = 0;
  let skippedCount = 0;
  let relevantCount = 0;

  billingEvents.push(emitEmailsScanned(merchantId, messages.length));

  for (const message of messages) {
    // Idempotency: skip already-processed messages
    if (state.processedMessageIds.has(message.id)) {
      skippedCount++;
      continue;
    }

    // Step 1: first-pass filter
    const filterResult = filterMessage(message);
    if (!filterResult.isRelevant) {
      state.processedMessageIds.add(message.id);
      skippedCount++;
      continue;
    }

    relevantCount++;
    billingEvents.push(emitRelevantMessageProcessed(merchantId));

    // Step 2: classify
    const { classification, confidence } = classifyMessage(message);
    if (classification === "needs_review" || confidence < 0.6) {
      reviewQueue.push(message.id);
      state.processedMessageIds.add(message.id);
      continue;
    }

    // Step 3: extract CommerceEvent
    const event = extractCommerceEvent(message, classification, merchantId);

    // Step 4: link to or create vault
    let vault: OrderEvidenceVault | undefined;

    if (classification === "order_confirmation" && event.orderId) {
      const result = createVault(event, state.vaults);
      if ("existing" in result) {
        vault = result.existing;
      } else {
        vault = result;
        state.vaults.push(vault);
        billingEvents.push(emitVaultCreated(merchantId, vault.orderId));
      }
    } else {
      const linkResult = linkEventToVault(event, state.vaults);
      if (!linkResult) {
        reviewQueue.push(message.id);
        state.processedMessageIds.add(message.id);
        continue;
      }
      if (linkResult.needsReview) {
        reviewQueue.push(message.id);
        state.processedMessageIds.add(message.id);
        continue;
      }
      vault = state.vaults.find((v) => v.id === linkResult.result.vaultId);
    }

    if (!vault) {
      reviewQueue.push(message.id);
      state.processedMessageIds.add(message.id);
      continue;
    }

    // Step 5: store EvidenceItem
    const { category, strength, summary } = inferEvidenceCategory(event);
    const item = storeEvidenceItem(vault, event, category, strength, summary);
    billingEvents.push(emitEvidenceItemCaptured(merchantId, vault.id));

    // Step 6: update EvidenceScore
    const scoreResult = scoreVault(vault);
    applyScore(vault, scoreResult);

    // Step 7: detect DisputeSignal
    const detection = detectDisputeSignal(event, message);
    if (detection.detected) {
      const signal = createDisputeSignal(event, detection, state.vaults);
      if (signal) {
        newDisputeSignals.push(signal);
        billingEvents.push(emitDisputeSignalDetected(merchantId, signal));

        // Step 8: generate EvidencePack if vault meets threshold
        if (vault.evidenceScore >= DISPUTE_READINESS_THRESHOLD) {
          const pack = generateEvidencePack(signal, vault);
          billingEvents.push(emitEvidencePackGenerated(merchantId, pack));
        }
      } else {
        reviewQueue.push(message.id); // no vault found for dispute
      }
    }

    // Mark processed
    state.processedMessageIds.add(message.id);
    processedCount++;
  }

  // Emit mailbox scan summary
  billingEvents.push(emitMailboxScanCompleted(merchantId, messages.length, relevantCount));

  // Advance SyncCursor
  const lastMessage = [...messages]
    .filter((m) => state.processedMessageIds.has(m.id))
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];

  if (lastMessage) {
    const cursorIndex = state.cursors.findIndex((c) => c.merchantId === merchantId);
    const newCursor: SyncCursor = {
      merchantId,
      lastProcessedMessageId: lastMessage.id,
      lastProcessedAt: lastMessage.receivedAt,
      updatedAt: new Date(),
    };
    if (cursorIndex >= 0) {
      state.cursors[cursorIndex] = newCursor;
    } else {
      state.cursors.push(newCursor);
    }
  }

  return {
    processedCount,
    skippedCount,
    vaults: state.vaults,
    newDisputeSignals,
    billingEvents,
    reviewQueue,
  };
}
