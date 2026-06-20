import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'

export function Logo({
  className,
  textClassName,
}: {
  className?: string
  textClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-primary text-primary-foreground">
        <Check className="h-5 w-5 text-emerald-foreground" strokeWidth={3} />
      </span>
      <span
        className={cn(
          'font-serif text-xl font-semibold tracking-tight text-primary',
          textClassName,
        )}
      >
        Settld
      </span>
    </span>
  )
}

export function ReadOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground',
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5 text-emerald" />
      Read-only access
    </span>
  )
}
