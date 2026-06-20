import { generateText, Output } from 'ai'
import { z } from 'zod'
import { analyzeVault } from '@/lib/pipeline'
import { getVaultById, SEED_VAULTS } from '@/lib/seed'
import type { OrderVault } from '@/lib/types'

// The one real AI moment: given an evidence vault + dispute signal, an LLM drafts
// the case summary, recommendation and copy-paste submission text. If no model is
// available it falls back to the deterministic rules-engine output so the demo
// always returns a complete pack.

const PackSchema = z.object({
  summary: z.string(),
  recommendation: z.enum(['contest', 'refund', 'review']),
  confidence: z.number(),
  submissionText: z.string(),
  rulesFired: z.array(z.string()),
})

type Pack = z.infer<typeof PackSchema> & { source: 'ai' | 'engine' }

function enginePack(vault: OrderVault): Pack {
  const { score, rules, recommendation } = analyzeVault(vault)
  const fired = rules.filter((r) => r.fired)
  const deliveryProof = vault.evidence.find((e) => e.category === 'delivery')
  return {
    summary: `Order #${vault.orderId} (${vault.product}, ${vault.currency} ${vault.amount}) was paid via Stripe, fulfilled and ${
      deliveryProof ? 'confirmed delivered by the carrier to the order address' : 'shipped'
    }. The customer disputed the charge citing "${vault.disputeReason ?? 'a dispute'}", but the captured evidence (score ${score.score}/100) supports the merchant.`,
    recommendation: recommendation.action,
    confidence: recommendation.confidence,
    submissionText: `To the payment processor regarding dispute on order #${vault.orderId}:\n\nWe are contesting this ${vault.currency} ${vault.amount} dispute. The order was placed on 10 June 2026 and paid in full via Stripe. The item (${vault.product}) was fulfilled the same day and shipped via ${vault.carrier ?? 'the carrier'}${
      vault.trackingNumber ? ` under tracking ${vault.trackingNumber}` : ''
    }. The carrier confirmed delivery to the customer's order address, which matches the billing details on file. We respectfully request this dispute be resolved in the merchant's favour. Supporting evidence (order confirmation, payment receipt, fulfilment, tracking and delivery confirmation) is attached.`,
    rulesFired: fired.map((r) => `${r.rule.description} — ${r.reason}`),
    source: 'engine',
  }
}

export async function POST(req: Request) {
  let vault: OrderVault | undefined
  let signal: unknown

  try {
    const body = await req.json()
    vault = body?.vault ?? (body?.orderId ? getVaultById(body.orderId) : undefined)
    signal = body?.signal
  } catch {
    // ignore — fall back to seed
  }

  if (!vault) vault = getVaultById('1048') ?? SEED_VAULTS[0]

  const fallback = enginePack(vault)

  // Attempt the LLM draft (OpenAI is zero-config via the Vercel AI Gateway).
  // Any failure falls back to the deterministic engine pack so the demo always works.
  try {
    const { experimental_output } = await generateText({
      model: 'openai/gpt-5-mini',
      experimental_output: Output.object({ schema: PackSchema }),
      prompt: `You are a dispute analyst for online merchants. Given this order evidence vault and dispute signal, produce a pack.

- summary: 2 sentences, factual, no hype.
- recommendation: "contest", "refund" or "review".
- confidence: 0..1.
- submissionText: a professional copy-paste response to the payment processor.
- rulesFired: short bullet descriptions of the reasoning that applies.

Evidence vault:
${JSON.stringify(vault, null, 2)}

Dispute signal:
${JSON.stringify(signal ?? { reason: vault.disputeReason, amount: vault.amount }, null, 2)}`,
    })

    return Response.json({ ...experimental_output, source: 'ai' } satisfies Pack)
  } catch {
    // AI Gateway unavailable (e.g. no billing on file) → deterministic engine pack.
    return Response.json(fallback)
  }
}
