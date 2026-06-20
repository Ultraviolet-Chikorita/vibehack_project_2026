import { SiteHeader } from '@/components/site-header'
import { Hero } from '@/components/landing/hero'
import { TrustStrip } from '@/components/landing/trust-strip'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Features } from '@/components/landing/features'
import { Pricing } from '@/components/landing/pricing'
import { OutcomeBand, FinalCta, SiteFooter } from '@/components/landing/closing'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <Features />
        <OutcomeBand />
        <Pricing />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
