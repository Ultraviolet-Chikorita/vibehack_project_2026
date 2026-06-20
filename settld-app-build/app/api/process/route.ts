import { runPipeline } from '@/lib/pipeline'
import { SEED_MAILBOX, SEED_VAULTS } from '@/lib/seed'
import type { SourceMessage } from '@/lib/types'

// Full read pipeline endpoint:
// filter → classify → extract → vault match → score → detect signal → apply rules.
export async function POST(req: Request) {
  let body: { merchant_id?: string; messages?: SourceMessage[] } = {}
  try {
    body = await req.json()
  } catch {
    // empty body → fall back to seed
  }

  const merchantId = body.merchant_id ?? 'demo-merchant'
  const messages =
    Array.isArray(body.messages) && body.messages.length > 0 ? body.messages : SEED_MAILBOX

  const result = runPipeline(merchantId, messages, SEED_VAULTS)
  return Response.json(result)
}
