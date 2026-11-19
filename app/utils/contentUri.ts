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

// Encrypted ebooks are only reachable via their keyed link; otherwise the
// ar:// id outranks the link.
export function getEbookContentUri(record: { arweaveId?: string, arweaveKey?: string, arweaveLink?: string }): string {
  if (record.arweaveKey && record.arweaveLink) { return record.arweaveLink }
  return getRecordContentUri(record)
}

// A result counts only if the URL it publishes on-chain matches the DRM mode:
// protected or legacy keyed for DRM, public otherwise. A public file is never
// access-controlled by hiding its link.
export function isBulkEbookUploaded(book: BulkEbookResult, trustedOrigins?: TrustedOrigins): boolean {
  const url = getEbookContentUri({
    arweaveId: book.bookArweaveId,
    arweaveKey: book.bookArweaveKey,
    arweaveLink: book.bookArweaveLink,
  })
  if (book.enableDRM) {
    return isProtectedTierLink(url, trustedOrigins) || hasKeyedLink(book)
  }
  return !!url && !book.bookArweaveKey && !isProtectedTierLink(url, trustedOrigins)
}

function hasKeyedLink(book: BulkEbookResult): boolean {
  try {
    return !!book.bookArweaveId && !!book.bookArweaveKey && new URL(book.bookArweaveLink || '').searchParams.has('key')
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
