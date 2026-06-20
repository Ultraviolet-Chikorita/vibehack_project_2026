/**
 * Shared definitions and data model for the V1 dispute-readiness engine.
 *
 * Source of truth: codeplainfiles/dispute-engine-core.plain (definitions, data
 * model) and V1 Product Development Spec §5, §17, §21, §22.
 *
 * Every record carries a `merchant_id` so data from different merchants is never
 * mixed (dispute-engine-core.plain · implementation reqs).
 */

/** Mail provider a :Merchant: connected (spec §7). */
export type MailProvider = "gmail" | "outlook";

/**
 * :Classification: — the commerce category assigned to a :SourceMessage:.
 * (dispute-engine-core.plain · definitions; spec §9.2)
 */
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

/** Strength of a single :EvidenceItem: (dispute-engine-core.plain · definitions). */
export type EvidenceStrength =
  | "strong"
  | "weak"
  | "missing"
  | "contradictory"
  | "irrelevant";

/** Action :App: advises for a :DisputeSignal: (dispute-engine-core.plain). */
export type Recommendation =
  | "contest"
  | "refund"
  | "request_more_evidence"
  | "escalate";

/** Detected dispute-signal categories (spec §14). */
export type DisputeSignalCategory =
  | "payment_dispute"
  | "chargeback"
  | "refund_request"
  | "missing_item_complaint"
  | "damaged_item_complaint"
  | "not_as_described_complaint"
  | "duplicate_charge_complaint"
  | "repeat_claimant_risk"
  | "unclear_human_review_needed";

/** Status label for an :OrderEvidenceVault: (evidence-scoring.plain; spec §13). */
export type VaultStatus =
  | "dispute_ready"
  | "mostly_ready"
  | "missing_delivery_proof"
  | "missing_policy_snapshot"
  | "missing_product_snapshot"
  | "needs_review"
  | "weak_evidence";

/** Pack review status. A pack is never sent without explicit merchant approval. */
export type PackStatus =
  | "ready_for_review"
  | "needs_human_review"
  | "approved"
  | "overridden";

/**
 * :SourceMessage: — a single email fetched from a :Merchant: mailbox.
 * Treated as read-only: :App: never modifies, deletes, sends, or marks it.
 */
export interface SourceMessage {
  /** Internal id, stable per (merchant, external_message_id). */
  id: string;
  merchant_id: string;
  provider: MailProvider;
  /** Mailbox-native message id, used to de-duplicate. */
  external_message_id: string;
  sender: string;
  subject: string;
  /**
   * Raw body, supplied only transiently for processing. The engine minimises
   * retained email content and does not persist this on stored records
   * (dispute-engine-core.plain · non-functional reqs; spec §22).
   */
  body?: string;
  received_at: string; // ISO 8601
  classification?: Classification;
  confidence?: number;
  /** Whether the message passed the first-pass commerce filter. */
  relevant?: boolean;
  processed?: boolean;
}

/** A persisted, content-minimised reference to a source message (spec §17.4). */
export interface StoredMessageRef {
  id: string;
  merchant_id: string;
  provider: MailProvider;
  external_message_id: string;
  sender: string;
  subject: string;
  received_at: string;
  classification: Classification;
  confidence: number;
  relevant: boolean;
  processed: boolean;
}

/**
 * :CommerceEvent: — structured commerce data extracted from a relevant
 * :SourceMessage: (event-extraction.plain; spec §10, §17.5).
 * Fields not present in the source are left empty rather than fabricated.
 */
export interface CommerceEvent {
  id: string;
  merchant_id: string;
  /** Traceability: the :SourceMessage: this event was extracted from. */
  source_message_id: string;
  event_type: string;
  order_id?: string;
  customer_email?: string;
  customer_name?: string;
  amount?: number;
  currency?: string;
  product_name?: string;
  product_url?: string;
  payment_reference?: string;
  tracking_number?: string;
  carrier?: string;
  shipping_address?: string;
  billing_address?: string;
  delivery_status?: string;
  dispute_reason?: string;
  dispute_deadline?: string;
  processor?: string;
  refund_amount?: number;
  occurred_at?: string;
  /** Internal annotation: the vault this event was linked to (set by pipeline). */
  linked_vault_id?: string;
}

/**
 * :EvidenceItem: — a single piece of evidence stored in an :OrderEvidenceVault:,
 * derived from a :SourceMessage: (spec §17.7).
 */
export interface EvidenceItem {
  id: string;
  merchant_id: string;
  vault_id: string;
  type: string;
  /** Traceability: the originating :SourceMessage:. */
  source_message_id: string;
  captured_at: string;
  event_timestamp?: string;
  strength: EvidenceStrength;
  /** One-line summary referencing its source message. */
  summary: string;
}

/** Result of scoring a vault (evidence-scoring.plain; spec §13). */
export interface EvidenceScoreResult {
  /** :EvidenceScore: — integer 0..100. */
  score: number;
  status: VaultStatus;
  missing: string[];
  weak: string[];
  strongest_evidence: string[];
  /** Per-dimension breakdown for transparency/auditability. */
  dimensions: Record<string, { weight: number; earned: number; note: string }>;
}

/** :OrderEvidenceVault: — per-order aggregate of evidence (spec §17.6). */
export interface OrderEvidenceVault {
  id: string;
  merchant_id: string;
  order_id: string;
  customer_email?: string;
  customer_name?: string;
  amount?: number;
  currency?: string;
  status: string;
  evidence_score: number;
  evidence_status: VaultStatus;
  missing: string[];
  weak: string[];
  strongest_evidence: string[];
  created_at: string;
  last_updated: string;
  created_from: MailProvider;
}

/** A captured link decision between a message and a vault (spec §11.2). */
export interface LinkResult {
  vault_id: string | null;
  link_confidence: number;
  matched_on: string[];
}

/** A low-confidence link or unmatched signal awaiting human review (spec §11.2). */
export interface ReviewQueueItem {
  id: string;
  merchant_id: string;
  kind: "low_confidence_link" | "unmatched_dispute_signal" | "needs_review_message";
  source_message_id?: string;
  commerce_event_id?: string;
  candidate_vault_id?: string;
  link_confidence?: number;
  reason: string;
  created_at: string;
}

/** :DisputeSignal: — an order is disputed or likely to be (spec §17.8). */
export interface DisputeSignal {
  id: string;
  merchant_id: string;
  vault_id: string | null;
  source_message_id: string;
  signal_type: string;
  category: DisputeSignalCategory;
  reason?: string;
  disputed_amount?: number;
  currency?: string;
  deadline?: string;
  detected_from_subject: string;
  detected_at: string;
}

/** A single row in the evidence pack's captured-evidence table. */
export interface PackEvidenceRow {
  type: string;
  summary: string;
  strength: EvidenceStrength;
  source_message_id: string;
  captured_at: string;
}

/** A single entry in the evidence pack timeline. */
export interface PackTimelineEntry {
  at: string;
  label: string;
  source_message_id?: string;
}

/**
 * :EvidencePack: — the merchant-ready response generated for a :DisputeSignal:
 * (pack-generation.plain; spec §15, §17.9). Facts are separated from the
 * recommendation; the pack never guarantees an outcome and is never submitted
 * without explicit :Merchant: approval.
 */
export interface EvidencePack {
  id: string;
  merchant_id: string;
  vault_id: string;
  signal_id: string;
  dispute_summary: string;
  order_summary: string;
  timeline: PackTimelineEntry[];
  evidence_table: PackEvidenceRow[];
  missing_evidence_warnings: string[];
  recommendation: Recommendation;
  recommendation_confidence: number;
  recommendation_rationale: string;
  submission_text: string;
  attachments_checklist: string[];
  disclaimer: string;
  status: PackStatus;
  approved_at?: string;
  approved_by?: string;
  generated_at: string;
}

/** :BillingEvent: — a metered, usage-based billing record (spec §17.10, §23). */
export interface BillingEvent {
  id: string;
  merchant_id: string;
  event_type: BillingEventType;
  quantity: number;
  case_id?: string;
  amount_disputed?: number;
  amount_recovered?: number;
  currency?: string;
  emails_scanned?: number;
  relevant_messages?: number;
  order_vaults_created?: number;
  dispute_signals_detected?: number;
  created_at: string;
}

export type BillingEventType =
  | "mailbox_scan_completed"
  | "email_scanned"
  | "relevant_message_processed"
  | "order_vault_created"
  | "evidence_item_captured"
  | "snapshot_stored"
  | "dispute_signal_detected"
  | "evidence_pack_generated"
  | "recovered_revenue_logged";

/** :SyncCursor: — per-merchant watermark of the most recent processed message. */
export interface SyncCursor {
  merchant_id: string;
  last_message_id: string | null;
  last_received_at: string | null;
  updated_at: string;
}

/** :Merchant: — a business that connected a mailbox to :App: (spec §17.1). */
export interface Merchant {
  id: string;
  name: string;
  platforms: string[];
  mail_provider: MailProvider;
  plan: PlanName;
  mailbox_connected: boolean;
}

export type PlanName = "Starter" | "Growth" | "High Volume";

/** Access-log entry for evidence-pack reads (spec §22: log access to packs). */
export interface AccessLogEntry {
  id: string;
  merchant_id: string;
  pack_id: string;
  actor: string;
  at: string;
}
