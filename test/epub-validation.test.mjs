// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { needsValidationErrorAck } from '../app/utils/epub-validation.ts'

test('asks for an acknowledgement only while errors are unacknowledged', () => {
  assert.equal(needsValidationErrorAck({ validationErrors: '• RSC-016' }), true)
  assert.equal(needsValidationErrorAck({
    validationErrors: '• RSC-016',
    hasAcknowledgedValidationErrors: true,
  }), false)
})

test('never asks for a file with warnings only, or none at all', () => {
  assert.equal(needsValidationErrorAck({ validationErrors: '' }), false)
  assert.equal(needsValidationErrorAck({}), false)
})
