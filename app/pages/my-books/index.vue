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
        :data="displayedTableRows"
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
                v-if="row.original.draftStepLabel"
                class="text-xs text-gray-500 dark:text-gray-400 truncate"
                v-text="$t('my_books.draft_step', { step: row.original.draftStepLabel })"
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

        <template #sold-cell="{ row }">
          <span v-text="row.original.sold ?? '-'" />
        </template>

        <template #status-cell="{ row }">
          <BookListingStatusBadge :status="row.original.status" />
        </template>

        <template #pendingAction-cell="{ row }">
          <span v-text="row.original.pendingAction ?? '-'" />
        </template>

        <template #empty>
          <span v-text="searchInput ? $t('my_books.no_search_result') : $t('my_books.no_books')" />
        </template>

        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.isDraft"
            icon="i-heroicons-trash"
            variant="ghost"
            color="error"
            size="sm"
            :aria-label="$t('my_books.delete_draft')"
            @click.stop="deleteDraft"
          />
          <UButton
            v-else
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
import { useObjectUrl } from '@vueuse/core'
import type { BookListingStatus } from '~/types'
import type { PublishSession } from '~/types/publish'
import { PUBLISH_WIZARD_STEP_LABEL_KEYS } from '~/types/publish'
import { formatPriceUSDLabel, getBookListingStatus, hasListedEdition, isBookSoldOut, getLowestPriceUSD } from '~/utils/listing'
import { getImageResizeURL, parseImageURLFromMetadata } from '~/utils'
import {
  PUBLISH_RESUME_QUERY,
  clearPublishDraft,
  getPublishSessionTitle,
  hasPublishDraftContent,
  loadPublishDraftFiles,
  loadPublishSession,
} from '~/utils/publishSession'
import { isManualCoverRecord } from '~/utils/arweave'

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
// needs looking at before one that is quietly selling. `draft` is pinned above
// the sorted rows, so its entry is only here to satisfy the exhaustive record.
const STATUS_SORT_ORDER: Record<BookListingStatus, number> = {
  draft: -1,
  pending_review: 0,
  sold_out: 1,
  listed: 2,
  unlisted: 3,
}

// The draft row fills what the local session knows and leaves the rest
// undefined, which the cells render as a placeholder.
interface BookTableRow {
  classId: string
  className: string
  hasClassName: boolean
  coverSrc?: string
  priceInUSD?: number | string | null
  status: BookListingStatus
  editionCount: number
  unlistedEditionCount: number
  pendingAction?: number
  sold?: number
  timestamp?: number
  isDraft?: boolean
  draftStepLabel?: string
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
const bookRows = computed<BookTableRow[]>(() => (isShowingModeratedList.value ? moderatedBookList : bookList).value.map((b) => {
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
    status: getBookListingStatus({
      ...b,
      hasListedEdition: hasListedEdition(prices),
      isSoldOut: isBookSoldOut(prices),
    }),
    editionCount: prices.length,
    unlistedEditionCount: prices.filter(p => p.isUnlisted).length,
    pendingAction: b.pendingNFTCount,
    sold: b.sold,
    timestamp: b.timestamp,
  }
}))

function matchesSearchInput(row: BookTableRow, normalizedSearchInput: string) {
  return row.classId.toLowerCase().includes(normalizedSearchInput)
    || row.className?.toLowerCase().includes(normalizedSearchInput)
}

const tableRows = computed(() => {
  if (!searchInput.value) { return bookRows.value }
  const normalizedSearchInput = searchInput.value.toLowerCase()
  return bookRows.value.filter(b => matchesSearchInput(b, normalizedSearchInput))
})

// The unfinished wizard session: nothing about it has reached the backend, so
// it exists on this device only. Read on mount — prerendering has no storage.
const draftSession = ref<PublishSession | null>(null)
const draftCoverBlob = shallowRef<Blob | null>(null)
// Revoked for us when the blob changes and when this page unmounts.
const draftCoverBlobUrl = useObjectUrl(draftCoverBlob)

// The author's own cover outranks the one the EPUB supplied.
const draftCoverRecords = computed(() => {
  const covers = (draftSession.value?.fileRecords || []).filter(r => r.fileType?.startsWith('image/'))
  return [...covers.filter(isManualCoverRecord), ...covers.filter(r => !isManualCoverRecord(r))]
})

// A draft never carries a data URL (localStorage quota), so its cover comes
// from the uploaded copy, or from the bytes still in the draft file store.
const draftCoverSrc = computed(() => {
  const uploadedLink = draftCoverRecords.value.find(record => record.arweaveLink)?.arweaveLink
  if (uploadedLink) {
    return getImageResizeURL(parseImageURLFromMetadata(uploadedLink), { width: 100 })
  }
  return draftCoverBlobUrl.value
})

const draftRow = computed<BookTableRow | null>(() => {
  const session = draftSession.value
  if (!session || !hasPublishDraftContent(session)) { return null }
  const prices = session.listingDraft?.prices || []
  const stepLabelKey = session.wizardStep && PUBLISH_WIZARD_STEP_LABEL_KEYS[session.wizardStep]
  return {
    classId: session.classId || '',
    className: getPublishSessionTitle(session, $t),
    // No class ID to show under the name until the draft has minted one, and a
    // half-minted draft's ID is not something to send the author looking up.
    hasClassName: false,
    coverSrc: draftCoverSrc.value,
    priceInUSD: getLowestPriceUSD(prices),
    status: 'draft',
    editionCount: prices.length,
    unlistedEditionCount: prices.filter(p => !p.isListed).length,
    isDraft: true,
    draftStepLabel: stepLabelKey ? $t(stepLabelKey) : undefined,
  }
})

// The draft deliberately survives a disconnect, so the one on disk may belong to
// a wallet other than the one now signed in. Compared case-insensitively: the
// two addresses come from the same source, but a checksum difference would hide
// the draft with nothing to show for it.
const isDraftOwnedByWallet = computed(() => {
  const draftWallet = draftSession.value?.walletAddress?.toLowerCase()
  return !draftWallet || draftWallet === wallet.value?.toLowerCase()
})

// Pinned above the paginated rows rather than sorted among them: the draft has
// no timestamp or sales to sort by, and it is the row an author returning
// mid-publish came for.
const visibleDraftRow = computed(() => {
  const row = draftRow.value
  // The moderated view lists other people's books.
  if (!row || !isDraftOwnedByWallet.value || isShowingModeratedList.value) { return null }
  if (!searchInput.value) { return row }
  return matchesSearchInput(row, searchInput.value.toLowerCase()) ? row : null
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

const displayedTableRows = computed(() => (visibleDraftRow.value
  ? [visibleDraftRow.value, ...paginatedTableRows.value]
  : paginatedTableRows.value))

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

// Fire-and-forget: the row renders from the session alone, and the cover is
// worth neither blocking the listing fetch nor an upload the draft skipped.
async function loadDraftCoverBlob() {
  const records = draftCoverRecords.value
  if (!records.length || records.some(record => record.arweaveLink)) { return }
  const blobs = await loadPublishDraftFiles(records)
  draftCoverBlob.value = records.map(record => blobs.get(record.fileSHA256 || '')).find(Boolean) || null
}

async function deleteDraft() {
  if (!window.confirm($t('my_books.delete_draft_confirm'))) { return }
  useLogEvent('my_books_draft_deleted', { wizard_step: draftSession.value?.wizardStep })
  await clearPublishDraft()
  draftSession.value = null
  draftCoverBlob.value = null
}

onMounted(async () => {
  draftSession.value = loadPublishSession()
  loadDraftCoverBlob()

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

async function selectTableRow(_e: Event, row: { original: BookTableRow }) {
  if (row.original.isDraft) {
    useLogEvent('my_books_resume_draft', { wizard_step: draftSession.value?.wizardStep })
    await navigateTo(localeRoute({ name: 'new-book', query: { ...PUBLISH_RESUME_QUERY } }))
    return
  }
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
