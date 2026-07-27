export interface CommissionRow {
  type: string
  classId?: string
  // Backfilled commission docs may have no classId, only a description.
  description?: string
  amount: number
  amountTotal: number
  currency: string
  stripeFeeAmount?: number
  buyerEmail?: string
  timestamp: number
}

export interface PayoutRow {
  id: string
  amount: number
  currency: string
  status: string
  arrivalTs?: number
  createdTs: number
}

export interface PayoutItemDetail {
  commissionId: string
  createdTs: number
  amount: number
  currency: string
  description?: string
  status: string
  metadata?: Record<string, unknown>
}

export interface PayoutData {
  id: string
  createdTs: number
  amount: number
  status: string
  currency: string
  arrivalTs?: number
  items?: PayoutItemDetail[]
}
