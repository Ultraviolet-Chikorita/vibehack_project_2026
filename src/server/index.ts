/**
 * Server bootstrap. Starts the V1 dispute-readiness API + dashboard.
 *
 * Env:
 *   PORT          - listen port (default 3000)
 *   SEED_ON_START - "full" seeds the demo dataset at boot; "hero" seeds only
 *                   order #1048; unset/"none" leaves the mailbox unconnected so
 *                   the connect → scan demo flow can be shown live.
 */
import { Engine } from "../engine";
import { createApp } from "./app";
import { seedEngine } from "../demo/seed";
import { DEMO_MERCHANT } from "../demo/dataset";

const PORT = Number(process.env.PORT ?? 3000);
const SEED = process.env.SEED_ON_START ?? "none";

const engine = new Engine();
if (SEED === "full" || SEED === "hero") {
  seedEngine(engine, { scope: SEED });
}

const app = createApp(engine);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`V1 dispute-readiness engine listening on http://localhost:${PORT}`);
  console.log(`  Dashboard:  http://localhost:${PORT}/`);
  console.log(`  Health:     http://localhost:${PORT}/api/health`);
  console.log(`  Merchant:   ${DEMO_MERCHANT.id} (${SEED === "none" ? "mailbox not yet connected" : `seeded: ${SEED}`})`);
});
