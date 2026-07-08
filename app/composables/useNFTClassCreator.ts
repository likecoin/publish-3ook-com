import { parseEventLogs } from 'viem'
import { LIKE_NFT_ABI } from '~/contracts/likeNFT'
import { DEFAULT_MAX_SUPPLY } from '~/constant'
import { formatISCNTxPayload, buildBookClassMetadata } from '~/utils/iscn'
import type { ISCNFormData, MsgNewBookNFT } from '~/types/iscn'

export function useNFTClassCreator() {
  const walletStore = useWalletStore()
  const { wallet } = storeToRefs(walletStore)
  const {
    assertSufficientBalanceForTransaction,
    waitForTransactionReceipt,
  } = useNFTContractWriter()
  const { writeContractAsync } = useContractWrite()
  const { precomputeBookNFTAddress } = useNFTContractReader()
  const {
    LIKE_NFT_CONTRACT_ADDRESS,
    LIKE_EVM_NFT_TARGET_ADDRESS,
  } = useRuntimeConfig().public

  // Builds the deterministic newBookNFT message struct from the ISCN form. The
  // salt is content-derived (see computeISCNSalt), so both the on-chain deploy
  // and precomputeBookNFTAddress resolve to the same class address.
  function buildNewBookNFTMessage(iscnFormData: Ref<ISCNFormData>): { salt: `0x${string}`, msgNewBookNFT: MsgNewBookNFT } {
    const { payload, computeISCNSalt } = useISCN({ iscnFormData })
    const contentMetadata = formatISCNTxPayload(payload.value)
    const metadata = buildBookClassMetadata(contentMetadata)
    const salt = computeISCNSalt(wallet.value!)
    const msgNewBookNFT: MsgNewBookNFT = {
      creator: wallet.value!,
      updaters: [wallet.value!, LIKE_EVM_NFT_TARGET_ADDRESS] as `0x${string}`[],
      minters: [wallet.value!, LIKE_EVM_NFT_TARGET_ADDRESS] as `0x${string}`[],
      config: {
        name: metadata.name,
        symbol: 'BOOK',
        metadata: JSON.stringify(metadata),
        max_supply: DEFAULT_MAX_SUPPLY,
      },
    }
    return { salt, msgNewBookNFT }
  }

  // Precomputes the deterministic class address without deploying. See
  // recoverDeployedClassId for how it's used to resume a lost class creation.
  async function predictClassId(iscnFormData: Ref<ISCNFormData>): Promise<`0x${string}`> {
    const { salt, msgNewBookNFT } = buildNewBookNFTMessage(iscnFormData)
    return precomputeBookNFTAddress(salt, msgNewBookNFT)
  }

  async function createNFTClass(params: {
    iscnFormData: Ref<ISCNFormData>
  }): Promise<{ classId: string, txHash: string }> {
    const { salt, msgNewBookNFT } = buildNewBookNFTMessage(params.iscnFormData)

    const txParams = {
      address: LIKE_NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: LIKE_NFT_ABI,
      functionName: 'newBookNFT' as const,
      args: [salt, msgNewBookNFT, 500],
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value!,
      ...txParams,
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })

    if (!receipt || receipt.status !== 'success') {
      throw new Error('NFT class creation failed')
    }

    const [bookNFTLog] = parseEventLogs({
      abi: LIKE_NFT_ABI,
      logs: receipt.logs,
      eventName: 'NewBookNFT',
      strict: false,
    })

    const classId = bookNFTLog?.args?.bookNFT?.toLowerCase()
    if (!classId) {
      throw new Error('NewBookNFT event not found in receipt')
    }
    return { classId, txHash }
  }

  return { createNFTClass, predictClassId }
}
