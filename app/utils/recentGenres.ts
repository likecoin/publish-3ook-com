// Per wallet, because the app can switch wallets and a publisher's shelf is
// per wallet — one account's back catalogue says nothing about another's.
const RECENT_GENRES_KEY_PREFIX = 'publish_recent_genres:'

export const MAX_RECENT_GENRES = 3

function storageKey(wallet: string): string {
  return `${RECENT_GENRES_KEY_PREFIX}${wallet.toLowerCase()}`
}

export function loadRecentGenres(wallet: string): string[] {
  if (!wallet) { return [] }
  try {
    const stored = localStorage.getItem(storageKey(wallet))
    if (!stored) { return [] }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) { return [] }
    return parsed.filter((value): value is string => typeof value === 'string')
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read recent genres from localStorage:', error)
    return []
  }
}

// Called once a genre is known to have been published, so the list records what
// the author actually committed to rather than what they browsed past.
export function rememberRecentGenre(wallet: string, genre: string): void {
  if (!wallet || !genre) { return }
  const next = [genre, ...loadRecentGenres(wallet).filter(value => value !== genre)]
    .slice(0, MAX_RECENT_GENRES)
  try {
    localStorage.setItem(storageKey(wallet), JSON.stringify(next))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save recent genres to localStorage:', error)
  }
}
