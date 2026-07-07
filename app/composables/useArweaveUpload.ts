import { useSendTransaction } from '@wagmi/vue'
import { parseEther } from 'viem'
import { estimateBundlrFilePrice, uploadSingleFileToBundlr, canSponsorArweaveUpload } from '~/utils/arweave'
import { encryptDataWithAES } from '~/utils/encryption'
import { EBOOK_FILE_TYPES } from '~/constant'
import type { ArweaveEstimate } from '~/types'

// Minimal record shape the pipelined uploader needs; UploadForm's FileRecord
// and the publish pipeline's PublishFileRecordWithBlob both satisfy it.
export interface ArweaveUploadableRecord {
  fileName?: string
  fileType?: string
  fileBlob?: Blob
  ipfsHash?: string
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
}

export interface UploadFileRecordsOptions<T extends ArweaveUploadableRecord> {
  encryptEbook: boolean
  sponsored?: boolean
  // Skip blob-less records instead of throwing (interactive form flow, where
  // a restored record may be re-selected and submitted again later).
  skipMissingBlob?: boolean
  onRecordSkipped?: (record: T, index: number) => void
  onRecordPrepare?: (record: T, index: number) => void
  onRecordUploaded?: (record: T, index: number) => void
}

export interface ArweaveUploadResult {
  arweaveId: string
  arweaveLink: string
  ipfsHash: string
  arweaveKey?: string
}

export interface PreparedArweaveUpload {
  txHash?: string
  buffer: Buffer
  ipfsHash: string
  key?: string
  fileType: string
  fileSize: number
  sponsored?: boolean
}

export type PrepareArweaveUploadResult
  = | PreparedArweaveUpload
    | { alreadyExists: true, result: ArweaveUploadResult }

interface UploadParams {
  arrayBuffer: ArrayBuffer
  fileSize: number
  fileType: string
  encrypt: boolean
  sponsored?: boolean
}

export function useArweaveUpload() {
  const walletStore = useWalletStore()
  const bookstoreApiStore = useBookstoreApiStore()
  const { wallet } = storeToRefs(walletStore)
  const { token } = storeToRefs(bookstoreApiStore)
  const {
    assertSufficientBalanceForTransfer,
    waitForTransactionReceipt,
  } = useNFTContractWriter()
  const { sendTransactionAsync } = useSendTransaction()
  const { isSponsoredMode } = useSponsoredTransaction()
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

  async function prepareFileAndEstimate(params: UploadParams): Promise<
    | { alreadyExists: true, result: ArweaveUploadResult }
    | { buffer: Buffer, ipfsHash: string, key?: string, priceResult: ArweaveEstimate }
  > {
    let buffer = Buffer.from(params.arrayBuffer)
    let key: string | undefined

    if (params.encrypt) {
      const { rawEncryptedKeyAsBase64, combinedArrayBuffer } = await encryptDataWithAES({ data: params.arrayBuffer })
      buffer = Buffer.from(combinedArrayBuffer)
      key = rawEncryptedKeyAsBase64
    }

    const ipfsHash = await calculateIPFSHash(buffer)
    if (!ipfsHash) {
      throw new Error('Failed to calculate IPFS hash')
    }

    const priceResult = await estimateBundlrFilePrice({
      fileSize: buffer.length,
      ipfsHash: params.encrypt ? undefined : ipfsHash,
      token: token.value,
    })

    const { arweaveId: existingArweaveId } = priceResult

    if (existingArweaveId) {
      return {
        alreadyExists: true,
        result: {
          arweaveId: existingArweaveId,
          arweaveLink: `${ARWEAVE_ENDPOINT}/${existingArweaveId}`,
          arweaveKey: key,
          ipfsHash,
        },
      }
    }

    return { buffer, ipfsHash, key, priceResult }
  }

  async function prepareArweaveUploadPaid(params: UploadParams, prepared: { buffer: Buffer, ipfsHash: string, key?: string, priceResult: ArweaveEstimate }): Promise<PreparedArweaveUpload> {
    const { buffer, ipfsHash, key, priceResult } = prepared
    const { evmAddress, ETH } = priceResult

    if (!ETH || !evmAddress) {
      throw new Error('Failed to get Arweave fee estimate')
    }

    await assertSufficientBalanceForTransfer({
      wallet: wallet.value!,
      to: evmAddress as `0x${string}`,
      value: parseEther(ETH),
    })

    const txHash = await sendTransactionAsync({
      to: evmAddress as `0x${string}`,
      value: parseEther(ETH),
    })

    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })
    if (!receipt || receipt.status !== 'success') {
      throw new Error('Arweave fee transaction failed')
    }

    return { txHash, buffer, ipfsHash, key, fileType: params.fileType, fileSize: buffer.length }
  }

  async function prepareArweaveUpload(params: UploadParams): Promise<PrepareArweaveUploadResult> {
    const prepared = await prepareFileAndEstimate(params)
    if ('alreadyExists' in prepared) { return prepared }

    // Explicit sponsored flag (bulk all-or-nothing) takes precedence over auto-detect
    const useSponsored = params.sponsored ?? (
      isSponsoredMode.value
      && canSponsorArweaveUpload(prepared.priceResult, prepared.buffer.length, 1)
    )

    if (useSponsored) {
      const { buffer, ipfsHash, key } = prepared
      return { buffer, ipfsHash, key, fileType: params.fileType, fileSize: buffer.length, sponsored: true }
    }
    return prepareArweaveUploadPaid(params, prepared)
  }

  async function executeArweaveUpload(prepared: PreparedArweaveUpload): Promise<ArweaveUploadResult> {
    const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(prepared.buffer, {
      fileSize: prepared.fileSize,
      ipfsHash: prepared.ipfsHash,
      fileType: prepared.fileType,
      txHash: prepared.txHash,
      token: token.value,
      key: prepared.key,
      sponsored: prepared.sponsored,
    })

    if (!arweaveId) {
      throw new Error('Failed to upload file to Arweave')
    }

    return { arweaveId, arweaveLink, arweaveKey: prepared.key, ipfsHash: prepared.ipfsHash }
  }

  async function uploadToArweave(params: UploadParams): Promise<ArweaveUploadResult> {
    const prepareResult = await prepareArweaveUpload(params)
    if ('alreadyExists' in prepareResult) {
      return prepareResult.result
    }
    return executeArweaveUpload(prepareResult)
  }

  // Uploads records lacking an arweaveId, mutating each record in place with
  // the result. Pipelined: the next file's signature is collected while the
  // previous file uploads.
  async function uploadFileRecordsToArweave<T extends ArweaveUploadableRecord>(
    records: T[],
    options: UploadFileRecordsOptions<T>,
  ): Promise<void> {
    const { encryptEbook, sponsored, skipMissingBlob, onRecordSkipped, onRecordPrepare, onRecordUploaded } = options
    let pendingUpload: Promise<void> = Promise.resolve()
    let uploadError: Error | null = null

    const storeResult = (record: T, index: number, result: ArweaveUploadResult) => {
      Object.assign(record, {
        arweaveId: result.arweaveId,
        arweaveLink: result.arweaveLink,
        arweaveKey: result.arweaveKey,
        ipfsHash: result.ipfsHash,
      })
      onRecordUploaded?.(record, index)
    }

    for (let i = 0; i < records.length; i += 1) {
      const record = records[i]
      if (!record) { continue }
      if (record.arweaveId || (skipMissingBlob && !record.fileBlob)) {
        onRecordSkipped?.(record, i)
        continue
      }
      if (uploadError) { break }
      if (!record.fileBlob) {
        throw new Error(`Missing file data for ${record.fileName || 'the selected file'}; please re-select the file`)
      }

      const shouldEncrypt = EBOOK_FILE_TYPES.includes(record.fileType ?? '') && encryptEbook

      onRecordPrepare?.(record, i)
      // Prepare: encrypt + sign transaction (interactive, requires wallet)
      const prepareResult = await prepareArweaveUpload({
        arrayBuffer: await record.fileBlob.arrayBuffer(),
        fileSize: record.fileBlob.size,
        fileType: record.fileType ?? '',
        encrypt: shouldEncrypt,
        sponsored,
      })

      if ('alreadyExists' in prepareResult) {
        storeResult(record, i, prepareResult.result)
      }
      else {
        // Chain upload after previous upload completes, but don't await here
        // so the next file's signature can be collected concurrently
        const capturedRecord = record
        const capturedIndex = i
        const prevUpload = pendingUpload
        pendingUpload = prevUpload
          .then(() => executeArweaveUpload(prepareResult))
          .then(result => storeResult(capturedRecord, capturedIndex, result))
          .catch((err) => { uploadError = err; throw err })
      }
    }

    await pendingUpload
  }

  return { prepareArweaveUpload, executeArweaveUpload, uploadToArweave, uploadFileRecordsToArweave }
}
