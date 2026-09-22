export interface AffiliationLink {
  productId: string
  productName: string
  selectedEditionLabel: string
  selectedEditionIndex: number
  channelId: string
  channelName: string
  utmCampaign: string
  utmMedium: string
  utmSource: string
  url: string
  qrCodeUrl: string
}

// The address the API reads off `session.collected_information.shipping_details`
// (the phone off `session.customer_details`), kept structured on the wire: the
// orders table joins it into one cell, the fulfilment CSV needs the parts apart.
// `postal_code` keeps Stripe's own spelling, which the API forwards verbatim.
export interface ShippingDetails {
  name?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
}

export interface PurchaseItem {
  id: string
  email: string
  phone?: string
  // Merch only: a book order collects no address, and only a shipped one
  // carries a tracking number.
  shippingDetails?: ShippingDetails
  trackingNumber?: string
  wallet?: string
  classId: string
  price: number
  priceName?: string
  status: string
  timestamp: number
  message?: string
  from?: string
  quantity?: number
  txHash?: string
  coupon?: string
  giftInfo?: { toEmail?: string }
}
