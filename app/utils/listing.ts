import type { FormError } from '#ui/types'
import { MINIMAL_PRICE } from '~/constant'
import { escapeHtml } from '~/utils/newClass'
import type { PriceFormItem, MappedPrice } from '~/types/publish'

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

export function getPriceItemUSDValue(p: PriceFormItem): number {
  return p.isCustomPricing ? Number(p.priceUSDInput) : Number(p.price)
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

// Custom-pricing rows must fill all three currency inputs before mapping.
export function validatePriceFormItems(rawPrices: PriceFormItem[], t: TranslateFn): FormError[] {
  const errors: FormError[] = []
  for (const raw of rawPrices) {
    if (!raw.isCustomPricing) { continue }
    const isMissing = raw.priceUSDInput.trim() === ''
      || raw.priceHKDInput.trim() === ''
      || raw.priceTWDInput.trim() === ''
    if (isMissing) {
      errors.push({
        name: 'customPricing',
        message: t('errors.custom_pricing_all_required'),
      })
    }
  }
  return errors
}

export function validateMappedPrices(prices: MappedPrice[], t: TranslateFn): FormError[] {
  const errors: FormError[] = []
  prices.forEach((price: MappedPrice) => {
    if (!Number.isFinite(price.priceInDecimal) || (price.price !== 0 && price.price < MINIMAL_PRICE)) {
      errors.push({
        name: 'price',
        message: t('errors.price_validation', { minPrice: MINIMAL_PRICE }),
      })
    }
    if (!price.name.en || !price.name.zh) {
      errors.push({
        name: 'name',
        message: t('errors.product_name_required'),
      })
    }
    if (price.priceInDecimalByCurrency) {
      for (const [currency, value] of Object.entries(price.priceInDecimalByCurrency)) {
        if (!Number.isFinite(value) || value < 0) {
          errors.push({
            name: `priceInDecimalByCurrency.${currency}`,
            message: t('errors.invalid_price_override', { currency: currency.toUpperCase() }),
          })
        }
      }
    }
  })
  return errors
}
