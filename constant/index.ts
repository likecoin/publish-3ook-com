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

export const CSV_DEFAULT_LANGUAGE = 'zh'
export const CSV_DEFAULT_AUTO_DELIVER = true
export const CSV_DEFAULT_ENABLE_DRM = false
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

export const BOOK_CATEGORIES = [
  { i18nKey: 'book_category.antiques_collectibles', value: 'Antiques & Collectibles' },
  { i18nKey: 'book_category.architecture', value: 'Architecture' },
  { i18nKey: 'book_category.art', value: 'Art' },
  { i18nKey: 'book_category.bibles', value: 'Bibles' },
  { i18nKey: 'book_category.biography_autobiography', value: 'Biography & Autobiography' },
  { i18nKey: 'book_category.business_economics', value: 'Business & Economics' },
  { i18nKey: 'book_category.comics_graphic_novels', value: 'Comics & Graphic Novels' },
  { i18nKey: 'book_category.computers', value: 'Computers' },
  { i18nKey: 'book_category.cooking', value: 'Cooking' },
  { i18nKey: 'book_category.crafts_hobbies', value: 'Crafts & Hobbies' },
  { i18nKey: 'book_category.design', value: 'Design' },
  { i18nKey: 'book_category.drama', value: 'Drama' },
  { i18nKey: 'book_category.education', value: 'Education' },
  { i18nKey: 'book_category.family_relationships', value: 'Family & Relationships' },
  { i18nKey: 'book_category.fiction', value: 'Fiction' },
  { i18nKey: 'book_category.games_activities', value: 'Games & Activities' },
  { i18nKey: 'book_category.gardening', value: 'Gardening' },
  { i18nKey: 'book_category.health_fitness', value: 'Health & Fitness' },
  { i18nKey: 'book_category.history', value: 'History' },
  { i18nKey: 'book_category.house_home', value: 'House & Home' },
  { i18nKey: 'book_category.humor', value: 'Humor' },
  { i18nKey: 'book_category.juvenile_fiction', value: 'Juvenile Fiction' },
  { i18nKey: 'book_category.juvenile_nonfiction', value: 'Juvenile Nonfiction' },
  { i18nKey: 'book_category.language_arts_disciplines', value: 'Language Arts & Disciplines' },
  { i18nKey: 'book_category.language_study', value: 'Language Study' },
  { i18nKey: 'book_category.law', value: 'Law' },
  { i18nKey: 'book_category.literary_collections', value: 'Literary Collections' },
  { i18nKey: 'book_category.literary_criticism', value: 'Literary Criticism' },
  { i18nKey: 'book_category.mathematics', value: 'Mathematics' },
  { i18nKey: 'book_category.medical', value: 'Medical' },
  { i18nKey: 'book_category.mind_body_spirit', value: 'Mind, Body, Spirit' },
  { i18nKey: 'book_category.music', value: 'Music' },
  { i18nKey: 'book_category.nature', value: 'Nature' },
  { i18nKey: 'book_category.performing_arts', value: 'Performing Arts' },
  { i18nKey: 'book_category.pets', value: 'Pets' },
  { i18nKey: 'book_category.philosophy', value: 'Philosophy' },
  { i18nKey: 'book_category.photography', value: 'Photography' },
  { i18nKey: 'book_category.poetry', value: 'Poetry' },
  { i18nKey: 'book_category.political_science', value: 'Political Science' },
  { i18nKey: 'book_category.psychology', value: 'Psychology' },
  { i18nKey: 'book_category.reference', value: 'Reference' },
  { i18nKey: 'book_category.religion', value: 'Religion' },
  { i18nKey: 'book_category.science', value: 'Science' },
  { i18nKey: 'book_category.self_help', value: 'Self-Help' },
  { i18nKey: 'book_category.social_science', value: 'Social Science' },
  { i18nKey: 'book_category.sports_recreation', value: 'Sports & Recreation' },
  { i18nKey: 'book_category.study_aids', value: 'Study Aids' },
  { i18nKey: 'book_category.technology_engineering', value: 'Technology & Engineering' },
  { i18nKey: 'book_category.transportation', value: 'Transportation' },
  { i18nKey: 'book_category.travel', value: 'Travel' },
  { i18nKey: 'book_category.true_crime', value: 'True Crime' },
  { i18nKey: 'book_category.young_adult_fiction', value: 'Young Adult Fiction' },
  { i18nKey: 'book_category.young_adult_nonfiction', value: 'Young Adult Nonfiction' },
  { i18nKey: 'book_category.other', value: 'Other' }
] as const

export const PUBLISH_GUIDE_URL = 'https://docs.3ook.com/zh-TW/collections/14176162-出版'
export const AFFILIATION_GUIDE_URL = 'https://docs.3ook.com/zh-TW/articles/13515071-%E5%A6%82%E4%BD%95%E5%8A%A0%E5%85%A5-3ook-com-%E6%9B%B8%E5%BA%97%E6%8E%A8%E5%BB%A3%E8%A8%88%E5%8A%83'
