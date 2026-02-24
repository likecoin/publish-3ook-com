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

    <UProgress v-if="isLoading" animation="carousel">
      <template #indicator>
        {{ $t('loading.progress') }}
      </template>
    </UProgress>

    <template v-if="bookstoreApiStore.isAuthenticated">
      <UCard
        :class="showEditISCN ? 'ring-2 ring-gray-500' : 'ring-1 ring-gray-200'"
        :ui="{
          header: 'flex justify-between items-center',
          body: 'p-3',
        }"
      >
        <div class="flex justify-between items-center w-full">
          <div class="flex items-center gap-2">
            <h3 class="font-bold font-mono" v-text="nftClassName || classId" />
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
          <UButton
            color="neutral"
            variant="ghost"
            trailing
            :label="$t('form.edit_iscn_metadata')"
            :icon="
              showEditISCN
                ? 'i-heroicons-chevron-up'
                : 'i-heroicons-chevron-down'
            "
            @click="
              () => {showEditISCN = !showEditISCN}
            "
          />
        </div>
        <template v-if="showEditISCN">
          <EditISCNMetadataForm
            :class-id="classId"
            @iscn-updated="handleISCNUpdated"
          />
        </template>
      </UCard>

      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="font-bold font-mono" v-text="$t('pages.editions')" />
            <div class="flex justify-between items-center gap-4">
              <UButton
                icon="i-heroicons-plus"
                class="mb-[12px]"
                variant="outline"
                :color="prices.length >= MAX_EDITION_COUNT ? 'neutral' : 'primary'"
                :disabled="prices.length >= MAX_EDITION_COUNT"
                :label="$t('form.add_edition')"
                :to="localeRoute({
                  name: 'my-books-status-classId-edit-new',
                  params: { classId },
                  query: { price_index: prices.length }
                })"
              />
            </div>
          </div>
        </template>

        <UTable
          :columns="editionsTableColumns"
          :data="editionsTableRows"
        >
          <template #sort-cell="{ row }">
            <div v-if="!row.original.isStockBalancePlaceholderRow && prices.length > 1" class="flex flex-col gap-1">
              <UButton
                :icon="row.original.originalIndex === 0 ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
                variant="ghost"
                color="neutral"
                size="xs"
                :label="String(row.original.originalIndex + 1)"
                :disabled="isUpdatingPricesOrder || (row.original.originalIndex <= 0 && row.original.originalIndex >= prices.length - 1)"
                :loading="isUpdatingPricesOrder"
                trailing
                @click="row.original.originalIndex === 0 ? movePriceDown(row.original.originalIndex) : movePriceUp(row.original.originalIndex)"
              />
            </div>
            <span v-if="!row.original.isStockBalancePlaceholderRow && prices.length === 1" v-text="String(row.original.originalIndex + 1)" />
          </template>
          <template #name-cell="{ row }">
            <h4 class="font-medium" v-text="typeof row.original.name === 'object' ? row.original.name.zh : row.original.name" />
          </template>
          <template #delivery-cell="{ row }">
            <h4
              v-if="!row.original.isStockBalancePlaceholderRow"
              class="font-medium"
              v-text="row.original.isAutoDeliver ? $t('form.auto_delivery') : $t('form.manual_delivery')"
            />
          </template>
          <template #stock-cell="{ row }">
            <span class="text-right">
              {{ row.original.isAutoDeliver ? $t('form.auto_stock') : row.original.stock }}
            </span>
          </template>
          <template #price-cell="{ row }">
            <span class="text-right">
              {{ row.original.price }}
            </span>
          </template>
          <template #details-cell="{ row }">
            <UButton
              v-if="!row.original.isStockBalancePlaceholderRow"
              icon="i-heroicons-document"
              :to="localeRoute({
                name: 'my-books-status-classId-edit-editionIndex',
                params: { classId, editionIndex: String(row.original.index) }
              })"
              variant="soft"
              color="neutral"
            />
          </template>
        </UTable>
        <template #footer>
          <div class="flex justify-end items-center ">
            <UButton
              icon="i-heroicons-plus"
              :label="$t('buttons.mint_new_stock')"
              @click="handleOpenRestockModal"
            />
          </div>
        </template>
      </UCard>

      <UCard
        :ui="{
          header: 'flex justify-between items-center gap-4',
          body: 'p-0',
        }"
      >
        <template #header>
          <h3 class="font-bold font-mono" v-text="$t('pages.orders')" />

          <UInput v-model="searchInput" icon="i-heroicons-magnifying-glass-20-solid" :placeholder="$t('status_page.search_placeholder')" />
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

      <UCard
        :ui="{
          header: 'flex justify-between items-center',
          body: 'p-3',
        }"
      >
        <div class="flex justify-between items-center w-full">
          <h3 class="font-bold font-mono" v-text="$t('nft_book_form.advanced_settings')" />
          <UButton
            color="neutral"
            variant="ghost"
            :icon="
              shouldShowAdvanceSettings
                ? 'i-heroicons-chevron-up'
                : 'i-heroicons-chevron-down'
            "
            @click="
              () => {
                shouldShowAdvanceSettings = !shouldShowAdvanceSettings;
              }
            "
          />
        </div>
        <template v-if="shouldShowAdvanceSettings">
          <div class="mt-[24px] flex flex-col gap-[12px]">
            <!-- Share channel summary -->
            <UCard :ui="{ body: 'p-0' }">
              <template #header>
                <h3 class="font-bold font-mono" v-text="$t('pages.sales_channel_summary')" />
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

            <!-- Share sales data -->
            <UCard
              :ui="{
                header: 'flex justify-between items-center',
                body: 'space-y-8 p-0'
              }"
            >
              <template #header>
                <h4 class="text-sm font-bold font-mono" v-text="$t('form.share_sales_data')" />
                <div class="flex gap-2">
                  <UInput
                    v-model="moderatorWalletInput"
                    class="font-mono"
                    placeholder="0x..."
                  />
                  <UButton
                    :label="$t('common.add')"
                    :variant="moderatorWalletInput ? 'outline' : 'solid'"
                    :color="moderatorWalletInput ? 'primary' : 'neutral'"
                    :disabled="!moderatorWalletInput"
                    @click="addModeratorWallet"
                  />
                </div>
              </template>
              <UTable
                :columns="moderatorWalletsTableColumns"
                :data="moderatorWalletsTableRows"
              >
                <template #wallet-cell="{ row }">
                  <UTooltip :text="row.original.wallet">
                    <UButton
                      class="font-mono"
                      :label="row.original.shortenWallet"
                      :to="row.original.walletLink"
                      variant="link"

                      size="xs"
                    />
                  </UTooltip>
                </template>
                <template #remove-cell="{ row }">
                  <div class="flex justify-end items-center">
                    <UButton
                      icon="i-heroicons-x-mark"
                      variant="soft"
                      color="error"
                      @click="() => { moderatorWallets.splice(row.original.index, 1) }"
                    />
                  </div>
                </template>
              </UTable>
            </UCard>

            <!-- Copy Purchase Link -->
            <UCard
              :ui="{ body: 'space-y-4' }"
            >
              <template #header>
                <h3 class="font-bold font-mono" v-text="$t('form.copy_purchase_link')" />
              </template>

              <UFormField :label="$t('form.edition')">
                <USelect v-model="priceIndex" :items="priceIndexOptions" />
              </UFormField>

              <UFormField :label="$t('form.sales_channel_for_links')">
                <UInput v-model="fromChannelInput" placeholder="Channel ID(s), separated by commas (e.g. store01, store02)" />
              </UFormField>

              <UCard
                v-if="purchaseLinks.length > 1"
                :ui="{ header: 'flex justify-between items-center', body: 'p-0' }"
              >
                <template #header>
                  <h4 class="text-sm font-bold font-mono" v-text="$t('purchase_link.download_all_links')" />

                  <UDropdownMenu
                    :items="[
                      [
                        {
                          label: $t('buttons.print_all_qr'),
                          icon: 'i-heroicons-qr-code',
                          onSelect: printAllQRCodes,
                        },
                        {
                          label: $t('buttons.download_all_links'),
                          icon: 'i-heroicons-arrow-down-on-square-stack',
                          onSelect: downloadAllPurchaseLinks,
                        },
                        {
                          label: $t('buttons.shorten_all_links'),
                          icon: 'i-heroicons-sparkles',
                          onSelect: shortenAllLinks,
                        },
                      ]
                    ]"
                    :popper="{ placement: 'top-end' }"
                  >
                    <UButton
                      icon="i-heroicons-ellipsis-horizontal-20-solid"
                      color="neutral"
                      variant="soft"
                    />
                  </UDropdownMenu>
                </template>

                <UTable
                  :columns="[
                    { accessorKey: 'index', header: '#' },
                    { accessorKey: 'channel', header: $t('table.channel_id') },
                    { accessorKey: 'link', header: $t('purchase_link.download_links') },
                  ]"
                  :data="purchaseLinks"
                  :ui="{ thead: 'whitespace-nowrap' }"
                >
                  <template #index-cell="{ row }">
                    {{ row.index + 1 }}
                  </template>
                  <template #link-cell="{ row }">
                    <div class="flex items-center gap-2">
                      <UButton
                        icon="i-heroicons-qr-code"
                        variant="outline"
                        size="xs"
                        @click="selectedPurchaseLink = row.original"
                      />
                      <UButton
                        icon="i-heroicons-document-duplicate"
                        size="xs"
                        variant="outline"
                        :disabled="!row.original.url"
                        @click="copyPurchaseLink(row.original.url)"
                      />
                      <UButton
                        class="font-mono break-all"
                        :label="row.original.url"
                        :to="row.original.url"
                        color="neutral"
                        variant="outline"
                        size="xs"
                        target="_blank"
                      />
                    </div>
                  </template>
                </UTable>
              </UCard>
              <div v-else-if="purchaseLinks[0]" class="flex items-center gap-2">
                <UButton
                  icon="i-heroicons-qr-code"
                  variant="outline"
                  size="xs"
                  @click="selectedPurchaseLink = purchaseLinks[0]"
                />
                <UButton
                  icon="i-heroicons-document-duplicate"
                  size="xs"
                  variant="outline"
                  :disabled="!purchaseLinks[0]?.url"
                  @click="copyPurchaseLink(purchaseLinks[0]?.url || '')"
                />
                <UButton
                  icon="i-heroicons-arrow-top-right-on-square"
                  :to="purchaseLinks[0].url"
                  target="_blank"
                  size="xs"
                  variant="outline"
                />
                <UInput
                  class="grow font-mono"
                  :model-value="purchaseLinks[0].url"
                  :disabled="true"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
              </div>
            </UCard>

            <UFormField class="flex items-center">
              <UTooltip class="flex items-center gap-2" :text="$t('nft_book_form.is_adult_only_tooltip')">
                <UCheckbox
                  v-model="isAdultOnly"
                  name="isAdultOnly"
                  :label="$t('nft_book_form.is_adult_only')"
                />

                <UIcon name="i-heroicons-question-mark-circle" />
              </UTooltip>
            </UFormField>

            <UFormField :label="$t('form.table_of_content')">
              <UTextarea
                v-model="tableOfContents"
                :rows="8"
                placeholder="- Chapter 1&#10;- Chapter 2&#10;  - Section 2.1"
              />
            </UFormField>
          </div>
          <div class="flex items-center justify-center w-full mt-4">
            <UButton
              :label="$t('common.save')"
              :loading="isLoading"
              size="lg"
              :disabled="isLoading"
              @click="updateSettings"
            />
          </div>
        </template>
      </UCard>
    </template>

    <UModal v-model:open="isOpenQRCodeModal">
      <template #content>
        <QRCodeGenerator
          v-if="selectedPurchaseLink"
          :data="selectedPurchaseLink.url"
          :file-name="getQRCodeFilename(selectedPurchaseLink.channel)"
          :width="500"
          :height="500"
        >
          <template #header>
            <h3 class="font-bold font-mono" v-text="$t('purchase_link.download_qr_modal')" />
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              @click="isOpenQRCodeModal = false"
            />
          </template>
        </QRCodeGenerator>
      </template>
    </UModal>
    <UModal v-model:open="showRestockModal">
      <template #content>
        <LiteMintNFT
          :is-restock="true"
          :restock-count="stockBalance"
          :iscn-id="classId"
          @submit="handleMintNFTSubmit"
        />
      </template>
    </UModal>

    <NuxtPage :transition="false" />
  </PageBody>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { getPortfolioURL, downloadFile, convertArrayOfObjectsToCSV, getPurchaseLink, copyToClipboard } from '~/utils'
import type { PurchaseItem, ClassListingData, ClassListingPrice, EditionTableRow } from '~/types'
import { getApiEndpoints } from '~/constant/api'
const { t: $t } = useI18n()

const MAX_EDITION_COUNT = 2
const AUTHOR_RESERVED_NFT_COUNT = 1

const { CHAIN_EXPLORER_URL, BOOK3_URL, LIKE_CO_API } = useRuntimeConfig().public
const bookstoreApiStore = useBookstoreApiStore()
const nftStore = useNftStore()
const stripeStore = useStripeStore()
const ordersStore = useOrdersStore()
const { token, wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { ordersByClassIdMap } = storeToRefs(ordersStore)
const { updateBookListingSetting, reduceListingPendingNFTCountById } = bookstoreApiStore
const { lazyFetchClassMetadataById } = nftStore
const { fetchStripeConnectStatusByWallet } = stripeStore
const { getBalanceOf } = useNFTContractReader()

const route = useRoute()
const localeRoute = useLocaleRoute()
const toast = useToast()
const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)

const error = ref('')
const isLoading = ref(false)
const classId = ref<string>(route.params.classId as string)
const fromChannelInput = ref('')
const priceIndex = ref(0)
const classListingInfo = ref<ClassListingData>({} as ClassListingData)
const prices = ref<ClassListingPrice[]>([])
const isUpdatingPricesOrder = ref(false)
const shouldShowAdvanceSettings = ref<boolean>(false)
const showEditISCN = ref(false)

// Search
const searchInput = ref('')

const tableOfContents = ref('')

const moderatorWallets = ref<string[]>([])
const moderatorWalletInput = ref('')
const notificationEmailInput = ref('')
const isStripeConnectChecked = ref(false)
const stripeConnectWallet = ref('')
const connectedWallets = ref<Record<string, number>>({})
const mustClaimToView = ref(true)
const hideDownload = ref(false)
const isAdultOnly = ref(false)
const enableCustomMessagePage = ref(true)
const useLikerLandPurchaseLink = ref(true)
const shouldDisableStripeConnectSetting = ref(false)
const isUsingDefaultAccount = ref(true)

const stockBalance = ref(-99)
const showRestockModal = ref(false)

const nftClassName = computed(() => nftStore.getClassMetadataById(classId.value as string)?.name)
const affiliationLink = computed(() => {
  const baseUrl = `${BOOK3_URL}/store/${classId.value}`
  if (userLikerInfo.value?.user) {
    return `${baseUrl}?from=@${userLikerInfo.value.user}`
  }
  return baseUrl
})
const ownerWallet = computed(() => classListingInfo?.value?.ownerWallet)
const userIsOwner = computed(() => sessionWallet.value && ownerWallet.value === sessionWallet.value)
const userCanSendNFT = computed(() => userIsOwner.value)
const purchaseLinks = computed(() =>
  fromChannelInput.value
    .split(',')
    .filter((c, index) => !!c || index === 0)
    .map(c => c.trim())
    .map(channel => ({
      channel,
      url: getPurchaseLink({
        classId: classId.value,
        priceIndex: priceIndex.value,
        channel,
        isUseLikerLandLink: useLikerLandPurchaseLink.value
      })
    }))
)

const selectedPurchaseLink = ref<{
  channel: string,
  url: string,
} | undefined>(undefined)

const isOpenQRCodeModal = computed({
  get: () => !!selectedPurchaseLink.value,
  set: (value) => {
    if (!value) {
      selectedPurchaseLink.value = undefined
    }
  }
})

const salesChannelMap = computed(() => {
  if (!purchaseList.value.length) {
    return {}
  }
  const map: {
    [key in string]: {
      count: number,
      totalUSD: number
    };
  } = purchaseList.value.reduce((acc: Record<string, { count: number; totalUSD: number }>, cur: PurchaseItem) => {
    const from = cur.from || 'empty'
    if (!acc[from]) {
      acc[from] = {
        count: 0,
        totalUSD: 0
      }
    }
    acc[from].count += 1
    acc[from].totalUSD += cur.price
    return acc
  }, {})
  return map
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
    { accessorKey: 'message', header: $t('table.reader_message') }
  ]
})

const ordersData = computed(() => {
  const orders = ordersByClassIdMap.value.get(classId.value) || []
  return orders
})

function getQRCodeFilename (channel = '') {
  const filenameParts = [`${nftClassName.value || classId.value}`, `price_${priceIndex.value}`]
  if (channel) {
    filenameParts.push(`channel_${channel}`)
  }
  return filenameParts.join('_')
}

function getOrdersTableActionItems (purchaseListItem: PurchaseItem) {
  const actionItems = []

  if (purchaseListItem.status === 'completed' && purchaseListItem.txHash) {
    actionItems.push([{
      label: $t('status_page.view_transaction'),
      icon: 'i-heroicons-magnifying-glass',
      to: `${CHAIN_EXPLORER_URL}/${purchaseListItem.txHash}`,
      target: '_blank'
    }])
  } else if (purchaseListItem.status === 'pendingNFT' && userCanSendNFT.value) {
    actionItems.push([{
      label: 'Send NFT',
      icon: 'i-heroicons-paper-airplane',
      to: localeRoute({
        name: 'my-books-send-classId',
        params: {
          classId: purchaseListItem.classId
        },
        query: {
          owner_wallet: ownerWallet.value,
          payment_id: purchaseListItem.id
        }
      })
    }])
  }

  if (purchaseListItem.status === 'paid') {
    actionItems.push([{
      label: $t('status_page.send_reminder_email'),
      icon: 'i-heroicons-envelope',
      onSelect: () => {
        sendReminderEmail(purchaseListItem)
      }
    }])
  }

  if (['pendingNFT', 'paid'].includes(purchaseListItem.status)) {
    actionItems.push([{
      label: $t('status_page.mark_complete'),
      icon: 'i-heroicons-check-circle',
      onSelect: () => {
        hardSetStatusToCompleted(purchaseListItem)
      }
    }])
  }

  return actionItems
}

function getStatusLabel (purchaseListItem: PurchaseItem) {
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

function getStatusLabelColor (purchaseListItem: PurchaseItem): 'info' | 'warning' | 'success' | 'neutral' {
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
  actions: getOrdersTableActionItems(p)
})).filter((p) => {
  if (!searchInput.value) { return true }
  const normalizedSearchInput = searchInput.value.toLowerCase()
  return (
    p.readerEmail.toLowerCase().includes(normalizedSearchInput) ||
    p.buyerEmail.toLowerCase().includes(normalizedSearchInput) ||
    p.buyerPhone.toLowerCase().includes(normalizedSearchInput) ||
    p.wallet?.toLowerCase().includes(normalizedSearchInput) ||
    p.priceName?.toLowerCase().includes(normalizedSearchInput) ||
    p.statusLabel?.toLowerCase().includes(normalizedSearchInput) ||
    p.orderDate?.toLowerCase().includes(normalizedSearchInput) ||
    p.from?.toLowerCase().includes(normalizedSearchInput)
  )
}))

const moderatorWalletsTableColumns = computed(() => {
  const columns = [{ accessorKey: 'wallet', header: $t('table.wallet') }]

  if (userIsOwner.value) {
    columns.push(
      { accessorKey: 'remove', header: '' }
    )
  }

  return columns
})

const moderatorWalletsTableRows = computed(() => moderatorWallets.value.map((wallet, index) => {
  return {
    index,
    wallet,
    shortenWallet: shortenWalletAddress(wallet),
    walletLink: getPortfolioURL(wallet)
  }
}))

function normalizeChannelId (channelId: string) {
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
  totalUSD: (value.totalUSD || 0).toFixed(2)
})))

const priceIndexOptions = computed(() => classListingInfo.value.prices?.map((p: ClassListingPrice, index: number) => ({
  label: `${typeof p.name === 'object' ? (p.name.en || '') : p.name} - $${p.price}`,
  value: index,
  disabled: index === priceIndex.value
})) || [])

const editionsTableColumns = computed(() => {
  const columns = []

  columns.push(
    { accessorKey: 'sort', header: $t('table.sort'), class: 'w-[60px]' },
    { accessorKey: 'name', header: $t('table.name') },
    {
      accessorKey: 'delivery',
      header: $t('table.delivery'),
      class: 'w-[120px]'
    },
    { accessorKey: 'stock', header: $t('table.stock'), class: 'w-[120px]' },
    { accessorKey: 'price', header: $t('table.price_usd'), class: 'w-[120px]' }
  )

  if (userIsOwner.value) {
    columns.push({ accessorKey: 'details', header: $t('table.details'), class: 'w-[80px]' })
  }

  return columns
})

const editionsTableRows = computed(() => {
  const rows: EditionTableRow[] = prices.value.map((element, index) => ({
    ...element,
    originalIndex: index,
    isStockBalancePlaceholderRow: false
  }))

  // If it's a manual edition, add a row for stock balance.
  if (prices.value.some(price => !price.isAutoDeliver)) {
    rows.push({
      name: '',
      isAutoDeliver: false,
      stock: $t('table.stock_balance', { count: stockBalance.value }),
      price: '',
      isStockBalancePlaceholderRow: true,
      originalIndex: -1,
      index: -1,
      description: '',
      isAllowCustomPrice: false
    })
  }

  return rows
})

whenever(isLoading, () => { error.value = '' })

watch(sessionWallet, async (newWallet) => {
  if (newWallet) {
    await calculateStock()
  } else {
    stockBalance.value = -99
  }
})

onMounted(async () => {
  isLoading.value = true
  try {
    const classData = await $fetch<ClassListingData>(`${LIKE_CO_API}/likernft/book/store/${classId.value}`,
      {
        headers: {
          authorization: `Bearer ${token.value}`
        }
      })
    classListingInfo.value = classData
    prices.value = classListingInfo.value.prices
    const {
      moderatorWallets: classModeratorWallets,
      connectedWallets: classConnectedWallets,
      mustClaimToView: classMustClaimToView,
      tableOfContents: classTableOfContent,
      enableCustomMessagePage: classEnableCustomMessagePage,
      hideDownload: classHideDownload,
      isAdultOnly: classIsAdultOnly
    } = classData
    moderatorWallets.value = classModeratorWallets || []
    isStripeConnectChecked.value = !!(classConnectedWallets && Object.keys(classConnectedWallets).length)
    connectedWallets.value = classConnectedWallets || {}

    const classStripeWallet = classConnectedWallets && Object.keys(classConnectedWallets)[0]
    if (classStripeWallet) {
      stripeConnectWallet.value = classStripeWallet
      if (classStripeWallet !== sessionWallet.value) {
        isUsingDefaultAccount.value = false
        try {
          await fetchStripeConnectStatusByWallet(classStripeWallet)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err)
        }
      }
    }
    mustClaimToView.value = classMustClaimToView ?? true
    hideDownload.value = classHideDownload ?? false
    isAdultOnly.value = classIsAdultOnly ?? false
    enableCustomMessagePage.value = classEnableCustomMessagePage ?? true
    tableOfContents.value = classTableOfContent ?? ''
    await ordersStore.fetchOrdersByClassId([classId.value])

    if (sessionWallet.value) {
      await calculateStock()
      try {
        await fetchStripeConnectStatusByWallet(sessionWallet.value)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
      }
    }
    lazyFetchClassMetadataById(classId.value as string)
  } catch (err) {
    error.value = (err as Error).toString()
  } finally {
    isLoading.value = false
  }
})

async function calculateStock () {
  const pendingNFTCount = classListingInfo.value.pendingNFTCount || 0
  const count = await getBalanceOf(classId.value, sessionWallet.value as string)
  const manuallyAssignedNFTCount = prices.value
    .filter(price => !price.isAutoDeliver)
    .reduce((total, price) => total + (price.stock || 0), 0)
  stockBalance.value = (Number(count) - manuallyAssignedNFTCount - AUTHOR_RESERVED_NFT_COUNT - pendingNFTCount) || 0
}

async function movePriceUp (index: number) {
  if (index <= 0) { return }
  await movePrice(index, index - 1)
}

async function movePriceDown (index: number) {
  if (index >= prices.value.length - 1) { return }
  await movePrice(index, index + 1)
}

async function movePrice (fromIndex: number, toIndex: number) {
  try {
    isUpdatingPricesOrder.value = true

    const newPrices = [...prices.value]
    const [movedItem] = newPrices.splice(fromIndex, 1)
    if (!movedItem) { return }
    newPrices.splice(toIndex, 0, movedItem)
    const edition = prices.value[fromIndex]
    if (!edition) { return }
    const priceIndex = edition.index
    await $fetch(`${LIKE_CO_API}/likernft/book/store/${classId.value}/price/${priceIndex}/order`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token.value}`
      },
      body: {
        order: toIndex
      }
    })
    prices.value = newPrices.map((p, order) => ({ ...p, order }))
    classListingInfo.value.prices = prices.value
    toast.add({
      icon: 'i-heroicons-check-circle',
      title: 'Updated editions order successfully',
      duration: 2000,
      color: 'success'
    })
  } catch (err) {
    prices.value = classListingInfo.value.prices
    error.value = (err as Error).toString()
  } finally {
    isUpdatingPricesOrder.value = false
  }
}

async function sendReminderEmail (purchase: PurchaseItem) {
  const orderData = ordersData.value?.find(p => p.id === purchase.id)
  if (!orderData) {
    throw new Error('ORDER_NOT_FOUND')
  }

  await $fetch(`${LIKE_CO_API}/likernft/book/purchase/${classId.value}/status/${purchase.id}/remind`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.value}`
      }
    })

  toast.add({
    icon: 'i-heroicons-check-circle',
    title: $t('status_page.send_reminder_email'),
    duration: 2000,
    color: 'success'
  })
}

async function hardSetStatusToCompleted (purchase: PurchaseItem) {
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
    await $fetch(`${LIKE_CO_API}/likernft/book/purchase/${classId.value}/sent/${purchase.id}`,
      {
        method: 'POST',
        body: {
          txHash: null,
          quantity: purchase.quantity || 1
        },
        headers: {
          authorization: `Bearer ${token.value}`
        }
      })
  } catch (err) {
    mutableOrder.status = previousStatus
    throw err
  }

  if (previousStatus === 'pendingNFT') {
    classListingInfo.value.pendingNFTCount = (classListingInfo.value.pendingNFTCount || 0) - 1
    reduceListingPendingNFTCountById(classId.value, 1)
  }
}

function addModeratorWallet () {
  if (!moderatorWalletInput.value) { return }
  moderatorWallets.value.push(moderatorWalletInput.value)
  moderatorWalletInput.value = ''
}

async function updateSettings () {
  try {
    if (moderatorWalletInput.value) {
      throw new Error($t('errors.add_moderator_wallet'))
    }
    if (notificationEmailInput.value) {
      throw new Error($t('errors.add_notification_email'))
    }
    isLoading.value = true

    const newConnectedWallets = (isStripeConnectChecked.value && stripeConnectWallet.value)
      ? connectedWallets.value
      : null
    await updateBookListingSetting(classId.value as string, {
      moderatorWallets: moderatorWallets.value,
      connectedWallets: newConnectedWallets,
      hideDownload: hideDownload.value,
      isAdultOnly: isAdultOnly.value,
      mustClaimToView: mustClaimToView.value,
      tableOfContents: tableOfContents.value,
      enableCustomMessagePage: enableCustomMessagePage.value
    })
    await navigateTo(localeRoute({
      name: 'my-books'
    }))
  } catch (err) {
    const errorData = (err as { data?: string }).data || err
    console.error(errorData)
    error.value = String(errorData)
  } finally {
    isLoading.value = false
    shouldDisableStripeConnectSetting.value = false
  }
}

function copyPurchaseLink (text = '') {
  copyToClipboard(text, $t('purchase_link.copied_to_clipboard'))
}

function downloadAllPurchaseLinks () {
  downloadFile({
    data: purchaseLinks.value,
    fileName: `${classId.value}_purchase_links.csv`,
    fileType: 'csv'
  })
}

function printAllQRCodes () {
  try {
    sessionStorage.setItem(
      'nft_book_press_batch_qrcode',
      convertArrayOfObjectsToCSV(purchaseLinks.value.map(({ channel, ...link }) => ({ key: channel, ...link })))
    )
    window.open('/batch-qrcode?print=1', 'batch_qrcode', 'popup,menubar=no,location=no,status=no')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('purchase_link.failed_print_qr'),
      duration: 0,
      color: 'error'
    })
  }
}

async function shortenAllLinks () {
  try {
    sessionStorage.setItem(
      'nft_book_press_batch_shorten_url',
      convertArrayOfObjectsToCSV(purchaseLinks.value.map(({ channel, url }) => ({ key: channel, url })))
    )
    await navigateTo(localeRoute({ name: 'batch-short-links', query: { print: 1 } }))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('purchase_link.failed_shorten_links'),
      duration: 0,
      color: 'error'
    })
  }
}

function handleOpenRestockModal () {
  showRestockModal.value = true
}

async function handleMintNFTSubmit () {
  await calculateStock()
  showRestockModal.value = false
}

function isContentFingerprintEncrypted (contentFingerprints: string[]) {
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK
  return contentFingerprints.some((fingerprint) => {
    return !!fingerprint.startsWith(arweaveLinkEndpoint) || fingerprint.includes('?key=')
  })
}

async function handleISCNUpdated ({
  classId,
  metadata
}: {
  classId: string
  metadata: Record<string, unknown> & { contentFingerprints?: string[] }
}) {
  const { contentFingerprints } = metadata
  if (contentFingerprints) {
    const shouldHideDownload = isContentFingerprintEncrypted(contentFingerprints)
    if (shouldHideDownload !== hideDownload.value) {
      hideDownload.value = shouldHideDownload
    }
    await updateBookListingSetting(classId, {
      hideDownload: shouldHideDownload
    })
  }
}
</script>
