export interface ClassMetadataHasPart {
  '@type'?: string
  'isAccessibleForFree'?: boolean
  'text'?: string
}

export interface ISCNContentMetadata {
  name?: string
  description?: string
  descriptionFull?: string
  alternativeHeadline?: string
  thumbnailUrl?: string
  url?: string
  hasPart?: ClassMetadataHasPart | ClassMetadataHasPart[]
  [key: string]: unknown
}

export interface ISCNData {
  'contentMetadata': ISCNContentMetadata
  'owner': string
  '@id': string
}

export interface PotentialActionTarget {
  '@type'?: string
  'contentType': string
  'url': string
  'name': string
  'encodingType'?: string
}

export interface PotentialAction {
  '@type'?: string
  'target'?: PotentialActionTarget[]
}

export interface ClassMetadata {
  '@type'?: string
  'name'?: string
  'description'?: string
  'descriptionFull'?: string
  'alternativeHeadline'?: string
  'url'?: string
  'keywords'?: string | string[]
  'thumbnailUrl'?: string
  'image'?: string
  'inLanguage'?: string
  'datePublished'?: string
  'author'?: string | { name?: string, description?: string, url?: string }
  'usageInfo'?: string
  'isbn'?: string
  'publisher'?: string | { name?: string, description?: string, url?: string }
  'genre'?: string
  'contentFingerprints'?: string[]
  'sameAs'?: string[]
  'potentialAction'?: PotentialAction
  'hasPart'?: ClassMetadataHasPart | ClassMetadataHasPart[]
  'recordNotes'?: string
  [key: string]: unknown
}

export interface ISCNRegisterPayload {
  'name': string
  'description': string
  'tagsString': string
  'url': string
  'license': string
  '@type': string
  'author': string
  'fileSHA256'?: string | string[]
  'publisher'?: string
  'publisherDescription'?: string
  'authorDescription'?: string
  'contentFingerprints'?: string[]
  'recordNotes'?: string
  'memo'?: string
  'inLanguage'?: string
  'datePublished'?: string
  'thumbnailUrl'?: string
  'isbn'?: string
}

// On-chain class metadata only; listing-owned fields (descriptionFull,
// tableOfContents) are collected separately by each host.
export interface ISCNFormData {
  type: string
  title: string
  description: string
  alternativeHeadline?: string
  isbn: string
  publisher: {
    name: string
    description: string
    url?: string
  }
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
  publisher?: string | { name: string, description: string }
  author: string | { name: string, description: string }
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

// On-chain BookNFT config + newBookNFT message struct, mirroring the contract's
// BookConfig / MsgNewBookNFT (see contracts/likeNFT.ts).
export interface BookNFTConfig {
  name: string
  symbol: string
  metadata: string
  max_supply: bigint
}

export interface MsgNewBookNFT {
  creator: `0x${string}`
  updaters: `0x${string}`[]
  minters: `0x${string}`[]
  config: BookNFTConfig
}
