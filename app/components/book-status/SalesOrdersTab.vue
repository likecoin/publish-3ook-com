<template>
  <div class="space-y-10">
    <UCard
      :ui="{
        header: 'flex justify-between items-center gap-4',
        body: 'p-0',
      }"
    >
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('pages.orders')"
        />

        <UInput
          v-model="searchInput"
          icon="i-heroicons-magnifying-glass-20-solid"
          :placeholder="$t('status_page.search_placeholder')"
        />
      </template>

      <UTable
        :ui="{ th: 'whitespace-nowrap' }"
        :columns="orderTableColumns"
        :data="ordersTableRows"
      >
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
      </UTable>
    </UCard>

    <!-- Sales channel summary -->
    <UCard :ui="{ body: 'p-0' }">
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
  </div>
</template>

<script setup lang="ts">
import { getPortfolioURL, convertMsToMinutes } from '~/utils'
import type { PurchaseItem, PlusReadingStats } from '~/types'

const { t: $t } = useI18n()

const { CHAIN_EXPLORER_URL, LIKE_CO_API } = useRuntimeConfig().public
const bookstoreApiStore = useBookstoreApiStore()
const ordersStore = useOrdersStore()
const { token, wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { ordersByClassIdMap } = storeToRefs(ordersStore)
const { reduceListingPendingNFTCountById } = bookstoreApiStore

const route = useRoute()
const isPlusReadingStatsEnabled = computed(() => route.query.time_stats === '1')
const localeRoute = useLocaleRoute()
const toast = useToast()

const { classId, ownerWallet } = defineProps<{
  classId: string
  ownerWallet?: string
}>()

const emit = defineEmits<{ reducePendingNft: [] }>()

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
    const data = await $fetch<PlusReadingStats>(`${LIKE_CO_API}/likernft/book/user/plus-reading/stats`, {
      headers: { authorization: `Bearer ${token.value}` },
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

onMounted(() => {
  // Independent fetches — run concurrently to keep them off each other's critical path.
  Promise.all([
    ordersStore.fetchOrdersByClassId([classId]),
    fetchPlusReadingStats(),
  ]).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
  })
})

const ordersData = computed(() => {
  const orders = ordersByClassIdMap.value.get(classId) || []
  return orders
})

const purchaseList = computed(() => {
  if (ordersData.value?.length) {
    return ordersData.value.map((purchase: PurchaseItem) => {
      const timestamp = purchase.timestamp
      const date = new Date(timestamp)
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
      return { ...purchase, formattedDate }
    }).sort((a, b) => b.timestamp - a.timestamp)
  }
  return []
})

const salesChannelMap = computed(() => {
  if (!purchaseList.value.length) {
    return {}
  }
  const map: {
    [key in string]: {
      count: number
      totalUSD: number
    };
  } = purchaseList.value.reduce((acc: Record<string, { count: number, totalUSD: number }>, cur: PurchaseItem) => {
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
      return 'Not set'

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

const orderTableColumns = computed(() => {
  return [
    { accessorKey: 'actions', header: $t('table.actions') },
    { accessorKey: 'orderDate', header: $t('table.order_date') },
    { accessorKey: 'status', header: $t('table.status') },
    { accessorKey: 'from', header: $t('table.sales_channel') },
    { accessorKey: 'price', header: $t('form.price'), class: 'w-[120px]' },
    { accessorKey: 'priceName', header: $t('table.price_name') },
    { accessorKey: 'quantity', header: $t('table.quantity') },
    { accessorKey: 'coupon', header: $t('table.coupon_applied') },
    { accessorKey: 'buyerEmail', header: $t('table.buyer_email') },
    { accessorKey: 'readerEmail', header: $t('table.reader_email') },
    { accessorKey: 'wallet', header: $t('table.reader_wallet') },
    { accessorKey: 'message', header: $t('table.reader_message') },
  ]
})

function getOrdersTableActionItems(purchaseListItem: PurchaseItem) {
  const actionItems = []

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
      label: 'Send NFT',
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
      return 'Paid'

    case 'pendingNFT':
      return $t('status.pendingNFT')

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
      return 'warning'

    case 'completed':
      return 'success'

    default:
      return 'neutral'
  }
}

const ordersTableRows = computed(() => purchaseList.value?.map((p, index) => ({
  index,
  readerEmail: p.giftInfo?.toEmail || p.email,
  buyerEmail: p.email,
  buyerPhone: p.phone || '',
  status: p.status,
  statusLabel: getStatusLabel(p),
  statusLabelColor: getStatusLabelColor(p),
  orderDate: p.formattedDate,
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
})).filter((p) => {
  if (!searchInput.value) { return true }
  const normalizedSearchInput = searchInput.value.toLowerCase()
  return (
    p.readerEmail.toLowerCase().includes(normalizedSearchInput)
    || p.buyerEmail.toLowerCase().includes(normalizedSearchInput)
    || p.buyerPhone.toLowerCase().includes(normalizedSearchInput)
    || p.wallet?.toLowerCase().includes(normalizedSearchInput)
    || p.priceName?.toLowerCase().includes(normalizedSearchInput)
    || p.statusLabel?.toLowerCase().includes(normalizedSearchInput)
    || p.orderDate?.toLowerCase().includes(normalizedSearchInput)
    || p.from?.toLowerCase().includes(normalizedSearchInput)
  )
}))

async function sendReminderEmail(purchase: PurchaseItem) {
  const orderData = ordersData.value?.find(p => p.id === purchase.id)
  if (!orderData) {
    throw new Error('ORDER_NOT_FOUND')
  }

  await $fetch(`${LIKE_CO_API}/likernft/book/purchase/${classId}/status/${purchase.id}/remind`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.value}`,
      },
    })

  toast.add({
    icon: 'i-heroicons-check-circle',
    title: $t('status_page.send_reminder_email'),
    duration: 2000,
    color: 'success',
  })
}

async function hardSetStatusToCompleted(purchase: PurchaseItem) {
  const userConfirmed = confirm('Do you want to skip the \'Send NFT\' action and override this payment status to \'completed\'?')
  if (!userConfirmed) {
    return
  }

  const orderData = ordersData.value?.find(p => p.id === purchase.id)
  if (!orderData) {
    throw new Error('ORDER_NOT_FOUND')
  }

  const mutableOrder = orderData as { status: string }
  const previousStatus = mutableOrder.status
  mutableOrder.status = 'completed'

  try {
    await $fetch(`${LIKE_CO_API}/likernft/book/purchase/${classId}/sent/${purchase.id}`,
      {
        method: 'POST',
        body: {
          txHash: null,
          quantity: purchase.quantity || 1,
        },
        headers: {
          authorization: `Bearer ${token.value}`,
        },
      })
  }
  catch (err) {
    mutableOrder.status = previousStatus
    throw err
  }

  if (previousStatus === 'pendingNFT') {
    reduceListingPendingNFTCountById(classId, 1)
    emit('reducePendingNft')
  }
}
</script>
