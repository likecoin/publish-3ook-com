// Pure text-layer verdict rules, dependency-free so test/pdf-text.test.mjs can
// import them without pulling in pdfjs — the same reason pdf-metadata.ts is.
//
// A PDF built from a scan carries page images and no text layer. Readers can
// still read it, but they cannot search, select or hear the text, so the author
// is told. Every rule below prefers calling a file searchable over accusing a
// legitimate book of being a scan: the notice is advisory, but a wrong one asks
// the author to re-do work that was already right.

// A page whose text layer holds only a running header or a folio yields roughly
// 5-20 characters, and that is the false positive to clear. A real page of prose
// is far above this in either script — a Chinese page runs 600-900 characters,
// an English one 1800-3000 — so nothing lands near the line by accident.
export const PDF_TEXT_MIN_CHARS_PER_PAGE = 50

// A text layer can also be present and unreadable: a font embedded as a subset
// with no ToUnicode CMap decodes to its glyph indices, so the page yields plenty
// of characters and none of them are the ones on the page. Readers lose exactly
// what a scan loses, and the count above cannot see it — mojibake scores higher
// than prose, not lower.
//
// Control characters, the private use areas and U+FFFD are what an unmapped
// glyph index decodes to, and none of them occur in text a person wrote. A
// legible page measures near zero; a garbled one runs 20-66%. The line sits well
// above zero because a page can mix fonts: a running header set in the one
// broken font still leaves a body of readable prose worth keeping.
export const PDF_TEXT_MAX_UNMAPPED_RATIO = 0.1

// How many pages the confirmation probe reads. Only paid on a file the cheap
// pass already suspects, and on an image-only page getTextContent does almost
// no work: there is no embedded font, so there is no cmap to fetch.
export const PDF_TEXT_SAMPLE_PAGES = 8

/**
 * Page numbers (1-based) to probe, spread across the document.
 *
 * The first page is excluded: it is the one page of a scan most likely to carry
 * text, because a scanned body often opens on a born-digital or OCR'd title
 * page. Pages are taken from the centre of each bucket rather than its edge, so
 * a short book's sample does not lean on its last page — often a blank or a
 * colophon, which would read as a scan.
 */
export function samplePdfPageNumbers(
  pageCount: number,
  sampleSize: number = PDF_TEXT_SAMPLE_PAGES,
): number[] {
  if (!Number.isFinite(pageCount) || pageCount <= 1) { return [] }
  if (!Number.isFinite(sampleSize) || sampleSize <= 0) { return [] }

  const firstCandidate = 2
  const candidateCount = Math.floor(pageCount) - 1
  if (candidateCount <= sampleSize) {
    return Array.from({ length: candidateCount }, (_, i) => firstCandidate + i)
  }

  // Strictly increasing while sampleSize <= candidateCount, so the result needs
  // no dedupe.
  return Array.from({ length: Math.floor(sampleSize) }, (_, i) =>
    firstCandidate + Math.floor(((i + 0.5) * candidateCount) / sampleSize))
}

/**
 * Whether the sampled pages read as a text layer rather than a scan.
 *
 * A third of the sample has to carry text. Not "any page": one born-digital
 * colophon in a 400-page scan would pass that. Not "most pages": plate sections
 * and blank pages are normal in a book that is otherwise all text.
 */
export function hasSearchableText(charCountsPerPage: number[]): boolean {
  if (!charCountsPerPage.length) { return false }
  const pagesWithText = countPagesWithText(charCountsPerPage)
  // Multiplied rather than divided, so the third is exact at every sample size.
  return pagesWithText * 3 >= charCountsPerPage.length
}

export function countPagesWithText(charCountsPerPage: number[]): number {
  return charCountsPerPage.filter(
    count => Number.isFinite(count) && count >= PDF_TEXT_MIN_CHARS_PER_PAGE,
  ).length
}

// The code points a text extractor emits when it has no mapping, and that no
// author typed: the C0 controls that are not whitespace, DEL, the three private
// use areas — which is all \p{Co} is — and the replacement character a stricter
// extractor substitutes for the same missing mapping.
// eslint-disable-next-line no-control-regex
const UNMAPPED_GLYPH = /[\x00-\x08\x0E-\x1F\x7F\p{Co}�]/gu

// Whitespace counts on neither side of the ratio: getTextContent returns
// positioned runs joined with spaces, so how many there are describes the page's
// layout rather than what its text decoded to.
const WHITESPACE_RUN = /\s+/gu

/**
 * How many of the page's characters a reader could search or select: all of them
 * or none, since a page that decoded to glyph indices is not partly readable.
 *
 * Zero for an empty page too, which the caller counts the same as the
 * no-characters page it already was. The count rather than a flag so that the
 * one-third rule above answers this question as it answers the scan.
 */
export function legibleCharCount(text: string): number {
  const visible = text.replace(WHITESPACE_RUN, '')
  if (!visible) { return 0 }
  const unmapped = visible.match(UNMAPPED_GLYPH)?.length ?? 0
  // Float error on the product falls toward legible, the side that does not
  // accuse a book.
  return unmapped <= visible.length * PDF_TEXT_MAX_UNMAPPED_RATIO ? text.length : 0
}

/**
 * For a page legibleCharCount kept, which tolerates a running header set in the
 * one broken font so the prose underneath survives: the header's glyph indices
 * are still not text, and nothing downstream should be reading them.
 */
export function stripUnmappedChars(text: string): string {
  const stripped = text.replace(UNMAPPED_GLYPH, '')
  // Only a removed run can leave two spaces adjacent, and the caller collapsed
  // the text once already.
  return stripped === text ? text : stripped.replace(WHITESPACE_RUN, ' ').trim()
}
