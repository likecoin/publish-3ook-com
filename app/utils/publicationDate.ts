// Import-free so `node --test` can run it.

// A bare numeric date, plus the time a spreadsheet appends to a datetime cell.
const BARE_DATE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}(?:[ T][\d:.]*)?$/
// The subset stating a year first with one consistent separator. Day-first and
// month-first are indistinguishable, so neither is read.
const YEAR_FIRST_DATE = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?:[ T][\d:.]*)?$/

// V8 reads a date with no offset as local midnight, so 2024/01/15 reached the
// chain as 2024-01-14 in UTC+8. Build the parts as UTC and drop the time.
function parseYearFirstDate(match: RegExpExecArray | null): Date | undefined {
  if (!match) { return undefined }
  const year = Number(match[1])
  const month = Number(match[3])
  const day = Number(match[4])
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date.UTC rolls 2024-13-01 over into 2025 and maps a year under 100 into the
  // 1900s rather than rejecting either; only a round trip proves a real date.
  const isRoundTrip = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  return isRoundTrip ? date : undefined
}

// Trim so a padded cell still matches the numeric shapes above; Date reads what
// it cannot match as local midnight. Unparseable input returns undefined rather
// than reaching toISOString() and throwing RangeError.
export function normalizePublicationDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) { return undefined }
  // Date is left only what states its own offset; it reads the rest as local
  // midnight, and rolls 2024/02/31 over into March.
  const date = BARE_DATE.test(trimmed)
    ? parseYearFirstDate(YEAR_FIRST_DATE.exec(trimmed))
    : new Date(trimmed)
  if (!date || Number.isNaN(date.getTime())) { return undefined }
  return date.toISOString().split('T')[0]
}
