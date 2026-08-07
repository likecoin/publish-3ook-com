// Pure tier tables, kept dependency-free and copied verbatim from
// likecoin-api-public — `constant/pricing.ts` and `util/pricing.ts` — so the
// wizard can show authors the NT$/HK$ a reader will actually be charged.
// Both copies run against test/fixtures/pricing.golden.json; a table only
// changes on the server, and the fixture must be regenerated there and
// re-copied here with it, or the two drift.
//
// These are hand-tuned price ladders, not an exchange rate: `4.99` is the
// fifth rung, and the fifth rungs are HK$40 and NT$150. Nothing here reads a
// live rate, so this mirror is exact rather than an approximation of one.
// A third copy lives in 3ook-com `shared/constants/pricing.ts`; it carries an
// extra above-tier map for Plus subscriptions that book prices never reach.

import type { BookPriceInDecimalByCurrency } from '~/types/book'

export type PricingCurrency = 'usd' | 'hkd' | 'twd'

export const USD_PRICE_TIER_LIST = [0].concat(Array.from({ length: 100 }, (_, i) => i + 0.99))

export const HKD_PRICE_TIER_LIST = [
  0,
  8,
  16,
  25,
  32,
  40,
  48,
  55,
  65,
  70,
  78,
  86,
  95,
  102,
  110,
  118,
  125,
  135,
  140,
  150,
  156,
  165,
  172,
  180,
  188,
  195,
  205,
  210,
  220,
  228,
  235,
  242,
  250,
  258,
  266,
  275,
  280,
  290,
  298,
  305,
  312,
  320,
  328,
  336,
  345,
  350,
  360,
  368,
  375,
  385,
  390,
  398,
  406,
  415,
  422,
  430,
  438,
  445,
  455,
  460,
  468,
  476,
  485,
  492,
  500,
  508,
  515,
  525,
  530,
  540,
  546,
  555,
  562,
  570,
  578,
  585,
  595,
  600,
  610,
  618,
  625,
  632,
  640,
  648,
  656,
  665,
  670,
  680,
  688,
  695,
  702,
  710,
  718,
  726,
  735,
  740,
  750,
  758,
  765,
  775,
  780,
]

export const TWD_PRICE_TIER_LIST = [
  0,
  30,
  60,
  90,
  120,
  150,
  180,
  210,
  240,
  270,
  300,
  330,
  360,
  390,
  420,
  450,
  480,
  510,
  540,
  570,
  600,
  630,
  660,
  690,
  720,
  750,
  780,
  810,
  840,
  870,
  900,
  930,
  960,
  990,
  1020,
  1050,
  1080,
  1110,
  1140,
  1170,
  1200,
  1230,
  1260,
  1290,
  1320,
  1350,
  1380,
  1410,
  1440,
  1470,
  1500,
  1530,
  1560,
  1590,
  1620,
  1650,
  1680,
  1710,
  1740,
  1770,
  1800,
  1830,
  1860,
  1890,
  1920,
  1950,
  1980,
  2010,
  2040,
  2070,
  2100,
  2130,
  2160,
  2190,
  2220,
  2250,
  2280,
  2310,
  2340,
  2370,
  2400,
  2430,
  2460,
  2490,
  2520,
  2550,
  2580,
  2610,
  2640,
  2670,
  2700,
  2730,
  2760,
  2790,
  2820,
  2850,
  2880,
  2910,
  2940,
  2970,
  3000,
]

const MAX_USD = USD_PRICE_TIER_LIST[USD_PRICE_TIER_LIST.length - 1]!
const MAX_HKD = HKD_PRICE_TIER_LIST[HKD_PRICE_TIER_LIST.length - 1]!
const MAX_TWD = TWD_PRICE_TIER_LIST[TWD_PRICE_TIER_LIST.length - 1]!

// The three ladders are parallel and equal-length — the golden test pins that —
// so every index derived from one is in range for the others. That invariant is
// what makes the assertions below safe.
export function convertUSDPriceToCurrency(price: number, currency: PricingCurrency): number {
  if (price <= 0) {
    return 0
  }
  switch (currency) {
    case 'hkd': {
      if (price > MAX_USD) {
        return Math.floor(price * (MAX_HKD / MAX_USD))
      }
      const index = Math.min(Math.round(price), HKD_PRICE_TIER_LIST.length - 1)
      return HKD_PRICE_TIER_LIST[index]!
    }
    case 'twd': {
      if (price > MAX_USD) {
        return Math.floor(price * (MAX_TWD / MAX_USD))
      }
      const index = Math.min(Math.round(price), TWD_PRICE_TIER_LIST.length - 1)
      return TWD_PRICE_TIER_LIST[index]!
    }
    case 'usd':
    default:
      return price
  }
}

export function convertCurrencyToUSDPrice(price: number, currency: PricingCurrency): number {
  switch (currency) {
    case 'hkd': {
      if (price > MAX_HKD) {
        return Math.floor(price * (MAX_USD / MAX_HKD))
      }
      const index = HKD_PRICE_TIER_LIST.findIndex(tierPrice => tierPrice >= price)
      return index >= 0 ? USD_PRICE_TIER_LIST[index]! : MAX_USD
    }
    case 'twd': {
      if (price > MAX_TWD) {
        return Math.floor(price * (MAX_USD / MAX_TWD))
      }
      const index = TWD_PRICE_TIER_LIST.findIndex(tierPrice => tierPrice >= price)
      return index >= 0 ? USD_PRICE_TIER_LIST[index]! : MAX_USD
    }
    case 'usd':
    default:
      return price
  }
}

// USD is excluded by design: it is the stored `priceInDecimal` and the commission base.
export const BOOK_PRICE_OVERRIDE_CURRENCIES = ['hkd', 'twd'] as const

export function getCurrencyPriceInDecimal(
  usdPriceInDecimal: number,
  currency: PricingCurrency,
  priceInDecimalByCurrency?: BookPriceInDecimalByCurrency,
): number {
  if (currency === 'usd') return usdPriceInDecimal
  const override = priceInDecimalByCurrency?.[currency]
  if (typeof override === 'number') return override
  return convertUSDPriceToCurrency(usdPriceInDecimal / 100, currency) * 100
}

// --- Wizard-facing wrapper; everything above is the verbatim mirror.
// Carries no value import: `node --test` runs this file directly and cannot
// resolve Nuxt's `~` alias, so the fee model stays in book-revenue.ts and is
// applied to these rows by the caller.

/** The regions a reader is quoted in, in the order the review step lists them. */
export const REGION_CURRENCIES = ['twd', 'hkd', 'usd'] as const satisfies readonly PricingCurrency[]

export type OverrideCurrency = typeof BOOK_PRICE_OVERRIDE_CURRENCIES[number]

/**
 * Reads a possibly half-typed custom-pricing form into an override map. Blank,
 * negative and non-numeric fields are dropped so the tier still applies, but an
 * explicit zero is kept — the server's schema accepts 0 as a real price.
 */
export function buildPriceOverride(
  inputs: Record<OverrideCurrency, string>,
): BookPriceInDecimalByCurrency {
  const override: BookPriceInDecimalByCurrency = {}
  for (const currency of BOOK_PRICE_OVERRIDE_CURRENCIES) {
    const input = inputs[currency]
    const value = Number(input)
    if (input.trim() !== '' && Number.isFinite(value) && value >= 0) {
      override[currency] = Math.round(value * 100)
    }
  }
  return override
}

export type RegionReaderPrice = {
  currency: PricingCurrency
  /** What the reader is charged, in that currency's minor units. */
  readerPriceInDecimal: number
  /**
   * The USD the sale settles at, which is what the fee ratios apply to. Equal
   * to the listed price unless an override breaks the ladder's implied rate.
   */
  grossUSDInDecimal: number
}

/**
 * The tier each region is quoted, exact rather than estimated. Pair with
 * `estimateAuthorRevenue(grossUSDInDecimal, currency)` and multiply
 * `readerPriceInDecimal` by its `ratio` for earnings in the reader's currency.
 */
export function getRegionReaderPrices(
  usdPriceInDecimal: number,
  priceInDecimalByCurrency?: BookPriceInDecimalByCurrency,
): RegionReaderPrice[] {
  return REGION_CURRENCIES.map((currency) => {
    const readerPriceInDecimal = getCurrencyPriceInDecimal(
      usdPriceInDecimal,
      currency,
      priceInDecimalByCurrency,
    )
    return {
      currency,
      readerPriceInDecimal,
      grossUSDInDecimal: currency === 'usd'
        ? usdPriceInDecimal
        : Math.round(convertCurrencyToUSDPrice(readerPriceInDecimal / 100, currency) * 100),
    }
  })
}
