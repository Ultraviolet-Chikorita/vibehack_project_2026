/**
 * Conformance tests for app.plain — the end-to-end demo render.
 */
import { describe, it, expect } from "vitest";
import { Engine } from "../src/engine";
import { resetIds } from "../src/engine/core/ids";
import { DEMO_MERCHANT, order1048Mailbox } from "../src/demo/dataset";

describe("app.plain · end-to-end demo flow for order #1048", () => {
  it("classifies, builds the vault, scores it, detects the signal, generates the pack and emits billing", () => {
    resetIds();
    const engine = new Engine();
    engine.upsertMerchant(DEMO_MERCHANT);
    engine.process(DEMO_MERCHANT.id, order1048Mailbox());

    // dispute_ready vault
    const vault = engine.getVault(DEMO_MERCHANT.id, "vault_1048")!;
    expect(vault.evidence_status).toBe("dispute_ready");

    // linked dispute signal
    const signal = engine.listSignals(DEMO_MERCHANT.id)[0];
    expect(signal.vault_id).toBe(vault.id);

    // auto-generated pack recommending contest
    const pack = engine.listPacks(DEMO_MERCHANT.id)[0];
    expect(pack.recommendation).toBe("contest");

    // corresponding billing events exist
    const billing = engine.listBilling(DEMO_MERCHANT.id);
    expect(billing.some((b) => b.event_type === "evidence_pack_generated")).toBe(true);
    expect(billing.some((b) => b.event_type === "mailbox_scan_completed")).toBe(true);
    expect(billing.some((b) => b.event_type === "order_vault_created")).toBe(true);

    // every evidence item is traceable to a source message
    for (const item of engine.listEvidence(DEMO_MERCHANT.id, vault.id)) {
      expect(item.source_message_id).toBeTruthy();
      expect(engine.listMessages(DEMO_MERCHANT.id).some((m) => m.id === item.source_message_id)).toBe(true);
    }
  });

  it("holds the pack for merchant review — nothing is submitted until approval is recorded", () => {
    resetIds();
    const engine = new Engine();
    engine.upsertMerchant(DEMO_MERCHANT);
    engine.process(DEMO_MERCHANT.id, order1048Mailbox());
    const pack = engine.listPacks(DEMO_MERCHANT.id)[0];

    expect(pack.status).toBe("ready_for_review");
    expect(pack.approved_at).toBeUndefined();

    const approved = engine.approvePack(DEMO_MERCHANT.id, pack.id, "merchant")!;
    expect(approved.status).toBe("approved");
    expect(approved.approved_at).toBeTruthy();
  });

  it("never modifies, deletes, sends, or marks a mailbox message (read-only)", () => {
    resetIds();
    const engine = new Engine();
    engine.upsertMerchant(DEMO_MERCHANT);
    const input = order1048Mailbox();
    const snapshot = JSON.stringify(input);
    engine.process(DEMO_MERCHANT.id, input);
    // The engine never mutates the input messages; there is no send/delete/mark API.
    expect(JSON.stringify(input)).toBe(snapshot);
    // Stored refs are content-minimised (no body retained).
    for (const ref of engine.listMessages(DEMO_MERCHANT.id)) {
      expect((ref as unknown as Record<string, unknown>).body).toBeUndefined();
    }
  });

  it("supports deleting all data for a merchant on request (spec §22)", () => {
    resetIds();
    const engine = new Engine();
    engine.upsertMerchant(DEMO_MERCHANT);
    engine.process(DEMO_MERCHANT.id, order1048Mailbox());
    expect(engine.listVaults(DEMO_MERCHANT.id).length).toBeGreaterThan(0);

    engine.deleteMerchant(DEMO_MERCHANT.id);
    expect(engine.listVaults(DEMO_MERCHANT.id)).toHaveLength(0);
    expect(engine.listPacks(DEMO_MERCHANT.id)).toHaveLength(0);
    expect(engine.listBilling(DEMO_MERCHANT.id)).toHaveLength(0);
  });
});
