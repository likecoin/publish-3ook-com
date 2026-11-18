// Import-free so `node --test` can run it.

// The suggest API allows 10 calls per user per minute, and each call is a paid LLM request,
// so a batch is spaced out to stay under it rather than retried into it.
export const GENRE_SUGGEST_MIN_INTERVAL_MS = 6500
export const GENRE_SUGGEST_RATE_LIMIT_BACKOFF_MS = 60 * 1000
export const GENRE_SUGGEST_MAX_RATE_LIMIT_RETRIES = 2

export type GenreSuggestQueueResult = 'completed' | 'cancelled' | 'rate_limited'

export function isRateLimitError(error: unknown): boolean {
  const { status, statusCode } = (error || {}) as { status?: number, statusCode?: number }
  return (status ?? statusCode) === 429
}

export async function runGenreSuggestQueue<T>(
  items: readonly T[],
  {
    suggest,
    onFailure,
    onSettled,
    shouldSkip,
    shouldContinue,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    now = Date.now,
  }: {
    suggest: (item: T) => Promise<void>
    onFailure?: (item: T, error: unknown) => void
    // Called once per item, whether it was suggested, failed, or skipped.
    onSettled?: (item: T) => void
    // Checked again right before every request, since the author can fill an item in during any wait.
    shouldSkip?: (item: T) => boolean
    shouldContinue: () => boolean
    sleep?: (ms: number) => Promise<void>
    now?: () => number
  },
): Promise<GenreSuggestQueueResult> {
  let lastStartedAt = -Infinity
  for (const item of items) {
    let rateLimitRetries = 0
    for (;;) {
      if (shouldSkip?.(item)) {
        onSettled?.(item)
        break
      }
      const wait = lastStartedAt + GENRE_SUGGEST_MIN_INTERVAL_MS - now()
      if (wait > 0) {
        await sleep(wait)
        continue
      }
      if (!shouldContinue()) { return 'cancelled' }
      lastStartedAt = now()
      try {
        await suggest(item)
        onSettled?.(item)
        break
      }
      catch (error) {
        if (!isRateLimitError(error)) {
          onFailure?.(item, error)
          onSettled?.(item)
          break
        }
        // Still limited after backing off means the quota is spent elsewhere too,
        // so the rest of the batch is left for the author rather than queued behind it.
        if (rateLimitRetries >= GENRE_SUGGEST_MAX_RATE_LIMIT_RETRIES) {
          onFailure?.(item, error)
          onSettled?.(item)
          return 'rate_limited'
        }
        rateLimitRetries += 1
        await sleep(GENRE_SUGGEST_RATE_LIMIT_BACKOFF_MS)
      }
    }
  }
  return 'completed'
}
