import type { ISCNFormData } from '~/types/iscn'
import type { BookUploadStatus } from '~/types/bulk-upload'
import type { BookPriceInDecimalByCurrency, EpubMetadata } from '~/types'

// Serializable upload record; presence of arweaveId means the file is already
// uploaded and the pipeline skips it on resume.
export interface PublishFileRecord {
  fileName: string
  fileType: string
  ipfsHash?: string
  fileSHA256?: string
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
}

// A record paired with its in-memory blob; blobs never persist to storage.
export type PublishFileRecordWithBlob = PublishFileRecord & { fileBlob?: Blob }

export interface PriceFormItem {
  index?: string
  price: string
  deliveryMethod: string
  autoMemo: string
  stock: number
  name: string
  description: string
  isAllowCustomPrice: boolean
  isListed: boolean
  oldIsAutoDeliver?: boolean
  oldStock?: number
  // Custom pricing mode: USD tier dropdown vs free-form USD/HKD/TWD trio (mutually exclusive).
  isCustomPricing: boolean
  priceUSDInput: string
  priceHKDInput: string
  priceTWDInput: string
}

export interface MappedPrice {
  name: { en: string, zh: string }
  description: { en: string, zh: string }
  priceInDecimal: number
  priceInDecimalByCurrency?: BookPriceInDecimalByCurrency
  price: number
  stock: number
  isAutoDeliver: boolean
  isAllowCustomPrice: boolean
  isUnlisted: boolean
  autoMemo: string
}

// Class-level flags edited by PricingForm's advanced-settings section.
export interface PricingFormSettings {
  isAllowCustomPrice: boolean
  isAdultOnly: boolean
  hideAudio: boolean
  isPlusReadingEnabled: boolean
  tableOfContents: string
  connectedWallets: Record<string, number> | null
}

// Class-level listing fields collected by the wizard; descriptionFull and
// tableOfContents are listing-owned (not on-chain).
export interface PublishListingDraft extends PricingFormSettings {
  prices: PriceFormItem[]
  descriptionFull: string
  moderatorWallets: string[]
}

export interface PublishBookInput {
  fileRecords: PublishFileRecordWithBlob[]
  encryptEbook: boolean
  sponsored?: boolean
  iscnFormData: ISCNFormData
  listingDraft: PublishListingDraft
  signatureImage?: File | null
  // Resume checkpoints from a prior interrupted publish
  classId?: string
  mintTxHash?: string
  // Legacy ?class_id= deep links resume after the old wizard already minted.
  skipMint?: boolean
}

// Persisted wizard draft + commit checkpoints (localStorage; survives quit).
export interface PublishSession {
  version: 1
  status: BookUploadStatus
  wizardStep?: string
  fileRecords: PublishFileRecord[]
  epubMetadata?: EpubMetadata
  encryptEbook: boolean
  sponsored?: boolean
  iscnFormData: ISCNFormData
  listingDraft: PublishListingDraft
  classId?: string
  mintTxHash?: string
  skipMint?: boolean
  // Signature blobs never persist; this flags that one was set so a resumed
  // draft can prompt for re-selection instead of silently publishing without it.
  hasSignatureImage?: boolean
  walletAddress?: string
  error?: string
}
