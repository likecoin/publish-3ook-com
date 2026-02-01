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

export function setUploadFileData (data: Partial<UploadFileData>) {
  try {
    sessionStorage.setItem(FILE_UPLOAD_KEY, JSON.stringify(data))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to save to sessionStorage:', error)
  }
}

export function getUploadFileData (): UploadFileData | null {
  try {
    const stored = sessionStorage.getItem(FILE_UPLOAD_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read from sessionStorage:', error)
  }
  return null
}

export function clearUploadFileData () {
  try {
    sessionStorage.removeItem(FILE_UPLOAD_KEY)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to clear sessionStorage:', error)
  }
}
