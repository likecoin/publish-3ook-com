export interface UploadFileData {
  epubMetadata?: {
    epubFileName: string
    title: string
    author: string
    language: string
    coverData?: string
    description: string
    tags: string[]
    thumbnailArweaveId: string
    thumbnailIpfsHash: string
    tableOfContents?: string
  }
  fileRecords: Array<{
    fileName: string
    fileType: string
    arweaveId: string
    arweaveLink: string
    ipfsHash: string
    arweaveKey?: string
  }>
}

export const FILE_UPLOAD_KEY = 'publish_book_uploaded_file'

export function setUploadFileData(data: Partial<UploadFileData>) {
  try {
    sessionStorage.setItem(FILE_UPLOAD_KEY, JSON.stringify(data))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save to sessionStorage:', error)
  }
}

export function getUploadFileData(): UploadFileData | null {
  try {
    const stored = sessionStorage.getItem(FILE_UPLOAD_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read from sessionStorage:', error)
  }
  return null
}

export function clearUploadFileData() {
  try {
    sessionStorage.removeItem(FILE_UPLOAD_KEY)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to clear sessionStorage:', error)
  }
}

// descriptionFull lives in the store listing now, but the new-book wizard
// collects it on the ISCN step; this bridge carries the value across the
// intermediate mint step until listing creation persists it.
export const PENDING_DESCRIPTION_FULL_KEY = 'publish_book_pending_description_full'

export function setPendingDescriptionFull(value: string) {
  try {
    sessionStorage.setItem(PENDING_DESCRIPTION_FULL_KEY, value)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save to sessionStorage:', error)
  }
}

export function getPendingDescriptionFull(): string {
  try {
    return sessionStorage.getItem(PENDING_DESCRIPTION_FULL_KEY) || ''
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read from sessionStorage:', error)
    return ''
  }
}

export function clearPendingDescriptionFull() {
  try {
    sessionStorage.removeItem(PENDING_DESCRIPTION_FULL_KEY)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to clear sessionStorage:', error)
  }
}
