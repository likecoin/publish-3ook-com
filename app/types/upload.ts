export interface FileRecord {
  fileName?: string
  fileSize?: number
  fileType?: string
  fileBlob?: Blob
  ipfsHash?: string
  fileSHA256?: string
  fileData?: string
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
  validationErrors?: string
  validationWarnings?: string
  hasValidationIssues?: boolean
}

// One spine content document of an EPUB, in spine order; sizeBytes is the
// uncompressed byte size and label is the best-matching ToC title.
export interface EpubSpineItem {
  href: string
  sizeBytes: number
  label: string
}

export interface EpubMetadata {
  title?: string
  author?: string
  language?: string
  description?: string
  tags?: string[]
  epubFileName?: string
  thumbnailIpfsHash?: string | null
  thumbnailArweaveId?: string | null
  coverData?: string | null
  tableOfContents?: string
  spineItems?: EpubSpineItem[]
  contentExcerpt?: string
}

export interface ArweaveEstimate {
  evmAddress?: string
  arweaveId?: string
  ETH?: string
  ipfsHash?: string
  remainingBytes?: number
  remainingUploads?: number
  isUnlimited?: boolean
}
