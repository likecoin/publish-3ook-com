import { EBOOK_FILE_TYPES } from '~/constant'
import { isRecordUploaded } from '~/utils/arweave'

// Minimal record shape needed to derive ISCN links; both UploadForm's
// FileRecord and PublishFileRecord satisfy it.
export interface IscnLinkSourceRecord {
  fileName?: string
  fileType?: string
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
  fileSHA256?: string
}

function getRecordArweaveUrl(record: IscnLinkSourceRecord): string {
  // Encrypted ebooks are only reachable via their keyed link, and GCS-direct
  // records (no arweaveId at all) via their API link; everything else uses
  // the plain ar:// id.
  if (record.arweaveLink && (record.arweaveKey || !record.arweaveId)) {
    return record.arweaveLink
  }
  return `ar://${record.arweaveId}`
}

// Derives the ISCN downloadable URLs, content fingerprints and cover URL from
// uploaded file records. The first downloadable URL also seeds the
// deterministic NFT class salt, so this must only run after uploads complete.
export function buildIscnLinksFromFileRecords(records: IscnLinkSourceRecord[]): {
  downloadableUrls: Array<{ url: string, type: string, fileName: string }>
  contentFingerprints: Array<{ url: string }>
  coverUrl: string
} {
  const uploadedRecords = records.filter(isRecordUploaded)

  const downloadableUrls = uploadedRecords
    .filter(r => EBOOK_FILE_TYPES.includes(r.fileType || ''))
    .map(file => ({
      url: getRecordArweaveUrl(file),
      type: file.fileType === 'application/epub+zip' ? 'epub' : 'pdf',
      fileName: file.fileName || '',
    }))

  const contentFingerprints = [
    ...new Set<string>(
      uploadedRecords
        .flatMap((r) => {
          const isEbook = EBOOK_FILE_TYPES.includes(r.fileType || '')
          const urls = [isEbook ? getRecordArweaveUrl(r) : `ar://${r.arweaveId}`]
          // Plaintext-hash provenance anchor (ADR 0001): anchor the original
          // content for every ebook, since an encrypted book's arweave URL
          // only fingerprints ciphertext.
          if (isEbook && r.fileSHA256) {
            urls.push(`hash://sha256/${r.fileSHA256.toLowerCase()}`)
          }
          return urls
        }),
    ),
  ].map(url => ({ url }))

  const coverRecord = records.find(r => r.fileType?.startsWith('image/') && r.arweaveId)
  const coverUrl = coverRecord ? `ar://${coverRecord.arweaveId}` : ''

  return { downloadableUrls, contentFingerprints, coverUrl }
}
