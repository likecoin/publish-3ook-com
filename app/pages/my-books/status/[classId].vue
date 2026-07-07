<template>
  <PageBody class="space-y-10 pb-10">
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="`${error}`"
      :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
      @close="error = ''"
    />

    <UProgress
      v-if="isLoading"
      animation="carousel"
    >
      <template #indicator>
        {{ $t('loading.progress') }}
      </template>
    </UProgress>

    <template v-if="bookstoreApiStore.isAuthenticated">
      <UCard :ui="{ body: 'p-3' }">
        <div class="flex items-center gap-2">
          <h3
            class="font-bold font-mono"
            v-text="nftClassName || classId"
          />
          <ULink
            :to="affiliationLink"
            class="flex items-center"
            target="_blank"
          >
            <UIcon
              name="i-heroicons-arrow-top-right-on-square"
              size="xl"
            />
          </ULink>
          <UButton
            icon="i-heroicons-document-duplicate"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="copyToClipboard(affiliationLink)"
          />
        </div>
      </UCard>

      <UTabs
        v-model="selectedTabItemIndex"
        class="w-full"
        :items="tabItems"
      >
        <template #content="{ item }">
          <BookStatusSalesOrdersTab
            v-if="item.value === 'sales'"
            class="mt-4"
            :class-id="classId"
            :owner-wallet="ownerWallet"
            @reduce-pending-nft="handleReducePendingNft"
          />
          <div
            v-else
            class="space-y-10 mt-4"
          >
            <BookStatusBookDetailsSection
              :class-id="classId"
              :class-listing-info="classListingInfo"
              @saved="refreshListingInfo"
            />
            <BookStatusEditionsCard
              v-model:prices="prices"
              :class-id="classId"
              :user-is-owner="userIsOwner"
              :stock-balance="stockBalance"
              @restocked="calculateStock"
              @error="(message: string) => (error = message)"
            />
            <BookStatusPurchaseLinksCard
              :class-id="classId"
              :prices="prices"
              :book-name="nftClassName"
            />
          </div>
        </template>
      </UTabs>
    </template>

    <NuxtPage :transition="false" />
  </PageBody>
</template>

<script setup lang="ts">
import { copyToClipboard } from '~/utils'
import type { ClassListingData, ClassListingPrice } from '~/types'

const { t: $t } = useI18n()

const AUTHOR_RESERVED_NFT_COUNT = 1

const { BOOK3_URL } = useRuntimeConfig().public
const apiFetch = useLikeCoApiFetch()
const bookstoreApiStore = useBookstoreApiStore()
const nftStore = useNftStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { lazyFetchClassMetadataById } = nftStore
const { getBalanceOf } = useNFTContractReader()

const route = useRoute()
const localeRoute = useLocaleRoute()
const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)

const error = ref('')
const isLoading = ref(false)
const classId = ref<string>(route.params.classId as string)
const classListingInfo = ref<ClassListingData>({} as ClassListingData)
const prices = ref<ClassListingPrice[]>([])
const stockBalance = ref(-99)

// Tabs
const tabItems = computed(() => [
  { label: $t('status_page.tab_sales_orders'), value: 'sales' },
  { label: $t('status_page.tab_book_details'), value: 'details' },
])

const selectedTabItemIndex = ref(route.query.tab as string || 'sales')

watch(selectedTabItemIndex, (value) => {
  if (value) {
    navigateTo(localeRoute({ query: { ...route.query, tab: value } }), { replace: true })
  }
})

const nftClassName = computed(() => nftStore.getClassMetadataById(classId.value as string)?.name)
const affiliationLink = computed(() => {
  const baseUrl = `${BOOK3_URL}/store/${classId.value}`
  if (userLikerInfo.value?.user) {
    return `${baseUrl}?from=@${userLikerInfo.value.user}`
  }
  return baseUrl
})
const ownerWallet = computed(() => classListingInfo?.value?.ownerWallet)
const userIsOwner = computed(() => !!sessionWallet.value && ownerWallet.value === sessionWallet.value)

watch(sessionWallet, async (newWallet) => {
  if (newWallet) {
    await calculateStock()
  }
  else {
    stockBalance.value = -99
  }
})

// Keep the cached listing copy of prices in sync after reorders.
watch(prices, (value) => {
  classListingInfo.value.prices = value
})

onMounted(async () => {
  isLoading.value = true
  try {
    await refreshListingInfo()

    if (sessionWallet.value) {
      await calculateStock()
    }
    lazyFetchClassMetadataById(classId.value as string)
  }
  catch (err) {
    error.value = (err as Error).toString()
  }
  finally {
    isLoading.value = false
  }
})

async function refreshListingInfo() {
  const classData = await apiFetch<ClassListingData>(`/likernft/book/store/${classId.value}`)
  classListingInfo.value = classData
  prices.value = classListingInfo.value.prices
}

async function calculateStock() {
  const pendingNFTCount = classListingInfo.value.pendingNFTCount || 0
  const count = await getBalanceOf(classId.value, sessionWallet.value as string)
  const manuallyAssignedNFTCount = prices.value
    .filter(price => !price.isAutoDeliver)
    .reduce((total, price) => total + (price.stock || 0), 0)
  stockBalance.value = (Number(count) - manuallyAssignedNFTCount - AUTHOR_RESERVED_NFT_COUNT - pendingNFTCount) || 0
}

function handleReducePendingNft() {
  classListingInfo.value.pendingNFTCount = (classListingInfo.value.pendingNFTCount || 0) - 1
}
</script>
