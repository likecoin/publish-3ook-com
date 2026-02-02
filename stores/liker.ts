import type { FetchLikerInfoResult } from '../utils/api'

export const useLikerStore = defineStore('liker', () => {
  const likerInfoMapById = ref({} as Record<string, FetchLikerInfoResult>)

  const likerIdMapByWallet = computed(() => {
    return Object.entries(likerInfoMapById.value).reduce((acc, [likerId, likerInfo]) => {
      acc[likerInfo.likeWallet] = likerId
      acc[likerInfo.evmWallet] = likerId
      return acc
    }, {} as Record<string, string>)
  })

  const getLikerInfoById = computed(() => (likerId: string) => {
    return likerInfoMapById.value[likerId] || null
  })

  const getLikerInfoByWallet = computed(() => (wallet: string) => {
    const likerId = likerIdMapByWallet.value[wallet]
    return likerId ? getLikerInfoById.value(likerId) : null
  })

  const getChannelInfoById = computed(() => (channelId: string) => {
    const likerId = convertChannelIdToLikerId(channelId)
    return getLikerInfoById.value(likerId)
  })

  async function fetchLikerInfoById (likerId: string) {
    try {
      const result = await useFetchLikerInfoById(likerId)
      const likerInfo = result
      if (!likerInfo) {
        throw new Error('Missing data in `fetchLikerInfoById`')
      }
      likerInfoMapById.value[likerId] = likerInfo
      return likerInfo
    } catch {
      return null
    }
  }

  async function lazyFetchLikerInfoById (likerId: string) {
    if (likerInfoMapById.value[likerId]) {
      return likerInfoMapById.value[likerId]
    }

    const likerInfo = await fetchLikerInfoById(likerId)
    return likerInfo
  }

  async function fetchLikerInfoByWallet (wallet: string, { nocache = false } = {}) {
    try {
      const result = await useFetchLikerInfoByWallet(wallet, { nocache })
      const likerInfo = result
      if (!likerInfo) {
        throw new Error('Missing data in `fetchLikerInfoByWallet`')
      }
      likerInfoMapById.value[likerInfo.user] = likerInfo
      return likerInfo
    } catch {
      return null
    }
  }

  async function lazyFetchLikerInfoByWallet (wallet: string) {
    const likerId = likerIdMapByWallet.value[wallet]
    if (likerId) {
      return lazyFetchLikerInfoById(likerId)
    }

    const likerInfo = await fetchLikerInfoByWallet(wallet)
    return likerInfo
  }

  async function lazyFetchChannelInfoById (channelId: string) {
    const likerId = convertChannelIdToLikerId(channelId)
    const result = await lazyFetchLikerInfoById(likerId)
    return result
  }

  return {
    likerInfoMapById,
    likerIdMapByWallet,
    getLikerInfoById,
    getLikerInfoByWallet,
    getChannelInfoById,
    fetchLikerInfoById,
    lazyFetchLikerInfoById,
    fetchLikerInfoByWallet,
    lazyFetchLikerInfoByWallet,
    lazyFetchChannelInfoById
  }
})
