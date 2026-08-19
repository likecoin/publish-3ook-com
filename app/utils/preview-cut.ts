// Pure preview-cut rules, kept dependency-free and copied verbatim from the
// ebook-cors server (likecoin-cloud-functions preview/plan.js) so this UI can
// show authors the cut the server will actually ship. Both copies run against
// test/fixtures/preview-cut.golden.json; a rule only changes on the server, and
// the fixture must be re-copied here with it, or the two drift.

export const PREVIEW_PERCENTAGE_MIN = 1
export const PREVIEW_PERCENTAGE_MAX = 50
export const PREVIEW_PERCENTAGE_DEFAULT = 10
// How far past the requested percentage a straddling chapter may push the cut.
export const PREVIEW_OVERSHOOT_FACTOR = 2

export type PreviewUnavailableReason
  = | 'INVALID_PERCENTAGE'
    | 'NOT_ENOUGH_SPINE'
    | 'EMPTY_SPINE'
    | 'NOT_ENOUGH_PAGES'

// One document the server ships cut down to roughly `targetBytes`, rather than
// whole. Absent from PDF plans, which cut only at page boundaries.
export interface PreviewPartialCut {
  index: number
  targetBytes: number
}

export type PreviewPlan
  = | { ok: false, reason: PreviewUnavailableReason }
    | {
      ok: true
      includedCount: number
      partial?: PreviewPartialCut | null
      effectivePercentage: number
    }

export function clampPreviewPercentage(value: unknown): number {
  const percentage = Number(value)
  if (!Number.isFinite(percentage) || percentage <= 0) { return PREVIEW_PERCENTAGE_DEFAULT }
  return Math.min(
    PREVIEW_PERCENTAGE_MAX,
    Math.max(PREVIEW_PERCENTAGE_MIN, Math.round(percentage)),
  )
}

const unavailable = (reason: PreviewUnavailableReason): PreviewPlan => ({ ok: false, reason })

// `sizes` is the uncompressed byte size of each spine document, in reading
// order. `percentage` must already be clamped — the ceiling below assumes it.
//
// Returns `includedCount` documents to ship whole, and optionally `partial`:
// `{ index, targetBytes }` for one further document to ship cut down to roughly
// `targetBytes`. `partial.index` is always `includedCount`, so the kept spine is
// a prefix either way.
export function planEpubPreviewCut(sizes: number[], percentage: number): PreviewPlan {
  if (!Number.isFinite(percentage) || percentage <= 0) { return unavailable('INVALID_PERCENTAGE') }
  if (sizes.length < 2) { return unavailable('NOT_ENOUGH_SPINE') }
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0)
  if (!totalBytes) { return unavailable('EMPTY_SPINE') }

  const threshold = (percentage / 100) * totalBytes
  const bytesBefore = (count: number) => sizes.slice(0, count).reduce((sum, size) => sum + size, 0)
  const percentageOf = (bytes: number) => (bytes / totalBytes) * 100

  // Generous by design: an item that starts before the mark is included whole,
  // so a preview never stops mid-chapter.
  let includedCount = 0
  let includedBytes = 0
  for (let i = 0; i < sizes.length; i += 1) {
    if (includedBytes >= threshold) { break }
    includedCount = i + 1
    includedBytes += sizes[i]!
  }

  // The straddling item is too generous to hand over whole when it pushes the
  // cut past the ceiling, or when including it would leave nothing withheld.
  // The first item is exempt from the ceiling — it is the smallest whole cut
  // the spine allows, so a 1% ask on a book of 5% chapters should still get
  // chapter one — but never from the hard maximum.
  const ceiling = includedCount > 1
    ? Math.min(PREVIEW_PERCENTAGE_MAX, percentage * PREVIEW_OVERSHOOT_FACTOR)
    : PREVIEW_PERCENTAGE_MAX
  const isTooGenerous = percentageOf(includedBytes) > ceiling
    || includedCount >= sizes.length

  let partial: PreviewPartialCut | null = null
  if (isTooGenerous) {
    // Cut the straddler down rather than dropping it: a book whose body is a
    // single document (Sigil-produced EPUBs routinely are) has no other item to
    // give, so dropping it previews the front matter and nothing else.
    const index = includedCount - 1
    includedCount = index
    const targetBytes = Math.round(threshold - bytesBefore(includedCount))
    // A straddler starting on the mark contributes nothing worth keeping.
    if (targetBytes > 0) { partial = { index, targetBytes } }
  }

  const effectiveBytes = bytesBefore(includedCount) + (partial ? partial.targetBytes : 0)
  return {
    ok: true,
    includedCount,
    partial,
    effectivePercentage: percentageOf(effectiveBytes),
  }
}

// PDF pages are uniform enough that rounding up to a whole page overshoots by
// at most one page, so the EPUB ceiling has nothing to protect against here.
export function planPdfPreviewCut(pageCount: number, percentage: number): PreviewPlan {
  if (!Number.isFinite(percentage) || percentage <= 0) { return unavailable('INVALID_PERCENTAGE') }
  if (!Number.isFinite(pageCount) || pageCount <= 1) { return unavailable('NOT_ENOUGH_PAGES') }
  const includedCount = Math.min(
    Math.max(Math.ceil((percentage / 100) * pageCount), 1),
    pageCount - 1,
  )
  return {
    ok: true,
    includedCount,
    effectivePercentage: (includedCount / pageCount) * 100,
  }
}
