<template>
  <PageBody>
    <PageHeader :title="$t('latest_books.title')" />
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="red"
      variant="soft"
      :title="`${error}`"
      :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'red', variant: 'link', padded: false }"
      @close="error = ''"
    />
    <UAlert
      v-if="!isAffiliationReady"
      icon="i-heroicons-exclamation-circle"
      color="orange"
      variant="soft"
      :title="$t('latest_books.join_affiliation')"
      :description="$t('latest_books.affiliation_description')"
      :actions="[{
        label: $t('common.setup'),
        color: 'orange',
        variant: 'outline',
        click: handleAffiliationSetupButtonClick,
      }]"
    />
    <UCard v-else>
      {{ $t('latest_books_extended.append_text') }}<UKbd class="font-mono">
        ?from={{ channelId }}
      </UKbd>{{ $t('latest_books_extended.append_suffix') }}
    </UCard>
    <UTabs v-model="selectedTabItemIndex" class="w-full" :items="tabItems">
      <template #item="{ item }">
        <UCard
          :key="item.key"
          :ui="{
            header: { base: 'flex justify-between items-center' },
            body: { padding: '' },
            footer: { base: 'text-center' },
          }"
        >
          <div class="flex px-3 py-3.5 border-b border-gray-200">
            <UInput v-model="q" :placeholder="$t('latest_books.filter_placeholder')" />
          </div>
          <UTable :columns="tableColumns" :rows="filteredRows" @select="selectTableRow">
            <template #image-data="{ row }">
              <img v-if="row.image" :src="row.image" :alt="row.className" class="w-12 h-12 object-cover rounded-lg">
            </template>
            <template #className-data="{ row }">
              <div class="max-w-[20vw] whitespace-normal" v-text="row.className" />
            </template>
            <template #url-data="{ row }">
              <UButton :label="$t('common.copy')" :disabled="!isAffiliationReady" @click="handleCopyButtonClick($event, row.url)" />
            </template>
          </UTable>
        </UCard>
      </template>
    </UTabs>
  </PageBody>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
const { t: $t } = useI18n()

const { BOOK3_URL } = useRuntimeConfig().public

const userStore = useUserStore()
const stripeStore = useStripeStore()
const bookstoreApiStore = useBookstoreApiStore()
const walletStore = useWalletStore()

const localeRoute = useLocaleRoute()
const route = useRoute()

const { wallet } = storeToRefs(walletStore)
const { userLikerInfo } = storeToRefs(userStore)
const { isAuthenticated } = storeToRefs(bookstoreApiStore)

const tabItems = computed(() => [
  { label: $t('latest_books.latest_releases'), key: 'latest' },
  { label: $t('latest_books.best_sellers'), key: 'bestselling' }
])

const error = ref('')
const isStripeConnectReady = ref(false)
const latestBookList = ref([])
const bestSellerBookList = ref([] as any[])
const selectedTabItemIndex = ref(0)
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
    key: 'image',
    label: $t('table.cover'),
    sortable: false
  },
  {
    key: 'className',
    label: $t('latest_books.book_name'),
    sortable: true
  },
  {
    key: 'author',
    label: $t('common.author'),
    sortable: true
  },
  {
    key: 'priceInUSD',
    label: $t('common.price'),
    sortable: true
  }, {
    key: 'url',
    label: isAffiliationReady.value ? $t('latest_books.affiliation_link') : $t('common.link'),
    sortable: false
  }
])
const selectedTabItemKey = computed(() => tabItems.value[selectedTabItemIndex.value]?.key || 'latest')
const bookList = computed(() => selectedTabItemKey.value === 'latest' ? latestBookList.value : bestSellerBookList.value)
const tableRows = computed(() => bookList.value.map((b: any) => {
  const className = b.name || b.title
  const image = b.thumbnailUrl || b.imageUrl
  const author = b.author?.name || b.author
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
  return tableRows.value.filter((row: any) => {
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
  await Promise.all([
    fetchBookList().catch((e) => {
      error.value = e
    }),
    fetchBestSellersList().catch((e) => {
      error.value = e
    })
  ])
  if (isAuthenticated.value) {
    try {
      await fetchUserStripeInfo()
    } catch (e) {
      console.error(e)
    }
  }
})

async function fetchBookList () {
  const data = await $fetch(`${BOOK3_URL}/api/store/products?tag=latest`)
  latestBookList.value = (data as any)?.records || []
}

async function fetchBestSellersList () {
  const data = await $fetch(`${BOOK3_URL}/api/store/products?tag=bestselling`)
  bestSellerBookList.value = (data as any)?.records || []
}

async function fetchUserStripeInfo () {
  if (!wallet.value) {
    isStripeConnectReady.value = false
    return
  }
  try {
    const stripeConnectStatus = await stripeStore.fetchStripeConnectStatusByWallet(wallet.value)
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

function selectTableRow (row: any) {
  useTrackEvent('latest_books_click_table_row')
  window.open(row.url, '_blank')
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
