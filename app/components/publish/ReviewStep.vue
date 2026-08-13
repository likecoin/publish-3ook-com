<template>
  <div class="flex flex-col gap-[16px] text-left">
    <!-- Assembled from the same draft the steps above edited. The NT$/HK$
         figures are the API's hand-tuned price ladders mirrored in
         `~/utils/pricing`, not a live conversion. -->
    <PublishReviewReaderPreviewCard
      :prices="listingDraft.prices"
      :title="iscnFormData.title"
      :subtitle="iscnFormData.alternativeHeadline"
      :author-name="iscnFormData.author.name"
      :cover-image-src="coverImageSrc"
      :is-preview-enabled="listingDraft.isPreviewEnabled"
      :preview-percentage="listingDraft.previewPercentage"
      :is-downloadable="!encryptEbook"
      :is-plus-reading-enabled="listingDraft.isPlusReadingEnabled"
    />

    <PublishReviewRevenueCard :prices="listingDraft.prices" />

    <!-- Files -->
    <UCard :ui="{ header: 'flex justify-between items-center' }">
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.files_title')"
        />
        <UButton
          variant="ghost"
          size="xs"
          icon="i-heroicons-pencil-square"
          :label="$t('publish_review.edit_section')"
          @click="emit('edit', 'files')"
        />
      </template>
      <ul class="space-y-2">
        <li
          v-for="record in fileRecords"
          :key="record.fileName"
          class="flex items-center justify-between text-sm"
        >
          <span
            class="font-medium text-highlighted"
            v-text="record.fileName"
          />
          <UBadge
            v-if="isRecordUploaded(record)"
            variant="soft"
            color="success"
            size="xs"
          >
            {{ $t('upload_form.file_already_uploaded') }}
          </UBadge>
          <UButton
            v-else-if="needsFileReselect(record)"
            variant="soft"
            color="error"
            size="xs"
            icon="i-heroicons-arrow-up-tray"
            :label="$t('upload_form.file_needs_reselect')"
            @click="emit('edit', 'files')"
          />
        </li>
      </ul>
    </UCard>

    <PublishReviewMetadataCard
      :iscn-form-data="iscnFormData"
      :description-full="listingDraft.descriptionFull"
      editable
      @edit="emit('edit', 'details')"
    />

    <PublishReviewPricingCard
      :prices="listingDraft.prices"
      :is-plus-reading-enabled="listingDraft.isPlusReadingEnabled"
      :hide-audio="listingDraft.hideAudio"
      :is-adult-only="listingDraft.isAdultOnly"
      editable
      @edit="emit('edit', 'pricing')"
    />
  </div>
</template>

<script setup lang="ts">
import type { FileRecord } from '~/types'
import type { ISCNFormData } from '~/types/iscn'
import type { PublishListingDraft } from '~/types/publish'
import { isRecordUploaded, needsFileReselect } from '~/utils/arweave'

const { t: $t } = useI18n()

const { fileRecords, encryptEbook, iscnFormData, listingDraft, coverImageSrc = '' } = defineProps<{
  fileRecords: FileRecord[]
  encryptEbook: boolean
  iscnFormData: ISCNFormData
  listingDraft: PublishListingDraft
  coverImageSrc?: string
}>()

const emit = defineEmits<{ edit: [step: string] }>()
</script>
