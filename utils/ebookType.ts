export type EbookType = 'pdf' | 'epub'

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D])
const ZIP_LOCAL_HEADER = new Uint8Array([0x50, 0x4B, 0x03, 0x04])
const EPUB_MIMETYPE = 'application/epub+zip'

function startsWith (bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) { return false }
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) { return false }
  }
  return true
}

// EPUB OCF spec mandates the first ZIP entry is `mimetype`, stored uncompressed,
// with content `application/epub+zip` — so reading the local file header is enough.
export function detectEbookType (buffer: ArrayBuffer): EbookType | null {
  const bytes = new Uint8Array(buffer)

  if (startsWith(bytes, PDF_MAGIC)) { return 'pdf' }

  if (startsWith(bytes, ZIP_LOCAL_HEADER)) {
    if (bytes.length < 30) { return null }
    const compressionMethod = bytes[8]! | (bytes[9]! << 8)
    if (compressionMethod !== 0) { return null }

    const filenameLength = bytes[26]! | (bytes[27]! << 8)
    const extraLength = bytes[28]! | (bytes[29]! << 8)
    const filenameStart = 30
    const filenameEnd = filenameStart + filenameLength
    const contentStart = filenameEnd + extraLength
    const contentEnd = contentStart + EPUB_MIMETYPE.length

    if (bytes.length < contentEnd) { return null }

    const decoder = new TextDecoder()
    if (decoder.decode(bytes.subarray(filenameStart, filenameEnd)) !== 'mimetype') { return null }
    if (decoder.decode(bytes.subarray(contentStart, contentEnd)) === EPUB_MIMETYPE) { return 'epub' }
  }

  return null
}
