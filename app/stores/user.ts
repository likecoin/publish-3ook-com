export const useUserStore = defineStore('user', () => {
  const apiFetch = useLikeCoApiFetch()

  const bookstoreApiStore = useBookstoreApiStore()
  const { isAuthenticated, wallet } = storeToRefs(bookstoreApiStore)
  const likerStore = useLikerStore()

  const bookUser = ref<Record<string, unknown> | null>(null)
  const userLikerInfo = computed(() => {
    if (isAuthenticated.value && wallet.value) {
      return likerStore.getLikerInfoByWallet(wallet.value)
    }
    return null
  })
  const isFetchingUserLikerInfo = ref(false)

  async function fetchBookUserProfile() {
    const data = await apiFetch('/likernft/book/user/profile')
    bookUser.value = data as Record<string, unknown>
    return bookUser.value
  }

  async function lazyFetchBookUserProfile() {
    if (bookUser.value) {
      return bookUser.value
    }
    try {
      const user = await fetchBookUserProfile()
      return user
    }
    catch (e: unknown) {
      if ((e as Error).message !== 'USER_NOT_FOUND') {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    }
  }

  async function fetchUserLikerInfo({ nocache = false } = {}) {
    if (!isAuthenticated.value) {
      return null
    }
    try {
      isFetchingUserLikerInfo.value = true
      const likerInfo = await likerStore.fetchLikerInfoByWallet(wallet.value, { nocache })
      return likerInfo
    }
    finally {
      isFetchingUserLikerInfo.value = false
    }
  }

  async function lazyFetchUserLikerInfo() {
    if (!isAuthenticated.value) {
      return null
    }
    if (userLikerInfo.value) {
      return userLikerInfo.value
    }
    const likerInfo = await fetchUserLikerInfo()
    return likerInfo
  }

  watch(isAuthenticated, () => {
    if (isAuthenticated.value) {
      lazyFetchUserLikerInfo()
      lazyFetchBookUserProfile()
    }
    else {
      bookUser.value = null
    }
  })

  return {
    bookUser,
    userLikerInfo,
    isFetchingUserLikerInfo,
    fetchBookUserProfile,
    lazyFetchBookUserProfile,
    fetchUserLikerInfo,
    lazyFetchUserLikerInfo,
  }
})
