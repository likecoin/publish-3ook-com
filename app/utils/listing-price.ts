// An edition's money conversions, kept free of runtime imports so
// test/listing-price.test.mjs can run them under `node --test` without Nuxt's
// aliases — listing.ts cannot, as it reaches dompurify through escapeHtml.
import type { BookPriceInDecimalByCurrency } from '~/types/book'

// What the listing doc holds: exact amounts in cents, per currency.
export interface PlusPriceAmounts {
  plusPriceInDecimal?: number
  plusPriceInDecimalByCurrency?: BookPriceInDecimalByCurrency
}

// What the form holds: dollars as typed, blank where the author set nothing.
export interface PlusPriceInputs {
  plusPriceUSDInput: string
  plusPriceHKDInput: string
  plusPriceTWDInput: string
}

export function isBlank(value: unknown): boolean {
  return String(value ?? '').trim() === ''
}

// Cents on the doc, dollars in the field; blank when there is no such amount,
// which is what tells the payload mapper there is nothing to send. Zero is an
// amount, not an absence — a free member price still round-trips.
export function toPriceInput(amountInDecimal?: number): string {
  return typeof amountInDecimal === 'number' ? (amountInDecimal / 100).toString() : ''
}

// And back: dollars in the field, cents on the doc.
export function toPriceCents(amount: string | number): number {
  return Math.round(Number(amount) * 100)
}

export function mapPlusPriceToFormInputs(price: PlusPriceAmounts): PlusPriceInputs {
  return {
    plusPriceUSDInput: toPriceInput(price.plusPriceInDecimal),
    plusPriceHKDInput: toPriceInput(price.plusPriceInDecimalByCurrency?.hkd),
    plusPriceTWDInput: toPriceInput(price.plusPriceInDecimalByCurrency?.twd),
  }
}

// Returns nothing when the edition has no member price, so the caller leaves
// the fields off the payload entirely rather than writing zeros over them.
// Read-only in the form, so a partial doc passes through as stored, not zeroed.
export function mapFormInputsToPlusPrice(inputs: PlusPriceInputs): PlusPriceAmounts | undefined {
  const { plusPriceUSDInput: usd, plusPriceHKDInput: hkd, plusPriceTWDInput: twd } = inputs
  if (isBlank(usd) && isBlank(hkd) && isBlank(twd)) { return undefined }
  const amounts: PlusPriceAmounts = {}
  if (!isBlank(usd)) { amounts.plusPriceInDecimal = toPriceCents(usd) }
  if (!isBlank(hkd) || !isBlank(twd)) {
    amounts.plusPriceInDecimalByCurrency = {
      ...(!isBlank(hkd) && { hkd: toPriceCents(hkd) }),
      ...(!isBlank(twd) && { twd: toPriceCents(twd) }),
    }
  }
  return amounts
}
