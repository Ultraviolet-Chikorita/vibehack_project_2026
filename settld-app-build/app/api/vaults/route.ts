import { sql } from "@vercel/postgres"
import type { VaultRow } from "@/lib/db-vaults"

export const dynamic = "force-dynamic"

// Returns every vault row, newest activity first.
export async function GET() {
  try {
    const { rows } = await sql<VaultRow>`
      SELECT
        id, order_id, customer, amount, currency, product,
        dispute_status, dispute_reason, dispute_deadline,
        evidence_score, recommendation, latest_event, latest_event_at, created_at
      FROM vaults
      ORDER BY latest_event_at DESC
    `
    return Response.json({ vaults: rows })
  } catch (err) {
    console.log("[v0] /api/vaults failed:", err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
