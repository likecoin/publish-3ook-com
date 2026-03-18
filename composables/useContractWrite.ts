import { useWriteContract } from '@wagmi/vue'
import type { Hash } from 'viem'

export function useContractWrite () {
  const { writeContractAsync: wagmiWriteContract } = useWriteContract()
  const { ensureMagicSession } = useMagicSession()

  async function writeContractAsync (params: Parameters<typeof wagmiWriteContract>[0]): Promise<Hash> {
    await ensureMagicSession()
    return wagmiWriteContract(params)
  }

  return { writeContractAsync }
}
