import {
  PREVIEW_PERCENTAGE_MIN,
  PREVIEW_PERCENTAGE_MAX,
  PREVIEW_PERCENTAGE_DEFAULT,
} from '~/utils/preview-cut'

export const IPFS_VIEW_GATEWAY_URL = 'https://ipfs.io/ipfs'

export const MINIMAL_PRICE = 0.99
export const DEFAULT_PRICE = 4.99
export const DEFAULT_PRICE_STRING = '4.99'
export const MAXIMUM_PRICE = 99.99

export const USD_PRICING_OPTIONS = [0, ...Array.from(
  { length: Math.round(MAXIMUM_PRICE - MINIMAL_PRICE) + 1 },
  (_, i) => MINIMAL_PRICE + i,
)].map(value => ({
  label: (value === 0) ? '免費' : value.toFixed(2),
  value: value.toString(),
}))

export const DEFAULT_MAX_SUPPLY = 18446744073709551615n

export const DEFAULT_STOCK = 100

export const MAX_EDITION_COUNT = 2

export {
  PREVIEW_PERCENTAGE_MIN,
  PREVIEW_PERCENTAGE_MAX,
  PREVIEW_PERCENTAGE_DEFAULT,
}

export const EBOOK_FILE_TYPES = ['application/epub+zip', 'application/pdf']

// Suffix useEbookProcessing gives a cover it extracted from the ebook itself,
// which is how the flow tells a generated cover from one the author picked.
export const GENERATED_COVER_SUFFIX = '_cover.jpeg'

// Rendering settings for the cover extracted from a PDF's first page. It is a
// paid Arweave upload rather than a screen render, so it targets a width rather
// than the device pixel ratio, and the cap stops a small page being upscaled.
export const PDF_COVER_TARGET_WIDTH = 1200
export const PDF_COVER_MAX_SCALE = 2
export const PDF_COVER_JPEG_QUALITY = 0.85

// Cover/image types that may take the open (public) storage tier. SVG is
// deliberately absent: it can carry script, and these objects are served with the
// content type they were stored under.
export const OPEN_IMAGE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

// Everything the publish flow can upload. Mirrors the API's upload_init content
// type allowlist exactly; every accepted file must resolve to a storage tier.
export const UPLOADABLE_FILE_TYPES = [...OPEN_IMAGE_FILE_TYPES, ...EBOOK_FILE_TYPES]

// `accept` is only a picker hint — drag-and-drop and folder selection bypass it,
// so callers must still validate against UPLOADABLE_FILE_TYPES.
export const UPLOAD_ACCEPT_ATTRIBUTE = UPLOADABLE_FILE_TYPES.join(',')

export const COVER_ACCEPT_ATTRIBUTE = OPEN_IMAGE_FILE_TYPES.join(',')

export const NFT_DEFAULT_MINT_AMOUNT = 1
export const NFT_DEFAULT_RESTOCK_AMOUNT = 50

export const LIKE_ADDRESS_REGEX = /^like1[ac-hj-np-z02-9]{38}$/

export const CSV_DEFAULT_LANGUAGE = 'zh'
export const CSV_DEFAULT_AUTO_DELIVER = true
export const CSV_DEFAULT_ENABLE_DRM = false
export const CSV_DEFAULT_ENABLE_TTS = true
export const CSV_DEFAULT_TTS_LIBRARY_ONLY = false
export const CSV_DEFAULT_ENABLE_LIBRARY = true
export const CSV_DEFAULT_ENABLE_PREVIEW = true
export const CSV_DEFAULT_IS_LIKER_LAND_ART = false
export const CSV_DEFAULT_IS_PUBLIC_DOMAIN = false
export const CSV_DEFAULT_HAS_AI_GENERATED_CONTENT = false
export const CSV_DEFAULT_PREVIEW_PERCENTAGE = PREVIEW_PERCENTAGE_DEFAULT
export const CSV_DEFAULT_EDITION_NAME = '電子版'
export const CSV_DEFAULT_EDITION_DESCRIPTION = ''

export const AFFILIATION_CHANNEL_DEFAULT = 'liker_land'

export const AFFILIATION_CHANNELS = [
  { id: AFFILIATION_CHANNEL_DEFAULT, name: 'Liker Land' },
  { id: '@bookpunch', name: '一拳書店' },
  { id: '@boundarybooks', name: '界限書店' },
  { id: '@breakthrough_publish', name: '突破書廊' },
  { id: '@hansbookstore', name: '留下書店' },
  { id: '@hkhouseofliterature', name: '香港文學生活館' },
  { id: '@hkreaders', name: '序言書室' },
  { id: '@hunterbookstore', name: '獵人書店' },
  { id: '@kubrick_hk', name: 'Kubrick' },
  { id: '@nowherebooks', name: '飛地書店' },
  { id: '@samkeebook', name: '森記圖書公司' },
  { id: '@donothingbookshop', name: '無所事事小書店' },
  { id: '@reveriebookstore', name: '長夢書店' },
  { id: '@dionysus_books', name: '神話書店' },
  { id: '@knockknockbookstore', name: 'knock knock 覺閣' },
  { id: '@tobylai1221', name: '藝跡文化' },
]

export const AUTHOR_MESSAGE_LIMIT = 98

export const TRANSFER_GAS = 100000
export const ISCN_GAS_FEE = 200000
export const ISCN_GAS_MULTIPLIER = 1.3
export const UPDATE_ISCN_GAS_MULTIPLIER = 1.75

export const languageOptions = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

export const typeOptions = [
  { label: 'Book', value: 'Book' },
]

export const licenseOptions = [
  { label: 'Copyright. All rights reserved.', value: 'All Rights Reserved' },
  { label: 'CC BY-NC-ND', value: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
  { label: 'CC BY-NC-SA', value: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  { label: 'CC BY-NC', value: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  { label: 'CC BY-ND', value: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  { label: 'CC BY-SA', value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { label: 'CC BY', value: 'https://creativecommons.org/licenses/by/4.0/' },
  { label: 'CC0 (Public Domain)', value: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { label: 'Other', value: 'Other' },
]

export const MAX_DESCRIPTION_LENGTH = 1000
export const MAX_DESCRIPTION_FULL_LENGTH = 5000
export const MAX_ALTERNATIVE_HEADLINE_LENGTH = 200
export const MAX_ACCOUNT_DESCRIPTION_LENGTH = 1000
// Stays under the suggest endpoint's 50-keyword request limit, which would
// otherwise reject the call once a book accumulated enough tags.
export const MAX_BOOK_KEYWORDS = 20

export { BOOK_CATEGORIES, BOOK_CATEGORY_VALUES, type BookCategory } from './bookCategories'

export const PUBLISH_GUIDE_URL = 'https://docs.3ook.com/zh-TW/collections/14176162-出版'
export const AFFILIATION_GUIDE_URL = 'https://docs.3ook.com/zh-TW/articles/13515071-%E5%A6%82%E4%BD%95%E5%8A%A0%E5%85%A5-3ook-com-%E6%9B%B8%E5%BA%97%E6%8E%A8%E5%BB%A3%E8%A8%88%E5%8A%83'

export const STOCK_BALANCE_UNKNOWN = -99
