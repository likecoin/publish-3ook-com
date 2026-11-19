// No `~/` imports: node --test loads this file directly.
type UploadResult = { arweaveId?: string, arweaveLink?: string }

const PROTECTED_LINK_PATH = '/arweave/v2/link/'

// The on-chain reference for a record: ar:// when Arweave stored it, else the
// permanent public link of a file the server kept in GCS only.
export function getRecordContentUri(record: UploadResult): string {
  if (record.arweaveId) { return `ar://${record.arweaveId}` }
  return record.arweaveLink || ''
}

// Protected-tier links go through the API and need the reader's access check,
// unlike the public links of open-tier files.
export function isProtectedTierLink(link?: string): boolean {
  return !!link && link.includes(PROTECTED_LINK_PATH)
}

// A link is proof enough for resume: a link-only cover or DRM ebook has no
// Arweave ID, and re-uploading it would only burn quota.
export function isBulkCoverUploaded(book: { coverArweaveId?: string, coverFileLink?: string }): boolean {
  return !!(book.coverArweaveId || book.coverFileLink)
}

type BulkEbookResult = {
  enableDRM: boolean
  bookArweaveId?: string
  bookArweaveKey?: string
  bookArweaveLink?: string
}

// The stored result must match the DRM mode, since it becomes the on-chain
// download URL and cannot be corrected: a public file is never access-controlled
// by hiding its link. A legacy DRM book was encrypted client-side on Arweave and
// carries a key, so that record still counts for DRM and never for an open book.
export function isBulkEbookUploaded(book: BulkEbookResult): boolean {
  const isKeyed = !!book.bookArweaveKey && !!(book.bookArweaveId || book.bookArweaveLink)
  if (book.enableDRM) {
    return isProtectedTierLink(book.bookArweaveLink) || isKeyed
  }
  return !isKeyed && hasOpenTierResult({ arweaveId: book.bookArweaveId, arweaveLink: book.bookArweaveLink })
}

export function hasOpenTierResult(record: UploadResult): boolean {
  return !!record.arweaveId || (!!record.arweaveLink && !isProtectedTierLink(record.arweaveLink))
}

// A cover link ends up on-chain and cannot be corrected, so a resumed CSV cell
// must be a real https URL before it is trusted.
export function isHttpsUrl(value?: string): boolean {
  try {
    return new URL((value || '').trim()).protocol === 'https:'
  }
  catch {
    return false
  }
}
