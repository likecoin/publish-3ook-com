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
}

export interface ArweaveEstimate {
  evmAddress?: string
  arweaveId?: string
  ETH?: string
  ipfsHash?: string
}
