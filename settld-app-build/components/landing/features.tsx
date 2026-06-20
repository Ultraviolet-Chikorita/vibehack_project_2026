import { cn } from '@/lib/utils'
import { Pill } from '@/components/status-pill'
import { formatGBP } from '@/lib/format'
import { CreditCard, Truck, Package, FileText, CircleCheckBig } from 'lucide-react'

function TimelineMock() {
  const rows = [
    { icon: Package, label: 'Order placed', sub: 'Shopify · #1048' },
    { icon: CreditCard, label: 'Payment captured', sub: 'Stripe · £420' },
    { icon: Truck, label: 'Delivered, signed for', sub: 'Royal Mail · RN123…GB' },
  ]
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
            <r.icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{r.label}</p>
            <p className="font-mono text-xs text-muted-foreground">{r.sub}</p>
          </div>
          <CircleCheckBig className="h-4 w-4 text-emerald" />
        </div>
      ))}
    </div>
  )
}

function PackMock() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald" />
          <span className="text-sm font-semibold text-foreground">Dispute pack · #1048</span>
        </div>
        <Pill label="Contest · 82%" tone="emerald" />
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <span className="text-muted-foreground">Delivery proof</span>
          <span className="font-medium text-emerald">strong</span>
        </div>
        <div className="flex justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <span className="text-muted-foreground">Address match</span>
          <span className="font-medium text-emerald">strong</span>
        </div>
        <div className="flex justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <span className="text-muted-foreground">Customer messages</span>
          <span className="font-medium text-warning">weak</span>
        </div>
      </div>
    </div>
  )
}

function DashboardMock() {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="col-span-2 flex items-center justify-between rounded-xl border border-border bg-secondary/60 p-4">
        <span className="text-sm text-muted-foreground">Disputed</span>
        <span className="font-mono text-xl font-semibold text-primary">{formatGBP(730)}</span>
      </div>
      <div className="col-span-2 flex items-center justify-between rounded-xl border border-emerald/30 bg-emerald/5 p-4">
        <span className="text-sm text-muted-foreground">Recoverable</span>
        <span className="font-mono text-xl font-semibold text-emerald">{formatGBP(620)}</span>
      </div>
    </div>
  )
}

const features = [
  {
    eyebrow: 'Traceable evidence',
    title: 'An order evidence timeline you can defend',
    body: 'Every order gets a chronological vault — order, payment, fulfilment, tracking and delivery — each row linked back to the source email so the proof is always traceable.',
    mock: <TimelineMock />,
  },
  {
    eyebrow: 'Auto-generated packs',
    title: 'A ready-to-submit dispute pack the moment a claim lands',
    body: 'Settld assembles a case summary, an evidence table and a copy-paste response for your processor, with a clear contest-or-refund recommendation and a confidence score.',
    mock: <PackMock />,
  },
  {
    eyebrow: 'Revenue clarity',
    title: 'See disputed vs recoverable value at a glance',
    body: 'The dashboard tracks exactly how much revenue is under dispute and how much is recoverable based on the evidence you already hold.',
    mock: <DashboardMock />,
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-6xl space-y-20 px-4 py-20 sm:px-6">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="grid items-center gap-10 lg:grid-cols-2"
          >
            <div className={cn(i % 2 === 1 && 'lg:order-2')}>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald">
                {f.eyebrow}
              </p>
              <h3 className="mb-3 text-balance text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                {f.title}
              </h3>
              <p className="text-pretty leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
            <div className={cn(i % 2 === 1 && 'lg:order-1')}>{f.mock}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
