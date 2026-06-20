/**
 * Conformance tests for processing-pipeline.plain (spec §19, §18.4/§18.5).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Engine } from "../src/engine";
import { resetIds } from "../src/engine/core/ids";
import { DEMO_MERCHANT, order1048Mailbox } from "../src/demo/dataset";

function freshEngine(): Engine {
  resetIds();
  const engine = new Engine();
  engine.upsertMerchant(DEMO_MERCHANT);
  return engine;
}

describe("processing-pipeline.plain · sync cursor", () => {
  it("instructs a first sync (no cursor) to fetch the 30 most recent messages", () => {
    const engine = freshEngine();
    const cursor = engine.getSyncCursor(DEMO_MERCHANT.id);
    expect(cursor.mode).toBe("initial_scan");
    expect(cursor.fetch_count).toBe(30);
  });

  it("returns the timestamp of the most recently processed message on later syncs", () => {
    const engine = freshEngine();
    engine.process(DEMO_MERCHANT.id, order1048Mailbox());
    const cursor = engine.getSyncCursor(DEMO_MERCHANT.id);
    expect(cursor.mode).toBe("incremental");
    expect(cursor.since).toBe("2026-06-16T09:41:00Z"); // the Stripe dispute, newest message
  });
});

describe("processing-pipeline.plain · process endpoint", () => {
  it("turns the seeded #1048 mailbox into one vault scoring 92, one signal and one contest pack at 0.82", () => {
    const engine = freshEngine();
    const result = engine.process(DEMO_MERCHANT.id, order1048Mailbox());

    const vaults = engine.listVaults(DEMO_MERCHANT.id);
    expect(vaults).toHaveLength(1);
    expect(vaults[0].order_id).toBe("1048");
    expect(vaults[0].evidence_score).toBe(92);
    expect(vaults[0].evidence_status).toBe("dispute_ready");

    const signals = engine.listSignals(DEMO_MERCHANT.id);
    expect(signals).toHaveLength(1);
    expect(signals[0].category).toBe("payment_dispute");
    expect(signals[0].vault_id).toBe(vaults[0].id);

    const packs = engine.listPacks(DEMO_MERCHANT.id);
    expect(packs).toHaveLength(1);
    expect(packs[0].recommendation).toBe("contest");
    expect(packs[0].recommendation_confidence).toBe(0.82);
    expect(packs[0].status).toBe("ready_for_review");

    expect(result.vaults_created).toHaveLength(1);
    expect(result.signals_created).toHaveLength(1);
    expect(result.packs_created).toHaveLength(1);
  });

  it("is idempotent on the SourceMessage identifier — re-processing creates no duplicates", () => {
    const engine = freshEngine();
    engine.process(DEMO_MERCHANT.id, order1048Mailbox());
    const beforeVaults = engine.listVaults(DEMO_MERCHANT.id).length;
    const beforeEvidence = engine.listEvidence(DEMO_MERCHANT.id, "vault_1048").length;
    const beforePacks = engine.listPacks(DEMO_MERCHANT.id).length;
    const beforeSignals = engine.listSignals(DEMO_MERCHANT.id).length;

    const second = engine.process(DEMO_MERCHANT.id, order1048Mailbox());

    expect(second.processed).toBe(0);
    expect(second.skipped_duplicates).toBe(order1048Mailbox().length);
    expect(engine.listVaults(DEMO_MERCHANT.id).length).toBe(beforeVaults);
    expect(engine.listEvidence(DEMO_MERCHANT.id, "vault_1048").length).toBe(beforeEvidence);
    expect(engine.listPacks(DEMO_MERCHANT.id).length).toBe(beforePacks);
    expect(engine.listSignals(DEMO_MERCHANT.id).length).toBe(beforeSignals);
  });

  it("processes a message delivered twice only once", () => {
    const engine = freshEngine();
    const batch = order1048Mailbox();
    const dup = { ...batch[0], id: "msg_dup_internal" }; // same external_message_id, new internal id
    const result = engine.process(DEMO_MERCHANT.id, [batch[0], dup]);
    expect(result.processed).toBe(1);
    expect(result.skipped_duplicates).toBe(1);
  });

  it("advances the cursor so the next sync fetches only newer messages", () => {
    const engine = freshEngine();
    engine.process(DEMO_MERCHANT.id, order1048Mailbox());
    const cursor = engine.getSyncCursor(DEMO_MERCHANT.id);
    // A message older than the cursor would not be re-fetched; the cursor sits at the newest.
    expect(Date.parse(cursor.since!)).toBe(Date.parse("2026-06-16T09:41:00Z"));
  });

  it("routes a dispute signal that matches no vault to review rather than dropping it", () => {
    const engine = freshEngine();
    const orphanDispute = order1048Mailbox().filter((m) => m.subject.includes("dispute"));
    const result = engine.process(DEMO_MERCHANT.id, orphanDispute);
    expect(result.signals_created).toHaveLength(1);
    expect(engine.listReviewQueue(DEMO_MERCHANT.id).some((r) => r.kind === "unmatched_dispute_signal")).toBe(true);
    // No pack is generated without a linked vault.
    expect(engine.listPacks(DEMO_MERCHANT.id)).toHaveLength(0);
  });
});
