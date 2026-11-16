// The username shown publicly. A rename only writes `handle`; the internal id
// in `user` never moves, so showing `user` would hide the rename.
export function usePublicLikerId() {
  const { userLikerInfo } = storeToRefs(useUserStore())

  const publicLikerId = computed(() => userLikerInfo.value?.handle || userLikerInfo.value?.user || '')

  return { publicLikerId }
}
