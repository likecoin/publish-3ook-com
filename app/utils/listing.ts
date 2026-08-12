import type { FormError } from '#ui/types'
import { MINIMAL_PRICE, DEFAULT_PRICE_STRING, DEFAULT_STOCK } from '~/constant'
import { escapeHtml } from '~/utils/newClass'
import type { ClassListingPrice } from '~/types'
import type { PriceFormItem, MappedPrice } from '~/types/publish'
import type { BookListingItem } from '~/utils/api'
import type { BookListingStatus } from '~/types/book'

// A book's shelf state as the author sees it. A book still awaiting moderation
// isn't for sale yet whatever its editions say, and one whose every edition is
// unlisted is as invisible to readers as an explicitly hidden one.
export function getBookListingStatus(
  book: Pick<BookListingItem, 'prices' | 'isHidden' | 'isPendingReview'>,
): BookListingStatus {
  if (book.isPendingReview) { return 'pending_review' }
  const prices = book.prices || []
  if (book.isHidden || !prices.length || prices.every(p => p.isUnlisted)) { return 'unlisted' }
  return 'listed'
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

export function getPriceItemUSDValue(p: PriceFormItem): number {
  return p.isCustomPricing ? Number(p.priceUSDInput) : Number(p.price)
}

// Zero is a real price the storefront labels, not a number to render.
export function formatPriceUSDLabel(usd: number, t: TranslateFn): string {
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
  const tierPriceStr = price.price?.toString() || ''
  return {
    index: price.index?.toString(),
    price: tierPriceStr,
    deliveryMethod: price.isAutoDeliver ? 'auto' : 'manual',
    autoMemo: price.autoMemo || '',
    stock: price.stock,
    name: typeof price.name === 'object' ? price.name.zh || '' : price.name || '',
    description: typeof price.description === 'object' ? price.description.zh || '' : price.description || '',
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
export function validatePriceFormItems(rawPrices: PriceFormItem[], t: TranslateFn): FormError[] {
  const errors: FormError[] = []
  rawPrices.forEach((p, index) => {
    const priceFieldName = `prices.${index}.price`
    if (!p.name) {
      errors.push({
        name: `prices.${index}.name`,
        message: t('errors.product_name_required'),
      })
    }
    if (p.isCustomPricing) {
      const isMissing = (
        String(p.priceUSDInput).trim() === ''
        || String(p.priceHKDInput).trim() === ''
        || String(p.priceTWDInput).trim() === ''
      )
      if (isMissing) {
        errors.push({
          name: priceFieldName,
          message: t('errors.custom_pricing_all_required'),
        })
        return
      }
      for (const [currency, input] of [['HKD', p.priceHKDInput], ['TWD', p.priceTWDInput]] as const) {
        const value = Number(input)
        if (!Number.isFinite(value) || value < 0) {
          errors.push({
            name: priceFieldName,
            message: t('errors.invalid_price_override', { currency }),
          })
        }
      }
    }
    const usdValue = getPriceItemUSDValue(p)
    if (!Number.isFinite(usdValue) || (usdValue !== 0 && usdValue < MINIMAL_PRICE)) {
      errors.push({
        name: priceFieldName,
        message: t('errors.price_validation', { minPrice: MINIMAL_PRICE }),
      })
    }
  })
  return errors
}
