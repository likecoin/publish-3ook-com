import type { PublishSession } from '~/types/publish'

// localStorage (not sessionStorage) so an accidental tab close or browser quit
// keeps the wizard draft and commit checkpoints resumable.
export const PUBLISH_SESSION_KEY = 'publish_book_draft'

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
