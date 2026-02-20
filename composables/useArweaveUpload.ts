import { useSendTransaction } from '@wagmi/vue'
import { parseEther } from 'viem'
import { estimateBundlrFilePrice, uploadSingleFileToBundlr } from '~/utils/arweave'
import { encryptDataWithAES } from '~/utils/encryption'

export interface ArweaveUploadResult {
  arweaveId: string
  arweaveLink: string
  ipfsHash: string
  arweaveKey?: string
}

export interface PreparedArweaveUpload {
  txHash: string
  buffer: Buffer
  ipfsHash: string
  key?: string
  fileType: string
  fileSize: number
}

export type PrepareArweaveUploadResult =
  | PreparedArweaveUpload
  | { alreadyExists: true; result: ArweaveUploadResult }

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
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

  async function prepareArweaveUpload (params: {
    arrayBuffer: ArrayBuffer
    fileSize: number
    fileType: string
    encrypt: boolean
  }): Promise<PrepareArweaveUploadResult> {
    let buffer = Buffer.from(params.arrayBuffer)
    let ipfsHash = await calculateIPFSHash(buffer) || ''
    let key: string | undefined

    if (params.encrypt) {
      const { rawEncryptedKeyAsBase64, combinedArrayBuffer } = await encryptDataWithAES({ data: params.arrayBuffer })
      buffer = Buffer.from(combinedArrayBuffer)
      ipfsHash = await calculateIPFSHash(buffer) || ''
      key = rawEncryptedKeyAsBase64
    }

    const priceResult = await estimateBundlrFilePrice({
      fileSize: buffer.length,
      ipfsHash: params.encrypt ? undefined : ipfsHash
    })

    const { evmAddress, arweaveId: existingArweaveId, ETH } = priceResult

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

  async function executeArweaveUpload (prepared: PreparedArweaveUpload): Promise<ArweaveUploadResult> {
    const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(prepared.buffer, {
      fileSize: prepared.fileSize,
      ipfsHash: prepared.ipfsHash,
      fileType: prepared.fileType,
      txHash: prepared.txHash,
      token: token.value,
      key: prepared.key
    })

    if (!arweaveId) {
      throw new Error('Failed to upload file to Arweave')
    }

    return { arweaveId, arweaveLink, arweaveKey: prepared.key, ipfsHash: prepared.ipfsHash }
  }

  async function uploadToArweave (params: {
    arrayBuffer: ArrayBuffer
    fileSize: number
    fileType: string
    encrypt: boolean
  }): Promise<ArweaveUploadResult> {
    const prepareResult = await prepareArweaveUpload(params)
    if ('alreadyExists' in prepareResult) {
      return prepareResult.result
    }
    return executeArweaveUpload(prepareResult)
  }

  return { prepareArweaveUpload, executeArweaveUpload, uploadToArweave }
}
