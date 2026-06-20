import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ReadOnlyBadge } from '@/components/brand'
import { ProductMock } from './product-mock'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <ReadOnlyBadge />
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
            Disputes, settled.
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Settld connects to your inbox and turns your order, payment and delivery emails into
            ready-to-submit dispute evidence — automatically, before a chargeback lands. You review
            and send.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-emerald text-emerald-foreground hover:bg-emerald/90',
              )}
            >
              Connect your inbox
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className={buttonVariants({ size: 'lg', variant: 'outline' })}
            >
              See how it works
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Read-only access. We never send, delete or alter your email.
          </p>
        </div>

        <div className="lg:pl-6">
          <ProductMock />
        </div>
      </div>
    </section>
  )
}
