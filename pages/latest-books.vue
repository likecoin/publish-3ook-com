<template>
  <PageBody>
    <PageHeader :title="$t('latest_books.title')" />
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="`${error}`"
      :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
      @close="error = ''"
    />
    <UAlert
      v-if="!isAffiliationReady"
      icon="i-heroicons-exclamation-circle"
      color="warning"
      variant="soft"
      :title="$t('latest_books.join_affiliation')"
      :description="$t('latest_books.affiliation_description')"
      :actions="[{
        label: $t('common.setup'),
        color: 'warning',
        variant: 'outline',
        onClick: handleAffiliationSetupButtonClick,
      }]"
    />
    <UCard v-else>
      {{ $t('latest_books_extended.append_text') }}<UKbd class="font-mono">
        ?from={{ channelId }}
      </UKbd>{{ $t('latest_books_extended.append_suffix') }}
    </UCard>
    <UTabs v-model="selectedTabItemIndex" class="w-full" :items="tabItems">
      <template #content="{ item }">
        <UCard
          :key="item.value"
          :ui="{
            header: 'flex justify-between items-center',
            body: 'p-0',
            footer: 'text-center',
          }"
        >
          <div class="flex px-3 py-3.5 border-b border-gray-200">
            <UInput v-model="q" :placeholder="$t('latest_books.filter_placeholder')" />
          </div>
          <UTable :columns="tableColumns" :data="filteredRows" @select="selectTableRow">
            <template #image-cell="{ row }">
              <img v-if="row.original.image" :src="row.original.image" :alt="row.original.className" class="w-12 h-12 object-cover rounded-lg">
            </template>
            <template #className-cell="{ row }">
              <div class="max-w-[20vw] whitespace-normal" v-text="row.original.className" />
            </template>
            <template #url-cell="{ row }">
              <UButton :label="$t('common.copy')" :disabled="!isAffiliationReady" @click="handleCopyButtonClick($event, row.original.url)" />
            </template>
          </UTable>
        </UCard>
      </template>
    </UTabs>
  </PageBody>
</template>

<script setup lang="ts">
import type { BookRecord } from '~/types'

const { t: $t } = useI18n()

const { BOOK3_URL } = useRuntimeConfig().public

const userStore = useUserStore()
const stripeStore = useStripeStore()
const bookstoreApiStore = useBookstoreApiStore()

const localeRoute = useLocaleRoute()
const route = useRoute()

const { userLikerInfo } = storeToRefs(userStore)
const { isAuthenticated, wallet: sessionWallet } = storeToRefs(bookstoreApiStore)

const tabItems = computed(() => [
  { label: $t('latest_books.latest_releases'), value: 'latest' },
  { label: $t('latest_books.best_sellers'), value: 'bestselling' }
])

const error = ref('')
const isStripeConnectReady = ref(false)

const { data: latestBookList, error: latestBooksError } = useLazyAsyncData(
  'latest-books',
  async () => {
    const data = await $fetch(`${BOOK3_URL}/api/store/products?tag=latest`)
    return (data as { records?: BookRecord[] })?.records || []
  },
  { default: () => [] as BookRecord[] }
)

const { data: bestSellerBookList, error: bestSellersError } = useLazyAsyncData(
  'best-sellers',
  async () => {
    const data = await $fetch(`${BOOK3_URL}/api/store/products?tag=bestselling`)
    return (data as { records?: BookRecord[] })?.records || []
  },
  { default: () => [] as BookRecord[] }
)

watch([latestBooksError, bestSellersError], ([e1, e2]) => {
  if (e1) { error.value = String(e1) }
  if (e2) { error.value = String(e2) }
})

const selectedTabItemIndex = ref('latest')
const q = ref(route.query.q as string || '')

const channelId = computed(() => {
  if (userLikerInfo.value?.user) {
    return convertLikerIdToChannelId(userLikerInfo.value?.user)
  }
  return ''
})

const isAffiliationReady = computed(() => isStripeConnectReady.value && channelId.value)

const tableColumns = computed(() => [
  {
    accessorKey: 'image',
    header: $t('table.cover')
  },
  {
    accessorKey: 'className',
    header: $t('latest_books.book_name')
  },
  {
    accessorKey: 'author',
    header: $t('common.author')
  },
  {
    accessorKey: 'priceInUSD',
    header: $t('common.price')
  }, {
    accessorKey: 'url',
    header: isAffiliationReady.value ? $t('latest_books.affiliation_link') : $t('common.link')
  }
])
const selectedTabItemKey = computed(() => selectedTabItemIndex.value || 'latest')
const bookList = computed(() => selectedTabItemKey.value === 'latest' ? latestBookList.value : bestSellerBookList.value)
const tableRows = computed(() => bookList.value.map((b) => {
  const className = b.name || b.title
  const image = b.thumbnailUrl || b.imageUrl
  const author = typeof b.author === 'object' ? b.author.name : b.author
  return {
    className,
    image: image ? getImageResizeURL(parseImageURLFromMetadata(image)) : undefined,
    author,
    priceInUSD: `US$${b.minPrice || b.prices?.[0]?.price || 0}`,
    url: `${BOOK3_URL}/store/${b.classId}?from=${channelId.value}&utm_source=bookpress&utm_medium=list_${selectedTabItemKey.value}`
  }
}))

const filteredRows = computed(() => {
  if (!q.value) {
    return tableRows.value
  }
  const query = q.value.toLowerCase()
  return tableRows.value.filter((row) => {
    return [row.className, row.author].some((value) => {
      return value && value.toLowerCase().includes(query)
    })
  })
})

useSeoMeta({
  title: () => $t('seo.latest_books_title'),
  ogTitle: () => $t('seo.latest_books_title')
})

onMounted(async () => {
  if (isAuthenticated.value) {
    try {
      await fetchUserStripeInfo()
    } catch (e) {
      console.error(e)
    }
  }
})

async function fetchUserStripeInfo () {
  if (!sessionWallet.value) {
    isStripeConnectReady.value = false
    return
  }
  try {
    const stripeConnectStatus = await stripeStore.fetchStripeConnectStatusByWallet(sessionWallet.value)
    isStripeConnectReady.value = stripeConnectStatus?.isReady
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    isStripeConnectReady.value = false
  }
}

function handleAffiliationSetupButtonClick () {
  useTrackEvent('latest_books_click_affiliation_setup')
  navigateTo(localeRoute({ name: 'settings' }))
}

function selectTableRow (row: { original: { url: string } }) {
  useTrackEvent('latest_books_click_table_row')
  window.open(row.original.url, '_blank')
}

function handleCopyButtonClick (e: MouseEvent, text: string) {
  e.stopPropagation()
  useTrackEvent('latest_books_click_copy_button')
  copyToClipboard(text)
}

watch(isAuthenticated, () => {
  if (isAuthenticated.value) {
    nextTick(() => {
      fetchUserStripeInfo()
    })
  }
})

</script>
