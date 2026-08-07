// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  USD_PRICE_TIER_LIST,
  HKD_PRICE_TIER_LIST,
  TWD_PRICE_TIER_LIST,
  REGION_CURRENCIES,
  buildPriceOverride,
  convertUSDPriceToCurrency,
  convertCurrencyToUSDPrice,
  getCurrencyPriceInDecimal,
  getRegionReaderPrices,
} from '../app/utils/pricing.ts'
import { estimateAuthorRevenue } from '../app/utils/book-revenue.ts'

// Bump alongside the fixture's `version` when the tables change, so this copy
// goes stale loudly instead of silently drifting from likecoin-api-public.
const EXPECTED_FIXTURE_VERSION = 1

const fixture = JSON.parse(fs.readFileSync(path.join(
  fileURLToPath(import.meta.url),
  '../fixtures/pricing.golden.json',
)))

test('fixture matches the version this implementation was written against', () => {
  assert.equal(fixture.version, EXPECTED_FIXTURE_VERSION)
})

test('tier lists match the fixture', () => {
  assert.deepEqual(USD_PRICE_TIER_LIST, fixture.tierLists.usd)
  assert.deepEqual(HKD_PRICE_TIER_LIST, fixture.tierLists.hkd)
  assert.deepEqual(TWD_PRICE_TIER_LIST, fixture.tierLists.twd)
})

// Every index derived from one ladder is used to read another, so the lookups
// are only in-range while the three stay the same length.
test('the ladders are parallel', () => {
  assert.equal(HKD_PRICE_TIER_LIST.length, USD_PRICE_TIER_LIST.length)
  assert.equal(TWD_PRICE_TIER_LIST.length, USD_PRICE_TIER_LIST.length)
})

test('convertUSDPriceToCurrency', async (t) => {
  await Promise.all(fixture.usdToCurrency.map(({
    name, price, currency, expected,
  }) => t.test(name, () => {
    assert.equal(convertUSDPriceToCurrency(price, currency), expected)
  })))
})

test('convertCurrencyToUSDPrice', async (t) => {
  await Promise.all(fixture.currencyToUSD.map(({
    name, price, currency, expected,
  }) => t.test(name, () => {
    assert.equal(convertCurrencyToUSDPrice(price, currency), expected)
  })))
})

test('getCurrencyPriceInDecimal', async (t) => {
  await Promise.all(fixture.currencyPriceInDecimal.map(({
    name, usdPriceInDecimal, currency, priceInDecimalByCurrency, expected,
  }) => t.test(name, () => {
    assert.equal(
      getCurrencyPriceInDecimal(usdPriceInDecimal, currency, priceInDecimalByCurrency),
      expected,
    )
  })))
})

// The whole ladder, not a sample: a single re-tuned rung fails here.
test('every tier converts as the fixture says', () => {
  assert.deepEqual(
    USD_PRICE_TIER_LIST.map(usd => ({
      usd,
      hkd: convertUSDPriceToCurrency(usd, 'hkd'),
      twd: convertUSDPriceToCurrency(usd, 'twd'),
    })),
    fixture.sweep,
  )
})

test('getRegionReaderPrices quotes the tier in each region', () => {
  assert.deepEqual(getRegionReaderPrices(999), [
    { currency: 'twd', readerPriceInDecimal: 30000, grossUSDInDecimal: 999 },
    { currency: 'hkd', readerPriceInDecimal: 7800, grossUSDInDecimal: 999 },
    { currency: 'usd', readerPriceInDecimal: 999, grossUSDInDecimal: 999 },
  ])
})

test('the review step lists TW, HK then everywhere else', () => {
  assert.deepEqual([...REGION_CURRENCIES], ['twd', 'hkd', 'usd'])
})

// An override is a price the ladder did not choose, so the USD it settles at is
// no longer the listed price — the fee ratio has to follow the reader's price
// back down the ladder, not stay pinned to US$9.99.
test('getRegionReaderPrices re-derives the gross behind a price override', () => {
  const rows = getRegionReaderPrices(999, { hkd: 5000 })
  const hkd = rows.find(row => row.currency === 'hkd')
  assert.equal(hkd.readerPriceInDecimal, 5000)
  assert.equal(hkd.grossUSDInDecimal, 699)
  // The regions without an override are untouched.
  assert.equal(rows.find(row => row.currency === 'twd').grossUSDInDecimal, 999)
})

test('buildPriceOverride reads a fully typed form', () => {
  assert.deepEqual(
    buildPriceOverride({ hkd: '50', twd: '250' }),
    { hkd: 5000, twd: 25000 },
  )
})

// Dropping the zero would quote the tier instead, misreporting a book the
// author has deliberately made free in one region.
test('buildPriceOverride keeps an explicit zero', () => {
  assert.deepEqual(buildPriceOverride({ hkd: '0', twd: '250' }), { hkd: 0, twd: 25000 })
  assert.deepEqual(buildPriceOverride({ hkd: '  0  ', twd: '250' }), { hkd: 0, twd: 25000 })
})

test('a zero override reaches the reader price', () => {
  const rows = getRegionReaderPrices(999, buildPriceOverride({ hkd: '0', twd: '' }))
  assert.equal(rows.find(row => row.currency === 'hkd').readerPriceInDecimal, 0)
  // The currency left untyped still falls back to its tier.
  assert.equal(rows.find(row => row.currency === 'twd').readerPriceInDecimal, 30000)
})

test('buildPriceOverride drops what cannot be a price', async (t) => {
  await Promise.all([
    ['blank', ''],
    ['whitespace', '  '],
    ['non-numeric', 'abc'],
    ['negative', '-5'],
  ].map(([name, input]) => t.test(name, () => {
    assert.deepEqual(buildPriceOverride({ hkd: input, twd: '250' }), { twd: 25000 })
  })))
})

test('a free book is free everywhere', () => {
  for (const row of getRegionReaderPrices(0)) {
    assert.equal(row.readerPriceInDecimal, 0, row.currency)
  }
})

// Pins the reason the review step quotes earnings in the reader's currency.
test('local-currency earnings are rate-stable, USD earnings are not', () => {
  const READER_PAYS_TWD = 30000
  const local = []
  const usd = []
  for (const rate of [28, 29, 30.03, 31, 32, 33]) {
    const grossUSDInDecimal = Math.round(READER_PAYS_TWD / rate)
    const { ratio, royaltyInDecimal } = estimateAuthorRevenue(grossUSDInDecimal, 'twd').direct
    local.push(READER_PAYS_TWD * ratio)
    usd.push(royaltyInDecimal)
  }
  const spread = values => (Math.max(...values) - Math.min(...values)) / Math.max(...values)
  assert.ok(spread(local) < 0.01, `local spread was ${spread(local)}`)
  assert.ok(spread(usd) > 0.1, `usd spread was ${spread(usd)}`)
})
