import { NextResponse } from "next/server"
import { buildOrderSummaries } from "@/lib/pipeline"
import { MERCHANT, SEED_VAULTS, SEED_DIGEST } from "@/lib/seed"

export const dynamic = "force-static"

export async function GET() {
  const orders = buildOrderSummaries(SEED_VAULTS, MERCHANT.name)
  const newDisputes = orders.filter((o) => o.status === "disputed").length
  const packsReady = orders.filter((o) => o.status === "ready" || o.status === "disputed").length
  const estimatedAtRisk = orders
    .filter((o) => o.status === "disputed" || o.status === "signal")
    .reduce((sum, o) => sum + o.amount, 0)

  return NextResponse.json({
    digest: {
      windowLabel: "Last 30 days",
      newDisputes,
      deadlinesSoon: SEED_DIGEST.newSignals,
      packsReady,
      estimatedAtRisk,
    },
    orders,
  })
}
