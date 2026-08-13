// Merges a replacement upload's file links into the ones a published book
// already carries. Kept free of `~/` imports so `test/iscn-file-links.test.mjs`
// can import it under `node --test`.

export interface DownloadableUrlRow {
  url: string
  type: string
  fileName: string
}

export interface IscnFileLinks {
  downloadableUrls: DownloadableUrlRow[]
  contentFingerprints: Array<{ url: string }>
}

// The same two arrays handed across a component boundary for in-place editing.
// Refs rather than the arrays themselves, for the reason `BookListingSettings`
// is shaped this way: the editor has to write into the host's own state, and a
// prop it could only replace would drop the edit.
export interface IscnFileLinksContext {
  downloadableUrls: Ref<DownloadableUrlRow[]>
  contentFingerprints: Ref<Array<{ url: string }>>
}

/**
 * Replaces only the formats the author actually re-uploaded.
 *
 * Overwriting both arrays wholesale — what the wizard does, where there is
 * nothing to overwrite — would drop the EPUB of a book whose PDF was replaced,
 * and with it the reader's download.
 *
 * `downloadableUrls` merge by type, in place, so untouched formats and any
 * hand-entered rows survive. `contentFingerprints` cannot be attributed to a
 * format, so only the replaced rows' own URLs are dropped: for an encrypted
 * ebook that URL is the keyed link, which is exactly the entry that would
 * otherwise keep `isContentFingerprintEncrypted` true after a plaintext
 * replacement. Stale `hash://sha256/…` anchors stay — they are unattributable,
 * never read as encrypted, and under ADR 0001 a plaintext anchor is an additive
 * claim about content this book once shipped.
 */
export function mergeIscnFileLinks(existing: IscnFileLinks, incoming: IscnFileLinks): IscnFileLinks {
  const incomingByType = new Map<string, DownloadableUrlRow[]>()
  for (const row of incoming.downloadableUrls) {
    if (!row.type) { continue }
    const rows = incomingByType.get(row.type) || []
    rows.push(row)
    incomingByType.set(row.type, rows)
  }
  const incomingUrls = new Set(incoming.downloadableUrls.map(row => row.url).filter(Boolean))

  // URLs the replacement retired, so their fingerprints go with them. A URL the
  // replacement brought back was never retired — re-uploading an unchanged file
  // must not cost it its own fingerprint.
  const retiredUrls = new Set<string>()
  const retire = (url: string) => {
    if (!incomingUrls.has(url)) { retiredUrls.add(url) }
  }
  const placedTypes = new Set<string>()
  const downloadableUrls: DownloadableUrlRow[] = []

  for (const row of existing.downloadableUrls) {
    // Empty rows are the edit form's seed, not a file.
    if (!row.url) { continue }
    const replacement = incomingByType.get(row.type)
    if (replacement) {
      retire(row.url)
      // Substituted at the first row of that type; a second old row of the same
      // type is a duplicate the replacement resolves.
      if (!placedTypes.has(row.type)) {
        placedTypes.add(row.type)
        downloadableUrls.push(...replacement)
      }
      continue
    }
    // The same file re-uploaded into a row whose type was never filled in.
    if (incomingUrls.has(row.url)) { continue }
    downloadableUrls.push(row)
  }

  // A format the book did not have before is an addition, not a replacement.
  for (const [type, rows] of incomingByType) {
    if (placedTypes.has(type)) { continue }
    downloadableUrls.push(...rows)
  }

  const contentFingerprints: Array<{ url: string }> = []
  const seenFingerprints = new Set<string>()
  for (const fingerprint of [...existing.contentFingerprints, ...incoming.contentFingerprints]) {
    // Empty rows are the edit form's seed, not a fingerprint.
    if (!fingerprint.url || retiredUrls.has(fingerprint.url) || seenFingerprints.has(fingerprint.url)) {
      continue
    }
    seenFingerprints.add(fingerprint.url)
    contentFingerprints.push(fingerprint)
  }

  return { downloadableUrls, contentFingerprints }
}
