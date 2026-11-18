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
      if (getApiErrorCode(e) !== 'USER_NOT_FOUND') {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    }
  }

  async function fetchUserLikerInfo() {
    if (!isAuthenticated.value) {
      return null
    }
    try {
      isFetchingUserLikerInfo.value = true
      // The endpoint allows a day of stale-while-revalidate, so a cached copy
      // would show the user's own profile as it was before their edits.
      const likerInfo = await likerStore.fetchLikerInfoByWallet(wallet.value, { nocache: true })
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
  async function updateUserProfile(payload: { displayName?: string, description?: string }) {
    await apiFetch('/users/update', {
      method: 'POST',
      body: payload,
    })
    await fetchUserLikerInfo()
  }

  async function uploadUserAvatar(file: File) {
    const formData = new FormData()
    formData.append('avatarFile', file)
    const data = await apiFetch<{ avatar: string }>('/users/update/avatar', {
      method: 'POST',
      body: formData,
    })
    await fetchUserLikerInfo()
    return data
  }

  // A malformed username also reads as unavailable, so the form checks format itself.
  function checkLikerIdAvailability(likerId: string, options: { signal?: AbortSignal } = {}) {
    return apiFetch<{ handle: string, isAvailable: boolean }>(
      `/users/handle/${encodeURIComponent(likerId)}/available`,
      options,
    )
  }

  // One-time rename of the public username; like the writes above, it needs `write:profile`.
  // The old username stays a permanent alias, so existing links keep resolving.
  async function updateUserLikerId(likerId: string) {
    const { handle } = await apiFetch<{ handle: string }>('/users/handle', {
      method: 'POST',
      body: { handle: likerId },
    })
    // The rename is committed now, so show it even if the refresh below fails.
    if (userLikerInfo.value) {
      userLikerInfo.value.handle = handle
    }
    await fetchUserLikerInfo()
  }

  watch(isAuthenticated, () => {
    if (isAuthenticated.value) {
      // Not the lazy fetch: the store may already hold this user from before sign-in,
      // and the profile may have been edited on 3ook.com since.
      fetchUserLikerInfo()
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
    checkLikerIdAvailability,
    updateUserLikerId,
  }
})
