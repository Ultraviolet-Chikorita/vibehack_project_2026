import type { Metadata } from "next"
import { DashboardView } from "@/components/dashboard/dashboard-view"

export const metadata: Metadata = {
  title: "Dispute monitor — Settld",
  description: "Live dispute queue with auto-assembled chargeback evidence.",
}

export default function DashboardPage() {
  return <DashboardView />
}
