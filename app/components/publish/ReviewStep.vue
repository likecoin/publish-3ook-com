<template>
  <div class="flex flex-col gap-[16px] text-left">
    <!-- What a reader meets on the storefront, assembled from the same draft
         the steps above edited. Prices are USD only: the NT$/HK$ tiers are
         hand-tuned tables that live in the API, not a conversion. -->
    <UCard>
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.reader_preview_title')"
        />
      </template>
      <div class="flex gap-4">
        <img
          v-if="coverImageSrc"
          :src="coverImageSrc"
          alt=""
          class="w-[120px] h-auto object-contain rounded border border-default self-start"
        >
        <div
          v-else
          class="w-[120px] h-[160px] shrink-0 rounded border border-default bg-elevated flex items-center justify-center"
        >
          <UIcon
            name="i-heroicons-book-open"
            class="w-8 h-8 text-dimmed"
          />
        </div>
        <div class="flex flex-col gap-1 min-w-0">
          <p
            class="text-lg font-semibold text-highlighted"
            v-text="iscnFormData.title || $t('publish_review.reader_untitled')"
          />
          <p
            v-if="iscnFormData.alternativeHeadline"
            class="text-sm text-muted"
            v-text="iscnFormData.alternativeHeadline"
          />
          <p
            v-if="iscnFormData.author.name"
            class="text-sm text-muted"
            v-text="iscnFormData.author.name"
          />
          <p
            v-if="readerPrice"
            class="text-xl font-semibold text-highlighted mt-2"
            v-text="readerPrice"
          />
          <div class="flex flex-wrap gap-2 mt-2">
            <UBadge
              v-for="badge in readerBadges"
              :key="badge"
              variant="soft"
              color="neutral"
              size="xs"
            >
              {{ badge }}
            </UBadge>
          </div>
        </div>
      </div>
    </UCard>

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
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <template
            v-for="row in metadataRows"
            :key="row.label"
          >
            <dt
              class="text-muted"
              v-text="row.label"
            />
            <dd
              class="text-highlighted"
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
            class="font-medium text-highlighted"
            v-text="p.name || $t('nft_book_form.product_name_placeholder')"
          />
          <span class="text-highlighted">
            {{ formatPrice(p) }}
            <span
              class="text-dimmed"
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
            class="text-muted"
            v-text="row.label"
          />
          <dd
            class="text-highlighted"
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
import { isRecordUploaded, needsFileReselect } from '~/utils/arweave'
import { resolveShortDescription } from '~/utils/description'
import { MAX_DESCRIPTION_LENGTH } from '~/constant'

const { t: $t } = useI18n()

const { fileRecords, encryptEbook, iscnFormData, listingDraft, coverImageSrc = '' } = defineProps<{
  fileRecords: FileRecord[]
  encryptEbook: boolean
  iscnFormData: ISCNFormData
  listingDraft: PublishListingDraft
  coverImageSrc?: string
}>()

const emit = defineEmits<{ edit: [step: string] }>()

function formatUSD(usd: number): string {
  return usd === 0 ? $t('publish_review.free') : `US$${usd}`
}

// The cheapest way in, which is the figure a storefront leads with. Editions
// seeded but never priced still carry -1, so they are excluded rather than
// shown as the lowest — leaving '' for an all-unpriced draft, which the
// template hides.
const readerPrice = computed(() => {
  const values = listingDraft.prices.map(getPriceItemUSDValue).filter(value => value >= 0)
  return values.length ? formatUSD(Math.min(...values)) : ''
})

// Only promises a reader can see on the listing itself.
const readerBadges = computed(() => {
  const badges: string[] = []
  if (listingDraft.isPreviewEnabled) {
    badges.push($t('publish_review.reader_preview_percent', {
      percent: listingDraft.previewPercentage,
    }))
  }
  badges.push(encryptEbook
    ? $t('publish_review.reader_badge_no_download')
    : $t('publish_review.reader_badge_download'))
  if (listingDraft.isPlusReadingEnabled) {
    badges.push($t('publish_review.reader_badge_plus'))
  }
  if (listingDraft.prices.length > 1) {
    badges.push($t('publish_review.reader_editions', { count: listingDraft.prices.length }))
  }
  return badges
})

const metadataRows = computed(() => [
  { label: $t('common.title'), value: iscnFormData.title },
  { label: $t('iscn_form.author_name'), value: iscnFormData.author.name },
  { label: $t('form.publisher'), value: iscnFormData.publisher.name },
  { label: $t('form.language'), value: iscnFormData.language },
  { label: $t('form.isbn'), value: iscnFormData.isbn },
  { label: $t('common.description'), value: listingDraft.descriptionFull },
  // What will actually be stored, derived here exactly as publish derives it,
  // so the review is not showing an empty box for a field that gets filled.
  {
    label: $t('iscn_form.description_short'),
    value: resolveShortDescription(
      iscnFormData.description,
      listingDraft.descriptionFull,
      MAX_DESCRIPTION_LENGTH,
    ),
  },
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
  return formatUSD(getPriceItemUSDValue(p))
}
</script>
