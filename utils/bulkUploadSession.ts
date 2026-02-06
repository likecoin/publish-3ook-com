import type {
  BulkUploadSession,
  BulkUploadBook,
  SerializedBulkUploadBook
} from './bulk-upload.type'
import { serializeBook, deserializeBook } from './bulk-upload.type'

export const BULK_UPLOAD_KEY = 'publish_book_bulk_upload_session'

export function saveBulkUploadSession (
  books: BulkUploadBook[],
  currentIndex: number,
  sessionId?: string
): void {
  try {
    const session: BulkUploadSession = {
      sessionId: sessionId || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      books: books.map(serializeBook),
      currentIndex
    }
    sessionStorage.setItem(BULK_UPLOAD_KEY, JSON.stringify(session))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save bulk upload session to sessionStorage:', error)
  }
}

export function loadBulkUploadSession (): BulkUploadSession | null {
  try {
    const stored = sessionStorage.getItem(BULK_UPLOAD_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read bulk upload session from sessionStorage:', error)
  }
  return null
}

export function clearBulkUploadSession (): void {
  try {
    sessionStorage.removeItem(BULK_UPLOAD_KEY)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to clear bulk upload session from sessionStorage:', error)
  }
}

export function updateBookInSession (
  bookId: string,
  updates: Partial<SerializedBulkUploadBook>
): void {
  const session = loadBulkUploadSession()
  if (!session) { return }

  const book = session.books.find(b => b.id === bookId)
  if (!book) { return }

  Object.assign(book, updates)

  try {
    sessionStorage.setItem(BULK_UPLOAD_KEY, JSON.stringify(session))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to update book in session:', error)
  }
}

export function restoreBooksFromSession (
  session: BulkUploadSession
): BulkUploadBook[] {
  return session.books.map(deserializeBook)
}
