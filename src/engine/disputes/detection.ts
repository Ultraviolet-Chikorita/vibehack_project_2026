/**
 * Dispute signal detection (dispute-detection.plain; spec §14).
 *
 * FRs:
 *  - Detect a :DisputeSignal: from messages indicating any of: payment dispute,
 *    chargeback, refund request, missing-item, damaged-item, not-as-described,
 *    duplicate-charge complaint, repeat-claimant risk, or an unclear case needing
 *    human review.
 *  - Record the dispute reason, disputed amount, and deadline when present.
 *  - (Vault linkage is performed by the pipeline using :LinkingKeys:.)
 *
 * A neutral delivery inquiry ("where is my order?") is NOT a dispute signal — it
 * is captured as weak communication-history evidence. Only explicit claims or
 * processor/platform actions raise a signal.
 */
import { Classification, CommerceEvent, DisputeSignalCategory } from "../core/types";

export interface DetectionInput {
  subject: string;
  body?: string;
  sender: string;
  classification: Classification;
  event: CommerceEvent;
  /** Number of prior dispute signals already seen for this customer (repeat risk). */
  priorDisputesForCustomer?: number;
}

export interface DetectedSignal {
  category: DisputeSignalCategory;
  signal_type: string;
  reason?: string;
  disputed_amount?: number;
  currency?: string;
  deadline?: string;
}

interface DetectionRule {
  category: DisputeSignalCategory;
  signalType: (sender: string) => string;
  test: (text: string, sender: string, classification: Classification) => boolean;
}

const has = (s: string, ...terms: string[]) => terms.some((t) => s.includes(t));

const RULES: DetectionRule[] = [
  {
    category: "chargeback",
    signalType: () => "chargeback_created",
    test: (s) => has(s, "chargeback"),
  },
  {
    category: "payment_dispute",
    signalType: (sender) =>
      sender.includes("stripe")
        ? "stripe_dispute_opened"
        : sender.includes("paypal")
          ? "paypal_dispute_opened"
          : "payment_dispute_opened",
    test: (s) => has(s, "dispute opened", "payment dispute", "dispute notification", "dispute created"),
  },
  {
    category: "duplicate_charge_complaint",
    signalType: () => "duplicate_charge_complaint",
    test: (s) => has(s, "duplicate charge", "charged twice", "double charged"),
  },
  {
    category: "not_as_described_complaint",
    signalType: () => "not_as_described_complaint",
    test: (s) => has(s, "not as described", "different from", "wrong item"),
  },
  {
    category: "damaged_item_complaint",
    signalType: () => "damaged_item_complaint",
    test: (s) => has(s, "damaged", "broken", "arrived damaged"),
  },
  {
    category: "missing_item_complaint",
    signalType: () => "missing_item_complaint",
    // Explicit non-receipt CLAIM (not a neutral "where is my order?" question).
    test: (s) => has(s, "item not received", "never arrived", "did not arrive", "not received", "hasn't arrived", "has not arrived"),
  },
  {
    category: "refund_request",
    signalType: () => "refund_requested",
    test: (s, _sender, classification) =>
      classification === "refund_request" || has(s, "refund request", "requesting a refund", "request a refund", "refund not processed"),
  },
  {
    // A marketplace/PayPal case is treated as a payment dispute category.
    category: "payment_dispute",
    signalType: (sender) => (sender.includes("paypal") ? "paypal_case_opened" : "marketplace_case_opened"),
    test: (s, _sender, classification) => classification === "marketplace_case" || has(s, "case opened", "a-to-z claim"),
  },
];

/**
 * Inspect a processed message and return a detected dispute signal, or null when
 * the message is not a dispute. Reason/amount/deadline are taken from the
 * extracted :CommerceEvent: when present (never fabricated).
 */
export function detectDisputeSignal(input: DetectionInput): DetectedSignal | null {
  const text = `${input.subject}\n${input.body ?? ""}`.toLowerCase();
  const sender = input.sender.toLowerCase();

  let matched: DetectionRule | null = null;
  for (const rule of RULES) {
    if (rule.test(text, sender, input.classification)) {
      matched = rule;
      break;
    }
  }

  // Repeat-claimant risk: a fresh complaint from a customer who has disputed before.
  const isComplaintish =
    matched !== null ||
    input.classification === "customer_complaint" ||
    input.classification === "refund_request";
  if ((input.priorDisputesForCustomer ?? 0) > 0 && isComplaintish && (!matched || matched.category === "refund_request")) {
    return {
      category: "repeat_claimant_risk",
      signal_type: "repeat_claimant_risk",
      reason: input.event.dispute_reason ?? "repeat_claim",
      disputed_amount: input.event.amount ?? input.event.refund_amount,
      currency: input.event.currency,
      deadline: input.event.dispute_deadline,
    };
  }

  if (!matched) {
    // A dispute-flavoured message we cannot categorise confidently → human review.
    if (input.classification === "dispute_notification") {
      return {
        category: "unclear_human_review_needed",
        signal_type: "unclear_dispute",
        reason: input.event.dispute_reason,
        disputed_amount: input.event.amount,
        currency: input.event.currency,
        deadline: input.event.dispute_deadline,
      };
    }
    return null;
  }

  return {
    category: matched.category,
    signal_type: matched.signalType(sender),
    reason: input.event.dispute_reason,
    disputed_amount: input.event.amount ?? input.event.refund_amount,
    currency: input.event.currency,
    deadline: input.event.dispute_deadline,
  };
}
