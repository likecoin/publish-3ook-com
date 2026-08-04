import { estimateBundlrFilePrice, canSponsorArweaveUpload, getUploadTier } from '~/utils/arweave'
import type { FileRecord } from '~/types'

interface UseArweaveUploadPrecheckOptions {
  fileRecords: Ref<FileRecord[]>
  isEncryptEbook: Ref<boolean>
  // Fires when the server already has a record's file (record.arweaveId is
  // set before this); hosts sync dependent state (e.g. EPUB thumbnail ids).
  onExistingUpload?: (record: FileRecord, arweaveId: string) => void
}

interface UploadQuotaState {
  isSponsored: boolean
  remainingUploads?: number
  requiredUploads: number
}

const EMPTY_QUOTA: UploadQuotaState = { isSponsored: false, requiredUploads: 0 }

// Checks the selection against the publisher's daily sponsored quota and marks
// records the server already has so the upload pipeline skips them.
// checkUploadQuota throws; hosts surface the error.
export function useArweaveUploadPrecheck(options: UseArweaveUploadPrecheckOptions) {
  const bookstoreApiStore = useBookstoreApiStore()
  const { token } = storeToRefs(bookstoreApiStore)

  // One object rather than three refs: a partial update would leave the sponsored
  // flag from an earlier run next to a cleared remaining count, which renders as
  // "free upload (unlimited)" to an author who may have no quota at all.
  const quota = ref<UploadQuotaState>({ ...EMPTY_QUOTA })
  const isArweaveSponsored = computed(() => quota.value.isSponsored)
  const arweaveRemainingUploads = computed(() => quota.value.remainingUploads)
  const arweaveRequiredUploads = computed(() => quota.value.requiredUploads)

  // Toggling DRM re-runs this while a previous pass may still be in flight; both
  // mutate the same records, so a late loser could re-apply an arweaveId derived
  // under the old setting. Only the newest run may publish its results.
  let latestRunId = 0

  function isOpenTier(record: FileRecord): boolean {
    return getUploadTier(record.fileType, options.isEncryptEbook.value) === 'open'
  }

  async function checkUploadQuota(): Promise<void> {
    const runId = ++latestRunId
    // A protected record must never carry a dedup hit: those ids only come from a
    // public Arweave copy, and isRecordUploaded() would then skip the file, so a
    // book the author chose to protect would be served from that public copy.
    options.fileRecords.value.forEach((record) => {
      if (record.arweaveId && !isOpenTier(record)) { record.arweaveId = undefined }
    })

    // Both tiers count: upload_init reserves quota for whatever it stages and
    // only the open tier ever releases it, so a DRM ebook costs a slot too.
    const pendingRecords = options.fileRecords.value.filter(r => r.fileBlob && !r.arweaveId)
    if (!pendingRecords.length) {
      quota.value = { ...EMPTY_QUOTA }
      return
    }

    // The quota fields are per account, not per file, so one call answers for the
    // whole selection. Only the duplicate check below is genuinely per-record.
    const totalSize = pendingRecords.reduce((sum, r) => sum + (r.fileBlob?.size || 0), 0)
    const estimate = await estimateBundlrFilePrice({ fileSize: totalSize, token: token.value })
    const nextQuota: UploadQuotaState = {
      isSponsored: canSponsorArweaveUpload(estimate, totalSize, pendingRecords.length),
      remainingUploads: estimate.remainingUploads,
      requiredUploads: pendingRecords.length,
    }

    // Arweave is content-addressed, so an estimate carrying an ipfsHash doubles as
    // a duplicate check. Worth a request only where a hit can be acted on: protected
    // records must not dedup at all, and a record without a hash cannot.
    const dedupTargets = pendingRecords.filter(r => r.ipfsHash && isOpenTier(r))
    const hits: { record: FileRecord, arweaveId: string }[] = []
    for (const [index, record] of dedupTargets.entries()) {
      // Paced rather than parallel: this fans out one request per selected file
      // against the same endpoint the upload itself uses.
      if (index) { await sleep(100) }
      const { arweaveId } = await estimateBundlrFilePrice({
        fileSize: record.fileBlob?.size || 0,
        ipfsHash: record.ipfsHash,
        token: token.value,
      })
      if (arweaveId) { hits.push({ record, arweaveId }) }
    }

    if (runId !== latestRunId) { return }
    quota.value = nextQuota
    hits.forEach(({ record, arweaveId }) => {
      record.arweaveId = arweaveId
      options.onExistingUpload?.(record, arweaveId)
    })
  }

  return {
    isArweaveSponsored,
    arweaveRemainingUploads,
    arweaveRequiredUploads,
    checkUploadQuota,
  }
}
