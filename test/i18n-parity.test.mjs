// AGENTS.md asks for both locale files to be kept in sync. A missing key falls
// back visibly, but a translation that drops a placeholder still reads fine with
// the value gone, so check interpolation and plural branches too.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = path.join(fileURLToPath(import.meta.url), '../../i18n/locales')

const load = locale => JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8'))

const en = load('en')
const zhTW = load('zh-TW')
const sharedKeys = Object.keys(en).filter(key => key in zhTW)

const placeholders = value => [...String(value).matchAll(/\{[^{}]*\}/g)].map(([match]) => match).sort().join(' ') || 'none'
// vue-i18n reads `|` as a plural separator, so both sides need the same count.
const branchCount = value => String(value).split('|').length

// A whole untranslated section would print as one unreadable multi-kilobyte
// line, and passing a message suppresses Node's own diff, so cap the preview.
function assertNone(problems, message) {
  const rest = problems.length > 10 ? `, +${problems.length - 10} more` : ''
  assert.equal(problems.length, 0, `${message} (${problems.length}): ${problems.slice(0, 10).join(', ')}${rest}`)
}

test('every key exists in both locales', () => {
  assertNone(Object.keys(en).filter(key => !(key in zhTW)), 'missing from zh-TW')
  assertNone(Object.keys(zhTW).filter(key => !(key in en)), 'missing from en')
})

test('every value is a non-empty string', () => {
  for (const [locale, messages] of [['en', en], ['zh-TW', zhTW]]) {
    assertNone(
      Object.entries(messages)
        .filter(([, value]) => typeof value !== 'string' || !value.trim())
        .map(([key]) => key),
      `${locale} has empty or non-string values`,
    )
  }
})

test('translations keep the same interpolation placeholders', () => {
  assertNone(
    sharedKeys
      .filter(key => placeholders(en[key]) !== placeholders(zhTW[key]))
      .map(key => `${key} (en: ${placeholders(en[key])} / zh-TW: ${placeholders(zhTW[key])})`),
    'placeholders differ between locales',
  )
})

test('translations keep the same plural branches', () => {
  assertNone(
    sharedKeys
      .filter(key => branchCount(en[key]) !== branchCount(zhTW[key]))
      .map(key => `${key} (en: ${branchCount(en[key])} / zh-TW: ${branchCount(zhTW[key])})`),
    'plural branch counts differ between locales',
  )
})
