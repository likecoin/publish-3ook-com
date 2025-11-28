import { http, createConfig, type Config, type CreateConnectorFn } from '@wagmi/core'
import { base, baseSepolia } from '@wagmi/vue/chains'
import { injected } from '@wagmi/vue/connectors'
import { dedicatedWalletConnector } from '@likecoin/wagmi-connector'

export function createWagmiConfig ({
  apiKey,
  customLogoURL,
  isServer = false,
  isTestnet = false
}: {
  apiKey: string
  customLogoURL?: string
  isServer?: boolean
  isTestnet?: boolean
}): Config {
  const chain = isTestnet ? baseSepolia : base
  return createConfig({
    chains: [chain],
    connectors: [
      // NOTE: @magiclabs/wagmi-connector is not compatible with SSR
      // https://github.com/magiclabs/wagmi-magic-connector/issues/42#issuecomment-2771613002
      ...(isServer
        ? []
        : [dedicatedWalletConnector({
          chains: [chain],
          options: {
            apiKey,
            accentColor: '#131313',
            customHeaderText: '3ook.com',
            customLogo: customLogoURL,
            isDarkMode: false,
            magicSdkConfiguration: {
              network: {
                rpcUrl: chain.rpcUrls.default.http[0],
                chainId: chain.id
              }
            }
          }
        }) as CreateConnectorFn]),
      injected()
    ],
    ssr: true,
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http()
    }
  })
}

declare module '@wagmi/vue' {
  interface Register {
    config: Config
  }
}
