<template>
  <!-- overflow-y-visible! undoes the `overflow-y-auto` <NuxtPage> puts on every
       page root: it makes this element a scrollport that never scrolls (the
       real one is <main>), which would pin the sticky bar below in place. -->
  <PageBody class="space-y-10 pb-10 overflow-y-visible!">
    <BookStatusPendingChangesBar
      v-if="bookstoreApiStore.isAuthenticated && userIsOwner"
      :changes="changes"
      :audience="changeAudience"
      :buyer-count="buyerCount"
      :needs-wallet-signature="needsWalletSignature"
      :is-saving="isSavingChanges"
      :last-saved-at="lastSavedAt"
      @save="saveAllChanges"
      @discard="discardAllChanges"
      @jump="(tab: BookStatusTab) => (selectedTabItemIndex = tab)"
    />

    <AppErrorAlert v-model="error" />

    <UProgress
      v-if="isLoading"
      animation="carousel"
    >
      <template #indicator>
        {{ $t('loading.progress') }}
      </template>
    </UProgress>

    <template v-if="bookstoreApiStore.isAuthenticated">
      <h1
        class="font-bold font-mono text-lg text-highlighted"
        v-text="nftClassName || classId"
      />

      <!-- Labels only: each pane below mounts on its first visit and then stays
           mounted (v-show), so edits survive visiting another tab while they
           wait in the bar and an unopened tab fetches nothing. -->
      <UTabs
        v-model="selectedTabItemIndex"
        class="w-full"
        :items="tabItems"
        :content="false"
      />

      <div
        v-if="visitedTabs.has('files')"
        v-show="selectedTabItemIndex === 'files'"
        class="mt-4"
      >
        <BookStatusBookFilesCard
          :key="filesRefreshCounter"
          :class-id="classId"
          @cover-replaced="handleCoverReplaced"
        />
      </div>

      <div
        v-if="visitedTabs.has('details')"
        v-show="selectedTabItemIndex === 'details'"
        class="space-y-10 mt-4"
      >
        <BookStatusBookDetailsSection
          ref="detailsSectionRef"
          :class-id="classId"
          :class-listing-info="classListingInfo"
          :settings="listingSettings"
        />
      </div>

      <div
        v-if="visitedTabs.has('pricing')"
        v-show="selectedTabItemIndex === 'pricing'"
        class="space-y-10 mt-4"
      >
        <BookStatusEditionsCard
          v-model:prices="prices"
          :class-id="classId"
          :stock-balance="stockBalance"
          :locked="changeCount > 0"
          @restocked="calculateStock"
          @added="refreshListingInfo"
          @error="(message: string) => (error = message)"
        />
        <PublishPricingForm
          v-if="userIsOwner && editedPrices.length"
          ref="managePricingFormRef"
          v-model:prices="editedPrices"
          v-model:settings="managePricingSettings"
          v-model:signature-image="signatureImage"
          mode="manage"
          :has-existing-signature-image="hasExistingSignatureImage"
        />
        <BookStatusBookListingSettingsCard
          v-if="userIsOwner"
          :settings="listingSettings"
          :is-free-book="isFreeBook"
        />
        <BookStatusFileProtectionCard :is-encrypted="listingSettings.hideDownload.value" />
      </div>

      <div
        v-if="visitedTabs.has('summary')"
        v-show="selectedTabItemIndex === 'summary'"
        class="mt-4"
      >
        <BookStatusBookSummaryTab
          :key="summaryRefreshCounter"
          v-model:prices="editedPrices"
          :class-id="classId"
          :class-listing-info="classListingInfo"
          :store-url="affiliationLink"
          :buyer-count="buyerCount"
          :pending-changes="changes"
          @go-to-tab="(tab: BookStatusTab) => (selectedTabItemIndex = tab)"
        />
      </div>

      <div
        v-if="visitedTabs.has('sales')"
        v-show="selectedTabItemIndex === 'sales'"
        class="space-y-10 mt-4"
      >
        <UAlert
          v-if="pendingNFTCount > 0"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-circle"
          :title="$t('status_page.pending_send_banner_title', { count: pendingNFTCount })"
          :description="$t('status_page.pending_send_banner_description')"
        />
        <BookStatusSalesOrdersTab
          :class-id="classId"
          :owner-wallet="ownerWallet"
          @reduce-pending-nft="handleReducePendingNft"
        />
        <BookStatusPurchaseLinksCard
          :class-id="classId"
          :prices="prices"
          :book-name="nftClassName"
        />
      </div>
    </template>
  </PageBody>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { ClassListingData, ClassListingPrice } from '~/types'
import { BOOK_STATUS_TABS, type BookStatusTab } from '~/types/book'
import type { PriceFormItem, PricingFormSettings } from '~/types/publish'
import type { BookEditEditionChange } from '~/composables/useBookEditChanges'
import { mapListingPriceToFormItem, mapPriceFormItemsToPayload, getPriceItemUSDValue } from '~/utils/listing'
import { PREVIEW_PERCENTAGE_DEFAULT } from '~/constant'

const { t: $t } = useI18n()

const AUTHOR_RESERVED_NFT_COUNT = 1

const { BOOK3_URL } = useRuntimeConfig().public
const apiFetch = useLikeCoApiFetch()
const bookstoreApiStore = useBookstoreApiStore()
const { updateBookListingSetting, updateEditionPrice, uploadSignImages } = bookstoreApiStore
const nftStore = useNftStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { lazyFetchClassMetadataById } = nftStore
const { getBalanceOf } = useNFTContractReader()
const { showSuccessToast, showErrorToast } = useToastComposable()

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

// What BookDetailsSection exposes to the save orchestration.
interface BookDetailsSectionApi {
  isChainDirty: boolean
  changedFields: string[]
  pendingModeratorInput: boolean
  setCoverUrl: (coverUrl: string) => void
  saveChain: () => Promise<boolean>
  discardChain: () => Promise<void>
}
const detailsSectionRef = ref<BookDetailsSectionApi | null>(null)

// Editable copy of the editions, diffed per edition against a baseline taken
// at load; the manage-mode pricing form writes into it and the bar saves the
// dirty ones through the per-edition PUT.
const editedPrices = ref<PriceFormItem[]>([])
const editionBaselines = ref<string[]>([])
const signatureImage = ref<File | null>(null)
const managePricingFormRef = ref<{ validate: () => Promise<boolean> } | null>(null)
// Required by PricingForm's model; every field it drives is hidden in manage
// mode, so this never reaches a payload.
const managePricingSettings = ref<PricingFormSettings>({
  isAllowCustomPrice: true,
  isAdultOnly: false,
  hideAudio: false,
  isPlusReadingEnabled: false,
  isPreviewEnabled: false,
  previewPercentage: PREVIEW_PERCENTAGE_DEFAULT,
  tableOfContents: '',
  connectedWallets: null,
})
const hasExistingSignatureImage = computed(() => !!classListingInfo.value.enableSignatureImage)

// Read from the draft so pricing an edition down to free forces Plus reading
// on in the same save, rather than only after the post-save refetch. The draft
// is empty until the listing loads, so the persisted prices seed it.
const isFreeBook = computed(() => (editedPrices.value.length
  ? editedPrices.value.some(p => getPriceItemUSDValue(p) === 0)
  : (classListingInfo.value.prices || []).some(p => Number(p.price) === 0)))

// One settings instance for the whole page: the /settings POST echoes every
// field back, so the tabs that edit different fields must share state.
const listingSettings = useBookListingSettings({
  classListingInfo: () => classListingInfo.value,
  isFreeBook,
})

function rebuildEditionDraft() {
  editedPrices.value = prices.value.map(mapListingPriceToFormItem)
  editionBaselines.value = editedPrices.value.map(item => JSON.stringify(item))
}

function getEditionChanges(): BookEditEditionChange[] {
  return editedPrices.value
    .map((item, index) => ({
      index,
      name: item.name,
      changedFields: getChangedKeysFromSnapshot(
        editionBaselines.value[index] ?? '',
        item as unknown as Record<string, unknown>,
      ),
    }))
    .filter(change => change.changedFields.length > 0)
}

// The pending-changes ledger the bar, the tab badge and the summary tab share.
const { changes, changeCount, changeAudience, needsWalletSignature } = useBookEditChanges({
  chainChangedFields: () => detailsSectionRef.value?.changedFields ?? [],
  settingsChangedKeys: () => listingSettings.changedSettingKeys(),
  editionChanges: getEditionChanges,
  signatureChanged: () => !!signatureImage.value,
})

const isSavingChanges = ref(false)
const lastSavedAt = ref<number | null>(null)
// Remounts the summary tab after a save so its chain-metadata copy refetches.
const summaryRefreshCounter = ref(0)
// Same for the files tab, on discard as well as save: it holds the picked
// cover's preview and its 待儲存 badge, neither of which survives either.
const filesRefreshCounter = ref(0)

// Tabs
const tabItems = computed(() => [
  { label: $t('status_page.tab_files'), value: 'files' },
  { label: $t('status_page.tab_book_details'), value: 'details' },
  { label: $t('status_page.tab_pricing'), value: 'pricing' },
  {
    label: $t('status_page.tab_summary'),
    value: 'summary',
    // The unsaved-changes count, as the mock shows it: on the summary tab.
    badge: changeCount.value || undefined,
  },
  { label: $t('status_page.tab_sales_orders'), value: 'sales' },
])

// An unrecognised ?tab= would leave every pane unmounted, so fall back.
const queryTab = route.query.tab as BookStatusTab
const selectedTabItemIndex = ref<BookStatusTab>(
  BOOK_STATUS_TABS.includes(queryTab) ? queryTab : 'details',
)

// A pane mounts on its first visit and stays mounted from then on, so an
// unopened tab costs no fetches while edits still survive tab switches.
// 'details' is seeded regardless: it owns the chain form the 書檔 tab writes a
// replaced cover into, and its metadata fetch is the same cached one 書檔 makes.
const visitedTabs = reactive(new Set<BookStatusTab>([selectedTabItemIndex.value, 'details']))

watch(selectedTabItemIndex, (value) => {
  if (value) {
    visitedTabs.add(value)
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
const pendingNFTCount = computed(() => classListingInfo.value.pendingNFTCount || 0)
// Owner-only per-edition counter, so this is the author's own reader count.
const buyerCount = computed(() => (classListingInfo.value.prices || [])
  .reduce((total, price) => total + (price.sold || 0), 0))

watch(sessionWallet, async (newWallet) => {
  if (newWallet) {
    await calculateStock()
  }
  else {
    stockBalance.value = -99
  }
})

// Keep the cached listing copy of prices in sync after reorders, and rebuild
// the edit draft from the fresh order. Reorders are locked while edits pend,
// so this never wipes anything the bar is still counting.
watch(prices, (value) => {
  classListingInfo.value.prices = value
  rebuildEditionDraft()
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

function handleCoverReplaced(coverUrl: string) {
  detailsSectionRef.value?.setCoverUrl(coverUrl)
}

function handleReducePendingNft() {
  classListingInfo.value.pendingNFTCount = (classListingInfo.value.pendingNFTCount || 0) - 1
}

// Two-phase save: REST first, the wallet-signed chain tx last, per-group
// failure handling. A failed group keeps its changes counted in the bar; a
// wallet reject therefore never rolls back the settings that already saved.
async function saveAllChanges() {
  if (isSavingChanges.value) { return }
  const details = detailsSectionRef.value
  if (details?.pendingModeratorInput) {
    showErrorToast($t('errors.add_moderator_wallet'))
    selectedTabItemIndex.value = 'details'
    return
  }
  isSavingChanges.value = true
  try {
    let savedSomething = false

    if (listingSettings.isListingSettingsDirty()) {
      try {
        await updateBookListingSetting(classId.value, listingSettings.buildSettingsPayload())
        listingSettings.commitListingSnapshot()
        savedSomething = true
      }
      catch (err) {
        handleGroupSaveError($t('nft_book_form.sale_settings'), err)
        return
      }
    }

    const editionChanges = getEditionChanges()
    if (editionChanges.length || signatureImage.value) {
      try {
        if (!(await managePricingFormRef.value?.validate())) {
          selectedTabItemIndex.value = 'pricing'
          return
        }
        const mapped = mapPriceFormItemsToPayload(editedPrices.value)
        for (const change of editionChanges) {
          const listingIndex = prices.value[change.index]?.index
          const payload = mapped[change.index]
          if (listingIndex === undefined || !payload) { continue }
          await updateEditionPrice(classId.value, listingIndex, { price: payload })
          // Committed one by one so a mid-loop failure keeps only the
          // unsaved editions counted.
          const item = editedPrices.value[change.index]
          if (item) { editionBaselines.value[change.index] = JSON.stringify(item) }
        }
        if (signatureImage.value) {
          const form = new FormData()
          form.append('signImage', signatureImage.value)
          await uploadSignImages(form, classId.value)
          signatureImage.value = null
        }
        savedSomething = true
      }
      catch (err) {
        handleGroupSaveError($t('pages.editions'), err)
        return
      }
    }

    if (details?.isChainDirty) {
      try {
        if (!(await details.saveChain())) {
          // Validation failed; the form already shows the field errors.
          selectedTabItemIndex.value = 'details'
          return
        }
        savedSomething = true
        // The saved fingerprints can flip hideDownload, re-dirtying the
        // settings; sync that within the same save.
        if (listingSettings.isListingSettingsDirty()) {
          await updateBookListingSetting(classId.value, listingSettings.buildSettingsPayload())
          listingSettings.commitListingSnapshot()
        }
      }
      catch (err) {
        handleGroupSaveError($t('status_page.tab_book_details'), err)
        return
      }
    }

    if (savedSomething) {
      lastSavedAt.value = Date.now()
      showSuccessToast($t('status_page.settings_saved'))
      await refreshListingInfo()
      summaryRefreshCounter.value += 1
      filesRefreshCounter.value += 1
    }
  }
  finally {
    isSavingChanges.value = false
  }
}

function handleGroupSaveError(group: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(err)
  const error = getApiErrorMessage(err, $t)
  showErrorToast($t('status_page.save_group_failed', { group, error }), { duration: 5000 })
}

async function discardAllChanges() {
  if (!window.confirm($t('status_page.discard_confirm'))) { return }
  listingSettings.restoreListingFromSnapshot()
  rebuildEditionDraft()
  signatureImage.value = null
  await detailsSectionRef.value?.discardChain()
  filesRefreshCounter.value += 1
}

// Unsaved edits guard the page as a whole; the forms' own guards are off.
useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (changeCount.value > 0) {
    event.preventDefault()
    event.returnValue = ''
  }
})

onBeforeRouteLeave(() => {
  if (changeCount.value > 0) {
    return window.confirm($t('unsaved_changes_warning'))
  }
  return true
})
</script>
