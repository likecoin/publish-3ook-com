// Aggregates the labeled pending edits of a published book across the status
// page's tabs. It owns no form state: each domain keeps its own snapshot, and
// this turns their changed-key lists into one deduped ledger for the bar.

export type BookEditChangeGroup = 'chain' | 'settings' | 'signature' | `price:${number}`

export interface BookEditChangeEntry {
  key: string
  label: string
  // The tab that owns the field, so the bar can jump to it.
  tab: 'details' | 'pricing'
  group: BookEditChangeGroup
  // Saving this entry signs an on-chain transaction; the bar announces it so
  // the wallet prompt on save is expected, not a surprise.
  needsWallet?: boolean
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

// descriptionFull / TOC / moderators are edited on the details tab even though
// they save through the settings POST.
const DETAILS_TAB_SETTING_KEYS = new Set(['descriptionFull', 'tableOfContents', 'moderatorWallets'])

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
  isListed: 'nft_book_form.list_for_sale',
}

export function useBookEditChanges(options: {
  chainChangedFields: () => string[]
  settingsChangedKeys: () => string[]
  editionChanges: () => BookEditEditionChange[]
  signatureChanged: () => boolean
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

    options.chainChangedFields().forEach((field) => {
      const labelKey = CHAIN_FIELD_LABEL_KEYS[field]
      push({
        key: `chain.${field}`,
        label: labelKey ? t(labelKey) : field,
        tab: 'details',
        group: 'chain',
        needsWallet: true,
      })
    })

    options.settingsChangedKeys().forEach((field) => {
      const labelKey = SETTINGS_FIELD_LABEL_KEYS[field]
      push({
        key: `settings.${field}`,
        label: labelKey ? t(labelKey) : field,
        tab: DETAILS_TAB_SETTING_KEYS.has(field) ? 'details' : 'pricing',
        group: 'settings',
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
        })
      })
    })

    if (options.signatureChanged()) {
      push({
        key: 'signature',
        label: t('nft_book_form.autograph_image'),
        tab: 'pricing',
        group: 'signature',
      })
    }

    return entries
  })

  const changeCount = computed(() => changes.value.length)
  const needsWalletSignature = computed(() => changes.value.some(entry => entry.needsWallet))

  return {
    changes,
    changeCount,
    needsWalletSignature,
  }
}
