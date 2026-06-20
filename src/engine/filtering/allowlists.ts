/**
 * First-pass filter vocabularies (email-filtering.plain · definitions; spec §9.1).
 *
 * :SenderAllowList:  — sender domains treated as commerce-relevant.
 * :SubjectAllowList: — subject phrases that mark a message commerce-relevant.
 * :SubjectIgnoreList: — subject phrases that mark a message irrelevant.
 *
 * The lists are non-exhaustive in the spec ("such as"); the fuller spec §9.1
 * vocabulary is included here so the filter is demoable on real-looking mail.
 */

export const SENDER_ALLOW_LIST: readonly string[] = [
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

export const SUBJECT_ALLOW_LIST: readonly string[] = [
  "order confirmed",
  "order confirmation",
  "payment received",
  "payment successful",
  "order fulfilled",
  "shipment created",
  "tracking number",
  "dispatched",
  "out for delivery",
  "delivered",
  "delivery confirmation",
  "refund request",
  "chargeback",
  "dispute opened",
  "payment dispute",
  "case opened",
  "item not received",
  "never arrived",
  "damaged item",
  "not as described",
  "where is my order",
  "refund not processed",
];

export const SUBJECT_IGNORE_LIST: readonly string[] = [
  "newsletter",
  "promotion",
  "discount",
  "marketing",
  "password reset",
  "login code",
  "subscription update",
  "social media notification",
];

/** Extract the domain part of a sender (handles "Name <a@b.com>" forms). */
export function senderDomain(sender: string): string {
  const match = sender.match(/[^<\s@]+@([^>\s]+)/);
  const domain = (match ? match[1] : sender).toLowerCase().trim();
  return domain;
}

export function senderInAllowList(sender: string): boolean {
  const domain = senderDomain(sender);
  return SENDER_ALLOW_LIST.some((d) => domain === d || domain.endsWith("." + d));
}

export function subjectMatches(subject: string, list: readonly string[]): string[] {
  const s = subject.toLowerCase();
  return list.filter((phrase) => s.includes(phrase));
}
