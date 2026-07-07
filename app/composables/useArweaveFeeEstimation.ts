import { BigNumber } from 'bignumber.js'
import { estimateBundlrFilePrice, canSponsorArweaveUpload } from '~/utils/arweave'
import { EBOOK_FILE_TYPES } from '~/constant'
import type { FileRecord, ArweaveEstimate } from '~/types'

interface UseArweaveFeeEstimationOptions {
  fileRecords: Ref<FileRecord[]>
  isEncryptEbook: Ref<boolean>
  // Fires when the server already has a record's file (record.arweaveId is
  // set before this); hosts sync dependent state (e.g. EPUB thumbnail ids).
  onExistingUpload?: (record: FileRecord, arweaveId: string) => void
}

// Estimates Arweave upload fees for the given records, tracks sponsorship
// eligibility, and marks records the server already has so the upload
// pipeline skips them. estimateArweaveFee throws; hosts surface the error.
export function useArweaveFeeEstimation(options: UseArweaveFeeEstimationOptions) {
  const bookstoreApiStore = useBookstoreApiStore()
  const { token } = storeToRefs(bookstoreApiStore)

  const arweaveFee = ref(new BigNumber(0))
  const arweaveFeeMap = ref({} as Record<string, string>)
  const arweaveFeeTargetAddress = ref('')
  const isArweaveSponsored = ref(false)
  const arweaveRemainingUploads = ref<number | undefined>()
  const arweaveRequiredUploads = ref<number | undefined>()

  async function estimateArweaveFee(): Promise<void> {
    const results: { record: FileRecord, estimate: ArweaveEstimate }[] = []
    for (const record of options.fileRecords.value) {
      await sleep(100)
      const isEbook = EBOOK_FILE_TYPES.includes(record.fileType ?? '')
      const estimate = await estimateBundlrFilePrice({
        fileSize: record.fileBlob?.size || 0,
        ipfsHash: (isEbook && options.isEncryptEbook.value) ? undefined : record.ipfsHash,
        token: token.value,
      })
      results.push({ record, estimate })
    }

    const firstResult = results[0]?.estimate
    arweaveRemainingUploads.value = firstResult?.remainingUploads
    if (firstResult) {
      const totalSize = options.fileRecords.value.reduce((sum, r) => sum + (r.fileBlob?.size || 0), 0)
      const fileCount = options.fileRecords.value.filter(r => r.fileBlob).length
      isArweaveSponsored.value = canSponsorArweaveUpload(firstResult, totalSize, fileCount)
      arweaveRequiredUploads.value = fileCount
    }

    let totalFee = new BigNumber(0)
    results.forEach(({ record, estimate }) => {
      const { evmAddress, arweaveId, ETH } = estimate
      if (!record.ipfsHash) { return }
      if (ETH && !isArweaveSponsored.value) {
        totalFee = totalFee.plus(new BigNumber(ETH))
        arweaveFeeMap.value[record.ipfsHash] = ETH
      }
      if (arweaveId) {
        record.arweaveId = arweaveId
        options.onExistingUpload?.(record, arweaveId)
      }
      if (!arweaveFeeTargetAddress.value && evmAddress) {
        arweaveFeeTargetAddress.value = evmAddress
      }
    })

    arweaveFee.value = totalFee
  }

  return {
    arweaveFee,
    arweaveFeeMap,
    arweaveFeeTargetAddress,
    isArweaveSponsored,
    arweaveRemainingUploads,
    arweaveRequiredUploads,
    estimateArweaveFee,
  }
}
