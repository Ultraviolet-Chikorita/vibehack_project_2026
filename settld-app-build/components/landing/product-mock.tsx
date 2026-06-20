import { Logo } from '@/components/brand'
import { Pill } from '@/components/status-pill'
import { formatGBP } from '@/lib/format'

const rows = [
  { id: '#1048', customer: 'Daniel Okafor', amount: 420, tone: 'red' as const, status: 'disputed' },
  { id: '#1055', customer: 'Tom Hughes', amount: 95, tone: 'emerald' as const, status: 'dispute-ready' },
  { id: '#1060', customer: 'Sofia Romano', amount: 275, tone: 'amber' as const, status: 'missing evidence' },
]

export function ProductMock() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-primary/10 sm:p-5">
      {/* window chrome */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <Logo textClassName="text-base" />
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        </div>
      </div>

      {/* scan line */}
      <p className="mb-4 text-xs text-muted-foreground">
        Scanned <span className="font-semibold text-foreground">184 emails</span> ·{' '}
        <span className="font-semibold text-foreground">12 order vaults</span> ·{' '}
        <span className="font-semibold text-foreground">3 dispute signals</span> ·{' '}
        <span className="font-semibold text-foreground">2 packs ready</span>
      </p>

      {/* stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-[3px] border border-border bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">Disputed</p>
          <p className="font-mono text-2xl font-semibold text-primary">{formatGBP(730)}</p>
        </div>
        <div className="rounded-[3px] border border-emerald/30 bg-emerald/5 p-3">
          <p className="text-xs text-muted-foreground">Recoverable</p>
          <p className="font-mono text-2xl font-semibold text-emerald">{formatGBP(620)}</p>
        </div>
      </div>

      {/* mini table */}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-[3px] border border-border bg-background px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="font-mono text-sm font-medium text-foreground">{r.id}</span>
              <span className="text-xs text-muted-foreground">{r.customer}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatGBP(r.amount)}
              </span>
              <Pill label={r.status} tone={r.tone} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
