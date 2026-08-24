import type { FormError } from '#ui/types'
import { MINIMAL_PRICE, DEFAULT_PRICE_STRING, DEFAULT_STOCK } from '~/constant'
import { escapeHtml } from '~/utils/newClass'
import type { ClassListingPrice } from '~/types'
import type { PriceFormItem, MappedPrice } from '~/types/publish'

// An author's message only reaches the reader through the custom message page:
// a manual edition is signed one by one, an auto one carries a preset memo.
// Whitespace is not a memo — the flag is one-way, so it must not flip on blanks.
export function shouldEnableCustomMessagePage(
  prices: { isAutoDeliver?: boolean, autoMemo?: string }[],
): boolean {
  return prices.some(p => !p.isAutoDeliver || !!p.autoMemo?.trim())
}

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

// Single source for a blank edition price row; callers override only the
// fields they mean to differ (name, price, index).
export function createDefaultPriceFormItem(overrides: Partial<PriceFormItem> = {}): PriceFormItem {
  return {
    price: DEFAULT_PRICE_STRING,
    deliveryMethod: 'auto',
    autoMemo: '',
    stock: DEFAULT_STOCK,
    name: '',
    description: '',
    isAllowCustomPrice: true,
    isListed: true,
    isCustomPricing: false,
    priceUSDInput: '',
    priceHKDInput: '',
    priceTWDInput: '',
    ...overrides,
  }
}

// This app writes zh and en alike, but an edition created elsewhere may carry
// only en; falling back keeps a required name from reading blank.
export function getListingPriceName(name: ClassListingPrice['name']): string {
  if (typeof name === 'object') { return name.zh || name.en || '' }
  return name || ''
}

function isBlank(value: unknown): boolean {
  return String(value ?? '').trim() === ''
}

function isRealPrice(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

// A blank price is "not chosen yet", not zero — Number('') is 0, and 0 is a
// real price here (free, which also opts the book into Plus). NaN keeps an
// untouched field failing validation instead of publishing as free.
export function getPriceItemUSDValue(p: PriceFormItem): number {
  const raw = p.isCustomPricing ? p.priceUSDInput : p.price
  return isBlank(raw) ? Number.NaN : Number(raw)
}

// The cheapest way in, which is the figure a storefront leads with. An edition
// never priced carries no number at all, so it is excluded rather than shown as
// the lowest — leaving null for an all-unpriced draft.
export function getLowestPriceUSD(prices: PriceFormItem[]): number | null {
  const values = prices.map(getPriceItemUSDValue).filter(isRealPrice)
  return values.length ? Math.min(...values) : null
}

// A free edition, which is what opts a book into Plus all-you-can-read whether
// its author picks that or not. Lives here rather than in listing-status.ts,
// which stays free of runtime imports so `node --test` can run it.
export function hasFreeEditionDraft(prices: PriceFormItem[]): boolean {
  return prices.some(price => getPriceItemUSDValue(price) === 0)
}

// Copies sold across the editions — not a headcount of readers: one person can
// buy several, and buying two editions counts twice.
export function getSoldCount(prices: ClassListingPrice[] | undefined): number {
  return (prices || []).reduce((total, price) => total + (price.sold || 0), 0)
}

// Zero is a real price the storefront labels, not a number to render. An edition
// never priced reaches here unmapped off the API as -1, so it reads as a dash
// rather than as US$-1.
export function formatPriceUSDLabel(usd: number, t: TranslateFn): string {
  if (!isRealPrice(usd)) { return '-' }
  return usd === 0 ? t('publish_review.free') : `US$${usd}`
}

export function mapPriceFormItemsToPayload(prices: PriceFormItem[]): MappedPrice[] {
  return prices.map((p: PriceFormItem) => {
    const usdValue = getPriceItemUSDValue(p)
    const mapped: MappedPrice = {
      name: {
        en: escapeHtml(p.name),
        zh: escapeHtml(p.name),
      },
      description: {
        en: escapeHtml(p.description),
        zh: escapeHtml(p.description),
      },
      priceInDecimal: Math.round(usdValue * 100),
      price: usdValue,
      stock: p.deliveryMethod === 'auto' ? 0 : Number(p.stock),
      isAutoDeliver: p.deliveryMethod === 'auto',
      isAllowCustomPrice: p.isAllowCustomPrice,
      isUnlisted: !p.isListed,
      autoMemo: p.deliveryMethod === 'auto' ? p.autoMemo || '' : '',
    }
    if (p.isCustomPricing) {
      mapped.priceInDecimalByCurrency = {
        hkd: Math.round(Number(p.priceHKDInput) * 100),
        twd: Math.round(Number(p.priceTWDInput) * 100),
      }
    }
    return mapped
  })
}

// Inverse of mapPriceFormItemsToPayload for one listing price: feeds the edit
// forms from the shape `/likernft/book/store/{classId}` returns. An HKD/TWD
// override on the doc means custom pricing was chosen, so the USD input echoes
// the tier price rather than starting blank.
export function mapListingPriceToFormItem(price: ClassListingPrice): PriceFormItem {
  const overrideHKD = price.priceInDecimalByCurrency?.hkd
  const overrideTWD = price.priceInDecimalByCurrency?.twd
  const hasCustomPricing = typeof overrideHKD === 'number' || typeof overrideTWD === 'number'
  // -1 is how the API marks an edition that was never priced; the form says
  // that with a blank select rather than a number no one would type.
  const tierPriceStr = Number(price.price) === -1 ? '' : price.price?.toString() || ''
  return {
    index: price.index?.toString(),
    price: tierPriceStr,
    deliveryMethod: price.isAutoDeliver ? 'auto' : 'manual',
    autoMemo: price.autoMemo || '',
    stock: price.stock,
    name: getListingPriceName(price.name),
    description: getListingPriceName(price.description),
    isAllowCustomPrice: price.isAllowCustomPrice,
    isListed: !price.isUnlisted,
    oldIsAutoDeliver: price.isAutoDeliver,
    oldStock: price.stock,
    isCustomPricing: hasCustomPricing,
    priceUSDInput: hasCustomPricing ? tierPriceStr : '',
    priceHKDInput: typeof overrideHKD === 'number' ? (overrideHKD / 100).toString() : '',
    priceTWDInput: typeof overrideTWD === 'number' ? (overrideTWD / 100).toString() : '',
  }
}

// Validates the raw price form items. Error names use the `prices.{i}.{field}`
// path convention so UForm can route each error to its UFormField by name.
// `reservedNames` are the names editions outside this form already use, so a
// second edition cannot be created under the same name as the first.
export function validatePriceFormItems(
  rawPrices: PriceFormItem[],
  t: TranslateFn,
  reservedNames: string[] = [],
): FormError[] {
  const errors: FormError[] = []
  // Seeded with the editions this form does not show, then grown as the form's
  // own rows are checked, so renaming edition 2 onto edition 1 is caught too.
  const taken = new Set(reservedNames.map(name => name.trim()).filter(Boolean))
  rawPrices.forEach((p, index) => {
    const priceFieldName = `prices.${index}.price`
    const trimmedName = p.name.trim()
    if (!trimmedName) {
      errors.push({
        name: `prices.${index}.name`,
        message: t('errors.product_name_required'),
      })
    }
    else if (taken.has(trimmedName)) {
      errors.push({
        name: `prices.${index}.name`,
        message: t('errors.product_name_duplicate'),
      })
    }
    else {
      taken.add(trimmedName)
    }
    if (p.isCustomPricing) {
      const isMissing = isBlank(p.priceUSDInput) || isBlank(p.priceHKDInput) || isBlank(p.priceTWDInput)
      if (isMissing) {
        errors.push({
          name: priceFieldName,
          message: t('errors.custom_pricing_all_required'),
        })
        return
      }
      for (const [currency, input] of [['HKD', p.priceHKDInput], ['TWD', p.priceTWDInput]] as const) {
        const value = Number(input)
        if (!isRealPrice(value)) {
          errors.push({
            name: priceFieldName,
            message: t('errors.invalid_price_override', { currency }),
          })
        }
      }
    }
    const usdValue = getPriceItemUSDValue(p)
    // A price left unchosen is its own mistake: "at least 0.99 or free" reads
    // as a correction to a number the author never entered.
    if (!p.isCustomPricing && Number.isNaN(usdValue)) {
      errors.push({
        name: priceFieldName,
        message: t('errors.price_required'),
      })
    }
    else if (!Number.isFinite(usdValue) || (usdValue !== 0 && usdValue < MINIMAL_PRICE)) {
      errors.push({
        name: priceFieldName,
        message: t('errors.price_validation', { minPrice: MINIMAL_PRICE }),
      })
    }
  })
  return errors
}
