import { readContract, getBalance, waitForTransactionReceipt as wagmiWaitForTransactionReceipt, estimateGas, getGasPrice } from '@wagmi/vue/actions'
import { encodeFunctionData, formatEther } from 'viem'
import type { Abi, EstimateGasParameters } from 'viem'
import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import { sleep } from '~/utils'

export const useNFTContractWriter = () => {
  const { writeContractAsync, isSponsoredMode } = useContractWrite()
  const { $wagmiConfig: config } = useNuxtApp()
  const { t: $t } = useI18n()
  const toast = useToast()

  const showGasFeeError = (walletAddress: string, currentBalance: bigint, neededBalance: bigint) => {
    const currentBalanceFormatted = formatEther(currentBalance)
    const neededBalanceFormatted = formatEther(neededBalance)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('errors.insufficient_gas_fee'),
      description: $t('errors.insufficient_gas_fee_description', {
        currentBalance: currentBalanceFormatted,
        neededBalance: neededBalanceFormatted
      }),
      duration: 0,
      color: 'warning',
      actions: [
        {
          label: $t('errors.contact_support'),
          onClick: () => {
            if (window.Intercom) {
              window.Intercom('showNewMessage', $t('errors.insufficient_gas_fee_support_message', {
                walletAddress,
                currentBalance: currentBalanceFormatted,
                neededBalance: neededBalanceFormatted
              }))
            }
          }
        }
      ]
    })
  }

  const checkAndGrantRole = async (
    { classId, wallet }: { classId: string; wallet: string },
    role: 'UPDATER_ROLE' | 'MINTER_ROLE'
  ) => {
    const roleData = await readContract(config, {
      abi: LIKE_NFT_CLASS_ABI,
      address: classId as `0x${string}`,
      functionName: role as 'UPDATER_ROLE'
    })
    const hasRole = await readContract(config, {
      abi: LIKE_NFT_CLASS_ABI,
      address: classId as `0x${string}`,
      functionName: 'hasRole',
      args: [roleData as `0x${string}`, wallet as `0x${string}`]
    })
    if (!hasRole) {
      await assertSufficientBalanceForTransaction({
        wallet,
        address: classId as `0x${string}`,
        abi: LIKE_NFT_CLASS_ABI,
        functionName: 'ownerGrantRole',
        args: [roleData as `0x${string}`, wallet as `0x${string}`]
      })
      const txHash = await writeContractAsync({
        abi: LIKE_NFT_CLASS_ABI,
        address: classId as `0x${string}`,
        functionName: 'ownerGrantRole',
        args: [roleData as `0x${string}`, wallet as `0x${string}`]
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
    // Note: Arweave fee transfers go through wagmi's sendTransactionAsync,
    // which is NOT routed through the sponsored smart wallet — so we must
    // always check balance, even when isSponsoredMode is true.
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
      showGasFeeError(wallet, balance.value, totalRequired)
      throw new Error('INSUFFICIENT_GAS_FEE_BALANCE')
    }

    return { balance, gasEstimate, estimatedGasCost, requiredBalance }
  }

  return {
    checkAndGrantUpdater,
    checkAndGrantMinter,
    assertSufficientBalanceForTransaction,
    assertSufficientBalanceForTransfer,
    waitForTransactionReceipt
  }
}
