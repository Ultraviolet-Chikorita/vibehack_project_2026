import { sql } from "@vercel/postgres"
import { VAULT_SEED_ROWS } from "@/lib/db-vaults"

export const dynamic = "force-dynamic"

// Inserts the 7 demo vaults. Safe to run repeatedly thanks to
// ON CONFLICT (id) DO NOTHING. Supports POST (and GET for convenience).
async function seed() {
  let inserted = 0

  for (const v of VAULT_SEED_ROWS) {
    const result = await sql`
      INSERT INTO vaults (
        id, order_id, customer, amount, currency, product,
        dispute_status, dispute_reason, dispute_deadline,
        evidence_score, recommendation, latest_event, latest_event_at
      ) VALUES (
        ${v.id}, ${v.order_id}, ${v.customer}, ${v.amount}, ${v.currency}, ${v.product},
        ${v.dispute_status}, ${v.dispute_reason}, ${v.dispute_deadline},
        ${v.evidence_score}, ${v.recommendation}, ${v.latest_event}, ${v.latest_event_at}
      )
      ON CONFLICT (id) DO NOTHING
    `
    inserted += result.rowCount ?? 0
  }

  return inserted
}

export async function POST() {
  try {
    const inserted = await seed()
    return Response.json({
      ok: true,
      inserted,
      total: VAULT_SEED_ROWS.length,
      message: `Seeded ${inserted} new vault(s); ${VAULT_SEED_ROWS.length - inserted} already existed.`,
    })
  } catch (err) {
    console.log("[v0] /api/seed failed:", err)
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
