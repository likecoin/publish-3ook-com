// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  NFT_BOOK_LIKER_LAND_FEE_RATIO,
  NFT_BOOK_TIP_LIKER_LAND_FEE_RATIO,
  NFT_BOOK_LIKER_LAND_COMMISSION_RATIO,
  NFT_BOOK_LIKER_LAND_ART_FEE_RATIO,
  STRIPE_PERCENTAGE_FEE,
  STRIPE_INTERNATIONAL_FEE,
  STRIPE_FX_FEE,
  STRIPE_FLAT_FEE,
  calculateStripeFee,
  calculateItemPrices,
  calculateItemFeeInfo,
  estimateAuthorRevenue,
} from '../app/utils/book-revenue.ts'

// Bump alongside the fixture's `version` when the rules change, so this copy
// goes stale loudly instead of silently drifting from likecoin-api-public.
const EXPECTED_FIXTURE_VERSION = 1

const fixture = JSON.parse(fs.readFileSync(path.join(
  fileURLToPath(import.meta.url),
  '../fixtures/book-revenue.golden.json',
)))

function feeInfoFor(item, from, currency) {
  const [itemPrice] = calculateItemPrices([item], from)
  const totalPriceInDecimal = item.priceInDecimal * item.quantity
  return calculateItemFeeInfo(itemPrice, {
    totalStripeFeeAmount: calculateStripeFee(totalPriceInDecimal, currency),
    totalPriceInDecimal,
  })
}

// Floats: compare the derived ratio with a tolerance so a harmless reordering
// of the arithmetic never fails.
function assertRatio(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`,
  )
}

test('fixture matches the version this implementation was written against', () => {
  assert.equal(fixture.version, EXPECTED_FIXTURE_VERSION)
})

test('constants match the fixture', () => {
  assert.deepEqual(fixture.constants, {
    likerLandFeeRatio: NFT_BOOK_LIKER_LAND_FEE_RATIO,
    tipFeeRatio: NFT_BOOK_TIP_LIKER_LAND_FEE_RATIO,
    commissionRatio: NFT_BOOK_LIKER_LAND_COMMISSION_RATIO,
    artFeeRatio: NFT_BOOK_LIKER_LAND_ART_FEE_RATIO,
    stripePercentageFee: STRIPE_PERCENTAGE_FEE,
    stripeInternationalFee: STRIPE_INTERNATIONAL_FEE,
    stripeFxFee: STRIPE_FX_FEE,
    stripeFlatFee: STRIPE_FLAT_FEE,
  })
})

test('calculateStripeFee', async (t) => {
  await Promise.all(fixture.stripeFee.map(({
    name, inputAmount, currency, expected,
  }) => t.test(name, () => {
    assert.equal(calculateStripeFee(inputAmount, currency), expected)
  })))
})

test('calculateItemPrices', async (t) => {
  await Promise.all(fixture.itemPrices.map(({
    name, item, from, expected,
  }) => t.test(name, () => {
    assert.deepEqual(calculateItemPrices([item], from)[0], expected)
  })))
})

test('calculateItemFeeInfo', async (t) => {
  await Promise.all(fixture.feeInfo.map(({
    name, item, from, currency, expected,
  }) => t.test(name, () => {
    assert.deepEqual(feeInfoFor(item, from, currency), expected)
  })))
})

test('estimateAuthorRevenue', async (t) => {
  await Promise.all(fixture.authorRevenue.map(({
    name, priceInDecimal, currency, expected,
  }) => t.test(name, () => {
    const actual = estimateAuthorRevenue(priceInDecimal, currency)
    assert.equal(actual.direct.royaltyInDecimal, expected.direct.royaltyInDecimal)
    assert.equal(actual.likerLand.royaltyInDecimal, expected.likerLand.royaltyInDecimal)
    assertRatio(actual.direct.ratio, expected.direct.ratio, `${name}: direct ratio`)
    assertRatio(actual.likerLand.ratio, expected.likerLand.ratio, `${name}: likerLand ratio`)
  })))
})

// The number the UI leads with, pinned in plain sight: 90% is the asymptote,
// not the typical case, which is why the review step shows amounts per channel
// rather than a single ratio.
test('the direct-sale ratio is price-dependent, not a flat 90%', () => {
  assertRatio(estimateAuthorRevenue(500).direct.ratio, 0.846, 'US$5')
  assertRatio(estimateAuthorRevenue(1000).direct.ratio, 0.876, 'US$10')
  assertRatio(estimateAuthorRevenue(5000).direct.ratio, 0.9, 'US$50')
})
