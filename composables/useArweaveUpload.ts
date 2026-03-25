import { useSendTransaction } from '@wagmi/vue'
import { parseEther } from 'viem'
import { estimateBundlrFilePrice, uploadSingleFileToBundlr, canSponsorArweaveUpload } from '~/utils/arweave'
import { encryptDataWithAES } from '~/utils/encryption'
import type { ArweaveEstimate } from '~/types'

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

export type PrepareArweaveUploadResult =
  | PreparedArweaveUpload
  | { alreadyExists: true; result: ArweaveUploadResult }

interface UploadParams {
  arrayBuffer: ArrayBuffer
  fileSize: number
  fileType: string
  encrypt: boolean
  sponsored?: boolean
}

export function useArweaveUpload () {
  const walletStore = useWalletStore()
  const bookstoreApiStore = useBookstoreApiStore()
  const { wallet } = storeToRefs(walletStore)
  const { token } = storeToRefs(bookstoreApiStore)
  const {
    assertSufficientBalanceForTransfer,
    waitForTransactionReceipt
  } = useNFTContractWriter()
  const { sendTransactionAsync } = useSendTransaction()
  const { isSponsoredMode } = useSponsoredTransaction()
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

  async function prepareFileAndEstimate (params: UploadParams): Promise<
    | { alreadyExists: true; result: ArweaveUploadResult }
    | { buffer: Buffer; ipfsHash: string; key?: string; priceResult: ArweaveEstimate }
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
      token: token.value
    })

    const { arweaveId: existingArweaveId } = priceResult

    if (existingArweaveId) {
      return {
        alreadyExists: true,
        result: {
          arweaveId: existingArweaveId,
          arweaveLink: `${ARWEAVE_ENDPOINT}/${existingArweaveId}`,
          arweaveKey: key,
          ipfsHash
        }
      }
    }

    return { buffer, ipfsHash, key, priceResult }
  }

  async function prepareArweaveUploadPaid (params: UploadParams, prepared: { buffer: Buffer; ipfsHash: string; key?: string; priceResult: ArweaveEstimate }): Promise<PreparedArweaveUpload> {
    const { buffer, ipfsHash, key, priceResult } = prepared
    const { evmAddress, ETH } = priceResult

    if (!ETH || !evmAddress) {
      throw new Error('Failed to get Arweave fee estimate')
    }

    await assertSufficientBalanceForTransfer({
      wallet: wallet.value!,
      to: evmAddress as `0x${string}`,
      value: parseEther(ETH)
    })

    const txHash = await sendTransactionAsync({
      to: evmAddress as `0x${string}`,
      value: parseEther(ETH)
    })

    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })
    if (!receipt || receipt.status !== 'success') {
      throw new Error('Arweave fee transaction failed')
    }

    return { txHash, buffer, ipfsHash, key, fileType: params.fileType, fileSize: buffer.length }
  }

  async function prepareArweaveUpload (params: UploadParams): Promise<PrepareArweaveUploadResult> {
    const prepared = await prepareFileAndEstimate(params)
    if ('alreadyExists' in prepared) { return prepared }

    // Explicit sponsored flag (bulk all-or-nothing) takes precedence over auto-detect
    const useSponsored = params.sponsored ?? (
      isSponsoredMode.value &&
      canSponsorArweaveUpload(prepared.priceResult, prepared.buffer.length, 1)
    )

    if (useSponsored) {
      const { buffer, ipfsHash, key } = prepared
      return { buffer, ipfsHash, key, fileType: params.fileType, fileSize: buffer.length, sponsored: true }
    }
    return prepareArweaveUploadPaid(params, prepared)
  }

  async function executeArweaveUpload (prepared: PreparedArweaveUpload): Promise<ArweaveUploadResult> {
    const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(prepared.buffer, {
      fileSize: prepared.fileSize,
      ipfsHash: prepared.ipfsHash,
      fileType: prepared.fileType,
      txHash: prepared.txHash,
      token: token.value,
      key: prepared.key,
      sponsored: prepared.sponsored
    })

    if (!arweaveId) {
      throw new Error('Failed to upload file to Arweave')
    }

    return { arweaveId, arweaveLink, arweaveKey: prepared.key, ipfsHash: prepared.ipfsHash }
  }

  async function uploadToArweave (params: UploadParams): Promise<ArweaveUploadResult> {
    const prepareResult = await prepareArweaveUpload(params)
    if ('alreadyExists' in prepareResult) {
      return prepareResult.result
    }
    return executeArweaveUpload(prepareResult)
  }

  return { prepareArweaveUpload, executeArweaveUpload, uploadToArweave }
}
