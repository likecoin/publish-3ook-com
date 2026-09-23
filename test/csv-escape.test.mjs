// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { neutralizeSpreadsheetFormula } from '../app/utils/csv-escape.ts'

test('a formula lead is quoted so the spreadsheet shows it instead of running it', () => {
  assert.equal(neutralizeSpreadsheetFormula('=HYPERLINK("http://x","y")'), '\'=HYPERLINK("http://x","y")')
  assert.equal(neutralizeSpreadsheetFormula('@SUM(A1)'), '\'@SUM(A1)')
  assert.equal(neutralizeSpreadsheetFormula('+cmd|\' /C calc\'!A0'), '\'+cmd|\' /C calc\'!A0')
  assert.equal(neutralizeSpreadsheetFormula('-2+3+cmd|x'), '\'-2+3+cmd|x')
  assert.equal(neutralizeSpreadsheetFormula('\t=1+1'), '\'\t=1+1')
})

test('a phone number or signed amount is a value, not a formula', () => {
  assert.equal(neutralizeSpreadsheetFormula('+852 1234 5678'), '+852 1234 5678')
  assert.equal(neutralizeSpreadsheetFormula('-12.50'), '-12.50')
  assert.equal(neutralizeSpreadsheetFormula('+1 (415) 555-0100'), '+1 (415) 555-0100')
})

test('ordinary text and non-strings pass through untouched', () => {
  assert.equal(neutralizeSpreadsheetFormula('Chan Tai Man'), 'Chan Tai Man')
  assert.equal(neutralizeSpreadsheetFormula(''), '')
  assert.equal(neutralizeSpreadsheetFormula(42), 42)
  assert.equal(neutralizeSpreadsheetFormula(undefined), undefined)
})
