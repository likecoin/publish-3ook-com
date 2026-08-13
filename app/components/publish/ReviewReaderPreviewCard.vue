<template>
  <!-- What a reader meets on the storefront. The lowest price leads because
       that is the figure the storefront leads with. -->
  <UCard>
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('publish_review.reader_preview_title')"
      />
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
  </UCard>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'
import { getPriceItemUSDValue, formatPriceUSDLabel } from '~/utils/listing'

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
}>()

// The cheapest way in, which is the figure a storefront leads with. Editions
// seeded but never priced still carry -1, so they are excluded rather than
// shown as the lowest — leaving null for an all-unpriced draft.
const lowestPriceUSD = computed(() => {
  const values = prices.map(getPriceItemUSDValue).filter(value => value >= 0)
  return values.length ? Math.min(...values) : null
})

const readerPrice = computed(() => (
  lowestPriceUSD.value === null ? '' : formatPriceUSDLabel(lowestPriceUSD.value, $t)
))

// Only promises a reader can see on the listing itself.
const readerBadges = computed(() => {
  const badges: string[] = []
  if (isPreviewEnabled) {
    badges.push($t('publish_review.reader_preview_percent', {
      percent: previewPercentage,
    }))
  }
  badges.push(isDownloadable
    ? $t('publish_review.reader_badge_download')
    : $t('publish_review.reader_badge_no_download'))
  if (isPlusReadingEnabled) {
    badges.push($t('publish_review.reader_badge_plus'))
  }
  if (prices.length > 1) {
    badges.push($t('publish_review.reader_editions', { count: prices.length }))
  }
  return badges
})
</script>
