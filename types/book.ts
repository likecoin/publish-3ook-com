export interface ClassListingPrice {
  index: number
  name: { en?: string; zh?: string } | string
  description: { en?: string; zh?: string } | string
  price: number | string
  stock: number
  isAutoDeliver: boolean
  isAllowCustomPrice: boolean
  isUnlisted?: boolean
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
  enableCustomMessagePage?: boolean
  hideDownload?: boolean
  isAdultOnly?: boolean
  pendingNFTCount?: number
  enableSignatureImage?: boolean
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
  name?: string | { en?: string; zh?: string }
  prices?: { name?: string | { en?: string; zh?: string }; price?: number; index?: number }[]
}
