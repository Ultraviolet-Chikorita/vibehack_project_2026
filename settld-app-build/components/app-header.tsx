import Link from 'next/link'
import { Logo, ReadOnlyBadge } from '@/components/brand'
import { MERCHANT } from '@/lib/seed'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="Settld home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/dashboard" className="text-foreground">
              Dashboard
            </Link>
            <Link href="/orders" className="transition-colors hover:text-foreground">
              Orders
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ReadOnlyBadge className="hidden sm:inline-flex" />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-foreground">{MERCHANT.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{MERCHANT.mailbox}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-primary font-mono text-sm font-semibold text-primary-foreground">
            EL
          </span>
        </div>
      </div>
    </header>
  )
}
