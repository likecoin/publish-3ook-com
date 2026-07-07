import { estimateBundlrFilePrice, canSponsorArweaveUpload } from '~/utils/arweave'
import type { ArweaveEstimate } from '~/types'
import type { BulkUploadBook } from '~/types/bulk-upload'
import { BookUploadStatus } from '~/types/bulk-upload'

export interface ArweaveQuotaInfo extends Pick<ArweaveEstimate, 'remainingUploads' | 'remainingBytes' | 'isUnlimited'> {
  isSponsored: boolean
  requiredUploads: number
  requiredBytes: number
}

// Evaluates the batch's Arweave sponsorship quota against the books' pending
// (not-yet-uploaded) files and derives the shortfall shown on the review step.
export function useArweaveQuota(options: { books: Ref<BulkUploadBook[]> }) {
  const bookstoreApiStore = useBookstoreApiStore()
  const { token } = storeToRefs(bookstoreApiStore)

  const arweaveQuota = ref<ArweaveQuotaInfo>({
    isSponsored: false,
    isUnlimited: false,
    requiredUploads: 0,
    requiredBytes: 0,
  })
  const isEvaluatingQuota = ref(false)

  const quotaShortfallUploads = computed(() => {
    const q = arweaveQuota.value
    if (q.isSponsored || q.remainingUploads === undefined) { return 0 }
    return Math.max(0, q.requiredUploads - q.remainingUploads)
  })

  const quotaShortfallBytes = computed(() => {
    const q = arweaveQuota.value
    if (q.isSponsored || q.remainingBytes === undefined) { return 0 }
    return Math.max(0, q.requiredBytes - q.remainingBytes)
  })

  // Sponsorship is all-or-none across the batch — partial quota still means every upload pays gas.
  const quotaIsPartial = computed(() => {
    if ((arweaveQuota.value.remainingUploads ?? 0) <= 0) { return false }
    return quotaShortfallUploads.value > 0 || quotaShortfallBytes.value > 0
  })

  function collectPendingFiles() {
    const files: File[] = []
    for (const b of options.books.value) {
      if (b.status === BookUploadStatus.COMPLETED) { continue }
      if (!b.coverArweaveId && b.coverFile) { files.push(b.coverFile) }
      if (!b.bookArweaveId) {
        const ebook = b.epubFile || b.pdfFile
        if (ebook) { files.push(ebook) }
      }
    }
    return files
  }

  async function evaluateArweaveQuota(): Promise<ArweaveQuotaInfo> {
    const pendingFiles = collectPendingFiles()
    const requiredUploads = pendingFiles.length
    const requiredBytes = pendingFiles.reduce((sum, f) => sum + f.size, 0)

    const fallback: ArweaveQuotaInfo = {
      isSponsored: false,
      isUnlimited: false,
      requiredUploads,
      requiredBytes,
    }

    if (requiredUploads === 0) {
      arweaveQuota.value = fallback
      return fallback
    }

    // Clear stale remaining* so ArweaveSponsorStatus hides until the new estimate resolves.
    arweaveQuota.value = fallback
    isEvaluatingQuota.value = true

    try {
      const quota = await estimateBundlrFilePrice({ fileSize: requiredBytes, token: token.value })
      const info: ArweaveQuotaInfo = {
        isSponsored: canSponsorArweaveUpload(quota, requiredBytes, requiredUploads),
        isUnlimited: !!quota.isUnlimited,
        remainingUploads: quota.remainingUploads,
        remainingBytes: quota.remainingBytes,
        requiredUploads,
        requiredBytes,
      }
      arweaveQuota.value = info
      return info
    }
    catch {
      arweaveQuota.value = fallback
      return fallback
    }
    finally {
      isEvaluatingQuota.value = false
    }
  }

  return {
    arweaveQuota,
    isEvaluatingQuota,
    quotaShortfallUploads,
    quotaShortfallBytes,
    quotaIsPartial,
    evaluateArweaveQuota,
  }
}
