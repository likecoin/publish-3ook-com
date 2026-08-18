// Aggregates the labeled pending edits of a published book across the status
// page's tabs. It owns no form state: each domain keeps its own snapshot, and
// this turns their changed-key lists into one deduped ledger for the bar.

import type { BookStatusTab } from '~/types/book'

export type BookEditChangeGroup = 'chain' | 'settings' | 'signature' | `price:${number}`

// Who a saved change reaches. Authors ask this before every save, so the bar
// answers it rather than leaving them to guess whether existing buyers see it.
export type BookEditChangeAudience = 'readers' | 'future_purchases' | 'storefront'

export interface BookEditChangeEntry {
  key: string
  label: string
  // The tab that owns the field, so the bar can jump to it.
  tab: BookStatusTab
  group: BookEditChangeGroup
  audience: BookEditChangeAudience
  // Saving this entry signs an on-chain transaction; the bar announces it so
  // the wallet prompt on save is expected, not a surprise.
  needsWallet?: boolean
  // Filled in from the bookstore listing rather than edited by the author, so
  // the leave guards can ignore it and the label can say where it came from.
  source?: 'store'
}

export interface BookEditEditionChange {
  index: number
  name: string
  changedFields: string[]
}

// ISCNFormData keys → the label keys their form fields already use.
const CHAIN_FIELD_LABEL_KEYS: Record<string, string> = {
  title: 'common.title',
  alternativeHeadline: 'iscn_form.subtitle',
  description: 'iscn_form.description_short',
  author: 'iscn_form.author_name',
  publisher: 'form.publisher',
  isbn: 'form.isbn',
  publicationDate: 'form.publication_date',
  language: 'form.language',
  genre: 'form.genre',
  license: 'iscn_form.license',
  customLicense: 'iscn_form.license',
  coverUrl: 'form.cover_image',
  tags: 'form.keywords',
  contentFingerprints: 'iscn_form.content_fingerprint',
  downloadableUrls: 'publish_review.files_title',
}

const SETTINGS_FIELD_LABEL_KEYS: Record<string, string> = {
  isAdultOnly: 'nft_book_form.is_adult_only',
  hideAudio: 'nft_book_form.ai_audio',
  hideDownload: 'upload_form.drm_section_title',
  isPlusReadingEnabled: 'nft_book_form.plus_reading',
  isPreviewEnabled: 'nft_book_form.free_preview',
  previewPercentage: 'nft_book_form.free_preview',
  descriptionFull: 'common.description',
  tableOfContents: 'form.table_of_content',
  moderatorWallets: 'form.share_sales_data',
}

// Where each setting is edited, which is not where it is saved: all of these go
// through the same settings POST. Anything unlisted is a term of the sale.
const SETTINGS_FIELD_TABS: Record<string, BookStatusTab> = {
  isPlusReadingEnabled: 'summary',
  descriptionFull: 'details',
  tableOfContents: 'details',
  hideDownload: 'details',
  moderatorWallets: 'sales',
}

// The file itself and what may be done with it are the only edits that reach
// someone who already paid; everything else is either the next sale's terms or
// the storefront page.
const READER_FACING_CHAIN_KEYS = new Set(['contentFingerprints', 'downloadableUrls'])
const READER_FACING_SETTING_KEYS = new Set(['hideDownload'])
const FUTURE_PURCHASE_SETTING_KEYS = new Set(['isPreviewEnabled', 'previewPercentage'])

const AUDIENCE_RANK: Record<BookEditChangeAudience, number> = {
  storefront: 0,
  future_purchases: 1,
  readers: 2,
}

const EDITION_FIELD_LABEL_KEYS: Record<string, string> = {
  name: 'nft_book_form.product_name',
  price: 'nft_book_form.unit_price_label',
  isCustomPricing: 'nft_book_form.unit_price_label',
  priceUSDInput: 'nft_book_form.unit_price_label',
  priceHKDInput: 'nft_book_form.unit_price_label',
  priceTWDInput: 'nft_book_form.unit_price_label',
  description: 'common.description',
  deliveryMethod: 'nft_book_form.copies_label',
  stock: 'nft_book_form.stock',
  autoMemo: 'nft_book_form.auto_delivery_memo',
  isAllowCustomPrice: 'nft_book_form.accept_tipping',
  isListed: 'nft_book_form.edition_visibility',
}

// What a pending entry is: filled in from the bookstore listing, signed on
// chain, or typed by the author. Shared so the bar and the summary list agree.
export function getBookEditChangeIcon(entry: BookEditChangeEntry): string | undefined {
  if (entry.source === 'store') { return 'i-heroicons-building-storefront' }
  return entry.needsWallet ? 'i-heroicons-wallet' : undefined
}

export function useBookEditChanges(options: {
  chainChangedFields: () => string[]
  settingsChangedKeys: () => string[]
  editionChanges: () => BookEditEditionChange[]
  signatureChanged: () => boolean
  // Chain fields holding a value taken from the bookstore listing; see
  // utils/store-metadata-drift.ts.
  chainStoreSourcedFields?: () => string[]
}) {
  const { t } = useI18n()

  const changes = computed<BookEditChangeEntry[]>(() => {
    const entries: BookEditChangeEntry[] = []
    // Dedupe by (group, label): the custom-pricing inputs are one price to the
    // author, not four separate changes.
    const seen = new Set<string>()

    function push(entry: BookEditChangeEntry) {
      const dedupeKey = `${entry.group}:${entry.label}`
      if (seen.has(dedupeKey)) { return }
      seen.add(dedupeKey)
      entries.push(entry)
    }

    const storeSourced = new Set(options.chainStoreSourcedFields?.() ?? [])
    options.chainChangedFields().forEach((field) => {
      const labelKey = CHAIN_FIELD_LABEL_KEYS[field]
      const label = labelKey ? t(labelKey) : field
      const isStoreSourced = storeSourced.has(field)
      push({
        key: `chain.${field}`,
        // Labeled where it came from wherever the entry is listed, so nobody
        // has to work out why a page they only opened has changes pending.
        label: isStoreSourced ? t('status_page.pending_change_from_store', { field: label }) : label,
        tab: 'details',
        group: 'chain',
        audience: READER_FACING_CHAIN_KEYS.has(field) ? 'readers' : 'storefront',
        needsWallet: true,
        source: isStoreSourced ? 'store' : undefined,
      })
    })

    options.settingsChangedKeys().forEach((field) => {
      const labelKey = SETTINGS_FIELD_LABEL_KEYS[field]
      push({
        key: `settings.${field}`,
        label: labelKey ? t(labelKey) : field,
        tab: SETTINGS_FIELD_TABS[field] ?? 'pricing',
        group: 'settings',
        audience: getSettingAudience(field),
      })
    })

    options.editionChanges().forEach(({ index, name, changedFields }) => {
      const editionName = name || t('nft_book_form.edition_number', { number: index + 1 })
      changedFields.forEach((field) => {
        const labelKey = EDITION_FIELD_LABEL_KEYS[field]
        push({
          key: `price.${index}.${field}`,
          label: t('status_page.pending_change_edition_field', {
            edition: editionName,
            field: labelKey ? t(labelKey) : field,
          }),
          tab: 'pricing',
          group: `price:${index}`,
          audience: 'future_purchases',
        })
      })
    })

    if (options.signatureChanged()) {
      push({
        key: 'signature',
        label: t('nft_book_form.autograph_image'),
        tab: 'pricing',
        group: 'signature',
        audience: 'future_purchases',
      })
    }

    return entries
  })

  const changeCount = computed(() => changes.value.length)
  // The edits the author actually made. The leave guards read this: warning
  // about values the store proposed teaches people to click through the dialog.
  const authorChangeCount = computed(() => changes.value.filter(entry => !entry.source).length)
  const needsWalletSignature = computed(() => changes.value.some(entry => entry.needsWallet))

  // The widest audience any pending change reaches: one save commits them all,
  // so the narrower ones are already covered by naming the widest.
  const changeAudience = computed<BookEditChangeAudience | null>(() => changes.value.reduce<BookEditChangeAudience | null>(
    (widest, entry) => (!widest || AUDIENCE_RANK[entry.audience] > AUDIENCE_RANK[widest] ? entry.audience : widest),
    null,
  ))

  return {
    changes,
    changeCount,
    authorChangeCount,
    changeAudience,
    needsWalletSignature,
  }
}

function getSettingAudience(field: string): BookEditChangeAudience {
  if (READER_FACING_SETTING_KEYS.has(field)) { return 'readers' }
  if (FUTURE_PURCHASE_SETTING_KEYS.has(field)) { return 'future_purchases' }
  return 'storefront'
}
