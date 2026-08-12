import type { ClassMetadata } from '~/types/iscn'
import type { ProductData } from '~/types'

export const useNftStore = defineStore('nft', () => {
  const { LIKE_CO_API } = useRuntimeConfig().public
  const classMetadataByIdMap = ref({} as Record<string, ClassMetadata | null>)
  const classListingInfoByIdMap = ref({} as Record<string, Record<string, unknown>>)

  const getClassMetadataById = computed(() => (classId: string) => classMetadataByIdMap.value[classId])

  const getClassListingInfoById = computed(() => (classId: string) => classListingInfoByIdMap.value[classId])

  const getClassNameById = computed(() => (classId: string) => {
    const metadataName = classMetadataByIdMap.value[classId]?.name
    if (metadataName) { return metadataName }
    const listingName = classListingInfoByIdMap.value[classId]?.name as ProductData['name']
    return (typeof listingName === 'object' ? (listingName?.zh || listingName?.en) : listingName) || undefined
  })

  async function fetchClassMetadataById(classId: string) {
    const { getClassMetadata } = useNFTContractReader()
    const classData = await getClassMetadata(classId)
    classMetadataByIdMap.value[classId] = classData
    return classData
  }

  // Only resolved values are cached above, so without this several components
  // mounting at once each fire the same on-chain read before the first returns.
  const classMetadataPromiseByIdMap = new Map<string, ReturnType<typeof fetchClassMetadataById>>()

  function lazyFetchClassMetadataById(classId: string) {
    const cached = getClassMetadataById.value(classId)
    if (cached) { return cached }
    const pending = classMetadataPromiseByIdMap.get(classId)
    if (pending) { return pending }
    const request = fetchClassMetadataById(classId)
      .finally(() => classMetadataPromiseByIdMap.delete(classId))
    classMetadataPromiseByIdMap.set(classId, request)
    return request
  }

  async function fetchClassListingInfoById(classId: string) {
    const data = await $fetch<Record<string, unknown>>(`${LIKE_CO_API}/likernft/book/store/${classId}`)
    const listingInfo = data
    classListingInfoByIdMap.value[classId] = listingInfo
    return listingInfo
  }

  function lazyFetchClassListingInfoById(classId: string) {
    if (classListingInfoByIdMap.value[classId]) { return classListingInfoByIdMap.value[classId] }
    return fetchClassListingInfoById(classId)
  }

  // Falls back to bookstore listing info for classes without an on-chain
  // contract (e.g. legacy classes migrated from another chain).
  // Never rejects, so callers can safely fire-and-forget.
  async function lazyFetchClassNameById(classId: string) {
    const cached = getClassNameById.value(classId)
    if (cached) { return cached }
    try {
      const metadata = await lazyFetchClassMetadataById(classId)
      if (metadata?.name) { return metadata.name }
    }
    catch {
      // fallback to listing info below
    }
    try {
      await lazyFetchClassListingInfoById(classId)
    }
    catch {
      // no name available; callers fall back to showing the classId
    }
    return getClassNameById.value(classId)
  }

  return {
    classMetadataByIdMap,
    getClassMetadataById,
    getClassListingInfoById,
    getClassNameById,
    fetchClassMetadataById,
    lazyFetchClassMetadataById,
    fetchClassListingInfoById,
    lazyFetchClassListingInfoById,
    lazyFetchClassNameById,
  }
})
