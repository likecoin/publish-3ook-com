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
            :icon="entry.needsWallet ? 'i-heroicons-wallet' : 'i-heroicons-pencil-square'"
            :label="entry.label"
            @click="emit('goToTab', entry.tab)"
          />
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('status_page.summary_status_title')"
        />
      </template>
      <dl class="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-6 gap-y-2 text-sm items-center">
        <dt
          class="text-muted"
          v-text="$t('table.status')"
        />
        <dd>
          <BookListingStatusBadge :status="listingStatus" />
        </dd>
        <template v-if="pendingNFTCount > 0">
          <dt
            class="text-muted"
            v-text="$t('status_page.summary_pending_send')"
          />
          <dd
            class="text-highlighted"
            v-text="pendingNFTCount"
          />
        </template>
      </dl>
    </UCard>

    <PublishReviewReaderPreviewCard
      :prices="priceFormItems"
      :title="iscnFormData.title"
      :subtitle="iscnFormData.alternativeHeadline"
      :author-name="iscnFormData.author.name"
      :cover-image-src="iscnFormData.coverUrl"
      :is-preview-enabled="classListingInfo.isPreviewEnabled ?? false"
      :preview-percentage="classListingInfo.previewPercentage ?? PREVIEW_PERCENTAGE_DEFAULT"
      :is-downloadable="!(classListingInfo.hideDownload ?? false)"
      :is-plus-reading-enabled="classListingInfo.isPlusReadingEnabled ?? false"
    />

    <PublishReviewRevenueCard :prices="priceFormItems" />

    <PublishReviewMetadataCard
      :iscn-form-data="iscnFormData"
      :description-full="classListingInfo.descriptionFull"
      editable
      @edit="emit('goToTab', 'details')"
    />

    <PublishReviewPricingCard
      :prices="priceFormItems"
      :is-plus-reading-enabled="classListingInfo.isPlusReadingEnabled ?? false"
      :hide-audio="classListingInfo.hideAudio ?? false"
      :is-allow-custom-price="priceFormItems[0]?.isAllowCustomPrice ?? true"
      :is-adult-only="classListingInfo.isAdultOnly ?? false"
      editable
      @edit="emit('goToTab', 'pricing')"
    />
  </div>
</template>

<script setup lang="ts">
import type { ClassListingData } from '~/types'
import type { BookStatusTab } from '~/types/book'
import type { ISCNFormData } from '~/types/iscn'
import type { BookEditChangeEntry } from '~/composables/useBookEditChanges'
import { getBookListingStatus, mapListingPriceToFormItem } from '~/utils/listing'
import { createEmptyISCNFormData } from '~/utils/iscn'
import { PREVIEW_PERCENTAGE_DEFAULT } from '~/constant'

const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

const { classId, classListingInfo, pendingChanges = [] } = defineProps<{
  classId: string
  classListingInfo: ClassListingData
  pendingChanges?: BookEditChangeEntry[]
}>()

const emit = defineEmits<{ goToTab: [tab: BookStatusTab] }>()

const iscnFormData = ref<ISCNFormData>(createEmptyISCNFormData())

const priceFormItems = computed(() =>
  (classListingInfo.prices || []).map(mapListingPriceToFormItem))

const pendingNFTCount = computed(() => classListingInfo.pendingNFTCount || 0)

const listingStatus = computed(() => getBookListingStatus(classListingInfo))

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
