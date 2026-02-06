export enum BookUploadStatus {
  PENDING = 'pending',
  UPLOADING_FILES = 'uploading',
  FILES_UPLOADED = 'files_uploaded',
  CREATING_NFT = 'creating_nft',
  NFT_CREATED = 'nft_created',
  MINTING = 'minting',
  MINTED = 'minted',
  LISTING = 'listing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface BulkUploadCSVRow {
  book_title: string
  book_description: string
  author_name: string
  author_description?: string
  publisher?: string
  isbn?: string
  publish_date?: string
  list_price?: string
  tags?: string
  cover_image_filename: string
  pdf_filename?: string
  epub_filename?: string
  edition_name?: string
  edition_description?: string
  auto_deliver?: string
  auto_memo?: string
  enable_drm?: string
  language?: string
  // Resume fields (from result CSV)
  class_id?: string
  mint_tx_hash?: string
  cover_arweave_id?: string
  book_arweave_id?: string
  book_arweave_key?: string
  status?: string
  remark?: string
}

export interface BulkUploadBook {
  id: string
  rowIndex: number
  // CSV fields
  title: string
  description: string
  authorName: string
  authorDescription?: string
  publisher: string
  isbn?: string
  publishDate?: string
  listPrice: number
  tags: string[]
  coverImageFilename: string
  pdfFilename?: string
  epubFilename?: string
  editionName: string
  editionDescription?: string
  isAutoDeliver: boolean
  autoMemo: string
  enableDRM: boolean
  language: string
  // Runtime state
  status: BookUploadStatus
  error?: string
  // File references (for matching)
  coverFile?: File
  pdfFile?: File
  epubFile?: File
  // Progress tracking (persisted for resume)
  coverArweaveId?: string
  coverIpfsHash?: string
  bookArweaveId?: string
  bookArweaveKey?: string
  bookIpfsHash?: string
  classId?: string
  mintTxHash?: string
}

export interface SerializedBulkUploadBook {
  id: string
  rowIndex: number
  title: string
  description: string
  authorName: string
  authorDescription?: string
  publisher: string
  isbn?: string
  publishDate?: string
  listPrice: number
  tags: string[]
  coverImageFilename: string
  pdfFilename?: string
  epubFilename?: string
  editionName: string
  editionDescription?: string
  isAutoDeliver: boolean
  autoMemo: string
  enableDRM: boolean
  language: string
  status: BookUploadStatus
  error?: string
  // Progress tracking
  coverArweaveId?: string
  coverIpfsHash?: string
  bookArweaveId?: string
  bookArweaveKey?: string
  bookIpfsHash?: string
  classId?: string
  mintTxHash?: string
}

export interface BulkUploadSession {
  sessionId: string
  createdAt: string
  books: SerializedBulkUploadBook[]
  currentIndex: number
}

export interface BulkUploadValidationError {
  rowIndex: number
  field: string
  message: string
  params?: Record<string, string | number>
}

export interface ValidatedProgressFields {
  coverArweaveId?: string
  bookArweaveId?: string
  bookArweaveKey?: string
  classId?: string
  mintTxHash?: string
}
