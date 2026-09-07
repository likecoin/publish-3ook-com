// Lives alone and import-free so `node --test` can reach it: the timezone
// behaviour below is subtle enough to be worth pinning down.

// A publication date can arrive as free text — a CSV cell, or older chain
// metadata — so anything Date cannot parse is dropped rather than thrown on:
// toISOString raises RangeError on an invalid date. Parse the trimmed value,
// since surrounding spaces drop V8 out of its ISO path and into local time,
// which shifts the date by a day.
export function normalizePublicationDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) { return undefined }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0]
}
