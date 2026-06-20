import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const plans = [
  {
    name: 'Starter',
    price: '£49',
    cadence: '/mo',
    highlight: false,
    features: ['1 inbox', 'Up to 200 orders/mo', 'Evidence vaults & scoring', 'Manual pack export'],
  },
  {
    name: 'Growth',
    price: '£149',
    cadence: '/mo',
    highlight: true,
    features: [
      'Up to 3 inboxes',
      'Unlimited orders',
      'Auto-generated dispute packs',
      'Dispute signal queue & deadlines',
      'Priority support',
    ],
  },
  {
    name: 'Pay on Recovery',
    price: '%',
    cadence: 'of recovered revenue',
    highlight: false,
    features: ['No monthly fee', 'You only pay when you win', 'Unlimited orders', 'Full evidence engine'],
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-12 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald">Pricing</p>
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          Simple pricing for sellers
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm',
              plan.highlight
                ? 'border-emerald ring-2 ring-emerald/30'
                : 'border-border',
            )}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-6 rounded-sm bg-emerald px-3 py-1 text-xs font-semibold text-emerald-foreground">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-semibold text-primary">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.cadence}</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants(),
                'mt-6 w-full',
                plan.highlight
                  ? 'bg-emerald text-emerald-foreground hover:bg-emerald/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              Connect your inbox
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
