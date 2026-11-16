// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COMMON_TERRITORY_CODES,
  getTerritoryOptions,
  isRestrictedTerritoriesLocked,
  parseTerritoryCodes,
} from '../app/utils/restricted-territories.ts'

test('parseTerritoryCodes reads an empty cell as no restriction', () => {
  for (const value of [undefined, '', '  ', ',']) {
    assert.deepEqual(parseTerritoryCodes(value), { codes: [], invalidCodes: [] })
  }
})

test('parseTerritoryCodes normalises case, spacing and duplicates', () => {
  assert.deepEqual(parseTerritoryCodes(' tw, jp ,TW'), { codes: ['TW', 'JP'], invalidCodes: [] })
  assert.deepEqual(parseTerritoryCodes('TW，JP、MO'), { codes: ['TW', 'JP', 'MO'], invalidCodes: [] })
})

// Expanding HK to HK + CN is the API's job, so the CSV value goes through as typed.
test('parseTerritoryCodes leaves HK unexpanded', () => {
  assert.deepEqual(parseTerritoryCodes('HK'), { codes: ['HK'], invalidCodes: [] })
})

test('parseTerritoryCodes separates codes the API would reject', () => {
  assert.deepEqual(parseTerritoryCodes('HK,UK,Taiwan,X'), {
    codes: ['HK'],
    invalidCodes: ['UK', 'TAIWAN', 'X'],
  })
})

test('isRestrictedTerritoriesLocked only lets the publisher edit its own geoblock', () => {
  const territories = ['HK', 'CN']
  assert.equal(isRestrictedTerritoriesLocked({}), false)
  assert.equal(isRestrictedTerritoriesLocked({ restrictedTerritories: [] }), false)
  assert.equal(isRestrictedTerritoriesLocked({ restrictedTerritories: territories, restrictedTerritoriesSetBy: 'publisher' }), false)
  assert.equal(isRestrictedTerritoriesLocked({ restrictedTerritories: territories, restrictedTerritoriesSetBy: 'review' }), true)
  assert.equal(isRestrictedTerritoriesLocked({ restrictedTerritories: territories, restrictedTerritoriesSetBy: 'admin' }), true)
  // A geoblock predating the source field could only have come from review or an admin.
  assert.equal(isRestrictedTerritoriesLocked({ restrictedTerritories: territories }), true)
})

test('getTerritoryOptions lists the common territories first, once each', () => {
  for (const locale of ['zh-TW', 'en-US']) {
    const options = getTerritoryOptions(locale)
    assert.deepEqual(options.slice(0, COMMON_TERRITORY_CODES.length).map(o => o.value), COMMON_TERRITORY_CODES)
    assert.equal(new Set(options.map(o => o.value)).size, options.length)
  }
  // Names come from the runtime's ICU data, so only the code suffix is fixed.
  assert.match(getTerritoryOptions('zh-TW')[0].label, /\S \(HK\)$/)
})
