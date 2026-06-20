import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ShoppingBag,
  CreditCard,
  FileCheck,
  Truck,
  PackageCheck,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import type { TimelineEvent } from "@/lib/types"

const KIND_META: Record<
  TimelineEvent["kind"],
  { Icon: typeof ShoppingBag; ring: string; dot: string }
> = {
  order: { Icon: ShoppingBag, ring: "border-border", dot: "bg-primary" },
  payment: { Icon: CreditCard, ring: "border-border", dot: "bg-primary" },
  fulfilment: { Icon: FileCheck, ring: "border-border", dot: "bg-primary" },
  tracking: { Icon: Truck, ring: "border-border", dot: "bg-primary" },
  delivery: { Icon: PackageCheck, ring: "border-emerald/40", dot: "bg-emerald" },
  dispute: { Icon: ShieldAlert, ring: "border-danger/40", dot: "bg-danger" },
  pack: { Icon: Sparkles, ring: "border-emerald/40", dot: "bg-emerald" },
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Order timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-6 border-l border-border pl-6">
          {events.map((e) => {
            const meta = KIND_META[e.kind]
            return (
              <li key={e.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[31px] flex size-6 items-center justify-center rounded-full border-2 bg-card",
                    meta.ring,
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", meta.dot)} />
                </span>
                <div className="flex items-center gap-2">
                  <meta.Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {e.description}
                </p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                  {formatDateTime(e.timestamp)}
                </p>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
