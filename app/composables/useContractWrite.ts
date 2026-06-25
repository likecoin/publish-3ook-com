import { useConnection, useWriteContract } from '@wagmi/vue'
import { encodeFunctionData, type Abi, type Hash } from 'viem'

import { SponsoredTransactionBroadcastError, type SponsoredWriteContractParams } from './useSponsoredTransaction'

export function useContractWrite() {
  const { writeContractAsync: wagmiWriteContract } = useWriteContract()
  const { ensureMagicSession } = useMagicSession()
  const { isSponsoredMode, sponsoredWriteContract } = useSponsoredTransaction()
  const { hasSufficientBalanceForTx } = useGasBalanceCheck()
  const { address } = useConnection()

  async function writeContractAsync(params: SponsoredWriteContractParams): Promise<Hash> {
    await ensureMagicSession()
    if (isSponsoredMode.value) {
      try {
        return await sponsoredWriteContract(params)
      }
      catch (error) {
        // If the sponsored transaction was already broadcast, retrying it as a
        // direct transaction would double-execute the call. Surface the error
        // instead of falling back.
        if (error instanceof SponsoredTransactionBroadcastError) {
          throw error
        }
        // Sponsored mode users (Magic) usually hold no gas, so falling back to a
        // direct transaction would fail with a misleading "insufficient funds"
        // that buries the real cause (e.g. per-address gas policy limit). Only
        // fall back when the wallet can actually pay its own gas; otherwise
        // surface the original sponsorship error.
        const callData = encodeFunctionData({
          abi: params.abi as Abi,
          functionName: params.functionName,
          args: params.args || [],
        })
        const canSelfPay = !!address.value
          && await hasSufficientBalanceForTx({
            wallet: address.value,
            tx: { to: params.address, data: callData, value: 0n },
          })
        if (!canSelfPay) {
          throw error
        }
        console.warn('[Sponsored TX] Failed but wallet is funded, falling back to direct transaction:', error)
      }
    }
    return wagmiWriteContract(params as Parameters<typeof wagmiWriteContract>[0])
  }

  return { writeContractAsync, isSponsoredMode }
}
