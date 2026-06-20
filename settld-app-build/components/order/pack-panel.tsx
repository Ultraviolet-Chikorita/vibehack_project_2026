"use client"

import { useState } from "react"
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Download,
  FileCheck2,
  Cpu,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/status-pill"
import { generatePack, type EvidencePack } from "@/lib/api"

export function PackPanel({
  orderId,
  autoReady,
}: {
  orderId: string
  autoReady: boolean
}) {
  const [pack, setPack] = useState<EvidencePack | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await generatePack(orderId)
      setPack(result)
    } catch {
      // surface nothing destructive; keep UI stable
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!pack) return
    await navigator.clipboard.writeText(pack.submissionText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-accent/30 bg-accent/[0.03]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-accent" aria-hidden="true" />
              Evidence pack
            </CardTitle>
            <CardDescription className="mt-1">
              {autoReady
                ? "Auto-generated when the dispute-readiness score crossed 90."
                : "Generate a ready-to-submit response from the captured evidence."}
            </CardDescription>
          </div>
          {pack ? (
            <Pill
              label={pack.source === "ai" ? "AI drafted" : "Engine drafted"}
              tone={pack.source === "ai" ? "emerald" : "slate"}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pack ? (
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileCheck2 className="size-4" aria-hidden="true" />
            )}
            {loading ? "Assembling pack…" : "Generate evidence pack"}
          </Button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Pill
                label={`Recommend: ${pack.recommendation}`}
                tone={
                  pack.recommendation === "contest"
                    ? "emerald"
                    : pack.recommendation === "refund"
                      ? "red"
                      : "amber"
                }
              />
              <span className="text-xs text-muted-foreground">
                Confidence{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {Math.round(pack.confidence * 100)}%
                </span>
              </span>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Case summary
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{pack.summary}</p>
            </div>

            {pack.rulesFired.length > 0 ? (
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Cpu className="size-3.5" aria-hidden="true" />
                  Reasoning
                </h4>
                <ul className="mt-1.5 space-y-1">
                  {pack.rulesFired.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Submission text
                </h4>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1.5 text-xs">
                  {copied ? (
                    <Check className="size-3.5 text-accent" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-card p-3.5 font-mono text-xs leading-relaxed text-foreground">
                {pack.submissionText}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                Regenerate
              </Button>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Download className="size-4" aria-hidden="true" />
                Export pack
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
