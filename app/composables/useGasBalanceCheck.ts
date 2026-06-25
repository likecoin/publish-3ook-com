import { getBalance, estimateGas, getGasPrice } from '@wagmi/vue/actions'
import { formatEther } from 'viem'
import type { EstimateGasParameters } from 'viem'

// Used only when on-chain estimateGas fails, so the check can still proceed.
const GAS_LIMIT_CONTRACT_CALL = 1_500_000n
const GAS_LIMIT_PLAIN_TRANSFER = 21_000n
const GAS_LIMIT_FALLBACK = 500_000n

interface GasCheckParams {
  wallet: string
  tx: EstimateGasParameters
  value?: bigint
}

export const useGasBalanceCheck = () => {
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
        neededBalance: neededBalanceFormatted,
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
                neededBalance: neededBalanceFormatted,
              }))
            }
          },
        },
      ],
    })
  }

  const evaluateBalanceForTx = async ({ wallet, tx, value }: GasCheckParams) => {
    const hasData = 'data' in tx && (tx as { data?: `0x${string}` | undefined }).data != null
    let defaultGasLimit = GAS_LIMIT_FALLBACK
    if (hasData) defaultGasLimit = GAS_LIMIT_CONTRACT_CALL
    else if ('to' in tx) defaultGasLimit = GAS_LIMIT_PLAIN_TRANSFER

    const [balanceResult, gasEstimateResult, gasPriceResult] = await Promise.allSettled([
      getBalance(config, { address: wallet as `0x${string}` }),
      estimateGas(config, { ...tx, account: wallet as `0x${string}` }),
      getGasPrice(config),
    ])

    const balance = balanceResult.status === 'fulfilled' ? balanceResult.value : { value: 0n }
    const gasEstimate = gasEstimateResult.status === 'fulfilled' ? gasEstimateResult.value : defaultGasLimit
    const estimatedGasPrice = gasPriceResult.status === 'fulfilled' ? gasPriceResult.value : 1000000000n // 1 gwei fallback for Base

    const estimatedGasCost = gasEstimate * estimatedGasPrice
    // Add a 20% safety buffer to the estimated gas cost to account for gas price volatility
    // and potential differences between estimation time and actual transaction execution.
    const requiredBalance = (estimatedGasCost * 120n) / 100n
    // Fall back to tx.value so a caller that sets the transfer amount only on
    // the tx (for estimateGas) doesn't under-count the required balance.
    const txValue = ('value' in tx ? (tx as { value?: bigint }).value : undefined) ?? 0n
    const totalRequired = requiredBalance + (value ?? txValue)

    return {
      balance,
      totalRequired,
      hasSufficient: balance.value >= totalRequired,
    }
  }

  const hasSufficientBalanceForTx = async (params: GasCheckParams) => {
    const { hasSufficient } = await evaluateBalanceForTx(params)
    return hasSufficient
  }

  const assertSufficientBalanceForTx = async (params: GasCheckParams) => {
    const { balance, totalRequired, hasSufficient } = await evaluateBalanceForTx(params)
    if (!hasSufficient) {
      showGasFeeError(params.wallet, balance.value, totalRequired)
      throw new Error('INSUFFICIENT_GAS_FEE_BALANCE')
    }
  }

  return {
    showGasFeeError,
    hasSufficientBalanceForTx,
    assertSufficientBalanceForTx,
  }
}
