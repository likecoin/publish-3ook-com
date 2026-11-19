// No `~/` imports: node --test loads this file directly.
type UploadResult = { arweaveId?: string, arweaveLink?: string }

const PROTECTED_LINK_PATH = '/arweave/v2/link/'

// The on-chain reference for a record: ar:// when Arweave stored it, else the
// permanent public link of a file the server kept in GCS only.
export function getRecordContentUri(record: UploadResult): string {
  if (record.arweaveId) { return `ar://${record.arweaveId}` }
  return record.arweaveLink || ''
}

type TrustedOrigins = string | string[]

// Protected-tier links go through the API and need the reader's access check.
// Judged on the parsed URL, so a query or fragment cannot fake the endpoint, and
// on the API origin when the caller knows it.
export function isProtectedTierLink(link?: string, trustedOrigins?: TrustedOrigins): boolean {
  try {
    const url = new URL((link || '').trim())
    if (url.protocol !== 'https:') { return false }
    if (!url.pathname.startsWith(PROTECTED_LINK_PATH) || url.pathname.length === PROTECTED_LINK_PATH.length) { return false }
    return !trustedOrigins || [trustedOrigins].flat().includes(url.origin)
  }
  catch {
    return false
  }
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

// The stored result becomes the on-chain download URL, so it must match the DRM
// mode: a public file is never access-controlled by hiding its link. A legacy
// DRM book was encrypted client-side and carries a key plus a keyed link.
export function isBulkEbookUploaded(book: BulkEbookResult, trustedOrigins?: TrustedOrigins): boolean {
  const isEncrypted = !!book.bookArweaveKey && !!(book.bookArweaveId || book.bookArweaveLink)
  if (book.enableDRM) {
    return isProtectedTierLink(book.bookArweaveLink, trustedOrigins) || (isEncrypted && hasKeyedLink(book))
  }
  return !isEncrypted && hasOpenTierResult(
    { arweaveId: book.bookArweaveId, arweaveLink: book.bookArweaveLink },
    trustedOrigins,
  )
}

function hasKeyedLink(book: BulkEbookResult): boolean {
  try {
    return !!book.bookArweaveId && new URL(book.bookArweaveLink || '').searchParams.has('key')
  }
  catch {
    return false
  }
}

export function hasOpenTierResult(record: UploadResult, trustedOrigins?: TrustedOrigins): boolean {
  return !!record.arweaveId || (!!record.arweaveLink && !isProtectedTierLink(record.arweaveLink, trustedOrigins))
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
