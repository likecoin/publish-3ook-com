// Lives outside the Nuxt-aware utils so it stays importable from node --test.

// How far back a cut may reach for a boundary before taking the plain slice
// instead. Cutting a 1000-character blurb back to 600 to land on a full stop
// loses more than the ragged edge it avoids.
const SENTENCE_SEARCH_FLOOR = 0.6
const WORD_SEARCH_FLOOR = 0.9

const SENTENCE_ENDINGS = ['。', '！', '？', '\n', '. ', '! ', '? ']

/**
 * The catalog description, derived from the long one.
 *
 * `description` is what Stripe, Google Merchant, Meta and OpenAI are handed, so
 * it is never optional in the payload — only optional for the author to type.
 * When they leave it empty this fills it from the full description.
 *
 * Prefers a sentence ending, then a word boundary, then a plain cut. Both
 * boundary searches have a floor because CJK has no spaces and often no ASCII
 * punctuation: without one, a Chinese blurb would either be thrown away back to
 * its first full stop or cut at the last space, which may not exist at all.
 */
export function deriveShortDescription(full: string, maxLength: number): string {
  const text = (full || '').trim()
  if (text.length <= maxLength) { return text }

  const slice = text.slice(0, maxLength)

  const sentenceEnd = SENTENCE_ENDINGS.reduce((best, ending) => {
    const index = slice.lastIndexOf(ending)
    // +1 keeps the punctuation; a trailing space is trimmed off below.
    return index > best ? index + 1 : best
  }, -1)
  if (sentenceEnd > maxLength * SENTENCE_SEARCH_FLOOR) {
    return slice.slice(0, sentenceEnd).trim()
  }

  const wordEnd = slice.lastIndexOf(' ')
  if (wordEnd > maxLength * WORD_SEARCH_FLOOR) {
    return slice.slice(0, wordEnd).trim()
  }

  return slice.trim()
}
