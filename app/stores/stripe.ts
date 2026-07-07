import type { StripeRefreshResponse } from '~/utils/api'

interface StripeConnectStatus {
  hasAccount: boolean
  isReady: boolean
  email?: string
  stripeConnectAccountId?: string
}

function getStripeConnectStatusDefault(): StripeConnectStatus {
  return {
    isReady: false,
    hasAccount: false,
    email: '',
    stripeConnectAccountId: '',
  }
}

export const useStripeStore = defineStore('stripe-connect', () => {
  const apiFetch = useLikeCoApiFetch()

  const stripeConnectStatusWalletMap = ref({} as Record<string, StripeConnectStatus>)

  const getStripeConnectStatusByWallet = computed(() => (wallet: string) => {
    return stripeConnectStatusWalletMap.value[wallet] || getStripeConnectStatusDefault()
  })

  async function fetchStripeConnectStatusByWallet(wallet: string) {
    if (!stripeConnectStatusWalletMap.value[wallet]) {
      stripeConnectStatusWalletMap.value[wallet] = getStripeConnectStatusDefault()
    }
    const data = await apiFetch<StripeConnectStatus>('/likernft/book/user/connect/status', {
      query: {
        wallet,
      },
    })
    if (!data) {
      return stripeConnectStatusWalletMap.value[wallet]
    }
    stripeConnectStatusWalletMap.value[wallet] = data
    return data
  }

  async function refreshStripeConnectStatus(wallet: string) {
    await fetchStripeConnectStatusByWallet(wallet)

    const currentStatus = stripeConnectStatusWalletMap.value[wallet]

    if (currentStatus?.hasAccount && !currentStatus?.isReady) {
      const data = await apiFetch<StripeRefreshResponse>('/likernft/book/user/connect/refresh', {
        method: 'POST',
      })

      if (data.isReady) {
        stripeConnectStatusWalletMap.value[wallet] = {
          ...currentStatus,
          isReady: true,
        }
      }
    }
    return stripeConnectStatusWalletMap.value[wallet]
  }

  return {
    stripeConnectStatusWalletMap,
    getStripeConnectStatusByWallet,
    fetchStripeConnectStatusByWallet,
    refreshStripeConnectStatus,
  }
})
