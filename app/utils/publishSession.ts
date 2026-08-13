import type { PublishFileRecord, PublishSession } from '~/types/publish'

// localStorage (not sessionStorage) so an accidental tab close or browser quit
// keeps the wizard draft and commit checkpoints resumable.
export const PUBLISH_SESSION_KEY = 'publish_book_draft'

// Says the author already chose to resume — by clicking the draft row in 我的
// 書籍 — so the wizard skips asking a second time.
export const PUBLISH_RESUME_QUERY = { resume: '1' } as const

export function savePublishSession(session: PublishSession): void {
  try {
    localStorage.setItem(PUBLISH_SESSION_KEY, JSON.stringify(session))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save publish session to localStorage:', error)
  }
}

export function loadPublishSession(): PublishSession | null {
  try {
    const stored = localStorage.getItem(PUBLISH_SESSION_KEY)
    if (stored) {
      const session: PublishSession = JSON.parse(stored)
      if (session.version === 1) {
        return session
      }
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read publish session from localStorage:', error)
  }
  return null
}

export function updatePublishSession(partial: Partial<PublishSession>): void {
  const session = loadPublishSession()
  if (!session) { return }
  savePublishSession({ ...session, ...partial })
}

export function clearPublishSession(): void {
  try {
    localStorage.removeItem(PUBLISH_SESSION_KEY)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to clear publish session from localStorage:', error)
  }
}

// A draft is two halves — this JSON and the file bytes in the draft file store.
// Dropping one without the other leaves the wizard a half-draft to resume from,
// so nothing should clear either half alone.
export function clearPublishDraft(): Promise<void> {
  clearPublishSession()
  return draftFileStore.clearDraftFiles()
}

// The bytes for a draft's records, keyed the way the wizard saved them.
export function loadPublishDraftFiles(records: PublishFileRecord[]): Promise<Map<string, Blob>> {
  return draftFileStore.loadDraftFiles(records.map(record => ({
    key: record.fileSHA256 || '',
    expectedSize: record.fileSize,
  })))
}

// Whether a draft holds anything worth going back to. The wizard persists on
// the first change of any kind, so merely opening it and leaving leaves behind
// a session carrying nothing but the default prices.
export function hasPublishDraftContent(session: PublishSession): boolean {
  return !!(session.fileRecords.length
    || session.iscnFormData?.title
    || session.classId
    || session.mintTxHash)
}

// The name to show a draft under, in the order the author most recently meant
// it: what they typed, then what the file claimed.
export function getPublishSessionTitle(
  session: PublishSession,
  t: (key: string) => string,
): string {
  return session.iscnFormData?.title || session.epubMetadata?.title || t('publish_wizard.untitled_draft')
}
