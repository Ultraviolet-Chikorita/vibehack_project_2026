// ============================================================
// app — V1 dispute-readiness engine entry point
// Generated from: app.plain
// Imports: dispute-engine-core, email-filtering, event-extraction,
//          evidence-vaults, evidence-scoring, dispute-detection,
//          pack-generation, billing-metering, processing-pipeline
// ============================================================
//
// Acceptance test (demo dataset, order #1048):
//   processBatch() should classify seeded messages, build the vault,
//   score it, detect the DisputeSignal, generate the EvidencePack,
//   and emit BillingEvent records — all held for Merchant review,
//   no mailbox message modified or sent.
// ============================================================

export * from "./types";
export * from "./email-filtering";
export * from "./event-extraction";
export * from "./evidence-vaults";
export * from "./evidence-scoring";
export * from "./dispute-detection";
export * from "./pack-generation";
export * from "./billing-metering";
export * from "./processing-pipeline";

import { OrderEvidenceVault, SyncCursor } from "./types";
import { getSyncCursor, processBatch, ProcessRequest, SyncRequest } from "./processing-pipeline";

// ── In-memory store (replace with persistent datastore per merchant) ──

const store: {
  vaults: OrderEvidenceVault[];
  processedMessageIds: Set<string>;
  cursors: SyncCursor[];
} = {
  vaults: [],
  processedMessageIds: new Set(),
  cursors: [],
};

// ── HTTP-style handlers (wire to your framework of choice) ────────────

export function handleSyncCursor(req: SyncRequest) {
  return getSyncCursor(req, store.cursors);
}

export function handleProcessBatch(req: ProcessRequest) {
  // Safety: read-only on mailbox data — pipeline never modifies messages
  return processBatch(req, store);
}
