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
