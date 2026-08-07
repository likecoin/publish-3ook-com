export interface BookUserProfile {
  notificationEmail?: string | null
  isEmailVerified?: boolean
}

export const useUserStore = defineStore('user', () => {
  const apiFetch = useLikeCoApiFetch()

  const bookstoreApiStore = useBookstoreApiStore()
  const { isAuthenticated, wallet } = storeToRefs(bookstoreApiStore)
  const likerStore = useLikerStore()

  const bookUser = ref<BookUserProfile | null>(null)
  const userLikerInfo = computed(() => {
    if (isAuthenticated.value && wallet.value) {
      return likerStore.getLikerInfoByWallet(wallet.value)
    }
    return null
  })
  const isFetchingUserLikerInfo = ref(false)

  async function fetchBookUserProfile() {
    const data = await apiFetch<BookUserProfile>('/likernft/book/user/profile')
    bookUser.value = data
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

  // Both writes need `write:profile` in the session token, hence the
  // `canEditProfile` gate on the UI that calls them.
  async function updateUserProfile(payload: { displayName: string }) {
    await apiFetch('/users/update', {
      method: 'POST',
      body: payload,
    })
    await fetchUserLikerInfo({ nocache: true })
  }

  async function uploadUserAvatar(file: File) {
    const formData = new FormData()
    formData.append('avatarFile', file)
    const data = await apiFetch<{ avatar: string }>('/users/update/avatar', {
      method: 'POST',
      body: formData,
    })
    await fetchUserLikerInfo({ nocache: true })
    return data
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
    updateUserProfile,
    uploadUserAvatar,
  }
})
