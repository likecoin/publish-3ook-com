<template>
  <PageBody :ui="{ constrained: '' }">
    <AppErrorAlert
      v-model="error"
      class="mt-4"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap justify-between items-center gap-3">
          <div class="flex items-center gap-3">
            <span
              class="text-sm font-medium whitespace-nowrap"
              v-text="$t('my_books.total_books', { count: tableRows.length })"
            />
            <UButton
              v-if="moderatedBookList.length || isShowingModeratedList"
              size="xs"
              :color="isShowingModeratedList ? 'primary' : 'neutral'"
              :variant="isShowingModeratedList ? 'soft' : 'outline'"
              :label="$t('bookstore.viewable_listing')"
              :aria-pressed="isShowingModeratedList"
              @click="toggleModeratedList"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="searchInput"
              class="w-44"
              size="sm"
              icon="i-heroicons-magnifying-glass-20-solid"
              :placeholder="$t('table.search_placeholder')"
            />
            <TablePaginationBar
              v-model:page="tablePage"
              v-model:page-size="pageSize"
              :total="pagination.total"
              :row-from="tablePageRowFrom"
              :row-to="tablePageRowTo"
              :page-size-options="pageSizeOptions"
            />
          </div>
        </div>
      </template>

      <UTable
        :columns="tableColumns"
        :data="paginatedTableRows"
        :loading="isLoading"
        :progress="{ color: 'primary', animation: 'carousel' }"
        :ui="{
          th: 'whitespace-nowrap',
          tr: 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors duration-200',
        }"
        @select="selectTableRow"
      >
        <template
          v-for="column in sortableColumns"
          :key="`header-${column.accessorKey}`"
          #[`${column.accessorKey}-header`]
        >
          <UButton
            color="neutral"
            variant="ghost"
            :label="column.header"
            :trailing-icon="getSortIcon(column.accessorKey)"
            :aria-label="getSortAriaLabel(column)"
            @click="() => toggleSort(column.accessorKey)"
          />
        </template>

        <template #className-cell="{ row }">
          <div class="flex items-center gap-3">
            <BookCoverThumbnail
              :src="row.original.coverSrc"
              :alt="row.original.className"
            />
            <div class="min-w-0 max-w-md">
              <div
                class="font-medium truncate"
                v-text="row.original.className"
              />
              <div
                v-if="row.original.hasClassName"
                class="font-mono text-xs text-gray-500 dark:text-gray-400 truncate"
                v-text="row.original.classId"
              />
              <div
                v-if="row.original.unlistedEditionCount"
                class="text-xs text-gray-500 dark:text-gray-400"
                v-text="$t('my_books.unlisted_editions', {
                  count: row.original.unlistedEditionCount,
                  total: row.original.editionCount,
                })"
              />
            </div>
          </div>
        </template>

        <template #priceInUSD-cell="{ row }">
          <span v-text="row.original.priceInUSD == null ? '-' : formatPriceUSDLabel(Number(row.original.priceInUSD), $t)" />
        </template>

        <template #status-cell="{ row }">
          <BookListingStatusBadge :status="row.original.status" />
        </template>

        <template #empty>
          <span v-text="searchInput ? $t('my_books.no_search_result') : $t('my_books.no_books')" />
        </template>

        <template #actions-cell="{ row }">
          <UButton
            icon="i-heroicons-arrow-top-right-on-square"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="$t('my_books.view_store_page')"
            @click.stop="openStorePage(row.original.classId)"
          />
        </template>
      </UTable>
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
import type { BookListingStatus } from '~/types'
import { formatPriceUSDLabel, getBookListingStatus } from '~/utils/listing'
import { getImageResizeURL, parseImageURLFromMetadata } from '~/utils'

const route = useRoute()
const localeRoute = useLocaleRoute()
const { t: $t } = useI18n()
const { BOOK3_URL } = useRuntimeConfig().public
const bookstoreApiStore = useBookstoreApiStore()
const nftStore = useNftStore()
const { listingList: bookList, moderatedBookList, token, wallet } = storeToRefs(bookstoreApiStore)
const likerStore = useLikerStore()
const { getLikerInfoByWallet } = storeToRefs(likerStore)
const stripeStore = useStripeStore()
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)
const { getClassNameById } = storeToRefs(nftStore)
const { lazyFetchClassNameById } = nftStore
const { fetchBookListing, fetchModeratedBookList } = bookstoreApiStore

// Books awaiting the author's action come first; a book that never sells still
// needs looking at before one that is quietly selling.
const STATUS_SORT_ORDER: Record<BookListingStatus, number> = {
  pending_review: 0,
  listed: 1,
  unlisted: 2,
}

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

// Books a moderator can see but doesn't own live behind a filter rather than
// their own tab. The query key stays `tab` so existing links keep working.
const isShowingModeratedList = ref(route.query.tab === 'viewable')

function toggleModeratedList() {
  const isShowing = !isShowingModeratedList.value
  isShowingModeratedList.value = isShowing
  searchInput.value = ''
  setPage(1)
  navigateTo(localeRoute({ query: isShowing ? { tab: 'viewable' } : {} }), { replace: true })
}

// Search
const searchInput = ref('')

// Rows. Mapping and filtering are separate so typing in the search box only
// re-runs the filter instead of rebuilding every row's cover URL and status.
const bookRows = computed(() => (isShowingModeratedList.value ? moderatedBookList : bookList).value.map((b) => {
  const prices = b.prices || []
  // The listing carries its own name; on-chain metadata is only a fallback for
  // legacy classes whose listing doc never recorded one.
  const className = b.name || getClassNameById.value(b.classId)
  return {
    classId: b.classId,
    // Fall back to the ID so nameless rows still sort by their visible text.
    className: className || b.classId,
    hasClassName: Boolean(className),
    // Covers are stored as `ar://`/`ipfs://` URLs a browser can't fetch, and at
    // full size for a 40px-wide box.
    coverSrc: b.thumbnailUrl ? getImageResizeURL(parseImageURLFromMetadata(b.thumbnailUrl), { width: 100 }) : undefined,
    priceInUSD: b.minPrice ?? prices[0]?.price,
    status: getBookListingStatus(b),
    editionCount: prices.length,
    unlistedEditionCount: prices.filter(p => p.isUnlisted).length,
    pendingAction: b.pendingNFTCount,
    sold: b.sold,
    timestamp: b.timestamp,
  }
}))

const tableRows = computed(() => {
  if (!searchInput.value) { return bookRows.value }
  const normalizedSearchInput = searchInput.value.toLowerCase()
  return bookRows.value.filter(b =>
    b.classId.toLowerCase().includes(normalizedSearchInput)
    || b.className?.toLowerCase().includes(normalizedSearchInput))
})

// Pagination & sort
const {
  pagination,
  pageSizeOptions,
  paginatedRows: paginatedTableRows,
  page: tablePage,
  pageSize,
  pageRowFrom: tablePageRowFrom,
  pageRowTo: tablePageRowTo,
  toggleSort,
  setPage,
  getSortIcon,
  getSortAriaLabel,
} = usePaginatedTable({
  rows: tableRows,
  pageSize: 10,
  resetKey: () => searchInput.value,
  initialSort: { column: 'pendingAction', direction: 'desc' },
  compare: (aValue, bValue, column) => {
    if (column === 'status') {
      return STATUS_SORT_ORDER[aValue as BookListingStatus] - STATUS_SORT_ORDER[bValue as BookListingStatus]
    }
    return compareTableValues(aValue, bValue)
  },
  defaultCompare: (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
})

// Columns
const sortableColumns = computed(() => [
  {
    accessorKey: 'className',
    header: $t('table.class_name'),
  },
  {
    accessorKey: 'priceInUSD',
    header: $t('table.price_in_usd'),
    meta: NUMERIC_COLUMN_META,
  },
  {
    accessorKey: 'sold',
    header: $t('table.sold'),
    meta: NUMERIC_COLUMN_META,
  },
  {
    accessorKey: 'status',
    header: $t('table.status'),
  },
  {
    accessorKey: 'pendingAction',
    header: $t('table.pending_action'),
    meta: NUMERIC_COLUMN_META,
  },
])

const tableColumns = computed(() => [
  ...sortableColumns.value,
  ACTIONS_COLUMN,
])

onMounted(async () => {
  if (wallet.value) {
    // Only the promo form link needs these, so the table doesn't wait on them.
    likerStore.lazyFetchLikerInfoByWallet(wallet.value).catch(() => {})
    stripeStore.fetchStripeConnectStatusByWallet(wallet.value).catch(() => {})
  }

  try {
    isLoading.value = true
    error.value = ''
    const promises: Promise<unknown>[] = [fetchBookListing()]
    if (token.value) {
      promises.push(fetchModeratedBookList())
    }
    await Promise.all(promises)

    // Only legacy listings arrive without a name; the rest render from the list
    // payload alone, with no per-book on-chain read.
    const namelessClassIds = new Set(bookList.value.concat(moderatedBookList.value)
      .filter(b => !b.name)
      .map(b => b.classId))
    namelessClassIds.forEach(classId => lazyFetchClassNameById(classId))
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    isLoading.value = false
  }
})

async function selectTableRow(_e: Event, row: { original: { classId: string } }) {
  useLogEvent('my_books_view_detail', { class_id: row.original.classId })
  await navigateTo(localeRoute({
    name: 'my-books-status-classId',
    params: { classId: row.original.classId },
  }))
}

function openStorePage(classId: string) {
  useLogEvent('my_books_view_store_page', { class_id: classId })
  window.open(`${BOOK3_URL}/store/${classId}`, '_blank', 'noopener')
}
</script>
