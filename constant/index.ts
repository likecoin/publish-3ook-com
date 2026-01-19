export const IPFS_VIEW_GATEWAY_URL = 'https://ipfs.io/ipfs'

export const MINIMAL_PRICE = 0.99
export const DEFAULT_PRICE = 4.99
export const DEFAULT_PRICE_STRING = '4.99'
export const MAXIMUM_PRICE = 99.99

export const USD_PRICING_OPTIONS = [0, ...Array.from(
  { length: Math.round(MAXIMUM_PRICE - MINIMAL_PRICE) + 1 },
  (_, i) => MINIMAL_PRICE + i
)].map(value => ({
  label: (value === 0) ? '免費' : value.toFixed(2),
  value: value.toString()
}))

export const DEFAULT_MAX_SUPPLY = 18446744073709551615n

export const DEFAULT_STOCK = 100

export const NFT_DEFAULT_MINT_AMOUNT = 1
export const NFT_DEFAULT_RESTOCK_AMOUNT = 50

export const LIKE_ADDRESS_REGEX = /^like1[ac-hj-np-z02-9]{38}$/

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
  { id: '@tobylai1221', name: '藝跡文化' }
]

export const AUTHOR_MESSAGE_LIMIT = 98

export const TRANSFER_GAS = 100000
export const ISCN_GAS_FEE = 200000
export const ISCN_GAS_MULTIPLIER = 1.3
export const UPDATE_ISCN_GAS_MULTIPLIER = 1.75

export const languageOptions = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' }
]

export const typeOptions = [
  { label: 'Book', value: 'Book' }
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
  { label: 'Other', value: 'Other' }
]

export const MAX_DESCRIPTION_LENGTH = 1000
export const MAX_DESCRIPTION_FULL_LENGTH = 5000
export const MAX_ALTERNATIVE_HEADLINE_LENGTH = 200

export const PUBLISH_GUIDE_URL = 'https://docs.3ook.com/zh-TW/collections/14176162-出版'
