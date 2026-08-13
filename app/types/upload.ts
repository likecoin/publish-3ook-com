export interface FileRecord {
  fileName?: string
  fileSize?: number
  fileType?: string
  fileBlob?: Blob
  ipfsHash?: string
  fileSHA256?: string
  fileData?: string
  // Set only on a cover extracted from the EPUB itself, never on one the
  // author picked. Decides which cover 復原 restores and which one publishes.
  isGeneratedCover?: boolean
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
  validationErrors?: string
  validationWarnings?: string
  hasValidationIssues?: boolean
  // PDFs only, and undefined means undetermined — the file would not open, or
  // reading it threw. Only an explicit false is a scan the author is told about.
  hasSearchableText?: boolean
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
