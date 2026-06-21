// ============================================================
// email-filtering — first-pass filter and classification
// Generated from: email-filtering.plain (spec §9)
// ============================================================

import { SourceMessage, Classification } from "./types";

export const SENDER_ALLOW_LIST = [
  "shopify.com",
  "stripe.com",
  "paypal.com",
  "royalmail.com",
  "evri.com",
  "dhl.com",
  "ups.com",
  "fedex.com",
  "etsy.com",
  "tiktok.com",
  "amazon.com",
];

export const SUBJECT_ALLOW_LIST = [
  "order confirmed",
  "payment received",
  "order fulfilled",
  "tracking number",
  "delivered",
  "refund request",
  "chargeback",
  "dispute opened",
  "item not received",
];

export const SUBJECT_IGNORE_LIST = [
  "newsletter",
  "promotion",
  "discount",
  "marketing",
  "password reset",
  "login code",
  "social media notification",
];

export interface FilterResult {
  isRelevant: boolean;
  reason: string;
}

export interface ClassificationResult {
  classification: Classification;
  confidence: number;
}

/**
 * First-pass filter: checks sender domain and subject line.
 * Returns true if message is commerce-relevant, false if it should be discarded.
 */
export function filterMessage(message: SourceMessage): FilterResult {
  const subjectLower = message.subject.toLowerCase();

  // Subject ignore list takes priority
  for (const phrase of SUBJECT_IGNORE_LIST) {
    if (subjectLower.includes(phrase)) {
      return { isRelevant: false, reason: `subject matched ignore list: "${phrase}"` };
    }
  }

  // Check sender domain
  const senderDomain = extractDomain(message.sender);
  if (SENDER_ALLOW_LIST.some((d) => senderDomain.endsWith(d))) {
    return { isRelevant: true, reason: `sender domain matched allow list: ${senderDomain}` };
  }

  // Check subject allow list
  for (const phrase of SUBJECT_ALLOW_LIST) {
    if (subjectLower.includes(phrase)) {
      return { isRelevant: true, reason: `subject matched allow list: "${phrase}"` };
    }
  }

  return { isRelevant: false, reason: "no allow list match" };
}

/**
 * Assigns a Classification and confidence score to a relevant SourceMessage.
 */
export function classifyMessage(message: SourceMessage): ClassificationResult {
  const subjectLower = message.subject.toLowerCase();
  const bodyLower = message.body.toLowerCase();
  const combined = subjectLower + " " + bodyLower;

  const rules: Array<{ pattern: RegExp; classification: Classification; confidence: number }> = [
    { pattern: /dispute opened|chargeback|dispute notification/i, classification: "dispute_notification", confidence: 0.95 },
    { pattern: /refund request|refund issued|refund processed/i, classification: "refund_request", confidence: 0.9 },
    { pattern: /item not received|not received|missing parcel/i, classification: "customer_complaint", confidence: 0.85 },
    { pattern: /delivered|delivery confirmed|out for delivery/i, classification: "delivery_confirmation", confidence: 0.9 },
    { pattern: /tracking number|tracking update|shipment update/i, classification: "tracking_update", confidence: 0.88 },
    { pattern: /order fulfilled|order shipped|dispatched/i, classification: "fulfilment_confirmation", confidence: 0.88 },
    { pattern: /payment received|payment confirmed|payment processed/i, classification: "payment_confirmation", confidence: 0.9 },
    { pattern: /order confirmed|order #\d+|order placed/i, classification: "order_confirmation", confidence: 0.92 },
    { pattern: /marketplace case|seller case|buyer case/i, classification: "marketplace_case", confidence: 0.85 },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(combined)) {
      return { classification: rule.classification, confidence: rule.confidence };
    }
  }

  return { classification: "needs_review", confidence: 0.0 };
}

function extractDomain(sender: string): string {
  const match = sender.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : "";
}
