<template>
  <!-- What a reader meets on the storefront, and the consequence of the two
       channel switches before the save that applies them. The panes mirror
       /store/{id} and /library/{id}, one page component there too. -->
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.reader_preview_title')"
        />
        <UTabs
          v-model="channel"
          size="xs"
          :content="false"
          :items="channelItems"
        />
      </div>
    </template>
    <div class="flex gap-4">
      <BookCoverThumbnail
        :src="coverImageSrc"
        size="lg"
      />
      <div class="flex flex-col gap-1 min-w-0">
        <p
          class="text-lg font-semibold text-highlighted"
          v-text="title || $t('publish_review.reader_untitled')"
        />
        <p
          v-if="subtitle"
          class="text-sm text-muted"
          v-text="subtitle"
        />
        <p
          v-if="authorName"
          class="text-sm text-muted"
          v-text="authorName"
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
            :label="badge"
          />
        </div>
      </div>
    </div>

    <!-- The consequence of the two channel switches, before the save that
         applies them. Nothing else on the page shows it. -->
    <UAlert
      v-if="channelNotice"
      class="mt-4"
      :color="channelNotice.color"
      variant="subtle"
      icon="i-heroicons-information-circle"
      :description="channelNotice.description"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'
import { getLowestPriceUSD, formatPriceUSDLabel } from '~/utils/listing'
import { hasListedEditionDraft, isBookUnlistedDraft } from '~/utils/listing-status'

const { t: $t } = useI18n()

const {
  prices,
  title,
  subtitle = '',
  authorName = '',
  coverImageSrc = '',
  isPreviewEnabled,
  previewPercentage,
  isDownloadable,
  isPlusReadingEnabled,
  isAudioAllowed = false,
} = defineProps<{
  prices: PriceFormItem[]
  title: string
  subtitle?: string
  authorName?: string
  coverImageSrc?: string
  isPreviewEnabled: boolean
  previewPercentage: number
  isDownloadable: boolean
  isPlusReadingEnabled: boolean
  isAudioAllowed?: boolean
}>()

type ReaderChannel = 'store' | 'library'

const channel = ref<ReaderChannel>('store')

const channelItems = computed<{ value: ReaderChannel, label: string }[]>(() => [
  { value: 'store', label: $t('status_page.reader_view_channel_store') },
  { value: 'library', label: $t('status_page.reader_view_channel_library') },
])

const isLibraryChannel = computed(() => channel.value === 'library')

const hasListedEdition = computed(() => hasListedEditionDraft(prices))

// The API serves both off for a book with nothing listed, so the preview says so
// too rather than promising a badge no reader would get.
const readerGetsPreview = computed(() => isPreviewEnabled && !isBookUnlistedDraft(prices))
const readerCanBorrow = computed(() => isPlusReadingEnabled && !isBookUnlistedDraft(prices))

// The figure the storefront leads with, so only editions a reader can actually
// buy count — an unlisted cheaper one would advertise a price that is not for
// sale. Null once nothing is listed, which is what leaves the price blank.
const lowestListedPriceUSD = computed(() =>
  getLowestPriceUSD(prices.filter(price => price.isListed)))

const readerPrice = computed(() => {
  if (isLibraryChannel.value) { return $t('status_page.reader_view_library_price') }
  if (lowestListedPriceUSD.value === null) { return '' }
  return formatPriceUSDLabel(lowestListedPriceUSD.value, $t)
})

// Only promises a reader can see on the listing itself.
const readerBadges = computed(() => {
  const badges: string[] = []
  if (isLibraryChannel.value) {
    badges.push($t('status_page.reader_view_badge_revenue_share'))
    if (isAudioAllowed) { badges.push($t('status_page.reader_view_badge_tts')) }
    return badges
  }
  if (readerGetsPreview.value) {
    badges.push($t('publish_review.reader_preview_percent', {
      percent: previewPercentage,
    }))
  }
  badges.push(isDownloadable
    ? $t('publish_review.reader_badge_download')
    : $t('publish_review.reader_badge_no_download'))
  if (readerCanBorrow.value) {
    badges.push($t('publish_review.reader_badge_plus'))
  }
  if (prices.length > 1) {
    badges.push($t('publish_review.reader_editions', { count: prices.length }))
  }
  return badges
})

// Free borrowing for a non-Plus reader needs a *listed* price-0 edition, so a
// book that has one only unlisted cuts them off while Plus members keep
// borrowing. Mirrors the storefront's own getHasFreeEdition rule.
const isFreeBorrowCut = computed(() => (
  getLowestPriceUSD(prices) === 0 && lowestListedPriceUSD.value !== 0
))

const channelNotice = computed(() => {
  if (!isLibraryChannel.value) {
    return hasListedEdition.value
      ? null
      : { color: 'neutral' as const, description: $t('status_page.reader_view_store_empty') }
  }
  if (!readerCanBorrow.value) {
    return { color: 'neutral' as const, description: $t('status_page.reader_view_library_empty') }
  }
  if (isFreeBorrowCut.value) {
    return { color: 'warning' as const, description: $t('status_page.reader_view_library_free_borrow_cut') }
  }
  return null
})
</script>
