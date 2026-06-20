import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShoppingBag,
  CreditCard,
  Package,
  ScrollText,
  Truck,
  MapPin,
  MessagesSquare,
  RotateCcw,
  ShieldAlert,
  FileCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { scoringWeights } from "@/lib/scoring"
import type { EvidenceCategory, EvidenceItem } from "@/lib/types"

const CATEGORY_ICON: Record<EvidenceCategory, typeof FileCheck> = {
  order: ShoppingBag,
  payment: CreditCard,
  product: Package,
  policy: ScrollText,
  fulfilment: FileCheck,
  delivery: Truck,
  address: MapPin,
  communication: MessagesSquare,
  refund: RotateCcw,
  conflict: ShieldAlert,
}

const CATEGORY_LABEL: Record<EvidenceCategory, string> = {
  order: "Order Proof",
  payment: "Payment Proof",
  product: "Product Proof",
  policy: "Policy Proof",
  fulfilment: "Fulfilment Proof",
  delivery: "Delivery Proof",
  address: "Address Match",
  communication: "Communication History",
  refund: "Refund History",
  conflict: "Conflict Detection",
}

function strengthMeta(strength: EvidenceItem["strength"]) {
  if (strength === "strong")
    return { Icon: CheckCircle2, color: "text-emerald", border: "border-emerald/30 bg-emerald/5" }
  if (strength === "weak")
    return { Icon: AlertTriangle, color: "text-warning", border: "border-warning/30 bg-warning/5" }
  return { Icon: XCircle, color: "text-danger", border: "border-danger/30 bg-danger/5" }
}

export function EvidenceGrid({
  evidence,
  missing,
}: {
  evidence: EvidenceItem[]
  missing: string[]
}) {
  // Build a full 10-dimension view: present items + synthesised "missing" tiles.
  const present = new Set(evidence.map((e) => e.category))
  const missingTiles: EvidenceItem[] = scoringWeights
    .filter((d) => !present.has(d.id as EvidenceCategory))
    .map((d) => ({
      id: `missing_${d.id}`,
      category: d.id as EvidenceCategory,
      label: d.label,
      type: d.label,
      source: "Not captured in inbox",
      sourceMessageId: null,
      strength: "missing" as const,
      summary: "No matching evidence found across connected sources.",
      relevance: 0,
    }))

  const all = [...evidence, ...missingTiles]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evidence vault</CardTitle>
        <CardDescription>
          Ten dimensions assembled from order, payment, fulfilment and delivery emails.
          {missing.length > 0 ? ` Missing: ${missing.join(", ")}.` : " Fully complete."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {all.map((item) => {
            const Icon = CATEGORY_ICON[item.category]
            const meta = strengthMeta(item.strength)
            return (
              <li
                key={item.id}
                className={cn("flex gap-3 rounded-lg border p-3.5", meta.border)}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {CATEGORY_LABEL[item.category]}
                    </p>
                    <meta.Icon className={cn("size-4 shrink-0", meta.color)} aria-hidden="true" />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>
                  <p className="mt-1.5 truncate font-mono text-[11px] font-medium text-muted-foreground/80">
                    {item.source}
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
