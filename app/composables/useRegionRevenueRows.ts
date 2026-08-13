import type { BookPriceInDecimalByCurrency } from '~/types/book'
import type { PriceFormItem } from '~/types/publish'
import { getPriceItemUSDValue } from '~/utils/listing'
import { estimateAuthorRevenue } from '~/utils/book-revenue'
import { buildPriceOverride, getRegionReaderPrices, type PricingCurrency } from '~/utils/pricing'

export interface RegionRevenueRow {
  currency: PricingCurrency
  label: string
  readerPays: string
  earnLikerLand: string
  earnDirect: string
}

const CURRENCY_SYMBOL: Record<PricingCurrency, string> = { usd: 'US$', hkd: 'HK$', twd: 'NT$' }

// The NT$/HK$ ladders are whole units; only USD is ever quoted with cents.
function formatRegionAmount(currency: PricingCurrency, valueInDecimal: number): string {
  const value = convertDecimalToAmount(valueInDecimal, currency)
  const amount = currency === 'usd'
    ? value.toFixed(2)
    : Math.round(value).toLocaleString('en-US')
  return `${CURRENCY_SYMBOL[currency]}${amount}`
}

// What a reader pays and what the author keeps, per region. Shared so the full
// review card and the inline readout beside the price field quote one set of
// numbers rather than each deriving its own.
export function useRegionRevenueRows(getPrices: () => PriceFormItem[]) {
  const { t: $t } = useI18n()

  // A free edition earns nothing and says nothing about the paid one beside it,
  // so the estimate follows the cheapest edition a reader can actually pay for.
  const cheapestPaidPrice = computed<PriceFormItem | null>(() => {
    const paid = getPrices().filter(p => getPriceItemUSDValue(p) > 0)
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

  // Shown in the reader's currency because that is the steadier figure: every
  // fee but Stripe's flat 30 cents is proportional, so the local share holds
  // when the real rate moves while the USD a fixed NT$300 sale settles at does not.
  const regionRows = computed<RegionRevenueRow[]>(() => {
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

  return { regionRows }
}
