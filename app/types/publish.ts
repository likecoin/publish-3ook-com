import type { ISCNFormData } from '~/types/iscn'
import type { BookUploadStatus } from '~/types/bulk-upload'
import type { BookPriceInDecimalByCurrency, EpubMetadata } from '~/types'

// Serializable upload record; presence of arweaveId means the file is already
// uploaded and the pipeline skips it on resume.
export interface PublishFileRecord {
  fileName: string
  fileType: string
  // Checked against the size a restored blob reads back at.
  fileSize?: number
  ipfsHash?: string
  fileSHA256?: string
  isGeneratedCover?: boolean
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
}

// A record paired with its in-memory blob; blobs never persist to storage.
export type PublishFileRecordWithBlob = PublishFileRecord & { fileBlob?: Blob }

export interface PriceFormItem {
  index?: string
  price: string
  deliveryMethod: 'auto' | 'manual'
  autoMemo: string
  // A number input hands back the raw string when it can't parse one, so a
  // field the author clears mid-edit arrives here as ''. Readers coerce.
  stock: number | string
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

// The wizard draft's class-level fields, as against the per-edition ones in
// PriceFormItem — tipping being the one that looks class-level and is not. Each
// is edited by whichever step owns it, so no one card speaks for them all.
export interface PricingFormSettings {
  isAdultOnly: boolean
  hideAudio: boolean
  isPlusReadingEnabled: boolean
  isPreviewEnabled: boolean
  previewPercentage: number
  tableOfContents: string
  connectedWallets: Record<string, number> | null
}

// Class-level listing fields collected by the wizard; descriptionFull and
// tableOfContents are listing-owned (not on-chain).
export interface PublishListingDraft extends PricingFormSettings {
  prices: PriceFormItem[]
  // Cleared to undefined when the author unticks the field.
  descriptionFull?: string
  moderatorWallets: string[]
}

export interface PublishBookInput {
  fileRecords: PublishFileRecordWithBlob[]
  encryptEbook: boolean
  iscnFormData: ISCNFormData
  listingDraft: PublishListingDraft
  signatureImage?: File | null
  // Resume checkpoints from a prior interrupted publish
  classId?: string
  mintTxHash?: string
  // Legacy ?class_id= deep links resume after the old wizard already minted.
  skipMint?: boolean
}

// The wizard's steps, in order. Also the values its `?step=` query accepts, and
// the label each one is shown under, so a step added here can't leave the
// stepper or a resumed draft's readout blank.
export const PUBLISH_WIZARD_STEPS = ['files', 'details', 'pricing', 'review'] as const
export type PublishWizardStep = typeof PUBLISH_WIZARD_STEPS[number]
export const PUBLISH_WIZARD_STEP_LABEL_KEYS: Record<PublishWizardStep, string> = {
  files: 'publish_wizard.step_files',
  details: 'publish_wizard.step_details',
  pricing: 'publish_wizard.step_pricing',
  review: 'publish_wizard.step_review',
}

// Persisted wizard draft + commit checkpoints (localStorage; survives quit).
export interface PublishSession {
  version: 1
  status: BookUploadStatus
  wizardStep?: PublishWizardStep
  fileRecords: PublishFileRecord[]
  epubMetadata?: EpubMetadata
  encryptEbook: boolean
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
