// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PREVIEW_PERCENTAGE_MIN,
  PREVIEW_PERCENTAGE_MAX,
  PREVIEW_PERCENTAGE_DEFAULT,
  PREVIEW_OVERSHOOT_FACTOR,
  clampPreviewPercentage,
  planEpubPreviewCut,
  planPdfPreviewCut,
} from '../app/utils/preview-cut.ts'

// Bump alongside the fixture's `version` when the rules change, so this copy
// goes stale loudly instead of silently drifting from the ebook-cors server.
const EXPECTED_FIXTURE_VERSION = 2

const fixture = JSON.parse(fs.readFileSync(path.join(
  fileURLToPath(import.meta.url),
  '../fixtures/preview-cut.golden.json',
)))

// Floats: the fixture stores the exact double the rules produce, but compare
// with a tolerance so a harmless reordering of the arithmetic never fails.
function assertPercentage(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`,
  )
}

function assertPlan(actual, expected, name) {
  assert.equal(actual.ok, expected.ok, `${name}: ok`)
  if (!expected.ok) {
    assert.equal(actual.reason, expected.reason, `${name}: reason`)
    return
  }
  assert.equal(actual.includedCount, expected.includedCount, `${name}: includedCount`)
  // Normalised both sides: PDF plans have no partial-page cut, and asserting
  // that unconditionally pins them to never growing one.
  assert.deepEqual(actual.partial ?? null, expected.partial ?? null, `${name}: partial`)
  assertPercentage(actual.effectivePercentage, expected.effectivePercentage, `${name}: effectivePercentage`)
}

test('fixture matches the version this implementation was written against', () => {
  assert.equal(fixture.version, EXPECTED_FIXTURE_VERSION)
})

test('constants match the fixture', () => {
  assert.deepEqual(fixture.constants, {
    minPercentage: PREVIEW_PERCENTAGE_MIN,
    maxPercentage: PREVIEW_PERCENTAGE_MAX,
    defaultPercentage: PREVIEW_PERCENTAGE_DEFAULT,
    overshootFactor: PREVIEW_OVERSHOOT_FACTOR,
  })
})

test('clampPreviewPercentage', async (t) => {
  await Promise.all(fixture.clamp.map(({ name, value, expected }) => t.test(name, () => {
    assert.equal(clampPreviewPercentage(value), expected)
  })))
})

test('planEpubPreviewCut', async (t) => {
  await Promise.all(fixture.epub.map(({
    name, sizes, percentage, expected,
  }) => t.test(name, () => {
    assertPlan(planEpubPreviewCut(sizes, percentage), expected, name)
  })))
})

test('planPdfPreviewCut', async (t) => {
  await Promise.all(fixture.pdf.map(({
    name, pageCount, percentage, expected,
  }) => t.test(name, () => {
    assertPlan(planPdfPreviewCut(pageCount, percentage), expected, name)
  })))
})
