import { useWriteContract } from '@wagmi/vue'
import { readContract, getBalance, waitForTransactionReceipt as wagmiWaitForTransactionReceipt, estimateGas, getGasPrice } from '@wagmi/vue/actions'
import { encodeFunctionData } from 'viem'
import type { Abi, EstimateGasParameters } from 'viem'
import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import { sleep } from '~/utils'

export const useNFTContractWriter = () => {
  const { writeContractAsync } = useWriteContract()
  const { $wagmiConfig: config } = useNuxtApp()
  const { t: $t } = useI18n()
  const toast = useToast()

  const showGasFeeError = (walletAddress: string) => {
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('errors.insufficient_gas_fee'),
      description: $t('errors.insufficient_gas_fee_description'),
      timeout: 0,
      color: 'orange',
      actions: [
        {
          label: $t('errors.contact_support'),
          click: () => {
            if (window.Intercom) {
              window.Intercom('showNewMessage', $t('errors.insufficient_gas_fee_support_message', {
                walletAddress
              }))
            }
          }
        }
      ]
    })
  }

  const checkAndGrantRole = async (
    { classId, wallet }: { classId: string; wallet: string },
    role: string
  ) => {
    const roleData = await readContract(config, {
      abi: LIKE_NFT_CLASS_ABI,
      address: classId as `0x${string}`,
      functionName: role
    })
    const hasRole = await readContract(config, {
      abi: LIKE_NFT_CLASS_ABI,
      address: classId as `0x${string}`,
      functionName: 'hasRole',
      args: [roleData, wallet]
    })
    if (!hasRole) {
      await assertSufficientBalanceForTransaction({
        wallet,
        address: classId as `0x${string}`,
        abi: LIKE_NFT_CLASS_ABI,
        functionName: 'ownerGrantRole',
        args: [roleData, wallet]
      })
      const txHash = await writeContractAsync({
        abi: LIKE_NFT_CLASS_ABI,
        address: classId as `0x${string}`,
        functionName: 'ownerGrantRole',
        args: [roleData, wallet]
      })
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
  const assertPositiveWalletBalance = async ({ wallet }: { wallet: string }) => {
    const balance = await getBalance(config, {
      address: wallet as `0x${string}`
    })
    if (balance.value <= 0n) {
      throw new Error('WALLET_HAS_NO_BASE_ETH_BALANCE')
    }
    return balance
  }

  const assertSufficientBalanceForTransaction = async (params: {
    wallet: string
    address: `0x${string}`
    abi: Abi
    functionName: string
    args?: unknown[]
    value?: bigint
  }) => {
    const data = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args
    })
    await assertSufficientBalanceForTx({
      wallet: params.wallet,
      tx: { to: params.address, data, value: params.value },
      value: params.value
    })
  }

  const waitForTransactionReceipt = async (
    parameters: Parameters<typeof wagmiWaitForTransactionReceipt>[1]
  ) => {
    let receipt
    try {
      receipt = await wagmiWaitForTransactionReceipt(config, parameters)
    } catch (error) {
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
    await assertSufficientBalanceForTx({
      wallet: params.wallet,
      tx: { to: params.to, value: params.value, data: params.data },
      value: params.value
    })
  }

  const assertSufficientBalanceForTx = async (params: {
    wallet: string
    tx: EstimateGasParameters
    value?: bigint
  }) => {
    const { wallet, tx, value } = params
    const hasTo = 'to' in tx
    const hasData = 'data' in tx && (tx as { data?: `0x${string}` | undefined }).data != null
    const defaultGasLimit = hasData ? 1_500_000n : hasTo ? 21000n : 500000n

    const [balanceResult, gasEstimateResult, gasPriceResult] = await Promise.allSettled([
      getBalance(config, { address: wallet as `0x${string}` }),
      estimateGas(config, { ...tx, account: wallet as `0x${string}` }),
      getGasPrice(config)
    ])

    const balance = balanceResult.status === 'fulfilled' ? balanceResult.value : { value: 0n }
    const gasEstimate = gasEstimateResult.status === 'fulfilled' ? gasEstimateResult.value : defaultGasLimit
    const estimatedGasPrice = gasPriceResult.status === 'fulfilled' ? gasPriceResult.value : 1000000000n // 1 gwei fallback for Base

    const estimatedGasCost = gasEstimate * estimatedGasPrice
    // Add a 20% safety buffer to the estimated gas cost to account for gas price volatility
    // and potential differences between estimation time and actual transaction execution.
    const requiredBalance = (estimatedGasCost * 120n) / 100n
    const totalRequired = requiredBalance + (value ?? 0n)

    if (balance.value < totalRequired) {
      showGasFeeError(wallet)
      throw new Error('INSUFFICIENT_GAS_FEE_BALANCE')
    }

    return { balance, gasEstimate, estimatedGasCost, requiredBalance }
  }

  return {
    checkAndGrantUpdater,
    checkAndGrantMinter,
    assertPositiveWalletBalance,
    assertSufficientBalanceForTransaction,
    assertSufficientBalanceForTransfer,
    waitForTransactionReceipt
  }
}
