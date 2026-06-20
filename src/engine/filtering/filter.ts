/**
 * First-pass commerce filter and classification (email-filtering.plain; spec §9).
 *
 * FRs:
 *  - Run a first-pass filter using :SenderAllowList: and :SubjectAllowList:
 *    before any expensive processing.
 *  - A subject in :SubjectIgnoreList: marks the message irrelevant even when
 *    other (allow-list) terms are present.
 *  - Store only minimal metadata for irrelevant messages and stop processing.
 *  - Assign a :Classification: and a confidence in [0, 1] to each relevant
 *    message; a message that cannot be confidently classified is `needs_review`
 *    rather than guessed.
 */
import { Classification, SourceMessage } from "../core/types";
import {
  SUBJECT_ALLOW_LIST,
  senderInAllowList,
  subjectMatches,
  SUBJECT_IGNORE_LIST,
} from "./allowlists";

export interface FilterResult {
  relevant: boolean;
  reason: string;
  matchedSubjectTerms: string[];
  senderAllowed: boolean;
}

/**
 * Decide whether a message is commerce-relevant. The ignore list wins over the
 * allow list so a "newsletter" is dropped even if it also says "order confirmed".
 */
export function firstPassFilter(message: Pick<SourceMessage, "sender" | "subject">): FilterResult {
  const ignored = subjectMatches(message.subject, SUBJECT_IGNORE_LIST);
  if (ignored.length > 0) {
    return {
      relevant: false,
      reason: `subject matches ignore list: ${ignored.join(", ")}`,
      matchedSubjectTerms: [],
      senderAllowed: senderInAllowList(message.sender),
    };
  }

  const senderAllowed = senderInAllowList(message.sender);
  const matchedSubjectTerms = subjectMatches(message.subject, SUBJECT_ALLOW_LIST);
  const relevant = senderAllowed || matchedSubjectTerms.length > 0;

  return {
    relevant,
    reason: relevant
      ? `sender_allowed=${senderAllowed}; subject_terms=[${matchedSubjectTerms.join(", ")}]`
      : "no allow-list sender or subject match",
    matchedSubjectTerms,
    senderAllowed,
  };
}

interface ClassificationRule {
  classification: Classification;
  confidence: number;
  /** True when this rule fires for the message. */
  test: (subject: string, sender: string) => boolean;
}

const has = (s: string, ...terms: string[]) => terms.some((t) => s.includes(t));

/**
 * Ordered classification rules. Higher rules win. Confidences mirror the spec
 * §9.3 example (a Shopify order confirmation classifies at 0.94).
 */
const RULES: ClassificationRule[] = [
  {
    classification: "dispute_notification",
    confidence: 0.95,
    test: (s) => has(s, "dispute opened", "payment dispute", "chargeback", "case opened", "dispute"),
  },
  {
    classification: "refund_request",
    confidence: 0.88,
    test: (s) => has(s, "refund request", "refund not processed", "requesting a refund", "request a refund"),
  },
  {
    classification: "delivery_confirmation",
    confidence: 0.92,
    test: (s) => has(s, "delivered", "delivery confirmation", "has been delivered"),
  },
  {
    classification: "tracking_update",
    confidence: 0.9,
    test: (s) =>
      has(s, "tracking number", "shipment created", "dispatched", "out for delivery", "on its way"),
  },
  {
    classification: "fulfilment_confirmation",
    confidence: 0.9,
    test: (s) => has(s, "order fulfilled", "fulfilled", "fulfilment", "fulfillment", "has shipped", "shipped"),
  },
  {
    classification: "payment_confirmation",
    confidence: 0.92,
    test: (s, sender) =>
      has(s, "payment received", "payment successful", "payment confirmation") ||
      (sender.includes("stripe") && has(s, "payment")),
  },
  {
    classification: "order_confirmation",
    confidence: 0.94,
    test: (s) => has(s, "order confirmed", "order confirmation", "confirmed"),
  },
  {
    classification: "marketplace_case",
    confidence: 0.85,
    test: (s, sender) =>
      (sender.includes("paypal") && has(s, "case")) ||
      (sender.includes("amazon") && has(s, "claim", "a-to-z")),
  },
  {
    classification: "customer_complaint",
    confidence: 0.7,
    test: (s) =>
      has(
        s,
        "where is my order",
        "item not received",
        "never arrived",
        "damaged item",
        "not as described",
        "complaint",
        "where is"
      ),
  },
];

export interface ClassifyResult {
  classification: Classification;
  confidence: number;
}

/**
 * Classify a relevant message. Returns `needs_review` (low confidence) when no
 * rule fires confidently, rather than guessing a category.
 */
export function classify(message: Pick<SourceMessage, "sender" | "subject">): ClassifyResult {
  const subject = message.subject.toLowerCase();
  const sender = message.sender.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(subject, sender)) {
      return { classification: rule.classification, confidence: rule.confidence };
    }
  }
  return { classification: "needs_review", confidence: 0.3 };
}
