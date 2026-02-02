interface StripeConnectStatus {
  hasAccount: boolean
  isReady: boolean
  email?: string
  stripeConnectAccountId?: string
}

function getStripeConnectStatusDefault (): StripeConnectStatus {
  return {
    isReady: false,
    hasAccount: false,
    email: '',
    stripeConnectAccountId: ''
  }
}

export const useStripeStore = defineStore('stripe-connect', () => {
  const { LIKE_CO_API } = useRuntimeConfig().public

  const bookstoreApiStore = useBookstoreApiStore()
  const { token } = storeToRefs(bookstoreApiStore)

  const stripeConnectStatusWalletMap = ref({} as Record<string, StripeConnectStatus>)

  const getStripeConnectStatusByWallet = computed(() => (wallet: string) => {
    return stripeConnectStatusWalletMap.value[wallet] || getStripeConnectStatusDefault()
  })

  async function fetchStripeConnectStatusByWallet (wallet: string) {
    if (!stripeConnectStatusWalletMap.value[wallet]) {
      stripeConnectStatusWalletMap.value[wallet] = getStripeConnectStatusDefault()
    }
    const data = await $fetch<StripeConnectStatus>(`${LIKE_CO_API}/likernft/book/user/connect/status`, {
      headers: {
        authorization: `Bearer ${token.value}`
      },
      query: {
        wallet
      }
    })
    if (!data) {
      return stripeConnectStatusWalletMap.value[wallet]
    }
    stripeConnectStatusWalletMap.value[wallet] = data
    return data
  }

  async function refreshStripeConnectStatus (wallet: string) {
    await fetchStripeConnectStatusByWallet(wallet)

    const currentStatus = stripeConnectStatusWalletMap.value[wallet]

    if (currentStatus?.hasAccount && !currentStatus?.isReady) {
      const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/connect/refresh`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.value}`
        }
      })

      if ((data as any).isReady) {
        stripeConnectStatusWalletMap.value[wallet] = {
          ...currentStatus,
          isReady: true
        }
      }
    }
    return stripeConnectStatusWalletMap.value[wallet]
  }

  return {
    stripeConnectStatusWalletMap,
    getStripeConnectStatusByWallet,
    fetchStripeConnectStatusByWallet,
    refreshStripeConnectStatus
  }
})
