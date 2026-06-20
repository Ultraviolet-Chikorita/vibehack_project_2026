import type { Metadata } from "next"
import { OrdersListView } from "@/components/orders/orders-list-view"

export const metadata: Metadata = {
  title: "Orders — Settld",
  description:
    "Every order Settld is watching, with its dispute status, evidence strength and recommended action.",
}

export default function OrdersPage() {
  return <OrdersListView />
}
