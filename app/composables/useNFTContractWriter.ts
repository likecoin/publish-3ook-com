import { readContract, waitForTransactionReceipt as wagmiWaitForTransactionReceipt } from '@wagmi/vue/actions'
import { encodeFunctionData } from 'viem'
import type { Abi } from 'viem'
import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import { sleep } from '~/utils'

export const useNFTContractWriter = () => {
  const { writeContractAsync, isSponsoredMode } = useContractWrite()
  const { $wagmiConfig: config } = useNuxtApp()
  const { assertSufficientBalanceForTx } = useGasBalanceCheck()

  const checkAndGrantRole = async (
    { classId, wallet }: { classId: string, wallet: string },
    role: 'UPDATER_ROLE' | 'MINTER_ROLE',
  ) => {
    const roleData = await readContract(config, {
      abi: LIKE_NFT_CLASS_ABI,
      address: classId as `0x${string}`,
      functionName: role as 'UPDATER_ROLE',
    })
    const hasRole = await readContract(config, {
      abi: LIKE_NFT_CLASS_ABI,
      address: classId as `0x${string}`,
      functionName: 'hasRole',
      args: [roleData as `0x${string}`, wallet as `0x${string}`],
    })
    if (!hasRole) {
      await assertSufficientBalanceForTransaction({
        wallet,
        address: classId as `0x${string}`,
        abi: LIKE_NFT_CLASS_ABI,
        functionName: 'ownerGrantRole',
        args: [roleData as `0x${string}`, wallet as `0x${string}`],
      })
      const txHash = await writeContractAsync({
        abi: LIKE_NFT_CLASS_ABI,
        address: classId as `0x${string}`,
        functionName: 'ownerGrantRole',
        args: [roleData as `0x${string}`, wallet as `0x${string}`],
      })
      await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })
      // eslint-disable-next-line no-console
      console.log(`Granted ${role} to ${wallet} in class ${classId}. Transaction hash: ${txHash}`)
    }
  }
  const checkAndGrantUpdater = ({ classId, wallet }: { classId: string, wallet: string }) => {
    return checkAndGrantRole({ classId, wallet }, 'UPDATER_ROLE')
  }
  const checkAndGrantMinter = ({ classId, wallet }: { classId: string, wallet: string }) => {
    return checkAndGrantRole({ classId, wallet }, 'MINTER_ROLE')
  }
  const assertSufficientBalanceForTransaction = async (params: {
    wallet: string
    address: `0x${string}`
    abi: Abi
    functionName: string
    args?: unknown[]
    value?: bigint
  }) => {
    if (isSponsoredMode.value) { return }
    const data = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    })
    await assertSufficientBalanceForTx({
      wallet: params.wallet,
      tx: { to: params.address, data, value: params.value },
      value: params.value,
    })
  }

  const waitForTransactionReceipt = async (
    parameters: Parameters<typeof wagmiWaitForTransactionReceipt>[1],
  ) => {
    let receipt
    try {
      receipt = await wagmiWaitForTransactionReceipt(config, parameters)
    }
    catch (error) {
      // Sometimes a TransactionReceiptNotFoundError would be thrown
      // https://github.com/wevm/viem/issues/1056
      await sleep(3000)
      receipt = await wagmiWaitForTransactionReceipt(config, parameters)
    }
    return receipt
  }

  const assertSufficientBalanceForTransfer = async (params: {
    wallet: string
    to: `0x${string}`
    value: bigint
    data?: `0x${string}`
  }) => {
    // Note: Arweave fee transfers go through wagmi's sendTransactionAsync,
    // which is NOT routed through the sponsored smart wallet — so we must
    // always check balance, even when isSponsoredMode is true.
    await assertSufficientBalanceForTx({
      wallet: params.wallet,
      tx: { to: params.to, value: params.value, data: params.data },
      value: params.value,
    })
  }

  return {
    checkAndGrantUpdater,
    checkAndGrantMinter,
    assertSufficientBalanceForTransaction,
    assertSufficientBalanceForTransfer,
    waitForTransactionReceipt,
  }
}
