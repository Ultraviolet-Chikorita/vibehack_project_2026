"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"
import { OrderTable } from "@/components/orders/order-table"
import { fetcher } from "@/lib/api"
import { buildOrderSummaries } from "@/lib/pipeline"
import { MERCHANT, SEED_VAULTS } from "@/lib/seed"
import { sortOrderSummaries, vaultRowToOrderSummary, type VaultRow } from "@/lib/db-vaults"

// Seed-derived fallback used when the database is unreachable.
const FALLBACK_ORDERS = buildOrderSummaries(SEED_VAULTS, MERCHANT.name)

export function OrdersListView() {
  const { data, error, isLoading } = useSWR<{ vaults: VaultRow[] }>("/api/vaults", fetcher)

  const orders =
    error || (data && !data.vaults)
      ? FALLBACK_ORDERS
      : data?.vaults
        ? sortOrderSummaries(data.vaults.map((v) => vaultRowToOrderSummary(v, MERCHANT.name)))
        : []

  const needsAttention = orders.filter(
    (o) => o.status === "disputed" || o.status === "signal",
  ).length

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-accent">Order book</p>
          <h1 className="mt-1 text-pretty text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Orders
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Every order Settld is watching. Select one to review its fulfilment, evidence
            vault and full timeline.{" "}
            {needsAttention > 0 ? (
              <span className="text-foreground">
                {needsAttention} need
                {needsAttention === 1 ? "s" : ""} attention right now.
              </span>
            ) : null}
          </p>
        </div>

        <Card className="mt-6 overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">
              All orders{" "}
              <span className="font-normal text-muted-foreground">
                ({isLoading ? "…" : orders.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OrderTable orders={orders} isLoading={isLoading} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
