/**
 * Order evidence vaults — creation, profile building, and evidence items
 * (evidence-vaults.plain; spec §11).
 *
 * FRs:
 *  - Create a new :OrderEvidenceVault: on an order_confirmation event for an
 *    order with no existing vault; never create a duplicate for the same order.
 *  - Store each linked piece of evidence as an :EvidenceItem: with a strength
 *    and a one-line summary referencing its :SourceMessage:.
 */
import {
  Classification,
  CommerceEvent,
  EvidenceItem,
  EvidenceStrength,
  OrderEvidenceVault,
} from "../core/types";
import { nextId } from "../core/ids";
import { VaultLinkProfile } from "./linking";

/** Build the matchable profile of a vault from its linked commerce events. */
export function buildProfile(vault: OrderEvidenceVault, events: CommerceEvent[]): VaultLinkProfile {
  const profile: VaultLinkProfile = {
    vault_id: vault.id,
    order_id: vault.order_id,
    tracking_numbers: new Set(),
    payment_refs: new Set(),
    customer_emails: new Set(),
    customer_names: new Set(),
    addresses: [],
    product_names: new Set(),
    amount: vault.amount,
    timestamps: [],
  };
  if (vault.customer_email) profile.customer_emails.add(vault.customer_email);
  for (const e of events) {
    if (e.tracking_number) profile.tracking_numbers.add(e.tracking_number);
    if (e.payment_reference) profile.payment_refs.add(e.payment_reference);
    if (e.customer_email) profile.customer_emails.add(e.customer_email);
    if (e.customer_name) profile.customer_names.add(e.customer_name);
    if (e.shipping_address) profile.addresses.push(e.shipping_address);
    if (e.billing_address) profile.addresses.push(e.billing_address);
    if (e.product_name) profile.product_names.add(e.product_name);
    if (profile.amount === undefined && e.amount !== undefined) profile.amount = e.amount;
    if (e.occurred_at) profile.timestamps.push(e.occurred_at);
  }
  return profile;
}

/** Create a new vault from an order_confirmation commerce event. */
export function createVaultFromEvent(event: CommerceEvent, provider: OrderEvidenceVault["created_from"]): OrderEvidenceVault {
  const now = event.occurred_at ?? new Date().toISOString();
  return {
    id: `vault_${event.order_id}`,
    merchant_id: event.merchant_id,
    order_id: event.order_id!,
    customer_email: event.customer_email,
    customer_name: event.customer_name,
    amount: event.amount,
    currency: event.currency,
    status: "created",
    evidence_score: 0,
    evidence_status: "needs_review",
    missing: [],
    weak: [],
    strongest_evidence: [],
    created_at: now,
    last_updated: now,
    created_from: provider,
  };
}

interface EvidenceMapping {
  type: string;
  strength: EvidenceStrength;
  summary: (e: CommerceEvent) => string;
}

const EVIDENCE_BY_CLASSIFICATION: Partial<Record<Classification, EvidenceMapping>> = {
  order_confirmation: {
    type: "order_confirmation",
    strength: "strong",
    summary: (e) => `Order ${e.order_id ?? ""} confirmed${e.amount ? ` for ${fmt(e)}` : ""}.`,
  },
  payment_confirmation: {
    type: "payment_confirmation",
    strength: "strong",
    summary: (e) => `Payment captured${e.amount ? ` of ${fmt(e)}` : ""}${e.processor ? ` via ${e.processor}` : ""}.`,
  },
  fulfilment_confirmation: {
    type: "fulfilment_confirmation",
    strength: "strong",
    summary: () => `Order marked fulfilled by the merchant.`,
  },
  tracking_update: {
    type: "tracking_number",
    strength: "strong",
    summary: (e) => `Tracking ${e.tracking_number ?? ""}${e.carrier ? ` created with ${e.carrier}` : " created"}.`,
  },
  delivery_confirmation: {
    type: "tracking_delivered",
    strength: "strong",
    summary: (e) => `${e.carrier ?? "Carrier"} marked parcel as delivered.`,
  },
  refund_request: {
    type: "refund_request",
    strength: "weak",
    summary: (e) => `Customer requested a refund${e.refund_amount ? ` of ${fmt(e, e.refund_amount)}` : ""}.`,
  },
  customer_complaint: {
    type: "customer_message",
    strength: "weak",
    summary: () => `Customer message regarding the order.`,
  },
  needs_review: {
    type: "uncategorised",
    strength: "weak",
    summary: () => `Message linked to order, awaiting categorisation.`,
  },
};

function fmt(e: CommerceEvent, amount = e.amount): string {
  const symbol = e.currency === "GBP" ? "£" : e.currency === "USD" ? "$" : e.currency === "EUR" ? "€" : "";
  return `${symbol}${amount}`;
}

/**
 * Build an :EvidenceItem: for an event, or null when the classification does not
 * itself constitute stored evidence (dispute / marketplace messages become
 * :DisputeSignal: records instead). The summary references the source message.
 */
export function evidenceItemFromEvent(
  event: CommerceEvent,
  vaultId: string,
  classification: Classification,
  sourceSubject: string
): EvidenceItem | null {
  const mapping = EVIDENCE_BY_CLASSIFICATION[classification];
  if (!mapping) return null;
  return {
    id: nextId("ev"),
    merchant_id: event.merchant_id,
    vault_id: vaultId,
    type: mapping.type,
    source_message_id: event.source_message_id, // traceability
    captured_at: new Date().toISOString(),
    event_timestamp: event.occurred_at,
    strength: mapping.strength,
    summary: `${mapping.summary(event)} (source: ${event.source_message_id} — "${sourceSubject}")`,
  };
}
