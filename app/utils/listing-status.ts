// The author-facing shelf state, derived from a book's editions. Kept free of
// runtime imports — only types, which erase — so test/listing-status.test.mjs
// can run it under `node --test` without Nuxt's alias resolution.
import type { PriceFormItem } from '~/types/publish'
import type { BookListingItem } from '~/utils/api'
import type { BookListingStatus } from '~/types/book'

// A book's shelf state as the author sees it. A book still awaiting moderation
// isn't for sale yet whatever its editions say, one whose every edition is
// unlisted is as invisible to readers as an explicitly hidden one, and one still
// listed with nothing left to sell is sold out rather than selling.
export function getBookListingStatus(
  book: Pick<BookListingItem, 'isHidden' | 'isPendingReview'> & { hasListedEdition: boolean, isSoldOut: boolean },
): BookListingStatus {
  if (book.isPendingReview) { return 'pending_review' }
  if (book.isHidden || !book.hasListedEdition) { return 'unlisted' }
  if (book.isSoldOut) { return 'sold_out' }
  return 'listed'
}

export function hasListedEdition(prices: { isUnlisted?: boolean }[] | undefined): boolean {
  return !!prices?.length && prices.some(p => !p.isUnlisted)
}

// The draft-shape counterpart of hasListedEdition(), which reads the API's
// `isUnlisted`. Kept apart rather than unified: the two shapes spell the same
// fact with opposite polarity, and one function taking either would hide that.
export function hasListedEditionDraft(prices: PriceFormItem[]): boolean {
  return prices.some(p => p.isListed)
}

// A book taken off the shelf — it has editions and none is listed — which the
// API mirrors as ValidationHelper.isBookUnlisted: readers get borrowing and
// preview off whatever the stored settings say. An editionless draft is not one.
export function isBookUnlistedDraft(prices: PriceFormItem[]): boolean {
  return prices.length > 0 && !hasListedEditionDraft(prices)
}

// Sold out only counts the editions a reader can still see: with none listed the
// book is already 已下架. `isSoldOut` is the API's verdict and the source of
// truth, never true for an auto-delivered edition since those mint on demand.
export function isBookSoldOut(prices: { isUnlisted?: boolean, isSoldOut?: boolean }[] | undefined): boolean {
  const listed = (prices || []).filter(p => !p.isUnlisted)
  return listed.length > 0 && listed.every(p => !!p.isSoldOut)
}

// A preview of that verdict for the unsaved draft, which carries stock instead
// of the flag, so the badge follows a restock the author has yet to save. It
// mirrors the server's rule (`isAutoDeliver ? false : stock <= 0`) by hand.
export function isEditionDraftSoldOut(prices: PriceFormItem[]): boolean {
  const listed = prices.filter(p => p.isListed)
  return listed.length > 0 && listed.every((p) => {
    // A number field cleared mid-edit models as blank, not zero; reading that as
    // sold out would flip the badge while the author is still typing.
    const stock = String(p.stock).trim() === '' ? Number.NaN : Number(p.stock)
    return p.deliveryMethod !== 'auto' && Number.isFinite(stock) && stock <= 0
  })
}
