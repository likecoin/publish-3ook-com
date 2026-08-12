<template>
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
          <!-- Both channels sit side by side rather than behind a toggle: comparing
               them is the point. The spanning header groups them so they do not read
               as additive; its centred label lands on the column boundary, so the
               divider is what stops it labelling the left column alone. -->
          <tr class="text-xs text-muted">
            <td colspan="2" />
            <th
              scope="colgroup"
              colspan="2"
              class="text-center font-normal pb-1 pl-4 border-b border-l border-default"
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
              class="text-right font-normal pb-1 pr-4"
              v-text="$t('publish_review.revenue_reader_pays')"
            />
            <th
              scope="col"
              class="text-right font-normal pb-1 pl-4 border-l border-default"
              v-text="$t('publish_review.revenue_liker_land')"
            />
            <th
              scope="col"
              class="text-right font-normal pb-1 pl-4"
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
              class="py-1.5 pr-4 text-right text-highlighted tabular-nums"
              v-text="row.readerPays"
            />
            <td
              class="py-1.5 pl-4 text-right text-highlighted tabular-nums border-l border-default"
              v-text="row.earnLikerLand"
            />
            <td
              class="py-1.5 pl-4 text-right text-highlighted tabular-nums"
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
</template>

<script setup lang="ts">
import type { BookPriceInDecimalByCurrency } from '~/types/book'
import type { PriceFormItem } from '~/types/publish'
import { getPriceItemUSDValue } from '~/utils/listing'
import { estimateAuthorRevenue } from '~/utils/book-revenue'
import { buildPriceOverride, getRegionReaderPrices, type PricingCurrency } from '~/utils/pricing'

const { t: $t } = useI18n()

const { prices } = defineProps<{
  prices: PriceFormItem[]
}>()

// A free edition earns nothing and says nothing about the paid one beside it,
// so the estimate follows the cheapest edition a reader can actually pay for.
const cheapestPaidPrice = computed<PriceFormItem | null>(() => {
  const paid = prices.filter(p => getPriceItemUSDValue(p) > 0)
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
</script>
