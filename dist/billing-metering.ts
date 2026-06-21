// ============================================================
// billing-metering — usage and outcome-based metering
// Generated from: billing-metering.plain (spec §23)
// ============================================================

import { BillingEvent, BillingEventType, EvidencePack, DisputeSignal } from "./types";
import { v4 as uuidv4 } from "uuid";

export interface MerchantPlan {
  merchantId: string;
  includedPackQuota: number;
  overageRatePerPack: number; // in pence/cents
  successFeePercent: number; // e.g. 0.05 for 5%
  packsUsedThisPeriod: number;
}

function emitEvent(
  merchantId: string,
  eventType: BillingEventType,
  quantity: number,
  metadata: Record<string, unknown> = {}
): BillingEvent {
  return {
    id: uuidv4(),
    merchantId,
    eventType,
    quantity,
    metadata,
    emittedAt: new Date(),
  };
}

export function emitMailboxScanCompleted(
  merchantId: string,
  emailsScanned: number,
  relevantFound: number
): BillingEvent {
  return emitEvent(merchantId, "mailbox_scan_completed", emailsScanned, {
    emailsScanned,
    relevantMessagesFound: relevantFound,
  });
}

export function emitEmailsScanned(merchantId: string, count: number): BillingEvent {
  return emitEvent(merchantId, "emails_scanned", count);
}

export function emitRelevantMessageProcessed(merchantId: string): BillingEvent {
  return emitEvent(merchantId, "relevant_messages_processed", 1);
}

export function emitVaultCreated(merchantId: string, orderId: string): BillingEvent {
  return emitEvent(merchantId, "vault_created", 1, { orderId });
}

export function emitEvidenceItemCaptured(merchantId: string, vaultId: string): BillingEvent {
  return emitEvent(merchantId, "evidence_item_captured", 1, { vaultId });
}

export function emitSnapshotStored(merchantId: string, vaultId: string): BillingEvent {
  return emitEvent(merchantId, "snapshot_stored", 1, { vaultId });
}

export function emitDisputeSignalDetected(merchantId: string, signal: DisputeSignal): BillingEvent {
  return emitEvent(merchantId, "dispute_signal_detected", 1, {
    disputeSignalId: signal.id,
    disputeType: signal.disputeType,
    disputedAmount: signal.disputedAmount,
  });
}

export function emitEvidencePackGenerated(merchantId: string, pack: EvidencePack): BillingEvent {
  return emitEvent(merchantId, "evidence_pack_generated", 1, {
    evidencePackId: pack.id,
    disputeSignalId: pack.disputeSignalId,
    disputedAmount: pack.evidenceTable
      .filter((i) => i.strength === "strong")
      .length,
  });
}

export function emitRecoveredRevenue(
  merchantId: string,
  recoveredAmount: number,
  plan: MerchantPlan
): BillingEvent {
  const successFee = recoveredAmount * plan.successFeePercent;
  return emitEvent(merchantId, "recovered_revenue_logged", 1, {
    recoveredAmount,
    successFeePercent: plan.successFeePercent,
    successFeeCharged: successFee,
  });
}

/**
 * Calculates the charge for a pack, taking plan quota into account.
 */
export function calculatePackCharge(plan: MerchantPlan): number {
  if (plan.packsUsedThisPeriod < plan.includedPackQuota) return 0;
  return plan.overageRatePerPack;
}
