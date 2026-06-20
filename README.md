# V1 — Dispute-Readiness Engine

> Make every fulfilled order dispute-ready from the merchant's mailbox.

V1 turns a merchant's mailbox into an **order evidence vault**. It classifies commerce
emails, extracts structured events, builds a per-order evidence timeline, scores how
dispute-ready each order is, detects dispute signals, and **auto-generates a merchant-ready
evidence pack** — all held for human approval before any action. It is read-only and never
submits a dispute or contacts a customer on its own.

This repository implements the backend engine, an HTTP API, and a batch-review dashboard,
built directly from the [V1 Product Development Spec](#spec-coverage) and the spec-driven
[`.plain` modules](codeplainfiles/) (one module per core component).

---

## Quick start

```bash
npm install
npm test          # 63 conformance tests across all components
npm start         # http://localhost:3000  (dashboard + API)
```

Then in the dashboard: **Link My Mailbox → Continue with Google → Run Initial Scan**.

Seed the demo data straight into a one-off process (no server):

```bash
npm run seed      # prints the §16 dashboard, §16.5 digest, and §23 invoice
```

Boot the server with data already loaded:

```bash
SEED_ON_START=full npm start   # or: SEED_ON_START=hero  (only order #1048)
```

## The hero flow (spec §24 demo dataset — order #1048)

Processing the seeded mailbox for **East London Camera Store** produces, deterministically:

| Output | Value |
|---|---|
| Order #1048 evidence vault | score **92**, status **dispute_ready** |
| Strongest evidence | order_confirmation, payment_confirmation, tracking_delivered, address_match |
| Dispute signal | Stripe `payment_dispute`, reason `item_not_received`, £420, deadline 2026-06-22 |
| Evidence pack | recommendation **contest** at **0.82** confidence, `ready_for_review` |
| Billing | `evidence_pack_generated`, `mailbox_scan_completed`, `order_vault_created`, … |

The full demo mailbox reproduces the spec §16/§25 figures exactly: **184** emails scanned,
**39** relevant, **12** vaults, **37** evidence items, **7** delivery confirmations,
**3** dispute signals, **2** ready packs, **£730** disputed, **£620** recoverable.

---

## Architecture

```
src/
  engine/                 # the spec-driven core (pure, fully unit-tested)
    core/                 #   data model + per-merchant datastore (dispute-engine-core.plain)
    filtering/            #   first-pass filter + classification   (email-filtering.plain  §9)
    extraction/           #   commerce-event extraction            (event-extraction.plain §10)
    vaults/               #   vault creation + LinkingKeys          (evidence-vaults.plain  §11)
    scoring/              #   evidence score + status               (evidence-scoring.plain §13)
    disputes/             #   dispute-signal detection              (dispute-detection.plain §14)
    packs/                #   evidence-pack generation              (pack-generation.plain  §15)
    billing/              #   Solvimon metering + invoicing         (billing-metering.plain §23)
    pipeline/             #   orchestration + idempotency + cursor  (processing-pipeline.plain §19)
    index.ts              #   Engine facade (sync cursor, approval, dashboard, deletion)
  server/                 # Express API — every spec §18 route
  web/                    # batch-review dashboard (spec §16, §25 demo flow)
  demo/                   # seeded #1048 mailbox + synthetic dataset
test/                     # one conformance suite per .plain module
```

Each `.plain` module's acceptance tests map 1:1 onto a `test/*.test.ts` suite, so the
behaviour is verified, not just produced.

## API (spec §18)

| Route | Purpose |
|---|---|
| `POST /api/auth/connect` · `GET /api/auth/session` | Simulated OAuth onboarding (§18.1, §25) |
| `GET /api/mailbox/sync-cursor` | Sync-cursor contract (§19) — first sync fetches 30 most recent |
| `POST /api/mailbox/scan` · `POST /api/mailbox/resync` | Initial scan / fallback resync (§18.4) |
| `POST /api/jobs/process` · `POST /api/jobs/process-message` | Batch / single-message pipeline (§18.5, §19) |
| `POST /api/webhooks/gmail` · `POST /api/webhooks/outlook` | Provider webhooks, simulated (§18.2/§18.3) |
| `POST /api/jobs/renew-watches` | Watch renewal stub (§18.6) |
| `GET /api/dashboard` · `/digest` · `/vaults` · `/signals` · `/packs` | Read models (§16) |
| `POST /api/packs/:id/approve` · `/override` · `/recovered` | Human approval & outcome logging (§15, §23) |
| `GET /api/billing/usage` · `/invoice` · `/plans` | Solvimon metering (§23) |
| `DELETE /api/merchant/:id` | Delete all merchant data (§22) |

## Safety & privacy (spec §21, §22)

- **Read-only.** No send/delete/modify/mark capability exists anywhere in the engine.
- **Traceability.** Every evidence item and pack claim references its source message id.
- **Minimal retention.** Stored message records keep metadata + summaries, never the body.
- **No autonomous action.** Packs are `ready_for_review`; nothing is submitted or sent until
  a merchant approval is recorded. The engine never guarantees a dispute outcome.
- **Right to delete.** All data for a merchant can be deleted on request.

## Spec coverage

Built against every section of the V1 Product Development Spec. Core engine sections
(§9–§15, §17, §19, §22, §23, §24) are implemented and test-covered; OAuth/provider webhooks
(§8, §18.1–§18.3, §18.6) are simulated for the hackathon demo with real request/response
shapes, as the spec itself permits (§25, §26 Phase 7–8, §29.1/§29.2).

### Provenance

This engine was implemented in TypeScript by Claude Code, working from the spec PDF and the
`.plain` modules. The `.plain` files in [`codeplainfiles/`](codeplainfiles/) are the
spec-driven source intended for the Codeplain track; they are kept here as the design source
of truth. This `src/` implementation is a hand/AI-built realisation of those same specs, not
a Codeplain render.
