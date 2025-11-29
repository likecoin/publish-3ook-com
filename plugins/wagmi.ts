import { WagmiPlugin, type Config } from '@wagmi/vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { defineNuxtPlugin } from 'nuxt/app'

import { createWagmiConfig } from '../utils/wagmi/config'

// NOTE: Possibly will move to @wagmi/vue/nuxt nitro plugin
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const wagmiConfig = createWagmiConfig({
    apiKey: config.public.MAGIC_LINK_API_KEY,
    customLogoURL: config.public.MAGIC_LINK_CUSTOM_LOGO_URL,
    walletConnectProjectId: config.public.WALLET_CONNECT_PROJECT_ID,
    isServer: !!nuxtApp.ssrContext,
    isTestnet: !!config.public.IS_TESTNET
  })

  nuxtApp.vueApp
    .use(WagmiPlugin, {
      config: wagmiConfig as Config
    })
    .use(VueQueryPlugin, {})

  return {
    provide: {
      wagmiConfig
    }
  }
})
