export interface BookPriceInDecimalByCurrency {
  hkd?: number
  twd?: number
}

// `draft` is local-only: an unfinished wizard session that the backend has
// never heard of, so no listing ever reports it.
export type BookListingStatus = 'listed' | 'sold_out' | 'unlisted' | 'pending_review' | 'draft'

// The status page's tabs, in display order. Also the values accepted in its
// `?tab=` query, so an unknown value can fall back instead of hiding every pane.
export const BOOK_STATUS_TABS = ['files', 'details', 'pricing', 'summary', 'sales'] as const
export type BookStatusTab = typeof BOOK_STATUS_TABS[number]

export interface ClassListingPrice {
  index: number
  name: { en?: string, zh?: string } | string
  description: { en?: string, zh?: string } | string
  price: number | string
  priceInDecimalByCurrency?: BookPriceInDecimalByCurrency
  stock: number
  isAutoDeliver: boolean
  isAllowCustomPrice: boolean
  isUnlisted?: boolean
  isSoldOut?: boolean
  // Owner-only; the API omits it for anyone else.
  sold?: number
  order?: number
  autoMemo?: string
}

export interface EditionTableRow extends Omit<ClassListingPrice, 'stock'> {
  stock: number | string
  originalIndex: number
  isStockBalancePlaceholderRow: boolean
}

export interface ClassListingData {
  ownerWallet?: string
  prices: ClassListingPrice[]
  moderatorWallets?: string[]
  connectedWallets?: Record<string, number>
  mustClaimToView?: boolean
  tableOfContents?: string
  descriptionFull?: string
  enableCustomMessagePage?: boolean
  hideDownload?: boolean
  hideAudio?: boolean
  isAdultOnly?: boolean
  isPlusReadingEnabled?: boolean
  isPreviewEnabled?: boolean
  previewPercentage?: number
  pendingNFTCount?: number
  enableSignatureImage?: boolean | 'signed'
  isHidden?: boolean
  isPendingReview?: boolean
}

export interface BookRecord {
  classId: string
  name?: string
  title?: string
  thumbnailUrl?: string
  imageUrl?: string
  author?: string | { name: string }
  minPrice?: number
  prices?: { price: number }[]
}

export interface ProductData {
  name?: string | { en?: string, zh?: string }
  prices?: { name?: string | { en?: string, zh?: string }, price?: number, index?: number }[]
}
