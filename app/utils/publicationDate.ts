// Import-free so `node --test` can run it.
// Trim input to keep YYYY-MM-DD parsing on the UTC path (spaces fall back to local time).
// Return undefined for unparseable input to avoid RangeError from toISOString().
export function normalizePublicationDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) { return undefined }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0]
}
