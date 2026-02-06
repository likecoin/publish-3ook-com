import { DEFAULT_PRICE, MINIMAL_PRICE } from '~/constant'

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
    editionName: row.edition_name?.trim() || '標準版',
    editionDescription: row.edition_description?.trim() || '標準數位版',
    isAutoDeliver: row.auto_deliver?.trim().toLowerCase() !== 'false',
    autoMemo: row.auto_memo?.trim() || '',
    enableDRM: row.enable_drm?.trim().toLowerCase() === 'true',
    language: row.language?.trim() || 'zh',
    status: BookUploadStatus.PENDING
  }
}

export function validateBook (book: BulkUploadBook): BulkUploadValidationError[] {
  const errors: BulkUploadValidationError[] = []
  const { rowIndex } = book

  if (!book.title) {
    errors.push({ rowIndex, field: 'book_title', message: 'Book title is required' })
  }

  if (!book.description) {
    errors.push({ rowIndex, field: 'book_description', message: 'Book description is required' })
  }

  if (book.description && book.description.length > 1000) {
    errors.push({ rowIndex, field: 'book_description', message: 'Book description must be 1000 characters or less' })
  }

  if (!book.authorName) {
    errors.push({ rowIndex, field: 'author_name', message: 'Author name is required' })
  }

  if (book.listPrice !== 0 && book.listPrice < MINIMAL_PRICE) {
    errors.push({ rowIndex, field: 'list_price', message: `Price must be 0 (free) or at least ${MINIMAL_PRICE}` })
  }

  if (!book.coverImageFilename) {
    errors.push({ rowIndex, field: 'cover_image_filename', message: 'Cover image filename is required' })
  }

  if (!book.pdfFilename && !book.epubFilename) {
    errors.push({ rowIndex, field: 'pdf_filename/epub_filename', message: 'At least one ebook file (PDF or EPUB) is required' })
  }

  if (book.autoMemo && !book.isAutoDeliver) {
    errors.push({ rowIndex, field: 'auto_memo', message: 'auto_memo requires auto_deliver to be true' })
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
          message: `Duplicate filename "${name}" (also used in row ${existing.rowIndex} ${existing.field})`
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
