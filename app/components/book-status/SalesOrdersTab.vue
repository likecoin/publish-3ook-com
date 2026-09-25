<template>
  <div class="space-y-10">
    <UCard
      :ui="{
        header: 'flex flex-wrap justify-between items-center gap-3',
        body: 'p-0 sm:p-0',
      }"
    >
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('pages.orders')"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="searchInput"
            class="w-44"
            size="sm"
            icon="i-heroicons-magnifying-glass-20-solid"
            :placeholder="$t('status_page.search_placeholder')"
          />
          <!-- The fulfilment sheet: every order still to ship, with the address
               split into its own columns. Ignores the search above on purpose —
               a filtered export would quietly leave orders unshipped. -->
          <UButton
            v-if="isMerch && userIsOwner"
            icon="i-heroicons-arrow-down-tray"
            color="neutral"
            variant="ghost"
            size="sm"
            :label="$t('status_page.export_open_orders')"
            :disabled="!openOrders.length"
            @click="exportOpenOrders"
          />
          <UDropdownMenu :items="columnToggleItems">
            <UButton
              icon="i-heroicons-view-columns"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="$t('status_page.toggle_columns')"
            />
          </UDropdownMenu>
          <TablePaginationBar
            v-model:page="tablePage"
            v-model:page-size="pageSize"
            :total="pagination.total"
            :row-from="tablePageRowFrom"
            :row-to="tablePageRowTo"
            :page-size-options="pageSizeOptions"
          />
        </div>
      </template>

      <UTable
        :ui="{ th: 'whitespace-nowrap' }"
        :columns="orderTableColumns"
        :data="paginatedOrderRows"
        :loading="isLoading"
        :progress="{ color: 'primary', animation: 'carousel' }"
      >
        <template
          v-for="column in visibleOrderColumns"
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

        <template #timestamp-cell="{ row }">
          {{ row.original.orderDate }}
        </template>
        <template #price-cell="{ row }">
          {{ formatPriceUSDLabel(row.original.price, $t) }}
        </template>
        <template #buyerEmail-cell="{ row }">
          <UButton
            :label="row.original.buyerEmail"
            :to="`mailto:${row.original.buyerEmail}`"
            variant="link"
          />
        </template>
        <template #readerEmail-cell="{ row }">
          <UButton
            :label="row.original.readerEmail"
            :to="`mailto:${row.original.readerEmail}`"
            variant="link"
          />
        </template>
        <template #wallet-cell="{ row }">
          <UTooltip :text="row.original.wallet">
            <UButton
              class="font-mono"
              :label="row.original.shortenWallet"
              :to="row.original.walletLink"
              variant="link"

              size="xs"
              target="_blank"
            />
          </UTooltip>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.statusLabelColor"
            :label="row.original.statusLabel"
            variant="outline"
            class="rounded-full"
          />
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu :items="row.original.actions">
            <UButton
              :class="{ hidden: !row.original.actions.length }"
              icon="i-heroicons-ellipsis-horizontal-20-solid"
              color="neutral"
              variant="ghost"
            />
          </UDropdownMenu>
        </template>

        <template #empty>
          <span v-text="searchInput ? $t('status_page.no_search_result') : $t('status_page.no_orders')" />
        </template>
      </UTable>
    </UCard>

    <!-- Sales channel summary -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('pages.sales_channel_summary')"
        />
      </template>

      <UTable
        :columns="[
          { accessorKey: 'id', header: $t('table.channel_id') },
          { accessorKey: 'count', header: $t('table.count') },
          { accessorKey: 'totalUSD', header: $t('table.total_usd') },
        ]"
        :data="salesChannelTableRows"
      >
        <template #id-cell="{ row }">
          <span
            v-if="row.original.id !== 'empty'"
            class="font-bold font-mono"
          >{{ row.original.idLabel }}</span>
          <UBadge
            v-else
            :label="row.original.idLabel"
            class="rounded-full"
            color="neutral"
          />
        </template>
      </UTable>
    </UCard>

    <UCard
      v-if="isPlusReadingStatsEnabled && plusReadingStats.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <template #header>
        <h3
          class="font-bold"
          v-text="$t('plus_reading_stats.title')"
        />
        <p
          class="text-xs text-gray-500"
          v-text="$t('plus_reading_stats.description')"
        />
      </template>
      <UTable
        :columns="plusReadingStatsColumns"
        :data="plusReadingStatsRows"
      />
    </UCard>

    <!-- The tracking number is optional: a hand-delivered order is still
         shipped, and withholding the status until a number exists would leave
         it counted as outstanding. -->
    <UModal
      v-model:open="isShipModalOpen"
      :title="isEditingTrackingNumber
        ? $t('status_page.edit_tracking_number')
        : $t('status_page.mark_shipped')"
      :description="isEditingTrackingNumber
        ? $t('status_page.edit_tracking_number_description')
        : $t('status_page.mark_shipped_description')"
      :ui="{ body: 'p-4 sm:p-6' }"
    >
      <template #body>
        <UFormField :label="$t('table.tracking_number')">
          <UInput
            v-model="trackingNumberInput"
            class="w-full"
            :placeholder="$t('status_page.tracking_number_placeholder')"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="w-full flex justify-end gap-2">
          <UButton
            :label="$t('common.cancel')"
            color="neutral"
            variant="ghost"
            :disabled="isShipping"
            @click="isShipModalOpen = false"
          />
          <UButton
            :label="isEditingTrackingNumber
              ? $t('common.save')
              : $t('status_page.mark_shipped')"
            :loading="isShipping"
            @click="confirmShipment"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { getPortfolioURL, convertMsToMinutes } from '~/utils'
import { downloadCSV } from '~/utils/csv'
import { formatPriceUSDLabel } from '~/utils/listing'
import type { PurchaseItem, PlusReadingStats, ShippingDetails } from '~/types'

const { t: $t, locale } = useI18n()

const { CHAIN_EXPLORER_URL } = useRuntimeConfig().public
const apiFetch = useLikeCoApiFetch()
const bookstoreApiStore = useBookstoreApiStore()
const ordersStore = useOrdersStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { ordersByClassIdMap } = storeToRefs(ordersStore)
const { setOrderStatus, setOrderShipped } = ordersStore
const { reduceListingPendingNFTCountById } = bookstoreApiStore

const route = useRoute()
const isPlusReadingStatsEnabled = computed(() => route.query.time_stats === '1')
const localeRoute = useLocaleRoute()
const { showSuccessToast, showErrorToast } = useToastComposable()

const { classId, ownerWallet, isMerch = false, bookName = '' } = defineProps<{
  classId: string
  ownerWallet?: string
  // A good is shipped rather than sent: no NFT, no wallet, and an address to
  // fulfil against.
  isMerch?: boolean
  bookName?: string
}>()

const emit = defineEmits<{ reducePendingNft: [], shipped: [] }>()

// Sorting 狀態 by its raw key would scatter the one status the author can act
// on, so the column sorts by urgency instead.
const ORDER_STATUS_SORT_ORDER: Record<string, number> = {
  pendingNFT: 0,
  paid: 1,
  processing: 2,
  shipped: 3,
  completed: 4,
}

// Paid for but not yet handed to the courier: checkout puts a merch item straight
// here, and it is exactly what the API counts in `pendingShipmentCount`.
const OPEN_MERCH_ORDER_STATUS = 'processing'

// Search
const searchInput = ref('')

const userIsOwner = computed(() => sessionWallet.value && ownerWallet === sessionWallet.value)
const userCanSendNFT = computed(() => userIsOwner.value)

// Live Plus reading engagement for this book (current, not-yet-settled usage). The library
// columns count only borrowed (Plus-library) reads by a paid Plus member — the rev-share-eligible
// durations. The non-library columns count the rest (owned copies, trial/non-Plus reads), shown
// for total engagement but never part of the payout.
const plusReadingStats = ref<PlusReadingStats['stats']>([])
const plusReadingStatsSummary = ref<PlusReadingStats['summary']>({
  totalReadingTimeMs: 0,
  totalTTSTimeMs: 0,
  totalNonLibraryReadingTimeMs: 0,
  totalNonLibraryTTSTimeMs: 0,
  bookCount: 0,
  periodCount: 0,
})
const plusReadingStatsRows = computed(() => {
  if (!plusReadingStats.value.length) return []
  const rows = plusReadingStats.value.map(row => ({
    periodId: row.periodId,
    readingMinutes: convertMsToMinutes(row.readingTimeMs),
    listeningMinutes: convertMsToMinutes(row.ttsTimeMs),
    // `|| 0` guards an older API response that predates the non-library fields.
    nonLibraryReadingMinutes: convertMsToMinutes(row.nonLibraryReadingTimeMs || 0),
    nonLibraryListeningMinutes: convertMsToMinutes(row.nonLibraryTtsTimeMs || 0),
  }))
  const summary = plusReadingStatsSummary.value
  rows.push({
    periodId: $t('plus_reading_stats.total'),
    readingMinutes: convertMsToMinutes(summary.totalReadingTimeMs),
    listeningMinutes: convertMsToMinutes(summary.totalTTSTimeMs),
    nonLibraryReadingMinutes: convertMsToMinutes(summary.totalNonLibraryReadingTimeMs || 0),
    nonLibraryListeningMinutes: convertMsToMinutes(summary.totalNonLibraryTTSTimeMs || 0),
  })
  return rows
})
const plusReadingStatsColumns = computed(() => [
  { accessorKey: 'periodId', header: $t('plus_reading_stats.period') },
  { accessorKey: 'readingMinutes', header: $t('plus_reading_stats.reading_minutes') },
  { accessorKey: 'listeningMinutes', header: $t('plus_reading_stats.listening_minutes') },
  { accessorKey: 'nonLibraryReadingMinutes', header: $t('plus_reading_stats.non_library_reading_minutes') },
  { accessorKey: 'nonLibraryListeningMinutes', header: $t('plus_reading_stats.non_library_listening_minutes') },
])

async function fetchPlusReadingStats() {
  if (!isPlusReadingStatsEnabled.value) return
  try {
    const data = await apiFetch<PlusReadingStats>('/likernft/book/user/plus-reading/stats', {
      query: { classId },
    })
    plusReadingStats.value = data?.stats || []
    plusReadingStatsSummary.value = data?.summary || plusReadingStatsSummary.value
  }
  catch (err) {
    // Non-blocking: engagement stats are supplementary to the listing page.
    // eslint-disable-next-line no-console
    console.error(err)
  }
}

// Starts true so the table shows its spinner rather than "no orders yet" in
// the gap between first paint and the fetch below.
const isLoading = ref(true)

onMounted(async () => {
  // The stats card is independent of the table, so it neither delays the
  // spinner nor blocks the orders fetch.
  fetchPlusReadingStats()
  try {
    await ordersStore.fetchOrdersByClassId([classId])
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
  }
  finally {
    isLoading.value = false
  }
})

const ordersData = computed(() => {
  const orders = ordersByClassIdMap.value.get(classId) || []
  return orders
})

const salesChannelMap = computed(() => {
  if (!ordersData.value.length) {
    return {}
  }
  const map: {
    [key in string]: {
      count: number
      totalUSD: number
    };
  } = ordersData.value.reduce((acc: Record<string, { count: number, totalUSD: number }>, cur: PurchaseItem) => {
    const from = cur.from || 'empty'
    if (!acc[from]) {
      acc[from] = {
        count: 0,
        totalUSD: 0,
      }
    }
    acc[from].count += 1
    acc[from].totalUSD += cur.price
    return acc
  }, {})
  return map
})

function normalizeChannelId(channelId: string) {
  switch (channelId) {
    case 'empty':
      return $t('pages.not_set')

    default:
      return channelId
  }
}

const salesChannelTableRows = computed(() => Object.entries(salesChannelMap.value)?.map(([id, value]) => ({
  id,
  idLabel: normalizeChannelId(id),
  count: value.count || 0,
  totalUSD: (value.totalUSD || 0).toFixed(2),
})))

// The default set matches what the author scans for (date, status, channel,
// price, edition, reader message); the support-workflow columns stay one
// toggle away rather than widening the table for everyone.
const orderColumnDefs = computed(() => [
  // Sorts on the raw timestamp, so the cell renders the date from `orderDate`.
  { accessorKey: 'timestamp', header: $t('table.order_date') },
  { accessorKey: 'status', header: $t('table.status') },
  { accessorKey: 'from', header: $t('table.sales_channel') },
  { accessorKey: 'price', header: $t('table.price_usd'), meta: NUMERIC_COLUMN_META },
  { accessorKey: 'priceName', header: $t('table.price_name') },
  { accessorKey: 'quantity', header: $t('table.quantity'), meta: NUMERIC_COLUMN_META, optional: true },
  { accessorKey: 'coupon', header: $t('table.coupon_applied'), optional: true },
  { accessorKey: 'buyerEmail', header: $t('table.buyer_email'), optional: true },
  { accessorKey: 'readerEmail', header: $t('table.reader_email'), optional: true },
  { accessorKey: 'buyerPhone', header: $t('table.buyer_phone'), optional: true },
  // Shipping is the merch workflow, and a merch item has no wallet to deliver to.
  // The address is not behind the toggle: on a merch listing this table is the
  // fulfilment console, and the toggle does not persist between visits.
  ...(isMerch
    ? [
        { accessorKey: 'shippingAddress', header: $t('table.shipping_address') },
        { accessorKey: 'trackingNumber', header: $t('table.tracking_number'), optional: true },
      ]
    : [{ accessorKey: 'wallet', header: $t('table.reader_wallet'), optional: true }]),
  { accessorKey: 'message', header: $t('table.reader_message') },
])

const shownOptionalColumnKeys = ref<string[]>([])

const visibleOrderColumns = computed(() => orderColumnDefs.value
  .filter(column => !column.optional || shownOptionalColumnKeys.value.includes(column.accessorKey))
  .map(({ optional: _optional, ...column }) => column))

const orderTableColumns = computed(() => [...visibleOrderColumns.value, ACTIONS_COLUMN])

const columnToggleItems = computed(() => orderColumnDefs.value
  .filter(column => column.optional)
  .map(column => ({
    label: column.header,
    type: 'checkbox' as const,
    checked: shownOptionalColumnKeys.value.includes(column.accessorKey),
    onUpdateChecked: (checked: boolean) => {
      shownOptionalColumnKeys.value = checked
        ? [...shownOptionalColumnKeys.value, column.accessorKey]
        : shownOptionalColumnKeys.value.filter(key => key !== column.accessorKey)
    },
    // Keep the menu open so several columns can be toggled in one visit.
    onSelect: (event: Event) => { event.preventDefault() },
  })))

function getOrdersTableActionItems(purchaseListItem: PurchaseItem) {
  const actionItems = []

  // A good is shipped, not sent. There is no NFT to deliver and no transaction
  // to link, and both 寄送提醒 and 直接標示完成 talk about claiming one.
  if (isMerch) {
    // The API re-ships a shipped order too, which is how a mistyped tracking
    // number gets corrected; nothing else is shippable.
    const isShipped = purchaseListItem.status === 'shipped'
    if (userIsOwner.value && (isShipped || purchaseListItem.status === OPEN_MERCH_ORDER_STATUS)) {
      actionItems.push([{
        label: isShipped
          ? $t('status_page.edit_tracking_number')
          : $t('status_page.mark_shipped'),
        icon: isShipped ? 'i-heroicons-pencil-square' : 'i-heroicons-truck',
        onSelect: () => {
          openShipModal(purchaseListItem)
        },
      }])
    }
    return actionItems
  }

  if (purchaseListItem.status === 'completed' && purchaseListItem.txHash) {
    actionItems.push([{
      label: $t('status_page.view_transaction'),
      icon: 'i-heroicons-magnifying-glass',
      to: `${CHAIN_EXPLORER_URL}/${purchaseListItem.txHash}`,
      target: '_blank',
    }])
  }
  else if (purchaseListItem.status === 'pendingNFT' && userCanSendNFT.value) {
    actionItems.push([{
      label: $t('pages.send_nft'),
      icon: 'i-heroicons-paper-airplane',
      to: localeRoute({
        name: 'my-books-send-classId',
        params: {
          classId: purchaseListItem.classId,
        },
        query: {
          owner_wallet: ownerWallet,
          payment_id: purchaseListItem.id,
        },
      }),
    }])
  }

  if (purchaseListItem.status === 'paid') {
    actionItems.push([{
      label: $t('status_page.send_reminder_email'),
      icon: 'i-heroicons-envelope',
      onSelect: () => {
        sendReminderEmail(purchaseListItem)
      },
    }])
  }

  if (['pendingNFT', 'paid'].includes(purchaseListItem.status)) {
    actionItems.push([{
      label: $t('status_page.mark_complete'),
      icon: 'i-heroicons-check-circle',
      onSelect: () => {
        hardSetStatusToCompleted(purchaseListItem)
      },
    }])
  }

  return actionItems
}

function getStatusLabel(purchaseListItem: PurchaseItem) {
  switch (purchaseListItem.status) {
    case 'paid':
      return $t('pages.paid')

    case 'pendingNFT':
      return $t('status.pendingNFT')

    case 'processing':
      return $t('status.processing')

    case 'shipped':
      return $t('status.shipped')

    case 'completed':
      return $t('status.completed')

    default:
      return purchaseListItem.status
  }
}

function getStatusLabelColor(purchaseListItem: PurchaseItem): 'info' | 'warning' | 'success' | 'neutral' {
  switch (purchaseListItem.status) {
    case 'paid':
      return 'info'

    case 'pendingNFT':
    case 'processing':
      return 'warning'

    case 'shipped':
    case 'completed':
      return 'success'

    default:
      return 'neutral'
  }
}

// Structured on the wire so the fulfilment CSV can split it; the table has one
// cell, so it joins whichever parts the order actually carries. Books never
// have an address, and this runs per row, so it leaves before allocating.
function formatShippingAddress(shippingDetails?: ShippingDetails) {
  const address = shippingDetails?.address
  if (!address) { return '' }
  const { line1, line2, city, state, postal_code: postalCode, country } = address
  return [line1, line2, city, state, postalCode, country].filter(Boolean).join(', ')
}

// Stripe collects a phone alongside the shipping address, so a merch order can
// carry it there rather than on the order itself.
function getBuyerPhone(purchaseListItem: PurchaseItem) {
  return purchaseListItem.phone || purchaseListItem.shippingDetails?.phone || ''
}

// Held rather than called through `toLocaleDateString`, which rebuilds the
// formatter on every call — the dominant cost of building a few thousand rows.
const orderDateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  year: 'numeric',
  // Padded so the column stays aligned.
  month: '2-digit',
  day: '2-digit',
}))

function formatOrderDate(timestamp: number) {
  const date = new Date(timestamp)
  if (!timestamp || Number.isNaN(date.getTime())) { return '-' }
  return orderDateFormatter.value.format(date)
}

// Mapping and filtering are separate so typing in the search box only re-runs
// the filter instead of rebuilding every row's action menu and wallet links.
const orderRows = computed(() => ordersData.value.map((p: PurchaseItem) => ({
  readerEmail: p.giftInfo?.toEmail || p.email,
  buyerEmail: p.email,
  buyerPhone: getBuyerPhone(p),
  shippingAddress: formatShippingAddress(p.shippingDetails),
  trackingNumber: p.trackingNumber || '',
  status: p.status,
  statusLabel: getStatusLabel(p),
  statusLabelColor: getStatusLabelColor(p),
  timestamp: p.timestamp,
  orderDate: formatOrderDate(p.timestamp),
  wallet: p.wallet || '',
  walletLink: getPortfolioURL(p.wallet),
  shortenWallet: shortenWalletAddress(p.wallet),
  priceName: p.priceName,
  price: p.price || 0,
  coupon: p.coupon || '',
  message: p.message || '',
  from: p.from || '',
  quantity: p.quantity || 1,
  actions: getOrdersTableActionItems(p),
})))

const filteredOrderRows = computed(() => {
  if (!searchInput.value) { return orderRows.value }
  const normalizedSearchInput = searchInput.value.toLowerCase()
  return orderRows.value.filter(p => [
    p.readerEmail,
    p.buyerEmail,
    p.buyerPhone,
    p.shippingAddress,
    p.trackingNumber,
    p.wallet,
    p.priceName,
    p.statusLabel,
    p.orderDate,
    p.from,
    p.coupon,
    p.message,
  ].some(field => field?.toLowerCase().includes(normalizedSearchInput)))
})

const {
  pagination,
  pageSizeOptions,
  paginatedRows: paginatedOrderRows,
  page: tablePage,
  pageSize,
  pageRowFrom: tablePageRowFrom,
  pageRowTo: tablePageRowTo,
  toggleSort,
  getSortIcon,
  getSortAriaLabel,
} = usePaginatedTable({
  rows: filteredOrderRows,
  pageSize: 25,
  resetKey: () => searchInput.value,
  compare: (aValue, bValue, column) => {
    if (column === 'status') {
      return (ORDER_STATUS_SORT_ORDER[aValue as string] ?? Number.MAX_SAFE_INTEGER)
        - (ORDER_STATUS_SORT_ORDER[bValue as string] ?? Number.MAX_SAFE_INTEGER)
    }
    return compareTableValues(aValue, bValue)
  },
  // Newest first until the author sorts, and as the tie-break afterwards.
  defaultCompare: (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
})

async function sendReminderEmail(purchase: PurchaseItem) {
  const orderData = ordersData.value?.find(p => p.id === purchase.id)
  if (!orderData) {
    throw new Error('ORDER_NOT_FOUND')
  }

  await apiFetch(`/likernft/book/purchase/${classId}/status/${purchase.id}/remind`,
    {
      method: 'POST',
    })

  showSuccessToast($t('status_page.send_reminder_email'))
}

async function hardSetStatusToCompleted(purchase: PurchaseItem) {
  const userConfirmed = confirm($t('pages.skip_send_nft_confirm'))
  if (!userConfirmed) {
    return
  }

  const previousStatus = purchase.status
  setOrderStatus(classId, purchase.id, 'completed')

  try {
    await apiFetch(`/likernft/book/purchase/${classId}/sent/${purchase.id}`,
      {
        method: 'POST',
        body: {
          txHash: null,
          quantity: purchase.quantity || 1,
        },
      })
  }
  catch (err) {
    setOrderStatus(classId, purchase.id, previousStatus)
    throw err
  }

  if (previousStatus === 'pendingNFT') {
    reduceListingPendingNFTCountById(classId, 1)
    emit('reducePendingNft')
  }
}

const isShipModalOpen = ref(false)
const isShipping = ref(false)
const trackingNumberInput = ref('')
const orderBeingShipped = ref<PurchaseItem | null>(null)
// Fixed when the dialog opens: a success flips the order to shipped before the
// dialog has finished closing, which would retitle it on the way out.
const isEditingTrackingNumber = ref(false)

function openShipModal(purchase: PurchaseItem) {
  orderBeingShipped.value = purchase
  isEditingTrackingNumber.value = purchase.status === 'shipped'
  // Opens on whatever the order already holds, so correcting a typo is an edit
  // rather than a retype.
  trackingNumberInput.value = purchase.trackingNumber || ''
  isShipModalOpen.value = true
}

async function confirmShipment() {
  const purchase = orderBeingShipped.value
  if (!purchase) { return }
  const trackingNumber = trackingNumberInput.value.trim()
  const previousStatus = purchase.status
  if (isEditingTrackingNumber.value && trackingNumber === (purchase.trackingNumber || '')) {
    isShipModalOpen.value = false
    return
  }

  isShipping.value = true
  try {
    // Written back only once the API has taken it, unlike the NFT flow above:
    // there is a spinner on the button here, so there is nothing to roll back.
    await apiFetch(`/likernft/book/purchase/${classId}/ship/${purchase.id}`, {
      method: 'POST',
      body: { trackingNumber },
    })
    setOrderShipped(classId, purchase.id, trackingNumber)
    // Only an order that was still open had been counted as outstanding.
    if (previousStatus === OPEN_MERCH_ORDER_STATUS) {
      emit('shipped')
    }
    isShipModalOpen.value = false
    showSuccessToast(isEditingTrackingNumber.value
      ? $t('status_page.edit_tracking_number_success')
      : $t('status_page.mark_shipped_success'))
  }
  catch (err) {
    // Said out loud, and the dialog stays open on the order: a silent failure
    // here reads as a shipped parcel that was never dispatched.
    // eslint-disable-next-line no-console
    console.error(err)
    showErrorToast(err)
  }
  finally {
    isShipping.value = false
  }
}

const openOrders = computed(() => (isMerch
  ? ordersData.value.filter((p: PurchaseItem) => p.status === OPEN_MERCH_ORDER_STATUS)
  : []))

async function exportOpenOrders() {
  // Discrete address columns rather than the table's joined cell, so the sheet
  // can be handed to a courier's importer as it is.
  const columns = [
    { accessorKey: 'orderDate', header: $t('table.order_date') },
    { accessorKey: 'orderId', header: $t('table.id') },
    { accessorKey: 'priceName', header: $t('table.price_name') },
    { accessorKey: 'quantity', header: $t('table.quantity') },
    { accessorKey: 'recipientName', header: $t('table.recipient_name') },
    { accessorKey: 'buyerEmail', header: $t('table.buyer_email') },
    { accessorKey: 'buyerPhone', header: $t('table.buyer_phone') },
    { accessorKey: 'addressLine1', header: $t('table.address_line1') },
    { accessorKey: 'addressLine2', header: $t('table.address_line2') },
    { accessorKey: 'addressCity', header: $t('table.address_city') },
    { accessorKey: 'addressState', header: $t('table.address_state') },
    { accessorKey: 'addressPostalCode', header: $t('table.address_postal_code') },
    { accessorKey: 'addressCountry', header: $t('table.address_country') },
    { accessorKey: 'message', header: $t('table.reader_message') },
  ]

  const data = openOrders.value.map((p: PurchaseItem) => {
    const address = p.shippingDetails?.address || {}
    return {
      orderDate: formatOrderDate(p.timestamp),
      orderId: p.id,
      priceName: p.priceName || '',
      quantity: p.quantity || 1,
      recipientName: p.shippingDetails?.name || '',
      buyerEmail: p.email,
      buyerPhone: getBuyerPhone(p),
      addressLine1: address.line1 || '',
      addressLine2: address.line2 || '',
      addressCity: address.city || '',
      addressState: address.state || '',
      addressPostalCode: address.postal_code || '',
      addressCountry: address.country || '',
      message: p.message || '',
    }
  })

  const date = new Date().toISOString().split('T')[0]
  await downloadCSV(data, columns, `open-orders-${bookName || classId}-${date}.csv`)
}
</script>
