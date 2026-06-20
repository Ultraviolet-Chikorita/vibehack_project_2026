import { runPipeline, type ProcessResult } from './pipeline'
import { MERCHANT, SEED_MAILBOX, SEED_VAULTS } from './seed'

// API_BASE comes from env. When unset, the app runs fully standalone on seed data.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

// Generic JSON fetcher for SWR.
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export interface ScanResponse extends ProcessResult {
  source: 'api' | 'seed'
}

// Fires the read pipeline. POSTs the seeded mailbox batch to `${API_BASE}/api/process`
// when API_BASE is set, otherwise falls back to running the engine on seed data locally.
export async function runScan(): Promise<ScanResponse> {
  const payload = {
    merchant_id: MERCHANT.mailbox,
    messages: SEED_MAILBOX,
  }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`process failed: ${res.status}`)
      const data = (await res.json()) as ProcessResult
      return { ...data, source: 'api' }
    } catch (err) {
      console.log('[v0] runScan API_BASE call failed, falling back to seed:', err)
    }
  }

  // Standalone fallback — same engine, run in the browser/server on seed data.
  const result = runPipeline(payload.merchant_id, SEED_MAILBOX, SEED_VAULTS)
  return { ...result, source: 'seed' }
}

export interface SeedResponse {
  ok: boolean
  inserted: number
  total: number
  message: string
}

// Populates the vaults table via GET /api/seed (safe to run repeatedly).
export async function syncDatabase(): Promise<SeedResponse> {
  const res = await fetch(`${API_BASE}/api/seed`)
  if (!res.ok) throw new Error(`seed failed: ${res.status}`)
  return (await res.json()) as SeedResponse
}

export interface EvidencePack {
  summary: string
  recommendation: 'contest' | 'refund' | 'review'
  confidence: number
  submissionText: string
  rulesFired: string[]
  source: 'ai' | 'engine'
}

// Calls /api/generate-pack for the given order. The route drafts the pack with an
// LLM when a gateway key is present and otherwise returns the deterministic engine pack.
export async function generatePack(orderId: string): Promise<EvidencePack> {
  const res = await fetch(`${API_BASE}/api/generate-pack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  })
  if (!res.ok) throw new Error(`generate-pack failed: ${res.status}`)
  return (await res.json()) as EvidencePack
}
