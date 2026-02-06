import type { ClassMetadata } from '~/types/iscn'

export const useNftStore = defineStore('nft', () => {
  const { LIKE_CO_API } = useRuntimeConfig().public
  const classMetadataByIdMap = ref({} as Record<string, ClassMetadata | null>)
  const classListingInfoByIdMap = ref({} as Record<string, Record<string, unknown>>)

  const getClassMetadataById = computed(() => (classId: string) => classMetadataByIdMap.value[classId])

  const getClassListingInfoById = computed(() => (classId: string) => classListingInfoByIdMap.value[classId])

  async function fetchClassMetadataById (classId: string) {
    const { getClassMetadata } = useNFTContractReader()
    const classData = await getClassMetadata(classId)
    classMetadataByIdMap.value[classId] = classData
    return classData
  }

  function lazyFetchClassMetadataById (classId: string) {
    if (getClassMetadataById.value(classId)) { return getClassMetadataById.value(classId) }
    return fetchClassMetadataById(classId)
  }

  async function fetchClassListingInfoById (classId: string) {
    const data = await $fetch<Record<string, unknown>>(`${LIKE_CO_API}/likernft/book/store/${classId}`)
    const listingInfo = data
    classListingInfoByIdMap.value[classId] = listingInfo
    return listingInfo
  }

  function lazyFetchClassListingInfoById (classId: string) {
    if (classListingInfoByIdMap.value[classId]) { return classListingInfoByIdMap.value[classId] }
    return fetchClassListingInfoById(classId)
  }

  return {
    classMetadataByIdMap,
    classStoreDataByIdMap: classListingInfoByIdMap,
    getClassMetadataById,
    getClassListingInfoById,
    fetchClassMetadataById,
    lazyFetchClassMetadataById,
    fetchClassListingInfoById,
    lazyFetchClassListingInfoById
  }
})
