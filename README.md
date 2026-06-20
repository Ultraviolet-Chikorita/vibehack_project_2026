# Settld

Settld is a dispute-evidence platform for merchants. The repo now documents the two branch lines called out for this project:

- `feat/dispute-readiness-engine` — the Codeplain spec engine that defines the dispute-readiness backend.
- `mobile_app` — the Next.js app build that turns the engine into a customer-facing web experience.

## `feat/dispute-readiness-engine`

This branch is the source-of-truth spec set under `codeplainfiles/`. It defines a full dispute-readiness pipeline:

- inbox filtering and commerce classification
- structured event extraction
- order evidence vault creation and linking
- evidence scoring and status labels
- dispute signal detection
- evidence pack generation
- billing and metering
- pipeline orchestration and sync handling

### Module map

- `dispute-engine-core.plain` — shared concepts, data model, and cross-cutting requirements
- `email-filtering.plain` — first-pass filtering and classification
- `event-extraction.plain` — structured commerce event extraction
- `evidence-vaults.plain` — vault creation, linking, and evidence storage
- `evidence-scoring.plain` — evidence scoring and status labels
- `dispute-detection.plain` — dispute signal detection and linking
- `pack-generation.plain` — evidence pack generation
- `billing-metering.plain` — usage and outcome metering
- `processing-pipeline.plain` — sync contract and processing pipeline
- `app.plain` — integrated render entry point

### Render

```bash
plain2code codeplainfiles/app.plain
```

Render modules individually while iterating, then render `app.plain` for the full system.

## `mobile_app`

This branch is the Next.js app build in `settld-app-build/`. It packages the dispute engine into a polished web app with:

- a marketing landing page
- a live dashboard
- an orders list and per-order detail view
- API routes for scan, seeding, vault reads, dashboard data, and pack generation
- deterministic fallbacks when API or AI services are unavailable

### App shape

- `app/page.tsx` — landing page
- `app/dashboard/page.tsx` — live dashboard
- `app/orders/page.tsx` — orders list
- `app/orders/[id]/page.tsx` — order detail view
- `app/api/process/route.ts` — scan pipeline endpoint
- `app/api/seed/route.ts` — seed vault rows
- `app/api/vaults/route.ts` — read vault rows
- `app/api/dashboard/route.ts` — dashboard payload
- `app/api/generate-pack/route.ts` — evidence pack generation

### Runtime behavior

- `NEXT_PUBLIC_API_BASE` is optional.
- When `NEXT_PUBLIC_API_BASE` is unset, the app runs locally on seed data.
- When it is set, scans and pack generation call the configured backend.
- `/api/generate-pack` uses the AI Gateway when available and falls back to deterministic output.
- `/api/seed` and `/api/vaults` use Vercel Postgres.

## Deployment instructions

### Codeplain engine

1. Keep working from the repository root.
2. Render the spec entry point:

```bash
plain2code codeplainfiles/app.plain
```

### Next.js app

1. Change into the app directory:

```bash
cd settld-app-build
```

2. Install dependencies:

```bash
pnpm install
```

3. Run locally:

```bash
pnpm dev
```

4. Build for production:

```bash
pnpm build
```

5. Start the production server:

```bash
pnpm start
```

### Production notes

- Deploy the Next app on Vercel or another Next.js host.
- Enable Vercel Postgres for the vault routes.
- Set `NEXT_PUBLIC_API_BASE` when the app should call an external backend instead of local seed data.
- Keep the AI Gateway available if you want live pack drafting; otherwise the deterministic fallback still works.

## Traction data images

These are placeholder slots for project traction screenshots or charts.

- ![Traction chart 1](./docs/traction/traction-01.png)
- ![Traction chart 2](./docs/traction/traction-02.png)
- ![Traction chart 3](./docs/traction/traction-03.png)
- ![Traction chart 4](./docs/traction/traction-04.png)

## Demo videos

These are placeholder slots for demo clips or walkthrough recordings.

- [Demo video 1](./docs/demo/demo-01.mp4)
- [Demo video 2](./docs/demo/demo-02.mp4)
- [Demo video 3](./docs/demo/demo-03.mp4)
- [Demo video 4](./docs/demo/demo-04.mp4)
