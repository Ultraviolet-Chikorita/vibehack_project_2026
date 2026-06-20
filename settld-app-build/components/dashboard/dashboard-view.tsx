"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Inbox,
  ScanLine,
  ShieldCheck,
  Clock,
  FileText,
  Loader2,
  Database,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { OrderTable } from "@/components/orders/order-table"
import { fetcher, runScan, syncDatabase } from "@/lib/api"
import { formatCurrency } from "@/lib/format"
import { buildOrderSummaries } from "@/lib/pipeline"
import { MERCHANT, SEED_VAULTS } from "@/lib/seed"
import {
  computeDigest,
  sortOrderSummaries,
  vaultRowToOrderSummary,
  type VaultRow,
} from "@/lib/db-vaults"

// Seed-derived fallback used when the database is unreachable.
const FALLBACK_ORDERS = buildOrderSummaries(SEED_VAULTS, MERCHANT.name)

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Inbox
  label: string
  value: string
  tone?: "default" | "warning" | "success"
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-accent"
        : "text-primary"
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-lg bg-secondary">
          <Icon className={`size-5 ${toneClass}`} aria-hidden="true" />
        </div>
        <div>
          <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardView() {
  const { data, error, isLoading, mutate } = useSWR<{ vaults: VaultRow[] }>(
    "/api/vaults",
    fetcher,
  )
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    const toastId = toast.loading("Syncing database…", {
      description: "Populating the vaults table.",
    })
    try {
      const res = await syncDatabase()
      await mutate()
      toast.success("Database synced", { id: toastId, description: res.message })
    } catch {
      toast.error("Sync failed", {
        id: toastId,
        description: "Could not reach the database. Please try again.",
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleScan() {
    setScanning(true)
    setScanMsg("Connecting to inbox (read-only)…")
    try {
      const steps = [
        "Filtering commerce mail from noise…",
        "Extracting orders, payments and delivery events…",
        "Matching evidence and scoring disputes…",
      ]
      for (const s of steps) {
        await new Promise((r) => setTimeout(r, 650))
        setScanMsg(s)
      }
      const res = await runScan()
      await mutate()
      setScanMsg(
        `Scan complete — ${res.scanned} messages reviewed, ${res.signals.length} dispute signal${res.signals.length === 1 ? "" : "s"} flagged.`,
      )
    } catch {
      setScanMsg("Scan failed. Please try again.")
    } finally {
      setScanning(false)
      setTimeout(() => setScanMsg(null), 4000)
    }
  }

  // Map DB rows → order summaries. If the fetch fails, fall back to seed data.
  const orders =
    error || (data && !data.vaults)
      ? FALLBACK_ORDERS
      : data?.vaults
        ? sortOrderSummaries(data.vaults.map((v) => vaultRowToOrderSummary(v, MERCHANT.name)))
        : []
  const digest = orders.length > 0 ? computeDigest(orders) : undefined

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">
              {digest?.windowLabel ?? "Last 30 days"}
            </p>
            <h1 className="mt-1 text-pretty text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Dispute monitor
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Settld watches your commerce inbox and assembles evidence the moment a
              chargeback risk appears. Review the queue below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Database className="size-4" aria-hidden="true" />
              )}
              {syncing ? "Syncing…" : "Sync database"}
            </Button>
            <Button
              onClick={handleScan}
              disabled={scanning}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {scanning ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ScanLine className="size-4" aria-hidden="true" />
              )}
              {scanning ? "Scanning…" : "Run inbox scan"}
            </Button>
          </div>
        </div>

        {scanMsg ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-foreground"
            role="status"
            aria-live="polite"
          >
            {scanning ? (
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
            )}
            {scanMsg}
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Inbox}
            label="New disputes"
            value={digest ? String(digest.newDisputes) : "—"}
            tone="warning"
          />
          <StatCard
            icon={Clock}
            label="Deadlines this week"
            value={digest ? String(digest.deadlinesSoon) : "—"}
            tone="warning"
          />
          <StatCard
            icon={FileText}
            label="Evidence packs ready"
            value={digest ? String(digest.packsReady) : "—"}
            tone="success"
          />
          <StatCard
            icon={ShieldCheck}
            label="Value at risk"
            value={digest ? formatCurrency(digest.estimatedAtRisk) : "—"}
          />
        </section>

        <Card className="mt-6 overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">Order queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OrderTable orders={orders} isLoading={isLoading} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
