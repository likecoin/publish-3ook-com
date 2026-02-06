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

  async function uploadToArweave (params: {
    arrayBuffer: ArrayBuffer
    fileSize: number
    fileType: string
    encrypt: boolean
  }): Promise<ArweaveUploadResult> {
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
        arweaveId: existingArweaveId,
        arweaveLink: `${ARWEAVE_ENDPOINT}/${existingArweaveId}`,
        arweaveKey: key,
        ipfsHash
      }
    }

    if (!ETH || !evmAddress) {
      throw new Error('Failed to get Arweave fee estimate')
    }

    const memo = JSON.stringify({
      ipfs: ipfsHash,
      fileSize: buffer.length
    })

    await assertSufficientBalanceForTransfer({
      wallet: wallet.value!,
      to: evmAddress as `0x${string}`,
      value: parseEther(ETH),
      data: `0x${Buffer.from(memo, 'utf-8').toString('hex')}` as `0x${string}`
    })

    const txHash = await sendTransactionAsync({
      to: evmAddress as `0x${string}`,
      value: parseEther(ETH),
      data: `0x${Buffer.from(memo, 'utf-8').toString('hex')}`
    })

    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })
    if (!receipt || receipt.status !== 'success') {
      throw new Error('Arweave fee transaction failed')
    }

    const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(buffer, {
      fileSize: buffer.length,
      ipfsHash,
      fileType: params.fileType,
      txHash,
      token: token.value,
      key
    })

    if (!arweaveId) {
      throw new Error('Failed to upload file to Arweave')
    }

    return { arweaveId, arweaveLink, arweaveKey: key, ipfsHash }
  }

  return { uploadToArweave }
}
