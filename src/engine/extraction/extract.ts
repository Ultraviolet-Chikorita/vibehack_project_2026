/**
 * Event extraction — structured :CommerceEvent: from a relevant :SourceMessage:
 * (event-extraction.plain; spec §10).
 *
 * FRs:
 *  - Extract any of: order id, customer email/name, amount, currency, product
 *    name/URL, payment reference, tracking number, carrier, shipping/billing
 *    address, delivery status, dispute reason/deadline, processor/platform,
 *    refund amount, event timestamp.
 *  - Fields not present in the source are left empty rather than fabricated.
 *  - Every :CommerceEvent: references the id of its originating :SourceMessage:.
 */
import { Classification, CommerceEvent, SourceMessage } from "../core/types";
import { nextId } from "../core/ids";

const ORDER_RE = /(?:order|order\s*#|order\s*no\.?|order\s*number)\D{0,3}#?\s*([A-Z0-9][A-Z0-9-]{2,})/i;
const ORDER_HASH_RE = /#\s*([0-9]{3,})/;
const EMAIL_RE = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i;
const AMOUNT_RE = /(?:£|\$|€|GBP|USD|EUR)\s?([0-9]+(?:[.,][0-9]{2})?)|([0-9]+(?:[.,][0-9]{2})?)\s?(?:GBP|USD|EUR)/i;
const TRACKING_RE = /\b([A-Z]{2}\d{6,}[A-Z]{0,2}|1Z[0-9A-Z]{16}|\d{12,22})\b/;
const DEADLINE_RE = /(?:deadline|respond by|due by|by)\s*:?\s*(\d{4}-\d{2}-\d{2})/i;
const ISO_DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const PAYMENT_REF_RE = /\b(pi_[A-Za-z0-9]+|ch_[A-Za-z0-9]+|txn_[A-Za-z0-9]+|PAYID-[A-Za-z0-9]+)\b/;
const URL_RE = /\bhttps?:\/\/[^\s)]+/i;

function currencyFromText(text: string): string | undefined {
  if (/£|\bGBP\b/i.test(text)) return "GBP";
  if (/\$|\bUSD\b/.test(text)) return "USD";
  if (/€|\bEUR\b/i.test(text)) return "EUR";
  return undefined;
}

function carrierFromText(text: string, sender: string): string | undefined {
  const t = (text + " " + sender).toLowerCase();
  if (t.includes("royal mail") || t.includes("royalmail")) return "Royal Mail";
  if (t.includes("evri")) return "Evri";
  if (t.includes("dhl")) return "DHL";
  if (t.includes("ups")) return "UPS";
  if (t.includes("fedex")) return "FedEx";
  return undefined;
}

function processorFromSender(sender: string): string | undefined {
  const s = sender.toLowerCase();
  if (s.includes("stripe")) return "Stripe";
  if (s.includes("paypal")) return "PayPal";
  if (s.includes("shopify")) return "Shopify";
  if (s.includes("amazon")) return "Amazon";
  if (s.includes("etsy")) return "Etsy";
  if (s.includes("tiktok")) return "TikTok";
  return undefined;
}

function disputeReasonFromText(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes("item not received") || t.includes("never arrived") || t.includes("did not arrive"))
    return "item_not_received";
  if (t.includes("not as described")) return "not_as_described";
  if (t.includes("damaged")) return "damaged_item";
  if (t.includes("duplicate")) return "duplicate_charge";
  if (t.includes("unauthorized") || t.includes("fraud")) return "fraudulent";
  return undefined;
}

const EVENT_TYPE_BY_CLASSIFICATION: Record<Classification, string> = {
  order_confirmation: "order_confirmed",
  payment_confirmation: "payment_confirmed",
  fulfilment_confirmation: "order_fulfilled",
  tracking_update: "tracking_created",
  delivery_confirmation: "delivered",
  refund_request: "refund_requested",
  customer_complaint: "customer_message",
  dispute_notification: "dispute_opened",
  marketplace_case: "marketplace_case_opened",
  irrelevant: "irrelevant",
  needs_review: "needs_review",
};

/** First capture group that is defined, trimmed. */
function firstMatch(re: RegExp, text: string): string | undefined {
  const m = text.match(re);
  if (!m) return undefined;
  for (let i = 1; i < m.length; i++) if (m[i]) return m[i].trim();
  return undefined;
}

function parseAmount(text: string): number | undefined {
  const m = text.match(AMOUNT_RE);
  if (!m) return undefined;
  const raw = (m[1] ?? m[2] ?? "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Extract a :CommerceEvent: from a relevant message. Absent fields stay
 * undefined (never fabricated). The result references `message.id`.
 */
export function extractCommerceEvent(
  message: SourceMessage,
  classification: Classification
): CommerceEvent {
  const subject = message.subject ?? "";
  const body = message.body ?? "";
  const haystack = `${subject}\n${body}`;
  const sender = message.sender ?? "";

  const orderId = firstMatch(ORDER_RE, haystack) ?? firstMatch(ORDER_HASH_RE, haystack);
  const tracking = firstMatch(TRACKING_RE, haystack);
  const customerEmail = firstMatch(EMAIL_RE, body);
  const amount = parseAmount(haystack);
  const currency = currencyFromText(haystack);
  const carrier = carrierFromText(haystack, sender);
  const processor = processorFromSender(sender);
  const productUrl = firstMatch(URL_RE, body);
  const paymentRef = firstMatch(PAYMENT_REF_RE, haystack);
  const disputeReason = disputeReasonFromText(haystack);
  const deadline = firstMatch(DEADLINE_RE, haystack);

  const event: CommerceEvent = {
    id: nextId("evt"),
    merchant_id: message.merchant_id,
    source_message_id: message.id, // traceability
    event_type: EVENT_TYPE_BY_CLASSIFICATION[classification] ?? "commerce_event",
    occurred_at: message.received_at,
  };

  // Only set fields that were actually found (no fabrication).
  if (orderId) event.order_id = normalizeOrderId(orderId);
  if (customerEmail) event.customer_email = customerEmail.toLowerCase();
  if (amount !== undefined) event.amount = amount;
  if (currency) event.currency = currency;
  if (tracking) event.tracking_number = tracking;
  if (carrier) event.carrier = carrier;
  if (processor) event.processor = processor;
  if (productUrl) event.product_url = productUrl;
  if (paymentRef) event.payment_reference = paymentRef;
  if (disputeReason) event.dispute_reason = disputeReason;
  if (deadline) event.dispute_deadline = deadline;

  // Structured fields that demo emails carry as explicit "Key: value" lines.
  const fields = parseKeyValueLines(body);
  if (!event.customer_name && fields["customer"]) event.customer_name = fields["customer"];
  if (!event.customer_name && fields["customer name"]) event.customer_name = fields["customer name"];
  if (!event.product_name && fields["product"]) event.product_name = fields["product"];
  if (!event.product_name && fields["item"]) event.product_name = fields["item"];
  if (!event.shipping_address && fields["shipping address"]) event.shipping_address = fields["shipping address"];
  if (!event.shipping_address && fields["ship to"]) event.shipping_address = fields["ship to"];
  if (!event.billing_address && fields["billing address"]) event.billing_address = fields["billing address"];
  if (!event.delivery_status && fields["status"]) event.delivery_status = fields["status"];

  // Delivery status defaults from classification when explicitly delivered.
  if (!event.delivery_status && classification === "delivery_confirmation") {
    event.delivery_status = "delivered";
  }

  // Refund amount for refund-related messages.
  if (classification === "refund_request" && amount !== undefined) {
    event.refund_amount = amount;
  }

  return event;
}

/** Normalise order ids like "#1048" / "Order 1048" to a bare token "1048". */
export function normalizeOrderId(raw: string): string {
  return raw.replace(/^#/, "").trim();
}

/** Parse simple "Key: value" lines often present in commerce email bodies. */
function parseKeyValueLines(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0 && idx < 40) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key && value) out[key] = value;
    }
  }
  return out;
}
