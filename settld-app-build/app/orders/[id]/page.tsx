import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Package, Mail, Truck, CreditCard, Clock } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { Pill, RecommendationBadge } from "@/components/status-pill"
import { ScoreCard } from "@/components/order/score-card"
import { EvidenceGrid } from "@/components/order/evidence-grid"
import { Timeline } from "@/components/order/timeline"
import { RulesPanel } from "@/components/order/rules-panel"
import { PackPanel } from "@/components/order/pack-panel"
import { Card, CardContent } from "@/components/ui/card"
import { analyzeVault } from "@/lib/pipeline"
import { getVaultById, SEED_VAULTS, MERCHANT } from "@/lib/seed"
import { formatCurrency, formatDate } from "@/lib/format"

export function generateStaticParams() {
  return SEED_VAULTS.map((v) => ({ id: v.orderId }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Order #${id} — Settld` }
}

function MetaItem({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Package
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-[3px] bg-secondary">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`truncate text-sm font-medium text-foreground${mono ? " font-mono" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vault = getVaultById(id)
  if (!vault) notFound()

  const { score, rules, recommendation, hasSignal } = analyzeVault(vault)
  const autoReady = score.score >= 90

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dispute monitor
        </Link>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Order #{vault.orderId}
              </h1>
              {hasSignal ? (
                <Pill
                  label={
                    vault.disputeStatus === "disputed" ? "Disputed" : "Dispute signal"
                  }
                  tone={vault.disputeStatus === "disputed" ? "red" : "amber"}
                />
              ) : (
                <Pill label="Monitoring" tone="slate" />
              )}
              <RecommendationBadge recommendation={recommendation.action} />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {vault.product} · {MERCHANT.name}
              {vault.disputeReason ? (
                <>
                  {" "}
                  · reason:{" "}
                  <span className="font-medium text-foreground">
                    {vault.disputeReason.replace(/_/g, " ")}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {formatCurrency(vault.amount, vault.currency)}
            </p>
            {vault.disputeDeadline ? (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-warning">
                <Clock className="size-3.5" aria-hidden="true" />
                Respond by {formatDate(vault.disputeDeadline)}
              </p>
            ) : null}
          </div>
        </div>

        <Card className="mt-6">
          <CardContent className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
            <MetaItem icon={Mail} label="Customer" value={vault.customer} />
            <MetaItem icon={CreditCard} label="Payment" value="Stripe · Visa 4242" mono />
            <MetaItem
              icon={Truck}
              label="Carrier"
              value={vault.trackingNumber ? `${vault.carrier} · ${vault.trackingNumber}` : "Pending"}
              mono
            />
            <MetaItem
              icon={Package}
              label="Fulfilment"
              value={vault.fulfilmentStatus.replace(/_/g, " ")}
            />
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ScoreCard score={score} />
            <EvidenceGrid evidence={vault.evidence} missing={score.missing} />
            <RulesPanel rules={rules} />
          </div>
          <div className="space-y-6">
            <PackPanel orderId={vault.orderId} autoReady={autoReady} />
            {vault.timeline.length > 0 ? <Timeline events={vault.timeline} /> : null}
          </div>
        </div>
      </main>
    </div>
  )
}
