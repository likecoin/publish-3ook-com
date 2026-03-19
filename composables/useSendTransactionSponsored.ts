import { useSendTransaction } from '@wagmi/vue'
import type { Hash } from 'viem'

import type { SponsoredSendTransactionParams } from './useSponsoredTransaction'

export function useSendTransactionSponsored () {
  const { sendTransactionAsync: wagmiSendTransaction } = useSendTransaction()
  const { ensureMagicSession } = useMagicSession()
  const { isSponsoredMode, sponsoredSendTransaction } = useSponsoredTransaction()

  async function sendTransactionAsync (params: SponsoredSendTransactionParams): Promise<Hash> {
    await ensureMagicSession()
    if (isSponsoredMode.value) {
      try {
        return await sponsoredSendTransaction(params)
      } catch (error) {
        console.warn('[Sponsored TX] Send failed, falling back to direct transaction:', error)
      }
    }
    return wagmiSendTransaction(params)
  }

  return { sendTransactionAsync, isSponsoredMode }
}
