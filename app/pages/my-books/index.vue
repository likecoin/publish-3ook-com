<template>
  <PageBody :ui="{ constrained: '' }">
    <AppErrorAlert
      v-model="error"
      class="mt-4"
    />

    <UProgress
      v-if="isLoading"
      animation="carousel"
    >
      <template #indicator>
        Loading...
      </template>
    </UProgress>

    <UCard
      :ui="{ header: 'flex justify-between items-center gap-4' }"
    >
      <UTabs
        v-model="selectedTabItemIndex"
        class="w-full"
        :items="tabItems"
      >
        <template #content="{ item }">
          <UCard
            :key="item.value"
            :ui="{
              header: 'flex justify-between items-center gap-4',
              body: 'divide-y divide-gray-200 dark:divide-gray-700 p-0 sm:p-0',
            }"
          >
            <template #header>
              <div class="flex justify-between items-center w-full">
                <div class="flex gap-2 items-center">
                  <UPagination
                    v-model:page="tablePage"
                    :items-per-page="pagination.limit"
                    :total="tableRows.length"
                  />
                  <span class="text-sm leading-5 whitespace-nowrap">
                    {{ $t('table.showing_rows', { from: tablePageRowFrom, to: tablePageRowTo, total: tableRows.length }) }}
                  </span>
                </div>
                <UInput
                  v-model="searchInput"
                  class="max-w-xs"
                  icon="i-heroicons-magnifying-glass-20-solid"
                  :placeholder="$t('table.search_placeholder')"
                />
              </div>
            </template>
            <!-- Table -->
            <UTable
              :columns="tableColumns"
              :data="paginatedTableRows"
              @select="selectTableRow"
            >
              <template #priceInUSD-cell="{ row }">
                <ul class="flex gap-1">
                  <li
                    v-for="price in row.original.prices"
                    :key="price"
                  >
                    <UBadge
                      :label="`${price}`"
                      variant="subtle"
                      size="md"
                      color="neutral"
                      class="rounded-full"
                    />
                  </li>
                </ul>
              </template>
              <template #className-cell="{ row }">
                <NFTClassMetadataLoader :class-id="row.original.classId">
                  <template #default="{ isLoading: isLoadingMetadata }">
                    <UProgress v-if="isLoadingMetadata || !row.original.className" />
                    <div
                      v-else
                      class="max-w-xs truncate"
                    >
                      {{ row.original.className }}
                    </div>
                  </template>
                </NFTClassMetadataLoader>
              </template>
            </UTable>
          </UCard>
        </template>
      </UTabs>
    </UCard>

    <div class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
      <ULink
        :to="authorPromoFormUrl"
        target="_blank"
        class="underline"
      >
        {{ $t('my_books.author_promo_form') }}
      </ULink>
    </div>
  </PageBody>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'

const route = useRoute()
const localeRoute = useLocaleRoute()
const { t: $t } = useI18n()
const bookstoreApiStore = useBookstoreApiStore()
const nftStore = useNftStore()
const { listingList: bookList, moderatedBookList, token, wallet } = storeToRefs(bookstoreApiStore)
const likerStore = useLikerStore()
const { getLikerInfoByWallet } = storeToRefs(likerStore)
const stripeStore = useStripeStore()
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)
const { lazyFetchClassMetadataById } = nftStore
const { fetchBookListing, fetchModeratedBookList } = bookstoreApiStore

const error = ref('')
const isLoading = ref(false)

const authorPromoFormUrl = computed(() => {
  const likerInfo = getLikerInfoByWallet.value(wallet.value || '')
  const stripeStatus = getStripeConnectStatusByWallet.value(wallet.value || '')
  const likerId = likerInfo?.user || ''
  const evmWallet = wallet.value || ''
  const email = stripeStatus?.email || ''
  const baseUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdiV9jIUFcDjoFoLtz6KMmq1YRFjU7uXR7ka36JKhVespsP6w/viewform'
  const params = new URLSearchParams({
    'usp': 'pp_url',
    'entry.1466422015': likerId,
    'entry.1252262934': evmWallet,
    'entry.1672981182': email,
  })
  return `${baseUrl}?${params.toString()}`
})

useSeoMeta({
  title: () => $t('seo_titles.book_listing_management'),
  ogTitle: () => $t('seo_titles.book_listing_management'),
})

// Tabs
const tabItems = computed(() => [
  { label: $t('bookstore.current_listing'), value: 'current' },
  { label: $t('bookstore.viewable_listing'), value: 'viewable' },
])

const selectedTabItemIndex = ref(route.query.tab as string || 'current')

watch(selectedTabItemIndex, (value) => {
  if (value) {
    navigateTo(localeRoute({ query: { tab: value } }), { replace: true })
  }
})

// Search
const searchInput = ref('')

// Rows
const tableRows = computed(() => (selectedTabItemIndex.value === 'viewable' ? moderatedBookList : bookList).value.map(b => ({
  classId: b.classId,
  className: nftStore.getClassMetadataById(b.classId)?.name,
  priceInUSD: b.prices?.[0]?.price,
  prices: b.prices?.map(p => p.price),
  pendingAction: b.pendingNFTCount,
  sold: b.sold,
})).filter((b) => {
  if (!searchInput.value) { return true }
  const normalizedSearchInput = searchInput.value.toLowerCase()
  return b.classId.toLowerCase().includes(normalizedSearchInput) || b.className?.toLowerCase().includes(normalizedSearchInput)
}))

// Pagination & sort
const {
  pagination,
  paginatedRows: paginatedTableRows,
  setPage,
} = usePaginatedTable({
  rows: tableRows,
  pageSize: 50,
  initialSort: { column: 'pendingAction', direction: 'desc' },
  compare: (aValue, bValue) => {
    const aVal = (aValue ?? '') as string | number
    const bVal = (bValue ?? '') as string | number
    if (aVal < bVal) { return -1 }
    if (aVal > bVal) { return 1 }
    return 0
  },
})

const tablePage = computed({
  get: () => pagination.value.page,
  set: setPage,
})
const tablePageRowFrom = computed(() => (tablePage.value - 1) * pagination.value.limit + 1)
const tablePageRowTo = computed(() => Math.min(tablePage.value * pagination.value.limit, tableRows.value.length))

// Columns
const tableColumns = computed(() => [
  {
    accessorKey: 'pendingAction',
    header: $t('table.pending_action'),
  },
  {
    accessorKey: 'className',
    header: $t('table.class_name'),
  },
  {
    accessorKey: 'priceInUSD',
    header: $t('table.price_in_usd'),
  },
  {
    accessorKey: 'sold',
    header: $t('table.sold'),
  },
  {
    accessorKey: 'classId',
    header: $t('bookstore.class_id'),
    meta: { class: { td: 'font-mono' } },
  },
])

whenever(isLoading, () => { error.value = '' })

watch(selectedTabItemIndex, () => {
  searchInput.value = ''
  setPage(1)
})

onMounted(async () => {
  const promises: Promise<unknown>[] = [fetchBookListing()]
  if (token.value) {
    promises.push(fetchModeratedBookList())
  }
  if (wallet.value) {
    promises.push(likerStore.lazyFetchLikerInfoByWallet(wallet.value))
    promises.push(stripeStore.fetchStripeConnectStatusByWallet(wallet.value))
  }
  await Promise.all(promises)

  const classIds: Set<string> = new Set(bookList.value.map(b => b.classId).concat(moderatedBookList.value.map(m => m.classId)))
  classIds.forEach(classId => lazyFetchClassMetadataById(classId))
})

async function selectTableRow(_e: Event, row: { original: { classId: string } }) {
  useLogEvent('my_books_view_detail', { class_id: row.original.classId })
  await navigateTo(localeRoute({
    name: 'my-books-status-classId',
    params: { classId: row.original.classId },
  }))
}
</script>
