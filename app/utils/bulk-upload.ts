import {
  DEFAULT_PRICE,
  MINIMAL_PRICE,
  CSV_DEFAULT_LANGUAGE,
  CSV_DEFAULT_AUTO_DELIVER,
  CSV_DEFAULT_ENABLE_DRM,
  CSV_DEFAULT_ENABLE_TTS,
  CSV_DEFAULT_ENABLE_LIBRARY,
  CSV_DEFAULT_EDITION_NAME,
  CSV_DEFAULT_EDITION_DESCRIPTION,
  MAX_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_FULL_LENGTH,
} from '~/constant'
import type { BulkUploadBook, BulkUploadCSVRow, SerializedBulkUploadBook, BulkUploadValidationError, ValidatedProgressFields } from '~/types/bulk-upload'
import { BookUploadStatus } from '~/types/bulk-upload'

export const CSV_REQUIRED_COLUMNS = ['book_title', 'book_description', 'author_name', 'cover_image_filename']

export const CSV_ALL_COLUMNS = [
  'book_title',
  'book_description',
  'book_description_full',
  'author_name',
  'author_description',
  'publisher',
  'publisher_description',
  'isbn',
  'publish_date',
  'list_price',
  'list_price_hkd',
  'list_price_twd',
  'tags',
  'cover_image_filename',
  'pdf_filename',
  'epub_filename',
  'edition_name',
  'edition_description',
  'auto_deliver',
  'auto_memo',
  'enable_drm',
  'enable_tts',
  'enable_library',
  'language',
]

export const CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS: Record<string, string> = {
  list_price: String(DEFAULT_PRICE),
  edition_name: CSV_DEFAULT_EDITION_NAME,
  edition_description: CSV_DEFAULT_EDITION_DESCRIPTION,
  auto_deliver: String(CSV_DEFAULT_AUTO_DELIVER),
  enable_drm: String(CSV_DEFAULT_ENABLE_DRM),
  enable_tts: String(CSV_DEFAULT_ENABLE_TTS),
  enable_library: String(CSV_DEFAULT_ENABLE_LIBRARY),
  language: CSV_DEFAULT_LANGUAGE,
}

// Returns undefined when the cell is absent, NaN when present-but-unparseable
// (so validateBook can flag it instead of silently dropping the override).
function parseOptionalDecimalPrice(value: string | undefined): number | undefined {
  if (!value || !value.trim()) { return undefined }
  return parseFloat(value)
}

export const CSV_RESULT_COLUMNS = [
  ...CSV_ALL_COLUMNS,
  'class_id',
  'mint_tx_hash',
  'cover_arweave_id',
  'book_arweave_id',
  'book_arweave_key',
  'book_arweave_link',
  'book_file_sha256',
  'status',
  'remark',
]

export function parseCSVRow(row: BulkUploadCSVRow, rowIndex: number): BulkUploadBook {
  const tags = row.tags
    ? row.tags.split(',').map(t => t.trim()).filter(Boolean)
    : []

  const parsedListPrice = parseOptionalDecimalPrice(row.list_price) ?? DEFAULT_PRICE
  const listPrice = isNaN(parsedListPrice) ? DEFAULT_PRICE : parsedListPrice
  const listPriceHKD = parseOptionalDecimalPrice(row.list_price_hkd)
  const listPriceTWD = parseOptionalDecimalPrice(row.list_price_twd)
  // Free books always opt into Plus all-you-can-read, regardless of enable_library.
  const isPlusReadingEnabled = listPrice === 0 || row.enable_library?.trim().toLowerCase() !== 'false'

  return {
    id: crypto.randomUUID(),
    rowIndex,
    title: row.book_title?.trim() || '',
    description: row.book_description?.trim() || '',
    descriptionFull: row.book_description_full?.trim() || undefined,
    authorName: row.author_name?.trim() || '',
    authorDescription: row.author_description?.trim(),
    publisher: row.publisher?.trim() || '',
    publisherDescription: row.publisher_description?.trim(),
    isbn: row.isbn?.trim(),
    publishDate: row.publish_date?.trim() || '',
    listPrice,
    listPriceHKD,
    listPriceTWD,
    tags,
    coverImageFilename: row.cover_image_filename?.trim() || '',
    pdfFilename: row.pdf_filename?.trim() || undefined,
    epubFilename: row.epub_filename?.trim() || undefined,
    editionName: row.edition_name?.trim() || CSV_DEFAULT_EDITION_NAME,
    editionDescription: row.edition_description?.trim() || CSV_DEFAULT_EDITION_DESCRIPTION,
    isAutoDeliver: row.auto_deliver?.trim().toLowerCase() !== 'false',
    autoMemo: row.auto_memo?.trim() || '',
    enableDRM: row.enable_drm?.trim().toLowerCase() === 'true',
    enableTTS: row.enable_tts?.trim().toLowerCase() !== 'false',
    isPlusReadingEnabled,
    language: row.language?.trim() || CSV_DEFAULT_LANGUAGE,
    status: BookUploadStatus.PENDING,
  }
}

const VALID_BOOLEAN_VALUES = ['true', 'false', '']

export function validateBook(book: BulkUploadBook, rawRow?: BulkUploadCSVRow): BulkUploadValidationError[] {
  const errors: BulkUploadValidationError[] = []
  const { rowIndex } = book

  if (!book.title) {
    errors.push({ rowIndex, field: 'book_title', message: 'bulk_upload.error_book_title_required' })
  }

  if (!book.description) {
    errors.push({ rowIndex, field: 'book_description', message: 'bulk_upload.error_book_description_required' })
  }

  if (book.description && book.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({ rowIndex, field: 'book_description', message: 'bulk_upload.error_book_description_too_long', params: { maxLength: MAX_DESCRIPTION_LENGTH } })
  }

  if (book.descriptionFull && book.descriptionFull.length > MAX_DESCRIPTION_FULL_LENGTH) {
    errors.push({
      rowIndex,
      field: 'book_description_full',
      message: 'bulk_upload.error_book_description_full_too_long',
      params: { maxLength: MAX_DESCRIPTION_FULL_LENGTH },
    })
  }

  if (!book.authorName) {
    errors.push({ rowIndex, field: 'author_name', message: 'bulk_upload.error_author_name_required' })
  }

  if (book.listPrice !== 0 && book.listPrice < MINIMAL_PRICE) {
    errors.push({ rowIndex, field: 'list_price', message: 'bulk_upload.error_invalid_price', params: { minPrice: MINIMAL_PRICE } })
  }

  for (const [field, value] of [
    ['list_price_hkd', book.listPriceHKD],
    ['list_price_twd', book.listPriceTWD],
  ] as const) {
    if (value === undefined) { continue }
    if (!Number.isFinite(value) || value < 0) {
      errors.push({ rowIndex, field, message: 'bulk_upload.error_invalid_price_override' })
    }
  }

  // Setting any per-currency price triggers custom mode, which requires all 3 cells filled.
  if (rawRow) {
    const hasUSD = !!rawRow.list_price?.trim()
    const hasHKD = !!rawRow.list_price_hkd?.trim()
    const hasTWD = !!rawRow.list_price_twd?.trim()
    const isCustomMode = hasHKD || hasTWD
    if (isCustomMode && !(hasUSD && hasHKD && hasTWD)) {
      errors.push({ rowIndex, field: 'list_price/list_price_hkd/list_price_twd', message: 'bulk_upload.error_custom_pricing_all_required' })
    }
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
    for (const field of ['auto_deliver', 'enable_drm', 'enable_tts', 'enable_library'] as const) {
      const raw = rawRow[field]
      const value = raw?.trim().toLowerCase() ?? ''
      if (value && !VALID_BOOLEAN_VALUES.includes(value)) {
        errors.push({ rowIndex, field, message: 'bulk_upload.error_invalid_boolean', params: { field, value: raw!.trim() } })
      }
    }
  }

  return errors
}

export function validateBooks(books: BulkUploadBook[]): BulkUploadValidationError[] {
  const errors: BulkUploadValidationError[] = []
  const seen = new Map<string, { rowIndex: number, field: string }>()

  for (const book of books) {
    const filenames: { name: string, field: string }[] = []
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
          params: { filename: name, otherRow: existing.rowIndex, otherField: existing.field },
        })
      }
      else {
        seen.set(key, { rowIndex: book.rowIndex, field })
      }
    }
  }

  return errors
}

export function serializeBook(book: BulkUploadBook): SerializedBulkUploadBook {
  return {
    id: book.id,
    rowIndex: book.rowIndex,
    title: book.title,
    description: book.description,
    descriptionFull: book.descriptionFull,
    authorName: book.authorName,
    authorDescription: book.authorDescription,
    publisher: book.publisher,
    publisherDescription: book.publisherDescription,
    isbn: book.isbn,
    publishDate: book.publishDate,
    listPrice: book.listPrice,
    listPriceHKD: book.listPriceHKD,
    listPriceTWD: book.listPriceTWD,
    tags: book.tags,
    coverImageFilename: book.coverImageFilename,
    pdfFilename: book.pdfFilename,
    epubFilename: book.epubFilename,
    editionName: book.editionName,
    editionDescription: book.editionDescription,
    isAutoDeliver: book.isAutoDeliver,
    autoMemo: book.autoMemo,
    enableDRM: book.enableDRM,
    enableTTS: book.enableTTS,
    isPlusReadingEnabled: book.isPlusReadingEnabled,
    language: book.language,
    status: book.status,
    error: book.error,
    detectedFileType: book.detectedFileType,
    coverArweaveId: book.coverArweaveId,
    coverIpfsHash: book.coverIpfsHash,
    bookArweaveId: book.bookArweaveId,
    bookArweaveKey: book.bookArweaveKey,
    bookArweaveLink: book.bookArweaveLink,
    bookIpfsHash: book.bookIpfsHash,
    bookFileSHA256: book.bookFileSHA256,
    classId: book.classId,
    mintTxHash: book.mintTxHash,
  }
}

export function deserializeBook(serialized: SerializedBulkUploadBook): BulkUploadBook {
  return {
    ...serialized,
    coverFile: undefined,
    pdfFile: undefined,
    epubFile: undefined,
  }
}

const ARWEAVE_ID_REGEX = /^[a-zA-Z0-9_-]{43}$/
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/

export function validateProgressFieldFormats(row: BulkUploadCSVRow): ValidatedProgressFields {
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

  if (row.book_arweave_link && row.book_arweave_link.trim()) {
    result.bookArweaveLink = row.book_arweave_link.trim()
  }

  if (row.book_file_sha256 && SHA256_REGEX.test(row.book_file_sha256.trim())) {
    result.bookFileSHA256 = row.book_file_sha256.trim().toLowerCase()
  }

  if (row.class_id && row.class_id.startsWith('0x')) {
    result.classId = row.class_id
  }

  if (row.mint_tx_hash && TX_HASH_REGEX.test(row.mint_tx_hash)) {
    result.mintTxHash = row.mint_tx_hash
  }

  return result
}

export async function generateResultCSV(books: BulkUploadBook[]): Promise<void> {
  const { stringify: csvStringify } = await import('csv-stringify/sync')
  const { saveAs } = await import('file-saver')

  const rows = books.map(book => [
    book.title,
    book.description,
    book.descriptionFull || '',
    book.authorName,
    book.authorDescription || '',
    book.publisher,
    book.publisherDescription || '',
    book.isbn || '',
    book.publishDate || '',
    book.listPrice,
    book.listPriceHKD ?? '',
    book.listPriceTWD ?? '',
    book.tags.join(','),
    book.coverImageFilename,
    book.pdfFilename || '',
    book.epubFilename || '',
    book.editionName,
    book.editionDescription || '',
    book.isAutoDeliver ? 'true' : 'false',
    book.autoMemo,
    book.enableDRM ? 'true' : 'false',
    book.enableTTS ? 'true' : 'false',
    book.isPlusReadingEnabled ? 'true' : 'false',
    book.language,
    book.classId || '',
    book.mintTxHash || '',
    book.coverArweaveId || '',
    book.bookArweaveId || '',
    book.bookArweaveKey || '',
    book.bookArweaveLink || '',
    book.bookFileSHA256 || '',
    book.status,
    book.error || '',
  ])

  const csvContent = csvStringify(rows, {
    header: true,
    columns: CSV_RESULT_COLUMNS,
  })

  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `bulk-upload-result-${new Date().toISOString().slice(0, 10)}.csv`)
}

export function getStatusColor(status: BookUploadStatus): 'success' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case BookUploadStatus.COMPLETED:
      return 'success'
    case BookUploadStatus.FAILED:
      return 'error'
    case BookUploadStatus.PENDING:
      return 'neutral'
    default:
      return 'info'
  }
}
