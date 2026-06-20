import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand'

export function OutcomeBand() {
  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
          Every fulfilled order is dispute-ready before you need it.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-lg text-primary-foreground/70">
          Less time digging through your inbox, more disputes won.
        </p>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="rounded-3xl border border-emerald/30 bg-emerald/5 px-6 py-14 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          Connect your inbox — see your first evidence pack in minutes.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
          Read-only. No card required to explore the demo.
        </p>
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ size: 'lg' }),
            'mt-6 bg-emerald text-emerald-foreground hover:bg-emerald/90',
          )}
        >
          Connect your inbox
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:px-6 md:flex-row">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          Read-only access • Delete your data anytime • Built for sellers
        </p>
      </div>
    </footer>
  )
}
