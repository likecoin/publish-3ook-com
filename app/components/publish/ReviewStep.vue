<template>
  <div class="flex flex-col gap-[16px] text-left">
    <!-- What a reader meets on the storefront, assembled from the same draft
         the steps above edited. The NT$/HK$ figures are the API's hand-tuned
         price ladders mirrored in `~/utils/pricing`, not a live conversion. -->
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

    <!-- Author-facing, so it gets its own card rather than sitting under the
         reader preview, but it stays next to the price it derives from. -->
    <UCard v-if="regionRows.length">
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.revenue_title')"
        />
      </template>
      <div class="flex flex-col gap-2">
        <table class="w-full text-sm">
          <thead>
            <!-- Both channels sit side by side rather than behind a toggle: the gap
                 between them is the point, and comparing costs a click otherwise.
                 The spanning header groups them so they do not read as additive. -->
            <tr class="text-xs text-muted">
              <td colspan="2" />
              <th
                scope="colgroup"
                colspan="2"
                class="text-center font-normal pb-1 border-b border-default"
                v-text="$t('publish_review.revenue_you_earn')"
              />
            </tr>
            <tr class="text-xs text-muted">
              <th
                scope="col"
                class="text-left font-normal pb-1"
                v-text="$t('publish_review.revenue_region')"
              />
              <th
                scope="col"
                class="text-right font-normal pb-1"
                v-text="$t('publish_review.revenue_reader_pays')"
              />
              <th
                scope="col"
                class="text-right font-normal pb-1"
                v-text="$t('publish_review.revenue_liker_land')"
              />
              <th
                scope="col"
                class="text-right font-normal pb-1"
                v-text="$t('publish_review.revenue_direct')"
              />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in regionRows"
              :key="row.currency"
              class="border-t border-default"
            >
              <td
                class="py-1.5 text-muted"
                v-text="row.label"
              />
              <td
                class="py-1.5 text-right text-highlighted tabular-nums"
                v-text="row.readerPays"
              />
              <td
                class="py-1.5 text-right text-highlighted tabular-nums"
                v-text="row.earnLikerLand"
              />
              <td
                class="py-1.5 text-right text-highlighted tabular-nums"
                v-text="row.earnDirect"
              />
            </tr>
          </tbody>
        </table>
        <p
          class="text-xs text-dimmed"
          v-text="$t('publish_review.revenue_note')"
        />
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
import type { BookPriceInDecimalByCurrency } from '~/types/book'
import type { PublishListingDraft, PriceFormItem } from '~/types/publish'
import { getPriceItemUSDValue } from '~/utils/listing'
import { isRecordUploaded, needsFileReselect } from '~/utils/arweave'
import { resolveShortDescription } from '~/utils/description'
import { estimateAuthorRevenue } from '~/utils/book-revenue'
import { buildPriceOverride, getRegionReaderPrices, type PricingCurrency } from '~/utils/pricing'
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

const formatUSDAmount = (amount: number | string): string => `US$${amount}`

function formatUSD(usd: number): string {
  return usd === 0 ? $t('publish_review.free') : formatUSDAmount(usd)
}

// The cheapest way in, which is the figure a storefront leads with. Editions
// seeded but never priced still carry -1, so they are excluded rather than
// shown as the lowest — leaving null for an all-unpriced draft.
const lowestPriceUSD = computed(() => {
  const values = listingDraft.prices.map(getPriceItemUSDValue).filter(value => value >= 0)
  return values.length ? Math.min(...values) : null
})

const readerPrice = computed(() => (
  lowestPriceUSD.value === null ? '' : formatUSD(lowestPriceUSD.value)
))

// A free edition earns nothing and says nothing about the paid one beside it,
// so the estimate follows the cheapest edition a reader can actually pay for.
const cheapestPaidPrice = computed<PriceFormItem | null>(() => {
  const paid = listingDraft.prices.filter(p => getPriceItemUSDValue(p) > 0)
  if (!paid.length) { return null }
  return paid.reduce((a, b) => (getPriceItemUSDValue(b) < getPriceItemUSDValue(a) ? b : a))
})

const lowestPaidPriceUSD = computed(() => (
  cheapestPaidPrice.value === null ? null : getPriceItemUSDValue(cheapestPaidPrice.value)
))

// Runs mid-edit, unlike the submit path, so a partly filled form still quotes
// the tier for the currencies not typed yet.
const cheapestPaidOverride = computed<BookPriceInDecimalByCurrency | undefined>(() => {
  const price = cheapestPaidPrice.value
  if (!price?.isCustomPricing) { return undefined }
  return buildPriceOverride({ hkd: price.priceHKDInput, twd: price.priceTWDInput })
})

const CURRENCY_SYMBOL: Record<PricingCurrency, string> = { usd: 'US$', hkd: 'HK$', twd: 'NT$' }

// The NT$/HK$ ladders are whole units; only USD is ever quoted with cents.
function formatRegionAmount(currency: PricingCurrency, valueInDecimal: number): string {
  const value = convertDecimalToAmount(valueInDecimal, currency)
  const amount = currency === 'usd'
    ? value.toFixed(2)
    : Math.round(value).toLocaleString('en-US')
  return `${CURRENCY_SYMBOL[currency]}${amount}`
}

// Shown in the reader's currency because that is the steadier figure: every fee
// but Stripe's flat 30 cents is proportional, so the local share holds when the
// real rate moves while the USD a fixed NT$300 sale settles at does not.
const regionRows = computed(() => {
  const usd = lowestPaidPriceUSD.value
  if (usd === null) { return [] }
  return getRegionReaderPrices(Math.round(usd * 100), cheapestPaidOverride.value).map((row) => {
    const revenue = estimateAuthorRevenue(row.grossUSDInDecimal, row.currency)
    const earned = (ratio: number) => (
      formatRegionAmount(row.currency, Math.round(row.readerPriceInDecimal * ratio))
    )
    return {
      currency: row.currency,
      label: $t(`publish_review.region_${row.currency}`),
      readerPays: formatRegionAmount(row.currency, row.readerPriceInDecimal),
      earnLikerLand: earned(revenue.likerLand.ratio),
      earnDirect: earned(revenue.direct.ratio),
    }
  })
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
