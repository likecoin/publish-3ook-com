import { estimateBundlrFilePrice, uploadEbookToGcsDirect, uploadFileToGcsOpen, getUploadTier, isRecordUploaded, clearOpenTierResult } from '~/utils/arweave'

// Minimal record shape the pipelined uploader needs; UploadForm's FileRecord
// and the publish pipeline's PublishFileRecordWithBlob both satisfy it.
export interface ArweaveUploadableRecord {
  fileName?: string
  fileType?: string
  fileBlob?: Blob
  ipfsHash?: string
  fileSHA256?: string
  arweaveId?: string
  arweaveLink?: string
}

export interface UploadFileRecordsOptions<T extends ArweaveUploadableRecord> {
  encryptEbook: boolean
  // Skip blob-less records instead of throwing (interactive form flow, where
  // a restored record may be re-selected and submitted again later).
  skipMissingBlob?: boolean
  onRecordSkipped?: (record: T, index: number) => void
  onRecordPrepare?: (record: T, index: number) => void
  onRecordUploaded?: (record: T, index: number) => void
}

// arweaveId/ipfsHash are absent for protected records, which stop at GCS and so
// have no public copy to address.
export interface ArweaveUploadResult {
  arweaveLink: string
  arweaveId?: string
  ipfsHash?: string
}

export function useArweaveUpload() {
  const bookstoreApiStore = useBookstoreApiStore()
  const { token } = storeToRefs(bookstoreApiStore)
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

  // Uploads records lacking an upload result, mutating each record in place with
  // the result. Pipelined: the next file's hashing and duplicate check happen
  // while the previous file's bytes are still in flight.
  async function uploadFileRecordsToArweave<T extends ArweaveUploadableRecord>(
    records: T[],
    options: UploadFileRecordsOptions<T>,
  ): Promise<void> {
    const { encryptEbook, skipMissingBlob, onRecordSkipped, onRecordPrepare, onRecordUploaded } = options
    let pendingUpload: Promise<void> = Promise.resolve()
    let uploadError: Error | null = null

    const storeResult = (record: T, index: number, result: ArweaveUploadResult) => {
      Object.assign(record, {
        arweaveLink: result.arweaveLink,
        ...(result.arweaveId ? { arweaveId: result.arweaveId } : {}),
        ...(result.ipfsHash ? { ipfsHash: result.ipfsHash } : {}),
      })
      onRecordUploaded?.(record, index)
    }

    // The chain never rejects: a failure is recorded and swallowed here, then
    // rethrown once after the loop. Letting it stay rejected would leave it
    // unobserved for as long as the loop sits on the next record's network
    // await, which the runtime reports as an unhandled rejection.
    const chainUpload = (record: T, index: number, upload: () => Promise<ArweaveUploadResult>) => {
      const prevUpload = pendingUpload
      pendingUpload = prevUpload
        .then(() => upload())
        .then(result => storeResult(record, index, result))
        .catch((err) => { uploadError ??= err as Error })
    }

    try {
      for (let i = 0; i < records.length; i += 1) {
        const record = records[i]
        if (!record) { continue }
        if (uploadError) { break }
        // Resolved before the skip check, and enforced here rather than in the
        // form, so the invariant holds wherever the DRM choice is made — the
        // wizard asks at its pricing step, long after the files were collected.
        const tier = getUploadTier(record.fileType, encryptEbook)
        if (tier === 'protected') { clearOpenTierResult(record) }

        if (isRecordUploaded(record) || (skipMissingBlob && !record.fileBlob)) {
          onRecordSkipped?.(record, i)
          continue
        }
        if (!record.fileBlob) {
          throw new Error(`Missing file data for ${record.fileName || 'the selected file'}; please re-select the file`)
        }
        if (!tier) {
        // Fail loudly rather than silently skip a file the author believes they
        // published; the pickers should have rejected this at selection time.
          throw new Error(`Unsupported file type ${record.fileType || 'unknown'} for ${record.fileName || 'the selected file'}`)
        }

        const fileBlob = record.fileBlob
        const fileType = record.fileType ?? ''
        const fileName = record.fileName

        // One read serves both hashes, and is deliberately not captured by the
        // chained upload below — that sends the Blob, so the buffer can be freed
        // at once rather than held across a 200MB transfer.
        if (!record.fileSHA256 || (tier === 'open' && !record.ipfsHash)) {
          const arrayBuffer = await fileBlob.arrayBuffer()
          record.fileSHA256 ??= await digestFileSHA256(arrayBuffer)
          if (tier === 'open' && !record.ipfsHash) {
            record.ipfsHash = await calculateIPFSHash(Buffer.from(arrayBuffer)) || undefined
          }
        }
        const fileSHA256 = record.fileSHA256!

        onRecordPrepare?.(record, i)

        if (tier === 'protected') {
          chainUpload(record, i, async () => {
            const { link } = await uploadEbookToGcsDirect(fileBlob, {
              fileType, fileName, fileSHA256, token: token.value,
            })
            return { arweaveLink: link }
          })
          continue
        }

        const ipfsHash = record.ipfsHash
        if (!ipfsHash) {
          throw new Error(`Failed to calculate IPFS hash for ${fileName || 'the selected file'}`)
        }

        // Arweave is content-addressed, so the estimate doubles as the duplicate
        // check: a file the server already has costs no quota and no upload.
        const { arweaveId: existingArweaveId } = await estimateBundlrFilePrice({
          fileSize: fileBlob.size,
          ipfsHash,
          token: token.value,
        })
        if (existingArweaveId) {
          storeResult(record, i, {
            arweaveId: existingArweaveId,
            arweaveLink: `${ARWEAVE_ENDPOINT}/${existingArweaveId}`,
            ipfsHash,
          })
          continue
        }

        chainUpload(record, i, async () => {
          const { arweaveId, link } = await uploadFileToGcsOpen(fileBlob, {
            fileType, fileName, fileSHA256, token: token.value, ipfsHash,
          })
          return { arweaveId, arweaveLink: link, ipfsHash }
        })
      }
    }
    finally {
      // Always drain, so a throw from the loop cannot leave an upload running
      // that would mutate records after the caller has handled the failure.
      await pendingUpload
    }

    if (uploadError) { throw uploadError }
  }

  return { uploadFileRecordsToArweave }
}
