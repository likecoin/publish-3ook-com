// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getBookListingStatus,
  hasListedEdition,
  hasListedEditionDraft,
  isBookUnlistedDraft,
  isBookSoldOut,
  isEditionDraftSoldOut,
} from '../app/utils/listing-status.ts'

// The draft shape spells the same fact with the opposite polarity, so the two
// must not be swapped for each other: `{}` is listed to one and hidden to the other.
test('hasListedEditionDraft reads the draft flag, not the API one', () => {
  assert.equal(hasListedEditionDraft([]), false)
  assert.equal(hasListedEditionDraft([{ isListed: false }]), false)
  assert.equal(hasListedEditionDraft([{ isListed: false }, { isListed: true }]), true)
  assert.equal(hasListedEditionDraft([{}]), false)
  assert.equal(hasListedEdition([{}]), true)
})

// The empty case is the one that separates it from !hasListedEditionDraft: a
// draft with no editions yet is not a book its author took off the shelf.
test('isBookUnlistedDraft needs editions before it calls a book unlisted', () => {
  assert.equal(isBookUnlistedDraft([]), false)
  assert.equal(isBookUnlistedDraft([{ isListed: false }]), true)
  assert.equal(isBookUnlistedDraft([{ isListed: false }, { isListed: true }]), false)
})

test('hasListedEdition needs at least one edition a reader can see', () => {
  assert.equal(hasListedEdition(undefined), false)
  assert.equal(hasListedEdition([]), false)
  assert.equal(hasListedEdition([{ isUnlisted: true }]), false)
  assert.equal(hasListedEdition([{ isUnlisted: true }, { isUnlisted: false }]), true)
  // The API omits the flag on a listed edition rather than sending false.
  assert.equal(hasListedEdition([{}]), true)
})

test('isBookSoldOut ignores editions the reader cannot see', () => {
  // Nothing listed is 已下架, not 售罄 — getBookListingStatus decides which wins.
  assert.equal(isBookSoldOut(undefined), false)
  assert.equal(isBookSoldOut([]), false)
  assert.equal(isBookSoldOut([{ isUnlisted: true, isSoldOut: true }]), false)

  // An unlisted edition with stock left must not rescue a sold-out listed one.
  assert.equal(isBookSoldOut([
    { isUnlisted: false, isSoldOut: true },
    { isUnlisted: true, isSoldOut: false },
  ]), true)

  // One listed edition still selling keeps the whole book on sale.
  assert.equal(isBookSoldOut([
    { isUnlisted: false, isSoldOut: true },
    { isUnlisted: false, isSoldOut: false },
  ]), false)

  // A missing flag is the API saying "not sold out", never unknown.
  assert.equal(isBookSoldOut([{ isUnlisted: false }]), false)
})

test('isEditionDraftSoldOut mirrors the server rule over unsaved stock', () => {
  const edition = overrides => ({ isListed: true, deliveryMethod: 'manual', stock: 10, ...overrides })

  assert.equal(isEditionDraftSoldOut([]), false)
  assert.equal(isEditionDraftSoldOut([edition({ isListed: false, stock: 0 })]), false)

  assert.equal(isEditionDraftSoldOut([edition({ stock: 0 })]), true)
  assert.equal(isEditionDraftSoldOut([edition({ stock: 5 })]), false)
  // Stock can go negative when the server oversells a race; still sold out.
  assert.equal(isEditionDraftSoldOut([edition({ stock: -1 })]), true)

  // An auto-delivered edition mints on demand, so it is never sold out —
  // and it keeps the book selling even beside an exhausted manual edition.
  assert.equal(isEditionDraftSoldOut([edition({ deliveryMethod: 'auto', stock: 0 })]), false)
  assert.equal(isEditionDraftSoldOut([
    edition({ stock: 0 }),
    edition({ deliveryMethod: 'auto', stock: 0 }),
  ]), false)

  // Unlisted rows are out of the verdict, listed ones decide it.
  assert.equal(isEditionDraftSoldOut([
    edition({ stock: 0 }),
    edition({ isListed: false, stock: 99 }),
  ]), true)
  assert.equal(isEditionDraftSoldOut([
    edition({ stock: 0 }),
    edition({ stock: 3 }),
  ]), false)
})

test('isEditionDraftSoldOut holds the badge while the author is typing', () => {
  const edition = overrides => ({ isListed: true, deliveryMethod: 'manual', stock: 10, ...overrides })

  // A cleared number input hands back '' rather than 0; reading that as sold
  // out would flash 售罄 between the delete and the retype.
  assert.equal(isEditionDraftSoldOut([edition({ stock: '' })]), false)
  assert.equal(isEditionDraftSoldOut([edition({ stock: '   ' })]), false)
  // A parsed value arrives as a string on some paths, and still counts.
  assert.equal(isEditionDraftSoldOut([edition({ stock: '0' })]), true)
  assert.equal(isEditionDraftSoldOut([edition({ stock: '7' })]), false)
})

test('getBookListingStatus resolves the states in priority order', () => {
  const book = overrides => ({
    isHidden: false,
    isPendingReview: false,
    hasListedEdition: true,
    isSoldOut: false,
    ...overrides,
  })

  // Moderation outranks everything: nothing is for sale yet.
  assert.equal(getBookListingStatus(book({ isPendingReview: true, isHidden: true, isSoldOut: true })), 'pending_review')

  // Hidden and "every edition unlisted" are the same thing to a reader.
  assert.equal(getBookListingStatus(book({ isHidden: true })), 'unlisted')
  assert.equal(getBookListingStatus(book({ hasListedEdition: false })), 'unlisted')
  // Unlisted outranks sold out — an invisible book is not a sold-out one.
  assert.equal(getBookListingStatus(book({ hasListedEdition: false, isSoldOut: true })), 'unlisted')

  assert.equal(getBookListingStatus(book({ isSoldOut: true })), 'sold_out')
  assert.equal(getBookListingStatus(book()), 'listed')
})
