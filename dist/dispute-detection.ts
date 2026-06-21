// ============================================================
// dispute-detection — detect disputed or at-risk orders
// Generated from: dispute-detection.plain (spec §14)
// ============================================================

import { SourceMessage, CommerceEvent, DisputeSignal, DisputeType, OrderEvidenceVault } from "./types";
import { v4 as uuidv4 } from "uuid";

interface DetectionResult {
  detected: true;
  disputeType: DisputeType;
  disputeReason?: string;
  disputedAmount?: number;
  deadline?: Date;
}

interface NoDetection {
  detected: false;
}

/**
 * Checks a CommerceEvent (and its SourceMessage body) for dispute signals.
 */
export function detectDisputeSignal(
  event: CommerceEvent,
  message: SourceMessage
): DetectionResult | NoDetection {
  const text = `${message.subject}\n${message.body}`.toLowerCase();

  if (/dispute opened|stripe dispute|chargeback/i.test(text)) {
    return {
      detected: true,
      disputeType: "payment_dispute",
      disputeReason: event.disputeReason,
      disputedAmount: event.amount,
      deadline: event.disputeDeadline,
    };
  }
  if (/refund request|requesting a refund/i.test(text)) {
    return {
      detected: true,
      disputeType: "refund_request",
      disputeReason: event.disputeReason,
      disputedAmount: event.refundAmount ?? event.amount,
      deadline: event.disputeDeadline,
    };
  }
  if (/item not received|never arrived|not received/i.test(text)) {
    return {
      detected: true,
      disputeType: "item_not_received",
      disputeReason: "Item not received as reported by customer",
      disputedAmount: event.amount,
      deadline: event.disputeDeadline,
    };
  }
  if (/damaged|broken|arrived damaged/i.test(text)) {
    return {
      detected: true,
      disputeType: "item_damaged",
      disputeReason: "Item arrived damaged",
      disputedAmount: event.amount,
    };
  }
  if (/not as described|wrong item|incorrect item/i.test(text)) {
    return {
      detected: true,
      disputeType: "not_as_described",
      disputeReason: "Item not as described",
      disputedAmount: event.amount,
    };
  }
  if (/duplicate charge|charged twice|double charge/i.test(text)) {
    return {
      detected: true,
      disputeType: "duplicate_charge",
      disputeReason: "Duplicate charge reported",
      disputedAmount: event.amount,
    };
  }

  return { detected: false };
}

/**
 * Creates a DisputeSignal linked to an existing OrderEvidenceVault.
 * If no vault exists for the order, returns null (should be queued for review).
 */
export function createDisputeSignal(
  event: CommerceEvent,
  detection: DetectionResult,
  vaults: OrderEvidenceVault[]
): DisputeSignal | null {
  const vault = vaults.find(
    (v) => v.orderId === event.orderId && v.merchantId === event.merchantId
  );

  if (!vault) return null; // Queue for human review

  return {
    id: uuidv4(),
    merchantId: event.merchantId,
    vaultId: vault.id,
    sourceMessageId: event.sourceMessageId,
    disputeType: detection.disputeType,
    disputeReason: detection.disputeReason,
    disputedAmount: detection.disputedAmount,
    deadline: detection.deadline,
    linkedAt: new Date(),
  };
}
