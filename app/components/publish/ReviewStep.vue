<template>
  <div class="flex flex-col gap-[16px] text-left">
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
            class="font-medium text-gray-700"
            v-text="record.fileName"
          />
          <UBadge
            v-if="record.arweaveId"
            variant="soft"
            color="success"
            size="xs"
          >
            {{ $t('upload_form.file_already_uploaded') }}
          </UBadge>
          <UButton
            v-else-if="!record.fileBlob"
            variant="soft"
            color="error"
            size="xs"
            icon="i-heroicons-arrow-up-tray"
            :label="$t('upload_form.file_needs_reselect')"
            @click="emit('edit', 'files')"
          />
        </li>
      </ul>
      <p class="mt-3 text-sm text-gray-500">
        {{ encryptEbook
          ? $t('upload_form.drm_option_encrypted')
          : $t('upload_form.drm_option_open') }}
      </p>
    </UCard>

    <!-- Book details -->
    <UCard :ui="{ header: 'flex justify-between items-center' }">
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.metadata_title')"
        />
        <UButton
          variant="ghost"
          size="xs"
          icon="i-heroicons-pencil-square"
          :label="$t('publish_review.edit_section')"
          @click="emit('edit', 'details')"
        />
      </template>
      <div class="flex gap-4">
        <img
          v-if="coverImageSrc"
          :src="coverImageSrc"
          alt=""
          class="w-[80px] h-auto object-contain rounded border border-gray-200 self-start"
        >
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <template
            v-for="row in metadataRows"
            :key="row.label"
          >
            <dt
              class="text-gray-500"
              v-text="row.label"
            />
            <dd
              class="text-gray-700"
              v-text="row.value || '—'"
            />
          </template>
        </dl>
      </div>
    </UCard>

    <!-- Pricing -->
    <UCard :ui="{ header: 'flex justify-between items-center' }">
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.pricing_title')"
        />
        <UButton
          variant="ghost"
          size="xs"
          icon="i-heroicons-pencil-square"
          :label="$t('publish_review.edit_section')"
          @click="emit('edit', 'pricing')"
        />
      </template>
      <ul class="space-y-2 text-sm">
        <li
          v-for="(p, index) in listingDraft.prices"
          :key="p.index || index"
          class="flex items-baseline gap-x-3 flex-wrap"
        >
          <span
            class="font-medium text-gray-700"
            v-text="p.name || $t('nft_book_form.product_name_placeholder')"
          />
          <span class="text-gray-700">
            {{ formatPrice(p) }}
            <span
              class="text-gray-400"
              v-text="p.deliveryMethod === 'auto'
                ? `(${$t('nft_book_form.unlimited')})`
                : `(${$t('nft_book_form.stock')}: ${p.stock})`"
            />
          </span>
        </li>
      </ul>
      <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <template
          v-for="row in settingsRows"
          :key="row.label"
        >
          <dt
            class="text-gray-500"
            v-text="row.label"
          />
          <dd
            class="text-gray-700"
            v-text="row.value"
          />
        </template>
      </dl>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { FileRecord } from '~/types'
import type { ISCNFormData } from '~/types/iscn'
import type { PublishListingDraft, PriceFormItem } from '~/types/publish'
import { getPriceItemUSDValue } from '~/utils/listing'

const { t: $t } = useI18n()

const { fileRecords, encryptEbook, iscnFormData, listingDraft, coverImageSrc = '' } = defineProps<{
  fileRecords: FileRecord[]
  encryptEbook: boolean
  iscnFormData: ISCNFormData
  listingDraft: PublishListingDraft
  coverImageSrc?: string
}>()

const emit = defineEmits<{ edit: [step: string] }>()

const metadataRows = computed(() => [
  { label: $t('common.title'), value: iscnFormData.title },
  { label: $t('iscn_form.author_name'), value: iscnFormData.author.name },
  { label: $t('form.publisher'), value: iscnFormData.publisher.name },
  { label: $t('form.language'), value: iscnFormData.language },
  { label: $t('form.isbn'), value: iscnFormData.isbn },
  { label: $t('common.description'), value: iscnFormData.description },
])

const settingsRows = computed(() => [
  {
    label: $t('nft_book_form.plus_reading'),
    value: listingDraft.isPlusReadingEnabled
      ? $t('nft_book_form.plus_reading_join')
      : $t('nft_book_form.plus_reading_skip'),
  },
  {
    label: $t('nft_book_form.ai_audio'),
    value: listingDraft.hideAudio
      ? $t('nft_book_form.ai_audio_forbid')
      : $t('nft_book_form.ai_audio_allow'),
  },
  {
    label: $t('nft_book_form.accept_tipping'),
    value: listingDraft.isAllowCustomPrice ? $t('common.yes') : $t('common.no'),
  },
  {
    label: $t('nft_book_form.is_adult_only'),
    value: listingDraft.isAdultOnly ? $t('common.yes') : $t('common.no'),
  },
])

function formatPrice(p: PriceFormItem): string {
  const usd = getPriceItemUSDValue(p)
  return usd === 0 ? $t('publish_review.free') : `US$${usd}`
}
</script>
