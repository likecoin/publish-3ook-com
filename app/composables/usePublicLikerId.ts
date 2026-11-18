// The username shown publicly. A rename only writes `handle`; the internal id
// in `user` never moves, so showing `user` would hide the rename.
export function usePublicLikerId() {
  const { userLikerInfo } = storeToRefs(useUserStore())

  const publicLikerId = computed(() => userLikerInfo.value?.handle || userLikerInfo.value?.user || '')
  // The two diverging is what marks the one-time rename as spent.
  const hasLikerIdChanged = computed(() =>
    !!userLikerInfo.value?.handle && userLikerInfo.value.handle !== userLikerInfo.value.user)

  return { publicLikerId, hasLikerIdChanged }
}
