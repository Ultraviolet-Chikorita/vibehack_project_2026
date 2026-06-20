/**
 * API smoke tests for the HTTP server (spec §18) — boots the Express app on an
 * ephemeral port and drives the onboarding → scan → review → approve flow.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { Engine } from "../src/engine";
import { createApp } from "../src/server/app";
import { resetIds } from "../src/engine/core/ids";

let server: Server;
let base: string;

beforeAll(async () => {
  resetIds();
  const app = createApp(new Engine());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server?.close();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
async function get(path: string): Promise<any> {
  const r = await fetch(base + path);
  return r.json();
}
async function post(path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json() };
}

describe("HTTP API (spec §18)", () => {
  it("reports health", async () => {
    const res = await get("/api/health");
    expect(res.ok).toBe(true);
  });

  it("refuses to scan before the mailbox is connected", async () => {
    const res = await post("/api/mailbox/scan");
    expect(res.status).toBe(400);
  });

  it("connects a mailbox (simulated OAuth) then runs the initial scan", async () => {
    const connect = await post("/api/auth/connect", { provider: "google" });
    expect(connect.json.data.message).toContain("Mailbox connected successfully");

    const scan = await post("/api/mailbox/scan");
    expect(scan.status).toBe(200);
    expect(scan.json.data.dashboard.emails_scanned).toBe(184);
    expect(scan.json.data.dashboard.order_vaults_created).toBe(12);
    expect(scan.json.data.dashboard.new_dispute_signals).toBe(3);
    expect(scan.json.data.dashboard.packs_ready_for_review).toBe(2);
  });

  it("returns an incremental sync cursor after the scan", async () => {
    const res = await get("/api/mailbox/sync-cursor");
    expect(res.data.mode).toBe("incremental");
  });

  it("exposes the #1048 vault scoring 92 with a contest pack at 0.82", async () => {
    const vault = await get("/api/vaults/vault_1048");
    expect(vault.data.vault.evidence_score).toBe(92);

    const packs = await get("/api/packs");
    const heroPack = packs.data.find((p: { vault_id: string }) => p.vault_id === "vault_1048");
    expect(heroPack.recommendation).toBe("contest");
    expect(heroPack.recommendation_confidence).toBe(0.82);
  });

  it("approves a pack only on explicit merchant action and logs pack access", async () => {
    const packs = await get("/api/packs");
    const id = packs.data[0].id;
    await get(`/api/packs/${id}`); // read → access logged
    const approve = await post(`/api/packs/${id}/approve`, { approved_by: "merchant" });
    expect(approve.json.data.status).toBe("approved");

    const log = await get("/api/access-log");
    expect(log.data.length).toBeGreaterThan(0);
  });

  it("validates the Microsoft Graph webhook challenge", async () => {
    const r = await fetch(base + "/api/webhooks/outlook?validationToken=abc123", { method: "POST" });
    const text = await r.text();
    expect(text).toBe("abc123");
  });

  it("computes a Solvimon invoice for the merchant", async () => {
    const res = await get("/api/billing/invoice");
    expect(res.data.plan).toBe("Growth");
    expect(res.data.base_fee).toBe(149);
  });
});
