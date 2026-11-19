import { EBOOK_FILE_TYPES } from '~/constant'
import { isRecordUploaded, isManualCoverRecord } from '~/utils/arweave'
import { getEbookContentUri, getRecordContentUri } from '~/utils/contentUri'

// Minimal record shape needed to derive ISCN links; both UploadForm's
// FileRecord and PublishFileRecord satisfy it.
export interface IscnLinkSourceRecord {
  fileName?: string
  fileType?: string
  isGeneratedCover?: boolean
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
  fileSHA256?: string
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
      url: getEbookContentUri(file),
      type: file.fileType === 'application/epub+zip' ? 'epub' : 'pdf',
      fileName: file.fileName || '',
    }))

  const contentFingerprints = [
    ...new Set<string>(
      uploadedRecords
        .flatMap((r) => {
          const isEbook = EBOOK_FILE_TYPES.includes(r.fileType || '')
          const urls = [isEbook ? getEbookContentUri(r) : getRecordContentUri(r)]
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

  // Both covers survive a manual replacement, so pick by provenance rather than
  // position: the author's choice outranks the one the EPUB supplied.
  const coverRecords = records.filter(r => r.fileType?.startsWith('image/') && isRecordUploaded(r))
  const coverRecord = coverRecords.find(r => isManualCoverRecord(r)) || coverRecords[0]
  const coverUrl = coverRecord ? getRecordContentUri(coverRecord) : ''

  return { downloadableUrls, contentFingerprints, coverUrl }
}
