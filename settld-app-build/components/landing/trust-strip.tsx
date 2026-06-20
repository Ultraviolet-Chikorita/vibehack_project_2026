import { ShieldCheck } from 'lucide-react'

const partners = ['Shopify', 'Stripe', 'PayPal', 'Gmail', 'Outlook']

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8 sm:px-6">
        <p className="flex items-center gap-2 text-center text-sm font-medium text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald" />
          Read-only access. We never send, delete or alter your email.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {partners.map((p) => (
            <span
              key={p}
              className="text-lg font-semibold tracking-tight text-muted-foreground/60"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
