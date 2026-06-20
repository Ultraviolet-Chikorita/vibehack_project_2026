// Shared domain types for the Settld UI + pipeline

export type EvidenceStrength = 'strong' | 'weak' | 'missing'

export type EvidenceCategory =
  | 'order'
  | 'payment'
  | 'product'
  | 'policy'
  | 'fulfilment'
  | 'delivery'
  | 'address'
  | 'communication'
  | 'refund'
  | 'conflict'

export interface SourceMessage {
  id: string
  platform: 'Shopify' | 'Stripe' | 'Royal Mail' | 'Customer' | 'Outlook' | 'Gmail'
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string // ISO
}

export interface EvidenceItem {
  id: string
  category: EvidenceCategory
  label: string
  type: string
  source: string
  sourceMessageId: string | null
  strength: EvidenceStrength
  summary: string
  relevance: number // 0..1
}

export interface TimelineEvent {
  id: string
  timestamp: string // ISO
  title: string
  description: string
  kind: 'order' | 'payment' | 'fulfilment' | 'tracking' | 'delivery' | 'dispute' | 'pack'
  sourceMessageId: string | null
}

export type DisputeStatus = 'none' | 'signal' | 'disputed'
export type FulfilmentStatus = 'delivered' | 'in_transit' | 'fulfilled' | 'processing'

export interface OrderVault {
  id: string
  orderId: string
  customer: string
  customerEmail: string
  amount: number
  currency: string
  product: string
  fulfilmentStatus: FulfilmentStatus
  trackingNumber?: string
  carrier?: string
  evidence: EvidenceItem[]
  timeline: TimelineEvent[]
  latestEvent: string
  latestEventAt: string
  disputeStatus: DisputeStatus
  disputeReason?: string
  disputeDeadline?: string
}

export interface OrderSummary {
  id: string
  orderNumber: string
  merchant: string
  customerName: string
  customerEmail: string
  amount: number
  currency: string
  status: DisputeStatus | 'ready' | 'incomplete'
  winScore: number
  recommendation: 'contest' | 'refund' | 'review'
  updatedAt: string
}

export interface DigestStats {
  scanned: number
  relevant: number
  vaultsCreated: number
  updated: number
  deliveryConfirmations: number
  disputeReady: number
  newSignals: number
  readyPacks: number
  disputedValue: number
  recoverableValue: number
}
