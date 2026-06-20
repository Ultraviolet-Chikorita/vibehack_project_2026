import { cn } from '@/lib/utils'

type Tone = 'emerald' | 'amber' | 'red' | 'slate'

const toneClasses: Record<Tone, string> = {
  emerald: 'bg-emerald/10 text-success-foreground border-emerald/30',
  amber: 'bg-warning/10 text-warning-foreground border-warning/30',
  red: 'bg-danger/10 text-danger-foreground border-danger/30',
  slate: 'bg-secondary text-secondary-foreground border-border',
}

const toneDot: Record<Tone, string> = {
  emerald: 'bg-emerald',
  amber: 'bg-warning',
  red: 'bg-danger',
  slate: 'bg-muted-foreground',
}

export function Pill({
  label,
  tone = 'slate',
  className,
}: {
  label: string
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[tone])} />
      {label}
    </span>
  )
}

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  disputed: { label: 'Disputed', tone: 'red' },
  signal: { label: 'Dispute signal', tone: 'amber' },
  ready: { label: 'Dispute-ready', tone: 'emerald' },
  incomplete: { label: 'Missing evidence', tone: 'amber' },
  none: { label: 'Monitoring', tone: 'slate' },
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.none
  return <Pill label={s.label} tone={s.tone} className={className} />
}

export function RecommendationBadge({
  recommendation,
}: {
  recommendation: 'contest' | 'refund' | 'review'
}) {
  const map: Record<typeof recommendation, { label: string; tone: Tone }> = {
    contest: { label: 'Contest', tone: 'emerald' },
    refund: { label: 'Refund', tone: 'red' },
    review: { label: 'Human review', tone: 'amber' },
  }
  const m = map[recommendation]
  return <Pill label={m.label} tone={m.tone} />
}

export function RiskBadge({ score }: { score: number }) {
  const tone: Tone = score >= 80 ? 'emerald' : score >= 50 ? 'amber' : 'red'
  const color =
    tone === 'emerald' ? 'text-emerald' : tone === 'amber' ? 'text-warning' : 'text-danger'
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('font-mono text-sm font-semibold tabular-nums', color)}>{score}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-[2px] bg-secondary" aria-hidden="true">
        <span
          className={cn(
            'block h-full rounded-[2px]',
            tone === 'emerald' ? 'bg-emerald' : tone === 'amber' ? 'bg-warning' : 'bg-danger',
          )}
          style={{ width: `${score}%` }}
        />
      </span>
    </span>
  )
}

// Maps a vault to its display status pill
export function vaultStatusPill(disputeStatus: string, score: number) {
  if (disputeStatus === 'disputed') return { label: 'disputed', tone: 'red' as Tone }
  if (disputeStatus === 'signal') return { label: 'dispute signal', tone: 'amber' as Tone }
  if (score >= 80) return { label: 'dispute-ready', tone: 'emerald' as Tone }
  return { label: 'missing evidence', tone: 'amber' as Tone }
}
