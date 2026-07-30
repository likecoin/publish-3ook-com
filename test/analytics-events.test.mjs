// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Intercom silently drops event names past its 120-per-workspace cap, so the
// allowlist is a scarce resource — an entry with no emitter wastes a slot and
// leaves a funnel step looking dead. Nothing links the Set to the call sites
// (useLogEvent takes a plain string), so assert the link here instead: the
// new-book rebuild dropped both blockchain milestones this way and the stale
// allowlist entries hid it for three weeks.
const APP_DIR = path.join(fileURLToPath(import.meta.url), '../../app')
const SOURCE_FILE = path.join(APP_DIR, 'composables/useLogEvent.ts')

const source = fs.readFileSync(SOURCE_FILE, 'utf8')

const setBody = source.match(/INTERCOM_TRACKED_EVENTS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)?.[1]
const allowlist = [...(setBody ?? '').matchAll(/'([^']+)'/g)].map(m => m[1])

// Every other file under app/, concatenated — a name may be logged directly or
// passed through a variable (settings/index.vue, usePurchaseLinkActions.ts), so
// match the literal anywhere rather than only inside a useLogEvent() call.
const emitterSources = fs.readdirSync(APP_DIR, { recursive: true })
  .map(entry => path.join(APP_DIR, entry.toString()))
  .filter(file => /\.(ts|vue)$/.test(file) && file !== SOURCE_FILE)
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n')

test('the allowlist parses', () => {
  // Without this a broken regex would make every assertion below vacuous.
  assert.ok(setBody, 'could not find the INTERCOM_TRACKED_EVENTS Set literal')
  assert.ok(allowlist.length > 0, 'parsed no event names out of the allowlist')
})

test('every allowlisted event has an emitter', async (t) => {
  await Promise.all(allowlist.map(name => t.test(name, () => {
    assert.ok(
      emitterSources.includes(`'${name}'`),
      `'${name}' is allowlisted for Intercom but nothing under app/ logs it — `
      + 'wire up the emitter or drop it from INTERCOM_TRACKED_EVENTS.',
    )
  })))
})
