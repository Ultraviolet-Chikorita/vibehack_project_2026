/**
 * Hackathon demo dataset for spec §24.
 *
 * Fictional merchant: East London Camera Store (support@eastlondoncamera.example),
 * using Gmail, Shopify, and Stripe. Hero order #1048 is a refurbished camera
 * lens for £420 with dispute reason "item not received".
 *
 * Two builders:
 * - {@link order1048Mailbox}: the seven seeded messages for the hero order. The
 *   pipeline turns them into a dispute_ready vault scoring 92, one dispute
 *   signal, and one auto-generated pack recommending contest at 0.82.
 * - {@link fullDemoMailbox}: the hero order plus synthetic orders and noise,
 *   tuned to reproduce the §16/§25 dashboard figures (184 scanned, 39 relevant,
 *   12 vaults, 3 signals, 2 ready packs).
 */
import { Merchant, SourceMessage } from "../engine/core/types";

export const DEMO_MERCHANT: Merchant = {
  id: "merchant_001",
  name: "East London Camera Store",
  platforms: ["Shopify", "Stripe", "Gmail"],
  mail_provider: "gmail",
  plan: "Growth",
  mailbox_connected: true,
};

const MERCHANT_ID = DEMO_MERCHANT.id;
const SHIP_ADDR = "14 Bethnal Green Road, London, E1 6PX";

function msg(m: Omit<SourceMessage, "merchant_id" | "provider">): SourceMessage {
  return { merchant_id: MERCHANT_ID, provider: "gmail", ...m };
}

/** Seven seeded messages for hero order #1048 (spec §24). */
export function order1048Mailbox(): SourceMessage[] {
  return [
    msg({
      id: "msg_1048_01",
      external_message_id: "gmail-1048-01",
      sender: "no-reply@shopify.com",
      subject: "Order #1048 confirmed",
      body: [
        "Thanks for your order!",
        "Order: #1048",
        "Customer: customer@example.com",
        "Customer name: Alex Morgan",
        "Product: Refurbished Camera Lens",
        "Total: £420.00",
        "Currency: GBP",
      ].join("\n"),
      received_at: "2026-06-10T10:14:00Z",
    }),
    msg({
      id: "msg_1048_02",
      external_message_id: "gmail-1048-02",
      sender: "receipts@stripe.com",
      subject: "Payment received for Order #1048",
      body: [
        "Payment successful.",
        "Order: #1048",
        "Customer: customer@example.com",
        "Amount: £420.00",
        "Payment reference: pi_3PqR8s2eZvKYlo2C",
        "Processor: Stripe",
      ].join("\n"),
      received_at: "2026-06-10T10:15:00Z",
    }),
    msg({
      id: "msg_1048_03",
      external_message_id: "gmail-1048-03",
      sender: "no-reply@shopify.com",
      subject: "Order #1048 fulfilled",
      body: [
        "Your order has been fulfilled.",
        "Order: #1048",
        "Customer: customer@example.com",
        "Shipping address: " + SHIP_ADDR,
        "Carrier: Royal Mail",
      ].join("\n"),
      received_at: "2026-06-10T14:20:00Z",
    }),
    msg({
      id: "msg_1048_04",
      external_message_id: "gmail-1048-04",
      sender: "no-reply@royalmail.com",
      subject: "Your tracking number for Order #1048: RN123456789GB",
      body: [
        "Shipment created.",
        "Order: #1048",
        "Tracking number: RN123456789GB",
        "Carrier: Royal Mail",
        "Shipping address: " + SHIP_ADDR,
      ].join("\n"),
      received_at: "2026-06-10T14:22:00Z",
    }),
    msg({
      id: "msg_1048_05",
      external_message_id: "gmail-1048-05",
      sender: "no-reply@royalmail.com",
      subject: "Royal Mail delivered: RN123456789GB",
      body: [
        "Your parcel has been delivered.",
        "Order: #1048",
        "Tracking number: RN123456789GB",
        "Status: delivered",
        "Delivered to: " + SHIP_ADDR,
      ].join("\n"),
      received_at: "2026-06-12T11:03:00Z",
    }),
    msg({
      id: "msg_1048_06",
      external_message_id: "gmail-1048-06",
      sender: "customer@example.com",
      subject: "Where is my order #1048?",
      body: ["Hi, just checking on the delivery status of order #1048. Thanks, Alex"].join("\n"),
      received_at: "2026-06-13T08:30:00Z",
    }),
    msg({
      id: "msg_1048_07",
      external_message_id: "gmail-1048-07",
      sender: "notifications@stripe.com",
      subject: "Stripe dispute opened: Order #1048",
      body: [
        "A payment dispute has been opened.",
        "Order: #1048",
        "Customer: customer@example.com",
        "Reason: item not received",
        "Disputed amount: £420.00",
        "Currency: GBP",
        "Respond by: 2026-06-22",
        "Processor: Stripe",
      ].join("\n"),
      received_at: "2026-06-16T09:41:00Z",
    }),
  ];
}

// Synthetic supporting orders used to reach the §16/§25 dashboard figures.

interface SyntheticOrderSpec {
  order: string;
  customer: string;
  name: string;
  product: string;
  amount: number;
  tracking: string;
  /** Stages to include. */
  stages: {
    order: boolean;
    payment: boolean;
    fulfilment: boolean;
    tracking: boolean;
    delivery: boolean;
    customerMsg: boolean;
  };
  /** Optional dispute type: "stripe" (full pack) or "lowscore_refund" (thin-vault refund path, needs_human_review). */
  dispute?: "stripe" | "lowscore_refund";
}

function syntheticOrderMessages(spec: SyntheticOrderSpec, startIso: string): SourceMessage[] {
  const out: SourceMessage[] = [];
  let t = Date.parse(startIso);
  const step = () => {
    t += 3600_000;
    return new Date(t).toISOString();
  };
  const addr = `${spec.order} High Street, London`;
  const p = (n: number) => `gmail-${spec.order}-${String(n).padStart(2, "0")}`;
  let n = 0;

  if (spec.stages.order)
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: "no-reply@shopify.com",
        subject: `Order #${spec.order} confirmed`,
        body: `Order: #${spec.order}\nCustomer: ${spec.customer}\nCustomer name: ${spec.name}\nProduct: ${spec.product}\nTotal: £${spec.amount}.00\nCurrency: GBP`,
        received_at: step(),
      })
    );
  if (spec.stages.payment)
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: "receipts@stripe.com",
        subject: `Payment received for Order #${spec.order}`,
        body: `Order: #${spec.order}\nCustomer: ${spec.customer}\nAmount: £${spec.amount}.00\nProcessor: Stripe`,
        received_at: step(),
      })
    );
  if (spec.stages.fulfilment)
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: "no-reply@shopify.com",
        subject: `Order #${spec.order} fulfilled`,
        body: `Order: #${spec.order}\nShipping address: ${addr}\nCarrier: Royal Mail`,
        received_at: step(),
      })
    );
  if (spec.stages.tracking)
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: "no-reply@royalmail.com",
        subject: `Your tracking number for Order #${spec.order}: ${spec.tracking}`,
        body: `Order: #${spec.order}\nTracking number: ${spec.tracking}\nCarrier: Royal Mail\nShipping address: ${addr}`,
        received_at: step(),
      })
    );
  if (spec.stages.delivery)
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: "no-reply@royalmail.com",
        subject: `Royal Mail delivered: ${spec.tracking}`,
        body: `Order: #${spec.order}\nTracking number: ${spec.tracking}\nStatus: delivered\nDelivered to: ${addr}`,
        received_at: step(),
      })
    );
  if (spec.stages.customerMsg)
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: spec.customer,
        subject: `Where is my order #${spec.order}?`,
        body: `Checking on delivery for order #${spec.order}.`,
        received_at: step(),
      })
    );
  if (spec.dispute === "stripe")
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: "notifications@stripe.com",
        subject: `Stripe dispute opened: Order #${spec.order}`,
        body: `Order: #${spec.order}\nReason: item not received\nDisputed amount: £${spec.amount}.00\nCurrency: GBP\nRespond by: 2026-06-24\nProcessor: Stripe`,
        received_at: step(),
      })
    );
  if (spec.dispute === "lowscore_refund")
    out.push(
      msg({
        id: `m_${spec.order}_${++n}`,
        external_message_id: p(n),
        sender: spec.customer,
        subject: `Refund request for order ${spec.order}`,
        body: `Order: #${spec.order}\nI'd like a refund please.\nAmount: £${spec.amount}.00`,
        received_at: step(),
      })
    );

  return out;
}

/** Irrelevant messages counted as scanned but dropped. */
function noiseMessages(count: number, startIso: string): SourceMessage[] {
  const subjects = [
    "Newsletter: this week's photography tips",
    "50% promotion on studio lighting",
    "Your password reset code",
    "Social media notification: new follower",
    "Marketing: summer sale starts now",
    "Your login code is 884213",
    "Discount inside: 20% off accessories",
  ];
  const out: SourceMessage[] = [];
  let t = Date.parse(startIso);
  for (let i = 0; i < count; i++) {
    t += 600_000;
    out.push(
      msg({
        id: `noise_${i}`,
        external_message_id: `gmail-noise-${i}`,
        sender: i % 2 === 0 ? "news@marketing.example" : "no-reply@socialapp.example",
        subject: subjects[i % subjects.length],
        body: "Promotional content.",
        received_at: new Date(t).toISOString(),
      })
    );
  }
  return out;
}

/**
 * Eleven supporting orders (order #1048 is the 12th, the hero). Tuned so the
 * full mailbox reproduces the spec §25 demo figures: 12 vaults, 39 relevant
 * messages, 7 delivery confirmations, 3 dispute signals, 2 ready packs (hero +
 * #2005), 1 needs_human_review pack (#2009), £730 disputed (420 + 200 + 110),
 * and £620 recoverable (the two contest packs: 420 + 200).
 */
const SUPPORTING_ORDERS: SyntheticOrderSpec[] = [
  // Strong second dispute: fully evidenced vault, contest pack at £200.
  { ...o("2005", 200, "RN200500005GB", full5()), dispute: "stripe" },
  // Thin vault with a low-value refund dispute: needs_human_review pack, £110.
  { ...o("2009", 110, "RN200900009GB", orderPayment()), dispute: "lowscore_refund" },
  // Four delivered orders (order + payment + tracking + delivery).
  o("2001", 300, "RN200100001GB", delivered4()),
  o("2002", 180, "RN200200002GB", delivered4()),
  o("2003", 95, "RN200300003GB", delivered4()),
  o("2004", 260, "RN200400004GB", delivered4()),
  // One more delivered order (order + tracking + delivery).
  o("2010", 110, "RN201000010GB", delivered3()),
  // Four order-only vaults missing delivery proof.
  o("2006", 210, "RN200600006GB", orderOnly()),
  o("2007", 130, "RN200700007GB", orderOnly()),
  o("2008", 75, "RN200800008GB", orderOnly()),
  o("2011", 240, "RN201100011GB", orderOnly()),
];

function o(order: string, amount: number, tracking: string, stages: SyntheticOrderSpec["stages"]): SyntheticOrderSpec {
  return { order, customer: `buyer_${order}@gmail.com`, name: `Buyer ${order}`, product: "Camera accessory", amount, tracking, stages };
}
function stages(order: boolean, payment: boolean, fulfilment: boolean, tracking: boolean, delivery: boolean): SyntheticOrderSpec["stages"] {
  return { order, payment, fulfilment, tracking, delivery, customerMsg: false };
}
function full5() {
  return stages(true, true, true, true, true);
}
function delivered4() {
  return stages(true, true, false, true, true);
}
function delivered3() {
  return stages(true, false, false, true, true);
}
function orderPayment() {
  return stages(true, true, false, false, false);
}
function orderOnly() {
  return stages(true, false, false, false, false);
}

/** Full demo mailbox: hero order, supporting orders, and noise. */
export function fullDemoMailbox(): SourceMessage[] {
  const messages: SourceMessage[] = [...order1048Mailbox()];
  let day = 10;
  for (const spec of SUPPORTING_ORDERS) {
    messages.push(...syntheticOrderMessages(spec, `2026-06-${String(day).padStart(2, "0")}T09:00:00Z`));
    day = day < 16 ? day + 1 : 10;
  }
  // Pad with noise so the total scanned count reaches 184.
  const relevantSoFar = messages.length;
  const noiseNeeded = Math.max(0, 184 - relevantSoFar);
  messages.push(...noiseMessages(noiseNeeded, "2026-06-09T06:00:00Z"));
  return messages;
}
