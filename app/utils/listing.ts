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
      const isMissing = p.priceUSDInput.trim() === ''
        || p.priceHKDInput.trim() === ''
        || p.priceTWDInput.trim() === ''
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
