import { useConnection } from '@wagmi/vue'
import { encodeFunctionData, createWalletClient, custom, type Abi, type Address, type Hash } from 'viem'
import { toRaw } from 'vue'
import type { Magic } from 'magic-sdk'

export interface SponsoredWriteContractParams {
  address: Address
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}

/**
 * Thrown when a sponsored transaction has already been broadcast (sendCalls
 * resolved) but we failed to read back its status/receipt. The transaction may
 * well have executed on-chain, so the caller MUST NOT retry it via a direct
 * transaction — doing so double-executes the call (e.g. a second mint of an
 * already-minted tokenId, which reverts).
 */
export class SponsoredTransactionBroadcastError extends Error {
  callsId?: string
  constructor(message: string, options?: { cause?: unknown, callsId?: string }) {
    super(message)
    this.name = 'SponsoredTransactionBroadcastError'
    this.cause = options?.cause
    this.callsId = options?.callsId
  }
}

let alchemyModules: Awaited<ReturnType<typeof loadAlchemyModules>> | null = null
let cachedSmartWalletClient: any | null = null
let cachedMagicInstance: Magic | null = null
let pendingClientCreation: Promise<any> | null = null

async function loadAlchemyModules() {
  const [aaSdk, infra, walletClient] = await Promise.all([
    import('@aa-sdk/core'),
    import('@account-kit/infra'),
    import('@account-kit/wallet-client'),
  ])
  return {
    WalletClientSigner: aaSdk.WalletClientSigner,
    alchemy: infra.alchemy,
    base: infra.base,
    baseSepolia: infra.baseSepolia,
    createSmartWalletClient: walletClient.createSmartWalletClient,
  }
}

function clearSponsoredClientCache() {
  cachedSmartWalletClient = null
  cachedMagicInstance = null
  pendingClientCreation = null
}

export function useSponsoredTransaction() {
  const config = useRuntimeConfig()
  const { address, connector } = useConnection()

  const alchemyApiKey = computed(() => (config.public.CUSTOM_RPC_URL as string)?.split('/v2/')[1])

  const isLoginWithMagic = computed(() => connector.value?.id === 'magic')

  const isSponsoredMode = computed(() =>
    !!isLoginWithMagic.value
    && !!alchemyApiKey.value
    && !!config.public.ALCHEMY_GAS_POLICY_ID,
  )

  function getMagicInstance(): Promise<Magic> {
    const c = toRaw(connector.value) as any
    if (!c) {
      throw new Error('Magic connector not available')
    }
    if (c.magic) {
      return Promise.resolve(toRaw(c.magic) as Magic)
    }
    if (typeof c.getMagic === 'function') {
      return c.getMagic() as Promise<Magic>
    }
    throw new Error('Magic connector not available')
  }

  async function createSmartWalletClient() {
    const magic = await getMagicInstance()

    if (!alchemyModules) {
      alchemyModules = await loadAlchemyModules()
    }
    const { WalletClientSigner, alchemy, base, baseSepolia, createSmartWalletClient: create } = alchemyModules

    const alchemyChain = config.public.IS_TESTNET ? baseSepolia : base
    const apiKey = alchemyApiKey.value!

    const walletClient = createWalletClient({
      chain: alchemyChain,
      transport: custom(magic.rpcProvider as any),
    })

    const baseSigner = new WalletClientSigner(walletClient, 'magic')
    const signer = {
      ...baseSigner,
      signAuthorization: async (unsignedAuth: any): Promise<any> => {
        const signature = await (magic.wallet as any).sign7702Authorization({
          ...unsignedAuth,
          contractAddress: unsignedAuth.address ?? unsignedAuth.contractAddress,
        })
        return { ...unsignedAuth, ...signature }
      },
    }

    const policyId = config.public.ALCHEMY_GAS_POLICY_ID as string
    cachedSmartWalletClient = create({
      chain: alchemyChain,
      transport: alchemy({ apiKey }),
      signer: signer as any,
      ...(policyId ? { policyId } : {}),
    })
    cachedMagicInstance = magic

    return cachedSmartWalletClient
  }

  async function getOrCreateSmartWalletClient() {
    const magic = await getMagicInstance()

    if (cachedSmartWalletClient && cachedMagicInstance === magic) {
      return cachedSmartWalletClient
    }

    if (pendingClientCreation) {
      return pendingClientCreation
    }

    pendingClientCreation = createSmartWalletClient().finally(() => {
      pendingClientCreation = null
    })
    return pendingClientCreation
  }

  async function sponsoredWriteContract(params: SponsoredWriteContractParams): Promise<Hash> {
    if (!address.value) {
      throw new Error('No connected account')
    }

    // Pre-broadcast phase: failures here mean nothing was submitted, so the
    // caller is free to fall back to a direct transaction.
    let client: any
    let result: { id: string }
    try {
      client = await getOrCreateSmartWalletClient()

      const callData = encodeFunctionData({
        abi: params.abi as Abi,
        functionName: params.functionName,
        args: params.args || [],
      })

      result = await client.sendCalls({
        from: address.value,
        calls: [{
          to: params.address,
          data: callData,
          value: '0x0' as `0x${string}`,
        }],
        capabilities: {
          eip7702Auth: true,
        },
      })
    }
    catch (error) {
      clearSponsoredClientCache()
      throw error
    }

    // Post-broadcast phase: the calls have been submitted. If we can't confirm
    // the status, surface a dedicated error so the caller does NOT re-submit.
    try {
      const status = await client.waitForCallsStatus({ id: result.id })
      const txHash = status.receipts?.[0]?.transactionHash as Hash | undefined
      if (!txHash) {
        throw new Error('no receipt returned')
      }
      return txHash
    }
    catch (error) {
      clearSponsoredClientCache()
      throw new SponsoredTransactionBroadcastError(
        'Sponsored transaction was broadcast but its status could not be confirmed',
        { cause: error, callsId: result.id },
      )
    }
  }

  watch(isSponsoredMode, (newVal) => {
    if (!newVal) {
      clearSponsoredClientCache()
    }
  })

  return {
    isSponsoredMode,
    sponsoredWriteContract,
  }
}
