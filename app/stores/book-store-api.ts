import { jwtDecode } from 'jwt-decode'
import type { AuthResponse, BookListingItem, BookListingResponse } from '~/utils/api'

export const useBookstoreApiStore = defineStore('book-api', () => {
  const apiFetch = useLikeCoApiFetch()
  const token = ref('')
  const sessionWallet = ref('')
  const intercomToken = ref('')
  const isShowLoginPanel = ref(false)

  const listingList = ref([] as BookListingItem[])
  const moderatedBookList = ref([] as BookListingItem[])
  const getTotalPendingNFTCount = computed(() => listingList.value.reduce((acc, item) => acc + (item.pendingNFTCount || 0), 0))

  const isAuthenticated = computed(() => {
    const tokenExists = !!token.value
    if (!sessionWallet.value || !tokenExists) { return false }
    const decoded = jwtDecode(token.value)
    if (!decoded) {
      return false
    }
    const isExpired = decoded.exp && decoded.exp * 1000 < Date.now()
    return !isExpired
  })

  function clearSession() {
    token.value = ''
    sessionWallet.value = ''
    isShowLoginPanel.value = false
    clearAuthSession()
  }

  function openLoginPanel() {
    isShowLoginPanel.value = true
  }

  function closeLoginPanel() {
    isShowLoginPanel.value = false
  }

  function restoreAuthSession() {
    try {
      const session = loadAuthSession()
      if (!session) { return }

      const { token: sessionToken, wallet, intercomToken: sessionIntercomToken } = session

      if (!checkJwtTokenValidity(sessionToken)) {
        throw new Error('INVALID_TOKEN')
      }

      token.value = sessionToken
      sessionWallet.value = wallet
      intercomToken.value = sessionIntercomToken
    }
    catch {}
  }

  async function authenticate(inputWallet: string, signature: { signature: string, message: string, wallet: string, signMethod: string, expiresIn: string }) {
    const data = await apiFetch<AuthResponse>('/wallet/authorize', {
      method: 'POST',
      body: {
        ...signature,
      },
    })
    if (!data?.token) { throw new Error('INVALID_SIGNATURE') }
    token.value = data.token
    intercomToken.value = data.intercomToken
    sessionWallet.value = inputWallet
    saveAuthSession({ wallet: inputWallet, token: token.value, intercomToken: intercomToken.value })
  }

  async function fetchBookListing(params: { key?: number, limit?: number } = {}) {
    const qsPayload: Record<string, string | number> = {
      wallet: sessionWallet.value,
      limit: params.limit || 100,
      chain: 'base',
    }
    if (params.key) {
      qsPayload.key = params.key
    }
    const data = await apiFetch<BookListingResponse>(`/likernft/book/store/list?${Object.entries(qsPayload).map(([key, value]) => `${key}=${value}`).join('&')}`)

    const { nextKey, list = [] } = data || {}
    if (params.key) {
      listingList.value.push(...list)
    }
    else {
      listingList.value = list
    }

    if (nextKey) {
      return fetchBookListing({ key: nextKey })
    }
  }

  async function fetchModeratedBookList(params: { key?: number, limit?: number } = {}) {
    const qsPayload: Record<string, string | number> = {
      wallet: sessionWallet.value,
      limit: params.limit || 100,
      chain: 'base',
    }
    if (params.key) {
      qsPayload.key = params.key
    }
    const data = await apiFetch<BookListingResponse>(`/likernft/book/store/list/moderated?${Object.entries(qsPayload).map(([key, value]) => `${key}=${value}`).join('&')}`)
    moderatedBookList.value = data?.list || []
  }

  function reduceListingPendingNFTCountById(classId: string, count: number) {
    const targetIndex = listingList.value.findIndex(item => item.classId === classId)
    if (targetIndex === -1) {
      return
    }
    const targetItem = listingList.value[targetIndex]
    if (targetItem && targetItem.pendingNFTCount !== undefined) {
      targetItem.pendingNFTCount -= count
    }
  }

  async function newBookListing(classId: string, payload: Record<string, unknown>) {
    const data = await apiFetch(`/likernft/book/store/${classId}/new`, {
      method: 'POST',
      body: payload,
    })
    return data
  }

  async function updateBookListingSetting(classId: string, payload: Record<string, unknown>) {
    const data = await apiFetch(`/likernft/book/store/${classId}/settings`, {
      method: 'POST',
      body: payload,
    })
    return data
  }

  async function updateEditionPrice(classId: string, priceIndex: number | string, payload: Record<string, unknown>) {
    const data = await apiFetch(`/likernft/book/store/${classId}/price/${priceIndex}`, {
      method: 'PUT',
      body: payload,
    })
    return data
  }

  async function addEditionPrice(classId: string, priceIndex: string, payload: Record<string, unknown>) {
    const data = await apiFetch(`/likernft/book/store/${classId}/price/${priceIndex}`, {
      method: 'POST',
      body: payload,
    })
    return data
  }

  async function refreshBookMetadata(classId: string) {
    const data = await apiFetch(`/likernft/book/store/class/${classId}/refresh`, {
      method: 'POST',
    })
    return data
  }

  async function uploadSignImages(payload: FormData, classId: string) {
    const data = await apiFetch(`/likernft/book/store/${classId}/image/upload`, {
      method: 'POST',
      body: payload,
    })
    return data
  }

  return {
    token,
    wallet: sessionWallet,
    intercomToken,
    listingList,
    moderatedBookList,
    getTotalPendingNFTCount,
    isAuthenticated,
    isShowLoginPanel,
    clearSession,
    openLoginPanel,
    closeLoginPanel,
    restoreAuthSession,
    authenticate,
    fetchBookListing,
    fetchModeratedBookList,
    reduceListingPendingNFTCountById,
    newBookListing,
    updateBookListingSetting,
    updateEditionPrice,
    addEditionPrice,
    refreshBookMetadata,
    uploadSignImages,
  }
})
