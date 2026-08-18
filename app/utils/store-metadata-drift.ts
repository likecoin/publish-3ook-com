// Compares the bookstore listing's copy of a book's metadata against the
// on-chain metadata the edit form loaded. Backfill scripts wrote genre and
// keywords straight into the listing doc (a class `update` needs the owner's
// signature, which a script has none of), so the store can hold enrichment the
// chain never got.
//
// Kept free of runtime imports — only types, which erase — so
// test/store-metadata-drift.test.mjs can run it under `node --test` without
// Nuxt's alias resolution. That is also why the keyword rules below live here
// rather than in a util of their own, and why the genre vocabulary and the
// keyword cap are injected.
import type { ClassListingData } from '~/types/book'
import type { ISCNFormData } from '~/types/iscn'

// The form keys this compares. Only ISCNFormData's own keys are ever staged:
// `mapClassMetadataToISCNForm` spreads raw metadata (`keywords`, `name`, …)
// into the form beside them, and those have no label in the change ledger.
export type StoreMetadataDriftField = 'genre' | 'tags'

export interface StoreMetadataConflict {
  field: StoreMetadataDriftField
  // What the store holds, for the「use this instead」control.
  storeValue: string
}

export interface StoreMetadataDrift {
  // Values to write into the form after its baseline snapshot, so they land in
  // the pending-changes ledger and the author's next save carries them on chain.
  staged: Partial<Pick<ISCNFormData, StoreMetadataDriftField>>
  // Where the store disagrees rather than adds. Never staged: the store copy is
  // only as fresh as its last refresh, so overwriting a chain value the author
  // did set could push a stale one back on chain. They apply these by hand.
  conflicts: StoreMetadataConflict[]
}

/**
 * What the store knows that the chain does not.
 *
 * Three rules, so nothing an author set is ever lost:
 * - fill — empty on chain, set on the store → stage the store value
 * - union — keywords → chain ∪ store, capped, chain's own order and casing kept
 * - conflict — both set and different → offered, not staged
 */
export function getStoreMetadataDrift({
  listing,
  formData,
  genreVocabulary,
  maxKeywords,
}: {
  listing: ClassListingData
  formData: ISCNFormData
  genreVocabulary: readonly string[]
  maxKeywords: number
}): StoreMetadataDrift {
  const staged: StoreMetadataDrift['staged'] = {}
  const conflicts: StoreMetadataConflict[] = []

  const storeGenre = (listing.genre || '').trim()
  const chainGenre = (formData.genre || '').trim()
  // An off-vocabulary genre would render as a blank USelectMenu and write a
  // category nothing recognises, so it is not offered at all.
  if (storeGenre && genreVocabulary.includes(storeGenre)) {
    if (!chainGenre) {
      staged.genre = storeGenre
    }
    else if (chainGenre !== storeGenre) {
      conflicts.push({ field: 'genre', storeValue: storeGenre })
    }
  }

  // The same merge the AI suggestion runs, so a keyword arriving from the store
  // dedupes against what the author typed exactly as a suggested one does.
  const chainKeywords = parseBookKeywords(formData.tags)
  const storeKeywords = parseBookKeywords(listing.keywords)
  const union = mergeBookKeywords(chainKeywords, storeKeywords, maxKeywords)
  if (union.length > chainKeywords.length) {
    staged.tags = union
  }

  return { staged, conflicts }
}

/**
 * The staged fields still holding the value that was staged.
 *
 * Provenance is derived rather than remembered: edit a staged field by hand and
 * it stops being store-sourced, with no flag to keep in step.
 */
export function getStoreSourcedFields(
  staged: Partial<Record<StoreMetadataDriftField, string | string[]>>,
  formData: ISCNFormData,
): StoreMetadataDriftField[] {
  return (Object.keys(staged) as StoreMetadataDriftField[])
    .filter(field => JSON.stringify(staged[field]) === JSON.stringify(formData[field]))
}

// NFKC-folded so width and case variants of one keyword collapse: a
// backend-normalized suggestion must dedupe against what the author typed.
export function foldKeyword(keyword: string): string {
  return keyword.normalize('NFKC').trim().toLowerCase()
}

/**
 * Keywords out of whatever a metadata field holds — an array, or the
 * comma-separated string on-chain metadata and older listings use.
 */
export function parseBookKeywords(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string' ? input.split(',') : []
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') { continue }
    const keyword = entry.trim()
    if (!keyword) { continue }
    const key = foldKeyword(keyword)
    if (seen.has(key)) { continue }
    seen.add(key)
    keywords.push(keyword)
  }
  return keywords
}

/**
 * `existing` plus whatever `incoming` adds to it, in that order.
 *
 * Merged rather than replaced so author-entered keywords are never lost, and
 * additions stop at the cap rather than displacing them — past it `UInputTags`
 * rejects adds silently, so a longer list would show a count it cannot hold.
 */
export function mergeBookKeywords(
  existing: string[],
  incoming: string[],
  max: number,
): string[] {
  const merged = [...existing]
  const seen = new Set(existing.map(foldKeyword))
  for (const keyword of parseBookKeywords(incoming)) {
    if (merged.length >= max) { break }
    const key = foldKeyword(keyword)
    if (seen.has(key)) { continue }
    seen.add(key)
    merged.push(keyword)
  }
  return merged
}
