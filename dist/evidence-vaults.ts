// ============================================================
// evidence-vaults — vault creation, linking, evidence storage
// Generated from: evidence-vaults.plain (spec §11)
// ============================================================

import {
  CommerceEvent,
  EvidenceItem,
  EvidenceCategory,
  EvidenceStrength,
  OrderEvidenceVault,
  LinkResult,
  LinkingKey,
} from "./types";
import { v4 as uuidv4 } from "uuid";

// Ordered by priority (highest first)
export const LINKING_KEYS: LinkingKey[] = [
  "order_number",
  "tracking_number",
  "payment_reference",
  "customer_email_amount",
  "customer_email_timestamp",
  "customer_name_address",
  "product_name_timestamp",
];

export const REVIEW_THRESHOLD = 0.6;

/**
 * Creates a new OrderEvidenceVault from an order_confirmation CommerceEvent.
 * Idempotent: if a vault for this orderId already exists, it is returned as-is.
 */
export function createVault(
  event: CommerceEvent,
  existingVaults: OrderEvidenceVault[]
): OrderEvidenceVault | { existing: OrderEvidenceVault } {
  const existing = existingVaults.find(
    (v) => v.orderId === event.orderId && v.merchantId === event.merchantId
  );
  if (existing) return { existing };

  const vault: OrderEvidenceVault = {
    id: uuidv4(),
    merchantId: event.merchantId,
    orderId: event.orderId!,
    evidenceScore: 0,
    status: "needs_review",
    evidenceItems: [],
    missingEvidence: allEvidenceCategories(),
    weakEvidence: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return vault;
}

/**
 * Attempts to link a CommerceEvent to an existing vault using LinkingKeys in priority order.
 * Returns a LinkResult if matched, or null if no vault matches.
 * Low-confidence links are flagged for review.
 */
export function linkEventToVault(
  event: CommerceEvent,
  vaults: OrderEvidenceVault[]
): { result: LinkResult; needsReview: boolean } | null {
  for (const key of LINKING_KEYS) {
    const match = tryLink(key, event, vaults);
    if (match) {
      return {
        result: match,
        needsReview: match.confidence < REVIEW_THRESHOLD,
      };
    }
  }
  return null;
}

function tryLink(
  key: LinkingKey,
  event: CommerceEvent,
  vaults: OrderEvidenceVault[]
): LinkResult | null {
  for (const vault of vaults) {
    if (vault.merchantId !== event.merchantId) continue;

    switch (key) {
      case "order_number":
        if (event.orderId && vault.orderId === event.orderId)
          return { vaultId: vault.id, matchedKey: key, confidence: 0.99 };
        break;

      case "tracking_number": {
        const hasTracking = vault.evidenceItems.some(
          (i) => i.summary.includes(event.trackingNumber ?? "__NONE__")
        );
        if (event.trackingNumber && hasTracking)
          return { vaultId: vault.id, matchedKey: key, confidence: 0.95 };
        break;
      }

      case "payment_reference": {
        const hasPayRef = vault.evidenceItems.some(
          (i) => i.summary.includes(event.paymentReference ?? "__NONE__")
        );
        if (event.paymentReference && hasPayRef)
          return { vaultId: vault.id, matchedKey: key, confidence: 0.92 };
        break;
      }

      case "customer_email_amount": {
        const emailMatch = vault.evidenceItems.some(
          (i) => event.customerEmail && i.summary.includes(event.customerEmail)
        );
        const amountMatch = event.amount !== undefined;
        if (emailMatch && amountMatch)
          return { vaultId: vault.id, matchedKey: key, confidence: 0.75 };
        break;
      }

      case "customer_email_timestamp": {
        const emailMatch = vault.evidenceItems.some(
          (i) => event.customerEmail && i.summary.includes(event.customerEmail)
        );
        if (emailMatch)
          return { vaultId: vault.id, matchedKey: key, confidence: 0.65 };
        break;
      }

      // Lower-priority keys yield lower confidence
      case "customer_name_address":
        return null; // Would need address similarity logic
      case "product_name_timestamp":
        return null;
    }
  }
  return null;
}

/**
 * Stores a piece of evidence as an EvidenceItem in the vault.
 */
export function storeEvidenceItem(
  vault: OrderEvidenceVault,
  event: CommerceEvent,
  category: EvidenceCategory,
  strength: EvidenceStrength,
  summary: string
): EvidenceItem {
  const item: EvidenceItem = {
    id: uuidv4(),
    merchantId: vault.merchantId,
    vaultId: vault.id,
    sourceMessageId: event.sourceMessageId,
    strength,
    summary,
    category,
    capturedAt: new Date(),
  };

  vault.evidenceItems.push(item);
  vault.missingEvidence = vault.missingEvidence.filter((c) => c !== category);
  vault.updatedAt = new Date();

  return item;
}

/**
 * Infers the EvidenceCategory and strength from a CommerceEvent classification.
 */
export function inferEvidenceCategory(event: CommerceEvent): {
  category: EvidenceCategory;
  strength: EvidenceStrength;
  summary: string;
} {
  switch (event.classification) {
    case "order_confirmation":
      return {
        category: "order_proof",
        strength: "strong",
        summary: `Order confirmation for order ${event.orderId} from source message ${event.sourceMessageId}`,
      };
    case "payment_confirmation":
      return {
        category: "payment_proof",
        strength: "strong",
        summary: `Payment confirmation${event.amount ? ` of ${event.currency ?? ""}${event.amount}` : ""} from source message ${event.sourceMessageId}`,
      };
    case "fulfilment_confirmation":
      return {
        category: "fulfilment_proof",
        strength: "strong",
        summary: `Fulfilment confirmation from source message ${event.sourceMessageId}`,
      };
    case "tracking_update":
      return {
        category: "fulfilment_proof",
        strength: "weak",
        summary: `Tracking update${event.trackingNumber ? ` (${event.trackingNumber})` : ""} from source message ${event.sourceMessageId}`,
      };
    case "delivery_confirmation":
      return {
        category: "delivery_proof",
        strength: "strong",
        summary: `Delivery confirmed${event.deliveryStatus ? `: ${event.deliveryStatus}` : ""} from source message ${event.sourceMessageId}`,
      };
    case "refund_request":
    case "customer_complaint":
      return {
        category: "communication_history",
        strength: "weak",
        summary: `Customer communication (${event.classification}) from source message ${event.sourceMessageId}`,
      };
    default:
      return {
        category: "communication_history",
        strength: "irrelevant",
        summary: `Unclassified event from source message ${event.sourceMessageId}`,
      };
  }
}

function allEvidenceCategories(): EvidenceCategory[] {
  return [
    "order_proof",
    "payment_proof",
    "product_proof",
    "policy_proof",
    "fulfilment_proof",
    "delivery_proof",
    "address_match",
    "communication_history",
    "refund_history",
    "conflict_detection",
  ];
}
