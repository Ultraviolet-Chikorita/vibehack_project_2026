// ============================================================
// dispute-engine-core — shared types and data model
// Generated from: dispute-engine-core.plain
// ============================================================

export interface Merchant {
  id: string;
  name: string;
  mailboxEmail: string;
  createdAt: Date;
}

export interface SourceMessage {
  id: string;
  merchantId: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export type Classification =
  | "order_confirmation"
  | "payment_confirmation"
  | "fulfilment_confirmation"
  | "tracking_update"
  | "delivery_confirmation"
  | "refund_request"
  | "customer_complaint"
  | "dispute_notification"
  | "marketplace_case"
  | "irrelevant"
  | "needs_review";

export interface CommerceEvent {
  id: string;
  merchantId: string;
  sourceMessageId: string;
  classification: Classification;
  orderId?: string;
  customerEmail?: string;
  customerName?: string;
  amount?: number;
  currency?: string;
  productName?: string;
  productUrl?: string;
  paymentReference?: string;
  trackingNumber?: string;
  carrier?: string;
  shippingAddress?: string;
  billingAddress?: string;
  deliveryStatus?: string;
  disputeReason?: string;
  disputeDeadline?: Date;
  processor?: string;
  refundAmount?: number;
  eventTimestamp?: Date;
  extractedAt: Date;
}

export type EvidenceStrength = "strong" | "weak" | "missing" | "contradictory" | "irrelevant";

export interface EvidenceItem {
  id: string;
  merchantId: string;
  vaultId: string;
  sourceMessageId: string;
  strength: EvidenceStrength;
  summary: string;
  category: EvidenceCategory;
  capturedAt: Date;
}

export type EvidenceCategory =
  | "order_proof"
  | "payment_proof"
  | "product_proof"
  | "policy_proof"
  | "fulfilment_proof"
  | "delivery_proof"
  | "address_match"
  | "communication_history"
  | "refund_history"
  | "conflict_detection";

export type VaultStatus =
  | "dispute_ready"
  | "mostly_ready"
  | "missing_delivery_proof"
  | "missing_policy_snapshot"
  | "missing_product_snapshot"
  | "needs_review"
  | "weak_evidence";

export interface OrderEvidenceVault {
  id: string;
  merchantId: string;
  orderId: string;
  evidenceScore: number; // 0–100
  status: VaultStatus;
  evidenceItems: EvidenceItem[];
  missingEvidence: EvidenceCategory[];
  weakEvidence: EvidenceCategory[];
  createdAt: Date;
  updatedAt: Date;
}

export type DisputeType =
  | "payment_dispute"
  | "chargeback"
  | "refund_request"
  | "item_not_received"
  | "item_damaged"
  | "not_as_described"
  | "duplicate_charge"
  | "repeat_claimant_risk"
  | "needs_review";

export interface DisputeSignal {
  id: string;
  merchantId: string;
  vaultId: string;
  sourceMessageId: string;
  disputeType: DisputeType;
  disputeReason?: string;
  disputedAmount?: number;
  deadline?: Date;
  linkedAt: Date;
}

export type Recommendation = "contest" | "refund" | "request_more_evidence" | "escalate";

export interface EvidencePack {
  id: string;
  merchantId: string;
  disputeSignalId: string;
  vaultId: string;
  disputeSummary: string;
  orderSummary: string;
  evidenceTimeline: TimelineEntry[];
  evidenceTable: EvidenceItem[];
  missingEvidenceWarnings: string[];
  recommendation: Recommendation;
  recommendationConfidence: number; // 0–1
  submissionText: string;
  attachmentsChecklist: string[];
  status: "auto_generated" | "needs_human_review" | "approved" | "submitted";
  merchantApprovedAt?: Date;
  generatedAt: Date;
}

export interface TimelineEntry {
  timestamp: Date;
  description: string;
  sourceMessageId: string;
}

export type BillingEventType =
  | "emails_scanned"
  | "relevant_messages_processed"
  | "vault_created"
  | "evidence_item_captured"
  | "snapshot_stored"
  | "dispute_signal_detected"
  | "evidence_pack_generated"
  | "mailbox_scan_completed"
  | "recovered_revenue_logged";

export interface BillingEvent {
  id: string;
  merchantId: string;
  eventType: BillingEventType;
  quantity: number;
  metadata: Record<string, unknown>;
  emittedAt: Date;
}

export interface SyncCursor {
  merchantId: string;
  lastProcessedMessageId?: string;
  lastProcessedAt?: Date;
  updatedAt: Date;
}

export interface LinkResult {
  vaultId: string;
  matchedKey: string;
  confidence: number;
}

export type LinkingKey =
  | "order_number"
  | "tracking_number"
  | "payment_reference"
  | "customer_email_amount"
  | "customer_email_timestamp"
  | "customer_name_address"
  | "product_name_timestamp";
