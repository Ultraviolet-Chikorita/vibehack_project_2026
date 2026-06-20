/**
 * HTTP API for the V1 dispute-readiness engine (spec §18).
 *
 * Exposes the engine's capabilities as backend endpoints callable by the merchant
 * webapp and the Gmail add-on sync client (dispute-engine-core.plain). OAuth and
 * provider webhooks are simulated for the hackathon demo (spec §25, §29.1/§29.2),
 * with the real request/response shapes preserved.
 */
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import { Engine } from "../engine";
import { Recommendation } from "../engine/core/types";
import { DEMO_MERCHANT, fullDemoMailbox, order1048Mailbox } from "../demo/dataset";

export function createApp(engine: Engine): express.Express {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  // Ensure the demo merchant exists (mailbox not yet connected until OAuth).
  if (!engine.getMerchant(DEMO_MERCHANT.id)) {
    engine.upsertMerchant({ ...DEMO_MERCHANT, mailbox_connected: false });
  }

  const merchantId = (req: Request): string =>
    (req.query.merchant_id as string) || (req.header("x-merchant-id") as string) || DEMO_MERCHANT.id;

  const ok = (res: Response, data: unknown) => res.json({ ok: true, data });
  const fail = (res: Response, code: number, message: string) => res.status(code).json({ ok: false, error: message });

  // --- health -------------------------------------------------------------
  app.get("/api/health", (_req, res) => ok(res, { status: "up", time: new Date().toISOString() }));

  // --- §18.1 Auth (simulated OAuth onboarding, spec §6/§25) ---------------
  app.get("/api/auth/session", (req, res) => {
    const merchant = engine.getMerchant(merchantId(req));
    ok(res, { connected: merchant?.mailbox_connected ?? false, merchant });
  });

  app.post("/api/auth/connect", (req, res) => {
    const provider = (req.body?.provider as "google" | "microsoft") ?? "google";
    const mail_provider = provider === "microsoft" ? "outlook" : "gmail";
    const merchant = engine.upsertMerchant({ ...DEMO_MERCHANT, mail_provider, mailbox_connected: true });
    ok(res, {
      message: "Mailbox connected successfully. We'll start building evidence vaults from your order, fulfilment, tracking, and dispute emails.",
      provider,
      scopes: provider === "microsoft" ? ["Mail.Read", "offline_access", "User.Read"] : ["https://www.googleapis.com/auth/gmail.readonly"],
      merchant,
    });
  });

  app.post("/api/auth/disconnect", (req, res) => {
    const merchant = engine.getMerchant(merchantId(req));
    if (merchant) engine.upsertMerchant({ ...merchant, mailbox_connected: false });
    ok(res, { disconnected: true });
  });

  // --- §19 sync-cursor endpoint -------------------------------------------
  app.get("/api/mailbox/sync-cursor", (req, res) => ok(res, engine.getSyncCursor(merchantId(req))));

  // --- onboarding initial scan (spec §6 step 6, §25 Scene 2) --------------
  app.post("/api/mailbox/scan", (req, res) => {
    const mid = merchantId(req);
    const merchant = engine.getMerchant(mid);
    if (!merchant?.mailbox_connected) return fail(res, 400, "Mailbox not connected. Connect a mailbox first.");
    const result = engine.process(mid, fullDemoMailbox(), merchant.mail_provider);
    return ok(res, { scan: result, dashboard: engine.dashboard(mid) });
  });

  // --- §18.4 manual resync / fallback sync --------------------------------
  app.post("/api/mailbox/resync", (req, res) => {
    const mid = merchantId(req);
    const merchant = engine.getMerchant(mid);
    const messages = Array.isArray(req.body?.messages) && req.body.messages.length ? req.body.messages : fullDemoMailbox();
    const result = engine.resync(mid, messages, merchant?.mail_provider ?? "gmail");
    return ok(res, { resync: result, dashboard: engine.dashboard(mid) });
  });

  // --- processing-pipeline.plain process endpoint -------------------------
  app.post("/api/jobs/process", (req, res) => {
    const mid = merchantId(req);
    const messages = req.body?.messages;
    if (!Array.isArray(messages)) return fail(res, 400, "Body must include a 'messages' array.");
    const merchant = engine.getMerchant(mid);
    return ok(res, engine.process(mid, messages, merchant?.mail_provider ?? "gmail"));
  });

  // --- §18.5 process a single message -------------------------------------
  app.post("/api/jobs/process-message", (req, res) => {
    const mid = merchantId(req);
    const message = req.body?.message;
    if (!message) return fail(res, 400, "Body must include a 'message'.");
    const merchant = engine.getMerchant(mid);
    return ok(res, engine.process(mid, [message], merchant?.mail_provider ?? "gmail"));
  });

  // --- §18.6 renew watches (stub — webhooks simulated for demo) ------------
  app.post("/api/jobs/renew-watches", (req, res) => {
    ok(res, {
      renewed: [],
      note: "Provider watches/subscriptions are simulated for the hackathon demo; fallback sync via /api/mailbox/resync.",
      next_fallback_sync: "daily",
    });
  });

  // --- §18.2 Gmail Pub/Sub webhook (simulated) ----------------------------
  app.post("/api/webhooks/gmail", (req, res) => {
    const mid = merchantId(req);
    // Accept either a simulated {messages:[...]} body or a Pub/Sub-style push.
    let messages = req.body?.messages;
    if (!messages && req.body?.message?.data) {
      try {
        const decoded = JSON.parse(Buffer.from(req.body.message.data, "base64").toString("utf8"));
        messages = decoded.messages ?? [];
      } catch {
        messages = [];
      }
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      // Acknowledge quickly even with nothing to do (spec §18.2).
      return res.status(200).json({ ok: true, data: { processed: 0, note: "ack" } });
    }
    const result = engine.process(mid, messages, "gmail");
    return res.status(200).json({ ok: true, data: result });
  });

  // --- §18.3 Microsoft Graph webhook (simulated) --------------------------
  app.post("/api/webhooks/outlook", (req, res) => {
    // Respond to the Microsoft validation challenge (spec §18.3).
    const validationToken = (req.query.validationToken as string) || (req.body?.validationToken as string);
    if (validationToken) return res.status(200).type("text/plain").send(validationToken);

    const mid = merchantId(req);
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(202).json({ ok: true, data: { processed: 0, note: "ack" } });
    }
    const result = engine.process(mid, messages, "outlook");
    return res.status(202).json({ ok: true, data: result });
  });

  // --- read models for the dashboard (spec §16) ---------------------------
  app.get("/api/dashboard", (req, res) => ok(res, engine.dashboard(merchantId(req))));
  app.get("/api/digest", (req, res) => ok(res, engine.digest(merchantId(req))));
  app.get("/api/vaults", (req, res) => ok(res, engine.listVaults(merchantId(req))));
  app.get("/api/vaults/:id", (req, res) => {
    const mid = merchantId(req);
    const vault = engine.getVault(mid, req.params.id);
    if (!vault) return fail(res, 404, "Vault not found");
    return ok(res, { vault, evidence: engine.listEvidence(mid, vault.id) });
  });
  app.get("/api/signals", (req, res) => ok(res, engine.listSignals(merchantId(req))));
  app.get("/api/review-queue", (req, res) => ok(res, engine.listReviewQueue(merchantId(req))));
  app.get("/api/messages", (req, res) => ok(res, engine.listMessages(merchantId(req))));

  // --- packs (spec §16.4) -------------------------------------------------
  app.get("/api/packs", (req, res) => ok(res, engine.listPacks(merchantId(req))));
  app.get("/api/packs/:id", (req, res) => {
    const pack = engine.readPack(merchantId(req), req.params.id);
    if (!pack) return fail(res, 404, "Pack not found");
    return ok(res, pack);
  });
  app.post("/api/packs/:id/approve", (req, res) => {
    const pack = engine.approvePack(merchantId(req), req.params.id, req.body?.approved_by ?? "merchant");
    if (!pack) return fail(res, 404, "Pack not found");
    return ok(res, pack);
  });
  app.post("/api/packs/:id/override", (req, res) => {
    const rec = req.body?.recommendation as Recommendation;
    if (!rec) return fail(res, 400, "Body must include a 'recommendation'.");
    const pack = engine.overridePack(merchantId(req), req.params.id, rec, req.body?.by ?? "merchant");
    if (!pack) return fail(res, 404, "Pack not found");
    return ok(res, pack);
  });
  app.post("/api/packs/:id/recovered", (req, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount)) return fail(res, 400, "Body must include a numeric 'amount'.");
    const event = engine.logRecoveredRevenue(merchantId(req), req.params.id, amount, req.body?.currency ?? "GBP");
    if (!event) return fail(res, 404, "Pack not found");
    return ok(res, { billing_event: event, invoice: engine.invoice(merchantId(req)) });
  });

  // --- billing (spec §23) -------------------------------------------------
  app.get("/api/billing/events", (req, res) => ok(res, engine.listBilling(merchantId(req))));
  app.get("/api/billing/usage", (req, res) => ok(res, engine.usage(merchantId(req))));
  app.get("/api/billing/invoice", (req, res) => ok(res, engine.invoice(merchantId(req))));
  app.get("/api/billing/plans", (_req, res) => ok(res, engine.plans()));

  // --- access log (spec §22) ----------------------------------------------
  app.get("/api/access-log", (req, res) => ok(res, engine.listAccessLog(merchantId(req))));

  // --- §22 delete all merchant data ---------------------------------------
  app.delete("/api/merchant/:id", (req, res) => {
    const deleted = engine.deleteMerchant(req.params.id);
    return ok(res, { deleted });
  });

  // --- demo helpers -------------------------------------------------------
  app.post("/api/demo/reset", (_req, res) => {
    engine.deleteMerchant(DEMO_MERCHANT.id);
    engine.upsertMerchant({ ...DEMO_MERCHANT, mailbox_connected: false });
    ok(res, { reset: true });
  });
  app.get("/api/demo/seed-1048", (_req, res) => ok(res, order1048Mailbox()));

  // --- static dashboard ---------------------------------------------------
  const webDir = path.resolve(__dirname, "..", "web");
  app.use(express.static(webDir));
  app.get("/", (_req, res) => res.sendFile(path.join(webDir, "index.html")));

  // --- error handler ------------------------------------------------------
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  });

  return app;
}
