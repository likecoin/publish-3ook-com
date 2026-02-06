import { DEFAULT_PRICE, MINIMAL_PRICE, CSV_DEFAULT_LANGUAGE, CSV_DEFAULT_AUTO_DELIVER, CSV_DEFAULT_ENABLE_DRM, CSV_DEFAULT_EDITION_NAME, CSV_DEFAULT_EDITION_DESCRIPTION } from '~/constant'

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

export const CSV_REQUIRED_COLUMNS = ['book_title', 'book_description', 'author_name', 'cover_image_filename']

export const CSV_ALL_COLUMNS = [
  'book_title',
  'book_description',
  'author_name',
  'author_description',
  'publisher',
  'isbn',
  'publish_date',
  'list_price',
  'tags',
  'cover_image_filename',
  'pdf_filename',
  'epub_filename',
  'edition_name',
  'edition_description',
  'auto_deliver',
  'auto_memo',
  'enable_drm',
  'language'
]

export const CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS: Record<string, string> = {
  list_price: String(DEFAULT_PRICE),
  edition_name: CSV_DEFAULT_EDITION_NAME,
  edition_description: CSV_DEFAULT_EDITION_DESCRIPTION,
  auto_deliver: String(CSV_DEFAULT_AUTO_DELIVER),
  enable_drm: String(CSV_DEFAULT_ENABLE_DRM),
  language: CSV_DEFAULT_LANGUAGE
}

export const CSV_RESULT_COLUMNS = [
  ...CSV_ALL_COLUMNS,
  'class_id',
  'mint_tx_hash',
  'cover_arweave_id',
  'book_arweave_id',
  'book_arweave_key',
  'status',
  'remark'
]

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
  editionDescription: string
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
  editionDescription: string
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

export function parseCSVRow (row: BulkUploadCSVRow, rowIndex: number): BulkUploadBook {
  const tags = row.tags
    ? row.tags.split(',').map(t => t.trim()).filter(Boolean)
    : []

  const listPrice = row.list_price ? parseFloat(row.list_price) : DEFAULT_PRICE

  return {
    id: crypto.randomUUID(),
    rowIndex,
    title: row.book_title?.trim() || '',
    description: row.book_description?.trim() || '',
    authorName: row.author_name?.trim() || '',
    authorDescription: row.author_description?.trim(),
    publisher: row.publisher?.trim() || '',
    isbn: row.isbn?.trim(),
    publishDate: row.publish_date?.trim() || '',
    listPrice: isNaN(listPrice) ? DEFAULT_PRICE : listPrice,
    tags,
    coverImageFilename: row.cover_image_filename?.trim() || '',
    pdfFilename: row.pdf_filename?.trim() || undefined,
    epubFilename: row.epub_filename?.trim() || undefined,
    editionName: row.edition_name?.trim() || CSV_DEFAULT_EDITION_NAME,
    editionDescription: row.edition_description?.trim() || CSV_DEFAULT_EDITION_DESCRIPTION,
    isAutoDeliver: row.auto_deliver?.trim().toLowerCase() !== 'false',
    autoMemo: row.auto_memo?.trim() || '',
    enableDRM: row.enable_drm?.trim().toLowerCase() === 'true',
    language: row.language?.trim() || CSV_DEFAULT_LANGUAGE,
    status: BookUploadStatus.PENDING
  }
}

const VALID_BOOLEAN_VALUES = ['true', 'false', '']

export function validateBook (book: BulkUploadBook, rawRow?: BulkUploadCSVRow): BulkUploadValidationError[] {
  const errors: BulkUploadValidationError[] = []
  const { rowIndex } = book

  if (!book.title) {
    errors.push({ rowIndex, field: 'book_title', message: 'bulk_upload.error_book_title_required' })
  }

  if (!book.description) {
    errors.push({ rowIndex, field: 'book_description', message: 'bulk_upload.error_book_description_required' })
  }

  if (book.description && book.description.length > 1000) {
    errors.push({ rowIndex, field: 'book_description', message: 'bulk_upload.error_book_description_too_long' })
  }

  if (!book.authorName) {
    errors.push({ rowIndex, field: 'author_name', message: 'bulk_upload.error_author_name_required' })
  }

  if (book.listPrice !== 0 && book.listPrice < MINIMAL_PRICE) {
    errors.push({ rowIndex, field: 'list_price', message: 'bulk_upload.error_invalid_price', params: { minPrice: MINIMAL_PRICE } })
  }

  if (!book.coverImageFilename) {
    errors.push({ rowIndex, field: 'cover_image_filename', message: 'bulk_upload.error_cover_required' })
  }

  if (!book.pdfFilename && !book.epubFilename) {
    errors.push({ rowIndex, field: 'pdf_filename/epub_filename', message: 'bulk_upload.error_ebook_required' })
  }

  if (book.autoMemo && !book.isAutoDeliver) {
    errors.push({ rowIndex, field: 'auto_memo', message: 'bulk_upload.error_auto_memo_requires_auto_deliver' })
  }

  // Validate boolean fields contain valid values
  if (rawRow) {
    const autoDeliverVal = rawRow.auto_deliver?.trim().toLowerCase() ?? ''
    if (autoDeliverVal && !VALID_BOOLEAN_VALUES.includes(autoDeliverVal)) {
      errors.push({ rowIndex, field: 'auto_deliver', message: 'bulk_upload.error_invalid_boolean', params: { field: 'auto_deliver', value: rawRow.auto_deliver!.trim() } })
    }
    const enableDrmVal = rawRow.enable_drm?.trim().toLowerCase() ?? ''
    if (enableDrmVal && !VALID_BOOLEAN_VALUES.includes(enableDrmVal)) {
      errors.push({ rowIndex, field: 'enable_drm', message: 'bulk_upload.error_invalid_boolean', params: { field: 'enable_drm', value: rawRow.enable_drm!.trim() } })
    }
  }

  return errors
}

export function validateBooks (books: BulkUploadBook[]): BulkUploadValidationError[] {
  const errors: BulkUploadValidationError[] = []
  const seen = new Map<string, { rowIndex: number; field: string }>()

  for (const book of books) {
    const filenames: { name: string; field: string }[] = []
    if (book.coverImageFilename) { filenames.push({ name: book.coverImageFilename, field: 'cover_image_filename' }) }
    if (book.pdfFilename) { filenames.push({ name: book.pdfFilename, field: 'pdf_filename' }) }
    if (book.epubFilename) { filenames.push({ name: book.epubFilename, field: 'epub_filename' }) }

    for (const { name, field } of filenames) {
      const key = name.toLowerCase()
      const existing = seen.get(key)
      if (existing) {
        errors.push({
          rowIndex: book.rowIndex,
          field,
          message: 'bulk_upload.error_duplicate_filename',
          params: { filename: name, otherRow: existing.rowIndex, otherField: existing.field }
        })
      } else {
        seen.set(key, { rowIndex: book.rowIndex, field })
      }
    }
  }

  return errors
}

export function serializeBook (book: BulkUploadBook): SerializedBulkUploadBook {
  return {
    id: book.id,
    rowIndex: book.rowIndex,
    title: book.title,
    description: book.description,
    authorName: book.authorName,
    authorDescription: book.authorDescription,
    publisher: book.publisher,
    isbn: book.isbn,
    publishDate: book.publishDate,
    listPrice: book.listPrice,
    tags: book.tags,
    coverImageFilename: book.coverImageFilename,
    pdfFilename: book.pdfFilename,
    epubFilename: book.epubFilename,
    editionName: book.editionName,
    editionDescription: book.editionDescription,
    isAutoDeliver: book.isAutoDeliver,
    autoMemo: book.autoMemo,
    enableDRM: book.enableDRM,
    language: book.language,
    status: book.status,
    error: book.error,
    coverArweaveId: book.coverArweaveId,
    coverIpfsHash: book.coverIpfsHash,
    bookArweaveId: book.bookArweaveId,
    bookArweaveKey: book.bookArweaveKey,
    bookIpfsHash: book.bookIpfsHash,
    classId: book.classId,
    mintTxHash: book.mintTxHash
  }
}

export function deserializeBook (serialized: SerializedBulkUploadBook): BulkUploadBook {
  return {
    ...serialized,
    coverFile: undefined,
    pdfFile: undefined,
    epubFile: undefined
  }
}

export interface ValidatedProgressFields {
  coverArweaveId?: string
  bookArweaveId?: string
  bookArweaveKey?: string
  classId?: string
  mintTxHash?: string
}

const ARWEAVE_ID_REGEX = /^[a-zA-Z0-9_-]{43}$/
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/

export function validateProgressFieldFormats (row: BulkUploadCSVRow): ValidatedProgressFields {
  const result: ValidatedProgressFields = {}

  if (row.cover_arweave_id && ARWEAVE_ID_REGEX.test(row.cover_arweave_id)) {
    result.coverArweaveId = row.cover_arweave_id
  }

  if (row.book_arweave_id && ARWEAVE_ID_REGEX.test(row.book_arweave_id)) {
    result.bookArweaveId = row.book_arweave_id
  }

  if (row.book_arweave_key && row.book_arweave_key.trim()) {
    result.bookArweaveKey = row.book_arweave_key.trim()
  }

  if (row.class_id && row.class_id.startsWith('0x')) {
    result.classId = row.class_id
  }

  if (row.mint_tx_hash && TX_HASH_REGEX.test(row.mint_tx_hash)) {
    result.mintTxHash = row.mint_tx_hash
  }

  return result
}

export async function generateResultCSV (books: BulkUploadBook[]): Promise<void> {
  const { stringify: csvStringify } = await import('csv-stringify/sync')
  const { saveAs } = await import('file-saver')

  const rows = books.map(book => [
    book.title,
    book.description,
    book.authorName,
    book.authorDescription || '',
    book.publisher,
    book.isbn || '',
    book.publishDate || '',
    book.listPrice,
    book.tags.join(','),
    book.coverImageFilename,
    book.pdfFilename || '',
    book.epubFilename || '',
    book.editionName,
    book.editionDescription,
    book.isAutoDeliver ? 'true' : 'false',
    book.autoMemo,
    book.enableDRM ? 'true' : 'false',
    book.language,
    book.classId || '',
    book.mintTxHash || '',
    book.coverArweaveId || '',
    book.bookArweaveId || '',
    book.bookArweaveKey || '',
    book.status,
    book.error || ''
  ])

  const csvContent = csvStringify(rows, {
    header: true,
    columns: CSV_RESULT_COLUMNS
  })

  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `bulk-upload-result-${new Date().toISOString().slice(0, 10)}.csv`)
}
