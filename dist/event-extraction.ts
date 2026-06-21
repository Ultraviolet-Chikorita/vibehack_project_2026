// ============================================================
// event-extraction — structured commerce data from emails
// Generated from: event-extraction.plain (spec §10)
// ============================================================

import { SourceMessage, CommerceEvent, Classification } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Extracts a CommerceEvent from a relevant SourceMessage.
 * Fields not present in the message are left undefined rather than fabricated.
 */
export function extractCommerceEvent(
  message: SourceMessage,
  classification: Classification,
  merchantId: string
): CommerceEvent {
  const text = `${message.subject}\n${message.body}`;

  return {
    id: uuidv4(),
    merchantId,
    sourceMessageId: message.id,
    classification,
    orderId: extractOrderId(text),
    customerEmail: extractEmail(text),
    customerName: extractCustomerName(text),
    amount: extractAmount(text),
    currency: extractCurrency(text),
    productName: extractProductName(text),
    productUrl: extractProductUrl(text),
    paymentReference: extractPaymentReference(text),
    trackingNumber: extractTrackingNumber(text),
    carrier: extractCarrier(text),
    shippingAddress: extractShippingAddress(text),
    billingAddress: extractBillingAddress(text),
    deliveryStatus: extractDeliveryStatus(text),
    disputeReason: extractDisputeReason(text),
    disputeDeadline: extractDisputeDeadline(text),
    processor: extractProcessor(message.sender),
    refundAmount: extractRefundAmount(text),
    eventTimestamp: extractEventTimestamp(text) ?? message.receivedAt,
    extractedAt: new Date(),
  };
}

// ── Extraction helpers ──────────────────────────────────────

function extractOrderId(text: string): string | undefined {
  const match = text.match(/order\s*#?\s*(\w{4,})/i);
  return match?.[1];
}

function extractEmail(text: string): string | undefined {
  const match = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return match?.[0];
}

function extractCustomerName(text: string): string | undefined {
  const match = text.match(/(?:dear|hi|hello)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i);
  return match?.[1];
}

function extractAmount(text: string): number | undefined {
  const match = text.match(/(?:total|amount|charged|paid)[^\d]*(\d+(?:[.,]\d{2})?)/i);
  if (match) return parseFloat(match[1].replace(",", "."));
  return undefined;
}

function extractCurrency(text: string): string | undefined {
  const match = text.match(/\b(GBP|USD|EUR|£|\$|€)\b/i);
  return match?.[1];
}

function extractProductName(text: string): string | undefined {
  const match = text.match(/(?:item|product|purchase):\s*(.+?)(?:\n|,)/i);
  return match?.[1]?.trim();
}

function extractProductUrl(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s]+(?:product|item|listing)[^\s]*/i);
  return match?.[0];
}

function extractPaymentReference(text: string): string | undefined {
  const match = text.match(/(?:payment ref|transaction id|payment id)[:\s#]+([A-Z0-9_-]{6,})/i);
  return match?.[1];
}

function extractTrackingNumber(text: string): string | undefined {
  // Royal Mail, Evri, generic patterns
  const match = text.match(/(?:tracking(?:\s+number)?|track)[:\s#]*([A-Z0-9]{8,20})/i);
  return match?.[1];
}

function extractCarrier(text: string): string | undefined {
  const carriers = ["Royal Mail", "Evri", "DHL", "UPS", "FedEx", "Hermes", "Yodel", "DPD", "Amazon Logistics"];
  for (const carrier of carriers) {
    if (text.toLowerCase().includes(carrier.toLowerCase())) return carrier;
  }
  return undefined;
}

function extractShippingAddress(text: string): string | undefined {
  const match = text.match(/(?:shipping|delivery)\s+address[:\s]+(.+?)(?:\n\n|\z)/is);
  return match?.[1]?.replace(/\n/g, ", ").trim();
}

function extractBillingAddress(text: string): string | undefined {
  const match = text.match(/billing\s+address[:\s]+(.+?)(?:\n\n|\z)/is);
  return match?.[1]?.replace(/\n/g, ", ").trim();
}

function extractDeliveryStatus(text: string): string | undefined {
  const statuses = ["delivered", "out for delivery", "in transit", "attempted delivery", "held at depot"];
  const lower = text.toLowerCase();
  return statuses.find((s) => lower.includes(s));
}

function extractDisputeReason(text: string): string | undefined {
  const match = text.match(/(?:reason|dispute reason|claim)[:\s]+(.+?)(?:\n|\.)/i);
  return match?.[1]?.trim();
}

function extractDisputeDeadline(text: string): Date | undefined {
  const match = text.match(/(?:respond by|deadline|due by)[:\s]+(\d{1,2}[\s/.-]\w+[\s/.-]\d{2,4})/i);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

function extractProcessor(sender: string): string | undefined {
  if (sender.includes("stripe.com")) return "Stripe";
  if (sender.includes("paypal.com")) return "PayPal";
  if (sender.includes("shopify.com")) return "Shopify";
  if (sender.includes("etsy.com")) return "Etsy";
  if (sender.includes("amazon.com")) return "Amazon";
  return undefined;
}

function extractRefundAmount(text: string): number | undefined {
  const match = text.match(/refund(?:ed)?\s+(?:of\s+)?(?:£|\$|€)?(\d+(?:[.,]\d{2})?)/i);
  if (match) return parseFloat(match[1].replace(",", "."));
  return undefined;
}

function extractEventTimestamp(text: string): Date | undefined {
  const match = text.match(/(?:on|date|at)[:\s]+(\d{1,2}[\s/.-]\w+[\s/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}
