/**
 * Seed an {@link Engine} with the hackathon demo dataset and (when run directly)
 * print the resulting dashboard + digest figures (spec §16, §24, §25).
 */
import { Engine } from "../engine";
import { DEMO_MERCHANT, fullDemoMailbox, order1048Mailbox } from "./dataset";

export interface SeedOptions {
  /** "full" reproduces the §16/§25 dashboard figures; "hero" seeds only #1048. */
  scope?: "full" | "hero";
}

/** Process the demo mailbox through the engine and return it seeded. */
export function seedEngine(engine: Engine, options: SeedOptions = {}): Engine {
  engine.upsertMerchant(DEMO_MERCHANT);
  const mailbox = options.scope === "hero" ? order1048Mailbox() : fullDemoMailbox();
  engine.process(DEMO_MERCHANT.id, mailbox);
  return engine;
}

export function freshSeededEngine(options: SeedOptions = {}): Engine {
  return seedEngine(new Engine(), options);
}

if (require.main === module) {
  const engine = freshSeededEngine();
  const d = engine.dashboard(DEMO_MERCHANT.id);
  const digest = engine.digest(DEMO_MERCHANT.id);
  const invoice = engine.invoice(DEMO_MERCHANT.id);
  // eslint-disable-next-line no-console
  console.log("=== Dashboard (spec §16.1) ===");
  console.log(JSON.stringify(d, null, 2));
  console.log("\n=== Daily digest (spec §16.5) ===");
  console.log(JSON.stringify(digest, null, 2));
  console.log("\n=== Invoice (spec §23) ===");
  console.log(JSON.stringify(invoice, null, 2));
}
