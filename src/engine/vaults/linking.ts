/**
 * Evidence linking — match a :CommerceEvent: to an existing :OrderEvidenceVault:
 * using :LinkingKeys: in priority order (evidence-vaults.plain; spec §11.2).
 *
 * :LinkingKeys: (highest priority first):
 *   1. exact order number
 *   2. exact tracking number
 *   3. exact payment reference
 *   4. customer email + amount
 *   5. customer email + timestamp proximity
 *   6. customer name + address similarity
 *   7. product name + timestamp proximity
 *
 * The highest-priority key that resolves a vault decides the link; lower-priority
 * keys that agree on the same vault are also recorded. Links below the review
 * threshold are routed to the review queue rather than auto-applied.
 */
import { CommerceEvent, LinkResult } from "../core/types";

/** Links at or above this confidence are auto-applied; below it → review queue. */
export const LINK_REVIEW_THRESHOLD = 0.6;

/** A denormalised, matchable profile of a vault built from its linked events. */
export interface VaultLinkProfile {
  vault_id: string;
  order_id: string;
  tracking_numbers: Set<string>;
  payment_refs: Set<string>;
  customer_emails: Set<string>;
  customer_names: Set<string>;
  addresses: string[];
  product_names: Set<string>;
  amount?: number;
  timestamps: string[];
}

interface LinkingKey {
  name: string;
  confidence: number;
  matches: (event: CommerceEvent, profile: VaultLinkProfile) => boolean;
}

const HOUR = 3600_000;

function within(aIso: string | undefined, timestamps: string[], windowMs: number): boolean {
  if (!aIso) return false;
  const a = Date.parse(aIso);
  if (Number.isNaN(a)) return false;
  return timestamps.some((t) => {
    const b = Date.parse(t);
    return !Number.isNaN(b) && Math.abs(a - b) <= windowMs;
  });
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Jaccard token overlap, used for fuzzy address / name similarity. */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}

const KEYS: LinkingKey[] = [
  {
    name: "order_number",
    confidence: 0.99,
    matches: (e, p) => !!e.order_id && e.order_id === p.order_id,
  },
  {
    name: "tracking_number",
    confidence: 0.95,
    matches: (e, p) => !!e.tracking_number && p.tracking_numbers.has(e.tracking_number),
  },
  {
    name: "payment_reference",
    confidence: 0.93,
    matches: (e, p) => !!e.payment_reference && p.payment_refs.has(e.payment_reference),
  },
  {
    name: "customer_email_amount",
    confidence: 0.85,
    matches: (e, p) =>
      !!e.customer_email &&
      p.customer_emails.has(e.customer_email) &&
      e.amount !== undefined &&
      p.amount !== undefined &&
      Math.abs(e.amount - p.amount) < 0.005,
  },
  {
    name: "customer_email_timestamp",
    confidence: 0.7,
    matches: (e, p) =>
      !!e.customer_email && p.customer_emails.has(e.customer_email) && within(e.occurred_at, p.timestamps, 72 * HOUR),
  },
  {
    name: "customer_name_address",
    confidence: 0.6,
    matches: (e, p) => {
      if (!e.customer_name) return false;
      const nameMatch = [...p.customer_names].some((n) => tokenSimilarity(n, e.customer_name!) >= 0.5);
      if (!nameMatch) return false;
      if (!e.shipping_address) return true;
      return p.addresses.some((a) => tokenSimilarity(a, e.shipping_address!) >= 0.5);
    },
  },
  {
    name: "product_name_timestamp",
    confidence: 0.5,
    matches: (e, p) =>
      !!e.product_name &&
      [...p.product_names].some((pn) => tokenSimilarity(pn, e.product_name!) >= 0.6) &&
      within(e.occurred_at, p.timestamps, 72 * HOUR),
  },
];

export interface LinkDecision extends LinkResult {
  /** True when confidence >= LINK_REVIEW_THRESHOLD (safe to auto-apply). */
  autoApply: boolean;
  /** The candidate vault even when below threshold (for the review queue). */
  candidate_vault_id: string | null;
}

/**
 * Resolve the best vault link for an event. The highest-priority matching key
 * decides; ties between keys are broken by priority. Returns the chosen vault,
 * a confidence in [0, 1], the matched key names, and whether it is auto-appliable.
 */
export function findLink(event: CommerceEvent, profiles: VaultLinkProfile[]): LinkDecision {
  let best: { profile: VaultLinkProfile; keyIndex: number } | null = null;

  for (const profile of profiles) {
    for (let i = 0; i < KEYS.length; i++) {
      if (KEYS[i].matches(event, profile)) {
        if (!best || i < best.keyIndex) best = { profile, keyIndex: i };
        break; // highest-priority match for this profile is enough
      }
    }
  }

  if (!best) {
    return { vault_id: null, candidate_vault_id: null, link_confidence: 0, matched_on: [], autoApply: false };
  }

  // Record every key (the deciding one and any lower-priority agreeing keys).
  const matched_on = KEYS.filter((k) => k.matches(event, best!.profile)).map((k) => k.name);
  const decidingKey = KEYS[best.keyIndex];
  // Agreement across multiple keys raises confidence slightly (capped at 0.99).
  const agreementBoost = Math.min(0.04 * (matched_on.length - 1), 0.08);
  const confidence = Math.min(0.99, decidingKey.confidence + agreementBoost);
  const autoApply = confidence >= LINK_REVIEW_THRESHOLD;

  return {
    vault_id: autoApply ? best.profile.vault_id : null,
    candidate_vault_id: best.profile.vault_id,
    link_confidence: Number(confidence.toFixed(2)),
    matched_on,
    autoApply,
  };
}
