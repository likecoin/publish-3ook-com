// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { needsValidationErrorAck, getReachableStepIndex } from '../app/utils/epub-validation.ts'

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

test('holds every later step, visited or not, while errors are unacknowledged', () => {
  const blocked = [{ validationErrors: '• RSC-016' }, { fileType: 'image/jpeg' }]
  assert.equal(getReachableStepIndex(3, blocked), 0)
  assert.equal(getReachableStepIndex(1, blocked), 0)
})

test('reaches the furthest visited step once errors are acknowledged or absent', () => {
  assert.equal(getReachableStepIndex(3, [{
    validationErrors: '• RSC-016',
    hasAcknowledgedValidationErrors: true,
  }]), 3)
  assert.equal(getReachableStepIndex(2, [{ validationWarnings: '• OPF-085' }]), 2)
  assert.equal(getReachableStepIndex(0, []), 0)
})
