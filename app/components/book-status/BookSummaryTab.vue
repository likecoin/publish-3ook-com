<template>
  <div class="flex flex-col gap-[16px] text-left">
    <!-- Unsaved changes: the same ledger the bar counts, spelled out with
         jump links, since this tab's badge is what carries the number. -->
    <UCard v-if="pendingChanges.length">
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('status_page.pending_changes_title')"
        />
      </template>
      <ul class="space-y-1">
        <li
          v-for="entry in pendingChanges"
          :key="entry.key"
        >
          <UButton
            variant="link"
            color="neutral"
            :icon="getBookEditChangeIcon(entry) || 'i-heroicons-pencil-square'"
            :label="entry.label"
            @click="emit('goToTab', entry.tab)"
          />
        </li>
      </ul>
    </UCard>

    <BookStatusBookTodoCard
      :class-id="classId"
      :genre="iscnFormData.genre || storeGenre"
      :isbn="iscnFormData.isbn"
      :pending-nft-count="classListingInfo.pendingNFTCount"
      :has-store-metadata-mismatch="hasStoreMetadataMismatch"
      @go-to-tab="(tab: BookStatusTab) => emit('goToTab', tab)"
    />

    <!-- The draft is empty until the listing loads, and an editionless book has
         no sale state to show. -->
    <BookStatusBookSaleStateCard
      v-if="editedPrices.length"
      v-model:prices="editedPrices"
      :store-url="storeUrl"
      :can-edit="canEdit"
      :sold-count="soldCount"
      :is-pending-review="classListingInfo.isPendingReview ?? false"
      :is-hidden-by-platform="classListingInfo.isHidden ?? false"
    />

    <BookStatusBookLendingStateCard
      v-model="isPlusReadingEnabled"
      :can-edit="canEdit"
      :is-free-book="isFreeBook"
    />

    <!-- Fed the edit draft, not the saved listing, so the two radios above show
         their effect before the save that applies it. -->
    <PublishReviewReaderPreviewCard
      :prices="editedPrices"
      :title="iscnFormData.title"
      :subtitle="iscnFormData.alternativeHeadline"
      :author-name="iscnFormData.author.name"
      :cover-image-src="coverImageSrc"
      :is-preview-enabled="isPreviewEnabled"
      :preview-percentage="previewPercentage"
      :is-downloadable="!hideDownload"
      :is-audio-allowed="!hideAudio"
      :is-plus-reading-enabled="isPlusReadingEnabled"
    />
  </div>
</template>

<script setup lang="ts">
import type { ClassListingData } from '~/types'
import type { BookStatusTab } from '~/types/book'
import type { BookListingSettingsContext } from '~/composables/useBookListingSettings'
import type { ISCNFormData } from '~/types/iscn'
import { getBookEditChangeIcon, type BookEditChangeEntry } from '~/composables/useBookEditChanges'
import type { PriceFormItem } from '~/types/publish'
import { getSoldCount } from '~/utils/listing'
import { parseImageURLFromMetadata } from '~/utils'
import { createEmptyISCNFormData } from '~/utils/iscn'
import { getStoreMetadataDrift } from '~/utils/store-metadata-drift'
import { BOOK_CATEGORY_VALUES, MAX_BOOK_KEYWORDS } from '~/constant'

const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

const { classId, classListingInfo, storeUrl, settings, isFreeBook = false, canEdit = false, pendingChanges = [], hasStoreMetadataMismatch = false } = defineProps<{
  classId: string
  classListingInfo: ClassListingData
  storeUrl: string
  settings: BookListingSettingsContext
  isFreeBook?: boolean
  canEdit?: boolean
  pendingChanges?: BookEditChangeEntry[]
  // Passed down rather than recomputed here: the details tab owns the drift, so
  // a conflict the author resolves there stops being a todo immediately.
  hasStoreMetadataMismatch?: boolean
}>()

const soldCount = computed(() => getSoldCount(classListingInfo.prices))

// Asked of the drift rules rather than re-derived: only a category they would
// actually offer counts as having one, or 尚未設定分類 and the details form
// would disagree about the same book.
const storeGenre = computed(() => getStoreMetadataDrift({
  listing: classListingInfo,
  formData: iscnFormData.value,
  genreVocabulary: BOOK_CATEGORY_VALUES,
  maxKeywords: MAX_BOOK_KEYWORDS,
}).staged.genre || '')

const emit = defineEmits<{ goToTab: [tab: BookStatusTab] }>()

// The page's edition draft, so the sale-state control writes into the same
// state the pricing tab and the pending-changes bar work on.
const editedPrices = defineModel<PriceFormItem[]>('prices', { required: true })

const iscnFormData = ref<ISCNFormData>(createEmptyISCNFormData())

const {
  isPlusReadingEnabled,
  isPreviewEnabled,
  previewPercentage,
  hideDownload,
  hideAudio,
} = settings

// The chain metadata stores the cover as `ar://` / `ipfs://`, which no browser
// can fetch, so the gateway rewrite has to happen before it reaches an <img>.
const coverImageSrc = computed(() =>
  parseImageURLFromMetadata(iscnFormData.value.coverUrl))

// Cached after any other tab loaded it; the summary reads, never writes.
watch(() => classId, async () => {
  if (!classId) { return }
  try {
    const loaded = await loadClassMetadataIntoForm(classId)
    if (loaded) {
      iscnFormData.value = loaded.formData
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load class metadata for the summary tab:', error)
  }
}, { immediate: true })
</script>
