export interface CommissionRow {
  type: string
  classId?: string
  amount: number
  amountTotal: number
  currency: string
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
