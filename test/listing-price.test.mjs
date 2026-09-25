// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isBlank,
  toPriceInput,
  toPriceCents,
  mapPlusPriceToFormInputs,
  mapFormInputsToPlusPrice,
} from '../app/utils/listing-price.ts'

// The member price is written as an exact amount per currency, so the two
// directions have to agree to the cent. An edition PUT sends a whole price
// object, so a member price the form fails to carry is a member price erased —
// which is what these guard.

test('cents become the dollars the field shows', () => {
  assert.equal(toPriceInput(169800), '1698')
  assert.equal(toPriceInput(25599), '255.99')
})

test('an absent amount is blank, but zero is an amount', () => {
  assert.equal(toPriceInput(undefined), '')
  assert.equal(toPriceInput(0), '0')
})

test('dollars become cents, rounding rather than truncating', () => {
  assert.equal(toPriceCents('1698'), 169800)
  assert.equal(toPriceCents('255.99'), 25599)
  // 25.565 * 100 lands on 2556.4999... in binary floating point.
  assert.equal(toPriceCents('25.565'), 2557)
})

test('isBlank treats whitespace and nullish alike', () => {
  assert.equal(isBlank(''), true)
  assert.equal(isBlank('  '), true)
  assert.equal(isBlank(undefined), true)
  assert.equal(isBlank(null), true)
  assert.equal(isBlank('0'), false)
})

test('an edition with no member price maps to blank inputs', () => {
  assert.deepEqual(mapPlusPriceToFormInputs({}), {
    plusPriceUSDInput: '',
    plusPriceHKDInput: '',
    plusPriceTWDInput: '',
  })
})

test('an edition with a member price maps to its three fields', () => {
  assert.deepEqual(
    mapPlusPriceToFormInputs({
      plusPriceInDecimal: 21700,
      plusPriceInDecimalByCurrency: { hkd: 169800, twd: 678000 },
    }),
    {
      plusPriceUSDInput: '217',
      plusPriceHKDInput: '1698',
      plusPriceTWDInput: '6780',
    },
  )
})

// The regression this file exists for: blank inputs must produce NOTHING, so
// the caller leaves the fields off the payload rather than writing zeros over
// a member price the form never showed.
test('blank inputs send no member price at all', () => {
  assert.equal(
    mapFormInputsToPlusPrice({
      plusPriceUSDInput: '',
      plusPriceHKDInput: '',
      plusPriceTWDInput: '',
    }),
    undefined,
  )
})

test('filled inputs send exact cents per currency', () => {
  assert.deepEqual(
    mapFormInputsToPlusPrice({
      plusPriceUSDInput: '217',
      plusPriceHKDInput: '1698',
      plusPriceTWDInput: '6780',
    }),
    {
      plusPriceInDecimal: 21700,
      plusPriceInDecimalByCurrency: { hkd: 169800, twd: 678000 },
    },
  )
})

test('a member price survives a doc to form to doc round trip', () => {
  const stored = {
    plusPriceInDecimal: 21700,
    plusPriceInDecimalByCurrency: { hkd: 169800, twd: 678000 },
  }
  assert.deepEqual(mapFormInputsToPlusPrice(mapPlusPriceToFormInputs(stored)), stored)
})

// A free member price is a real offer, not an absent one, so it has to survive
// the same trip — `0` must not be read back as "nothing set".
test('a free member price survives the round trip', () => {
  const stored = {
    plusPriceInDecimal: 0,
    plusPriceInDecimalByCurrency: { hkd: 0, twd: 0 },
  }
  assert.deepEqual(mapFormInputsToPlusPrice(mapPlusPriceToFormInputs(stored)), stored)
})

// The form cannot edit the member price, so whatever the doc holds, even a
// partial trio, must go back unchanged rather than gaining zeros.
test('a partial member price survives the round trip as stored', () => {
  const stored = {
    plusPriceInDecimal: 21700,
    plusPriceInDecimalByCurrency: { twd: 678000 },
  }
  assert.deepEqual(mapFormInputsToPlusPrice(mapPlusPriceToFormInputs(stored)), stored)
})
