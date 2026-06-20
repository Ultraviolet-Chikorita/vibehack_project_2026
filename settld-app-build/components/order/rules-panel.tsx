import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RuleResult } from "@/lib/rules-engine"

// Plain-language copy for each check. Keyed internally by rule id so the
// underlying rule identifiers are never shown to the user.
const FRIENDLY: Record<string, { title: string; detail: string }> = {
  order_has_full_evidence: {
    title: "Complete evidence on file",
    detail: "We found every type of proof for this order — purchase, payment and delivery.",
  },
  payment_confirmed_with_receipt: {
    title: "Payment is confirmed",
    detail: "There's a receipt showing the customer was charged successfully.",
  },
  strong_evidence_with_signal: {
    title: "Strong proof against the dispute",
    detail: "The evidence is solid and a dispute was raised, so it's worth challenging.",
  },
  delivery_proof_present: {
    title: "Delivery is documented",
    detail: "The carrier confirmed the parcel reached the customer's address.",
  },
  score_between_50_and_74: {
    title: "Evidence is mixed",
    detail: "Some proof is strong and some is unclear, so it's worth a closer look.",
  },
  missing_critical_evidence: {
    title: "Some proof is missing",
    detail: "One or more key documents weren't found for this order.",
  },
  weak_evidence_high_risk: {
    title: "Limited proof available",
    detail: "There isn't enough evidence to confidently challenge this dispute.",
  },
  auto_generate_if_score_gt_90: {
    title: "Response pack ready",
    detail: "The evidence was strong enough for us to prepare a response automatically.",
  },
}

const TONE: Record<string, string> = {
  info: "text-emerald",
  warning: "text-warning",
  error: "text-danger",
}

export function RulesPanel({ rules }: { rules: RuleResult[] }) {
  const applied = rules.filter((r) => r.fired)
  const notApplied = rules.filter((r) => !r.fired)
  const ordered = [...applied, ...notApplied]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Why we recommend this</CardTitle>
        <CardDescription>
          The checks we ran on this order&apos;s evidence. {applied.length} of {rules.length}{" "}
          applied here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {ordered.map((r) => {
            const copy = FRIENDLY[r.rule.id] ?? {
              title: "Evidence check",
              detail: "",
            }
            return (
              <li
                key={r.rule.id}
                className={cn(
                  "flex items-start gap-3 rounded-[3px] border p-3",
                  r.fired
                    ? "border-border bg-secondary/60"
                    : "border-border/60 opacity-55",
                )}
              >
                {r.fired ? (
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      TONE[r.rule.severity],
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                ) : (
                  <Minus
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground/40"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{copy.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                    {r.fired ? copy.detail : "Doesn't apply to this order."}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
