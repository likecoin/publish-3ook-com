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

export function hasOpenTierResult(record: UploadResult): boolean {
  return !!record.arweaveId || (!!record.arweaveLink && !isProtectedTierLink(record.arweaveLink))
}
