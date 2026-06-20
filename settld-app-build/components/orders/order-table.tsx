import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusPill, RecommendationBadge, RiskBadge } from "@/components/status-pill"
import { formatCurrency, formatRelative } from "@/lib/format"
import type { OrderSummary } from "@/lib/types"

export function OrderTable({
  orders,
  isLoading = false,
}: {
  orders: OrderSummary[]
  isLoading?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Order</TableHead>
          <TableHead className="hidden md:table-cell">Customer</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Win score</TableHead>
          <TableHead className="hidden lg:table-cell">Recommendation</TableHead>
          <TableHead className="text-right">Updated</TableHead>
          <TableHead className="sr-only">View</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
              Loading orders…
            </TableCell>
          </TableRow>
        ) : orders.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
              No orders to show yet.
            </TableCell>
          </TableRow>
        ) : (
          orders.map((o) => (
            <TableRow key={o.id} className="group">
              <TableCell>
                <Link
                  href={`/orders/${o.id}`}
                  className="font-mono font-medium text-foreground underline-offset-4 hover:underline"
                >
                  #{o.orderNumber}
                </Link>
                <p className="text-xs text-muted-foreground">{o.merchant}</p>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <p className="text-sm text-foreground">{o.customerName}</p>
                <p className="font-mono text-xs text-muted-foreground">{o.customerEmail}</p>
              </TableCell>
              <TableCell className="font-mono font-medium tabular-nums">
                {formatCurrency(o.amount, o.currency)}
              </TableCell>
              <TableCell>
                <StatusPill status={o.status} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <RiskBadge score={o.winScore} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <RecommendationBadge recommendation={o.recommendation} />
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {formatRelative(o.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/orders/${o.id}`}
                  aria-label={`View order ${o.orderNumber}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                >
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
