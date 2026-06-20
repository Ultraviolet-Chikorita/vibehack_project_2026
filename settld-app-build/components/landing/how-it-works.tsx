import { Inbox, FolderLock, FileCheck2 } from 'lucide-react'

const steps = [
  {
    icon: Inbox,
    title: 'Connect Gmail or Outlook',
    body: 'Read-only access in about 2 minutes. Settld watches for commerce emails — nothing is ever sent, deleted or altered.',
  },
  {
    icon: FolderLock,
    title: 'Settld builds an evidence vault for every order',
    body: 'Payment, fulfilment, tracking, delivery and policy — all linked to the order and timestamped as the emails arrive.',
  },
  {
    icon: FileCheck2,
    title: 'A dispute lands, you get a ready-to-submit pack',
    body: 'The moment a chargeback appears, Settld assembles the evidence with a contest-or-refund recommendation. You review and send.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-12 max-w-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald">
          How it works
        </p>
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          From inbox to evidence pack, automatically
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <step.icon className="h-5 w-5" />
            </div>
            <span className="absolute right-5 top-5 font-mono text-sm font-semibold text-muted-foreground/50">
              0{i + 1}
            </span>
            <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
