import type { OrderSummary } from "./types"

// Shape of a row in the Neon `vaults` table.
export interface VaultRow {
  id: string
  order_id: string
  customer: string
  amount: number | string
  currency: string
  product: string
  dispute_status: "none" | "signal" | "disputed"
  dispute_reason: string | null
  dispute_deadline: string | null
  evidence_score: number
  recommendation: "contest" | "refund" | "review" | null
  latest_event: string | null
  latest_event_at: string | null
  created_at?: string
}

// The 7 demo vaults used to seed the database. Mirrors lib/seed.ts so the
// app behaves identically whether reading from Postgres or the local fallback.
export const VAULT_SEED_ROWS: Array<
  Pick<
    VaultRow,
    | "id"
    | "order_id"
    | "customer"
    | "amount"
    | "currency"
    | "product"
    | "dispute_status"
    | "dispute_reason"
    | "dispute_deadline"
    | "evidence_score"
    | "recommendation"
    | "latest_event"
    | "latest_event_at"
  >
> = [
  {
    id: "vault_1048",
    order_id: "1048",
    customer: "Daniel Okafor",
    amount: 420,
    currency: "GBP",
    product: "Refurbished 50mm camera lens",
    dispute_status: "disputed",
    dispute_reason: "item_not_received",
    dispute_deadline: "2026-06-23T23:59:00Z",
    evidence_score: 92,
    recommendation: "contest",
    latest_event: "Stripe dispute detected · pack ready",
    latest_event_at: "2026-06-16T09:42:00Z",
  },
  {
    id: "vault_1042",
    order_id: "1042",
    customer: "Priya Sharma",
    amount: 310,
    currency: "GBP",
    product: "Vintage film camera body",
    dispute_status: "disputed",
    dispute_reason: "damaged_item",
    dispute_deadline: "2026-06-24T23:59:00Z",
    evidence_score: 88,
    recommendation: "review",
    latest_event: "Customer reports item damaged",
    latest_event_at: "2026-06-16T08:10:00Z",
  },
  {
    id: "vault_1051",
    order_id: "1051",
    customer: "Marcus Lee",
    amount: 189,
    currency: "GBP",
    product: "Camera tripod kit",
    dispute_status: "signal",
    dispute_reason: "refund_request",
    dispute_deadline: "2026-06-25T23:59:00Z",
    evidence_score: 91,
    recommendation: "contest",
    latest_event: "Refund request received",
    latest_event_at: "2026-06-16T07:30:00Z",
  },
  {
    id: "vault_1039",
    order_id: "1039",
    customer: "Aisha Rahman",
    amount: 540,
    currency: "GBP",
    product: "Mirrorless camera kit",
    dispute_status: "none",
    dispute_reason: null,
    dispute_deadline: null,
    evidence_score: 71,
    recommendation: "review",
    latest_event: "In transit · awaiting delivery scan",
    latest_event_at: "2026-06-15T18:02:00Z",
  },
  {
    id: "vault_1055",
    order_id: "1055",
    customer: "Tom Hughes",
    amount: 95,
    currency: "GBP",
    product: "Lens cleaning kit",
    dispute_status: "none",
    dispute_reason: null,
    dispute_deadline: null,
    evidence_score: 95,
    recommendation: "contest",
    latest_event: "Delivered · dispute-ready",
    latest_event_at: "2026-06-14T12:20:00Z",
  },
  {
    id: "vault_1060",
    order_id: "1060",
    customer: "Sofia Romano",
    amount: 275,
    currency: "GBP",
    product: "Prime lens 35mm",
    dispute_status: "none",
    dispute_reason: null,
    dispute_deadline: null,
    evidence_score: 83,
    recommendation: "review",
    latest_event: "Delivered · missing policy snapshot",
    latest_event_at: "2026-06-13T15:45:00Z",
  },
  {
    id: "vault_1033",
    order_id: "1033",
    customer: "Leah Cohen",
    amount: 130,
    currency: "GBP",
    product: "Camera strap & case",
    dispute_status: "none",
    dispute_reason: null,
    dispute_deadline: null,
    evidence_score: 96,
    recommendation: "contest",
    latest_event: "Delivered · dispute-ready",
    latest_event_at: "2026-06-11T09:05:00Z",
  },
]

// Maps a DB vault row to the OrderSummary shape the UI tables expect.
export function vaultRowToOrderSummary(row: VaultRow, merchant: string): OrderSummary {
  let status: OrderSummary["status"]
  if (row.dispute_status === "disputed") status = "disputed"
  else if (row.dispute_status === "signal") status = "signal"
  else if (row.evidence_score >= 80) status = "ready"
  else status = "incomplete"

  return {
    id: row.order_id,
    orderNumber: row.order_id,
    merchant,
    customerName: row.customer,
    customerEmail: "",
    amount: Number(row.amount),
    currency: row.currency,
    status,
    winScore: row.evidence_score,
    recommendation: row.recommendation ?? "review",
    updatedAt: row.latest_event_at ?? "",
  }
}

// Sorts summaries the way the queue does: most urgent first, then by value.
export function sortOrderSummaries(orders: OrderSummary[]): OrderSummary[] {
  const rank = (s: OrderSummary["status"]) =>
    s === "disputed" ? 0 : s === "signal" ? 1 : s === "incomplete" ? 2 : 3
  return [...orders].sort((a, b) => {
    const r = rank(a.status) - rank(b.status)
    return r !== 0 ? r : b.amount - a.amount
  })
}

export interface DashboardDigest {
  windowLabel: string
  newDisputes: number
  deadlinesSoon: number
  packsReady: number
  estimatedAtRisk: number
}

// Derives the dashboard stat cards from a set of order summaries.
export function computeDigest(orders: OrderSummary[]): DashboardDigest {
  return {
    windowLabel: "Last 30 days",
    newDisputes: orders.filter((o) => o.status === "disputed").length,
    deadlinesSoon: orders.filter((o) => o.status === "disputed" || o.status === "signal")
      .length,
    packsReady: orders.filter((o) => o.status === "ready" || o.status === "disputed").length,
    estimatedAtRisk: orders
      .filter((o) => o.status === "disputed" || o.status === "signal")
      .reduce((sum, o) => sum + o.amount, 0),
  }
}
