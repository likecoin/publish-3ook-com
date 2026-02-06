export interface ISCNContentMetadata {
  name?: string
  description?: string
  descriptionFull?: string
  alternativeHeadline?: string
  thumbnailUrl?: string
  url?: string
  [key: string]: unknown
}

export interface ISCNData {
  contentMetadata: ISCNContentMetadata
  owner: string
  '@id': string
}

export interface PotentialActionTarget {
  '@type'?: string
  contentType: string
  url: string
  name: string
  encodingType?: string
}

export interface PotentialAction {
  '@type'?: string
  target?: PotentialActionTarget[]
}

export interface ClassMetadata {
  '@type'?: string
  name?: string
  description?: string
  descriptionFull?: string
  alternativeHeadline?: string
  url?: string
  keywords?: string | string[]
  thumbnailUrl?: string
  image?: string
  inLanguage?: string
  datePublished?: string
  author?: string | { name?: string; description?: string; url?: string }
  usageInfo?: string
  isbn?: string
  publisher?: string
  genre?: string
  contentFingerprints?: string[]
  sameAs?: string[]
  potentialAction?: PotentialAction
  recordNotes?: string
  [key: string]: unknown
}

export interface ISCNRegisterPayload {
  name: string
  description: string
  tagsString: string
  url: string
  license: string
  '@type': string
  author: string
  fileSHA256?: string | string[]
  publisher?: string
  authorDescription?: string
  contentFingerprints?: string[]
  recordNotes?: string
  memo?: string
  inLanguage?: string
  datePublished?: string
  thumbnailUrl?: string
  isbn?: string
}

export interface ISCNFormData {
  type: string
  title: string
  description: string
  descriptionFull?: string
  alternativeHeadline?: string
  isbn: string
  publisher: string
  publicationDate: string
  author: {
    name: string
    description: string
    url?: string
  }
  license: string
  customLicense: string
  contentFingerprints: Array<{ url: string }>
  downloadableUrls: Array<{
    url: string
    type: string
    fileName: string
  }>
  language: string
  bookInfoUrl: string
  tags: string[]
  coverUrl: string
  genre: string
}

export interface ISCNTxPayload {
  name: string
  description: string
  url?: string
  thumbnailUrl?: string
  publisher?: string
  author: string | { name: string; description: string }
  keywords: string[]
  usageInfo: string
  contentFingerprints: string[]
  [key: string]: unknown
}

export interface ISCNValidationData {
  title?: string
  description?: string
  author?: { name: string }
  contentFingerprints?: Array<{ url: string }>
  coverUrl?: string
}
