import type { Book, NavItem } from '@likecoin/epub-ts'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileRecord, EpubMetadata, EpubSpineItem } from '~/types'
import {
  EBOOK_FILE_TYPES,
  GENERATED_COVER_SUFFIX,
  PDF_COVER_TARGET_WIDTH,
  PDF_COVER_MAX_SCALE,
  PDF_COVER_JPEG_QUALITY,
} from '~/constant'
import { getPdfDocument } from '~/utils/pdf'
import { sanitizePdfTitle, sanitizePdfAuthor } from '~/utils/pdf-metadata'
import {
  PDF_TEXT_MIN_CHARS_PER_PAGE,
  samplePdfPageNumbers,
  hasSearchableText,
  countPagesWithText,
  legibleCharCount,
  stripUnmappedChars,
} from '~/utils/pdf-text'

// Cap matches the backend's validation limit (MAX_CONTENT_EXCERPT_CHARS).
const CONTENT_EXCERPT_MAX_CHARS = 20000
// Roughly ten text-dense pages fill the cap, so this only bounds the walk over
// a book whose opening pages carry little text — a picture book, or a scan.
const PDF_EXCERPT_MAX_PAGES = 30
// Give up on a scan early: walking its 30 text-less pages costs about a second
// and can fetch a cmap per page. Counted in characters rather than emptiness,
// since a scanned body often opens on a born-digital or OCR'd title page.
const PDF_EXCERPT_PROBE_PAGES = 5
const PDF_EXCERPT_PROBE_MIN_CHARS = 200

// One pass over the spine, sharing each decompressed document: the ordered
// size table for the free-preview cut readout (uncompressed byte size per
// document, labelled with the best-matching ToC title), plus a plain-text
// excerpt of the opening documents for AI metadata suggestions.
async function extractSpineData(
  book: Book,
): Promise<{ spineItems: EpubSpineItem[], contentExcerpt: string }> {
  const labelByHref = new Map<string, string>()
  const labelByFilename = new Map<string, string>()
  const collectTocLabels = (items: NavItem[]) => {
    for (const item of items) {
      const href = item.href?.split('#')[0]
      const label = item.label?.trim()
      if (href && label) {
        if (!labelByHref.has(href)) { labelByHref.set(href, label) }
        const filename = href.split('/').pop()
        if (filename && !labelByFilename.has(filename)) { labelByFilename.set(filename, label) }
      }
      if (item.subitems?.length) { collectTocLabels(item.subitems) }
    }
  }
  collectTocLabels(book.navigation?.toc || [])

  const archive = book.archive
  if (!archive) { return { spineItems: [], contentExcerpt: '' } }

  const parser = new DOMParser()
  const spineItems: EpubSpineItem[] = []
  let excerpt = ''
  for (const item of book.spine?.items || []) {
    const href = item.href?.split('#')[0]
    if (!href) { continue }
    // getBlob returns the decompressed document, so blob.size is the
    // uncompressed byte size the preview-cut formula is defined over.
    const resolvedPath = book.path?.resolve(href) ?? href
    const blob = await archive.getBlob(resolvedPath)
    // A spine document we cannot size would desync the cut from the server's,
    // so drop the whole table and let the caller hide the readout.
    if (!blob) { return { spineItems: [], contentExcerpt: excerpt } }
    const filename = href.split('/').pop() || href
    spineItems.push({
      href,
      sizeBytes: blob.size,
      label: labelByHref.get(href) || labelByFilename.get(filename) || filename,
    })
    const remaining = CONTENT_EXCERPT_MAX_CHARS - excerpt.length
    if (remaining > 0) {
      // Bound the decode+parse cost: slicing first decodes only a prefix,
      // truncated markup parses fine, and *8 bytes leaves headroom for tags
      // and multi-byte (CJK) characters relative to the wanted text length.
      const content = await blob.slice(0, remaining * 8).text()
      const bodyText = parser.parseFromString(content, 'text/html')
        .body?.textContent?.slice(0, remaining).replace(/\s+/g, ' ').trim()
      if (bodyText) { excerpt += `${bodyText}\n\n` }
    }
  }
  return { spineItems, contentExcerpt: excerpt.slice(0, CONTENT_EXCERPT_MAX_CHARS).trim() }
}

async function readPdfPageText(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const { items } = await page.getTextContent()
  // Items are positioned runs, not words, so join with a space and collapse
  // after: a run boundary mid-word is rarer than two runs running together.
  return items
    .map(item => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// The two ways a PDF can fail a reader, per page: a scan has no characters, and
// a file whose fonts carry no ToUnicode has plenty that decode to nothing.
interface PdfPageStat {
  chars: number
  legibleChars: number
}

// Undefined where the file would not open or reading it threw — see FileRecord,
// which carries both to the author on the same terms.
interface PdfTextLayerVerdict {
  hasSearchableText?: boolean
  hasLegibleText?: boolean
}

function toPdfPageStat(pageText: string): PdfPageStat {
  return { chars: pageText.length, legibleChars: legibleCharCount(pageText) }
}

const hasTextLayer = (stats: PdfPageStat[]) =>
  hasSearchableText(stats.map(stat => stat.chars))

const hasLegibleTextLayer = (stats: PdfPageStat[]) =>
  hasSearchableText(stats.map(stat => stat.legibleChars))

// Held to the same floor as every other rule here: a half-title carrying one
// PUA ornament is entirely unmapped over three characters, and would otherwise
// buy the probe for a book with nothing wrong with it. A blank page is neither
// garbled nor legible — books have blank pages.
const isPageGarbled = (stat: PdfPageStat) =>
  stat.chars >= PDF_TEXT_MIN_CHARS_PER_PAGE && stat.legibleChars === 0

// The PDF counterpart of extractSpineData's excerpt half, feeding the same AI
// metadata suggestion. The per-page stats are the same walk's answer to whether
// the file carries a text layer, and whether it can be read — see processPdf.
async function extractPdfExcerpt(
  pdf: PDFDocumentProxy,
): Promise<{ excerpt: string, pageStats: PdfPageStat[] }> {
  let excerpt = ''
  let charsSeen = 0
  const pageStats: PdfPageStat[] = []
  const pageCount = Math.min(pdf.numPages, PDF_EXCERPT_MAX_PAGES)
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pageText = await readPdfPageText(pdf, pageNumber)
    const stat = toPdfPageStat(pageText)
    pageStats.push(stat)
    charsSeen += stat.chars
    // A garbled page is skipped rather than stopped on: the pages after it may
    // still be legible, and glyph indices in the excerpt are worse for the AI
    // suggestion than no excerpt at all. A page that is kept is still stripped —
    // it is kept for its prose, not for the header that failed to decode.
    if (stat.legibleChars) { excerpt += `${stripUnmappedChars(pageText)}\n\n` }
    if (excerpt.length >= CONTENT_EXCERPT_MAX_CHARS) { break }
    // Measured on what the pages held rather than on what was kept. A book whose
    // opening pages are garbled has a text layer worth walking further into; a
    // scan holds nothing either way and still gives up here.
    if (pageNumber >= PDF_EXCERPT_PROBE_PAGES
      && charsSeen < PDF_EXCERPT_PROBE_MIN_CHARS) { break }
  }
  return {
    excerpt: excerpt.slice(0, CONTENT_EXCERPT_MAX_CHARS).trim(),
    pageStats,
  }
}

// Second opinion for a file whose opening pages read as a scan or as glyph
// indices, sampling across the whole book: the excerpt walk reads only from the
// front, so on its own it would call a book that opens on full-page plates a
// scan. Cheapest on the scan — an image-only page has no embedded font, so
// getTextContent fetches no cmap — and eight pages either way.
async function probePdfTextLayer(
  pdf: PDFDocumentProxy,
  excerptStats: PdfPageStat[],
): Promise<PdfPageStat[]> {
  const pageStats: PdfPageStat[] = []
  for (const pageNumber of samplePdfPageNumbers(pdf.numPages)) {
    // The walk read pages 1..n of this same document with this same function,
    // so a sampled page it already covered costs nothing to reuse — on a book
    // short enough that the sample falls inside the walk, all of them do.
    // `??` and not `||`: an all-zero stat is an answer, not a missing one.
    pageStats.push(
      excerptStats[pageNumber - 1] ?? toPdfPageStat(await readPdfPageText(pdf, pageNumber)),
    )
  }
  return pageStats
}

// The per-page stats both verdicts are taken over, and which sampler produced
// them.
//
// One garbled page buys the probe, rather than the walk's own legibility verdict
// deciding it. The walk's run is not a fixed length — it walks on past a garbled
// page — so how much of the book it covers depends on how broken the file is,
// and a file garbled either side of one legible chapter can land its whole walk
// on that chapter and read as a book that is fine.
//
// The probe's stats replace the walk's rather than joining them. It skips page
// one and spreads across the body, so it is the better judge of every case the
// walk gets wrong — a scan opening on a born-digital title page, a text book
// opening on plates, and a garbled book opening on its one legible spread.
// Joining the two would let a long stretch of plates outvote a body the probe
// found to be all text. The walk is the fallback only for a document too short
// to have anything to probe.
async function samplePdfTextLayer(
  pdf: PDFDocumentProxy,
  excerptStats: PdfPageStat[],
): Promise<{ stats: PdfPageStat[], source: 'excerpt' | 'probe' }> {
  if (hasTextLayer(excerptStats) && !excerptStats.some(isPageGarbled)) {
    return { stats: excerptStats, source: 'excerpt' }
  }
  const stats = await probePdfTextLayer(pdf, excerptStats)
  return stats.length
    ? { stats, source: 'probe' }
    : { stats: excerptStats, source: 'excerpt' }
}

interface UseEbookProcessingOptions {
  // File hashing delegate; return null to skip (the host surfaces its own error).
  getFileInfo: (file: Blob) => Promise<Awaited<ReturnType<typeof getFileInfo>> | null>
  // Receives the cover record auto-extracted from an ebook for the host's file list.
  onCoverExtracted?: (record: FileRecord) => void
  onError?: (error: unknown) => void
}

// Owns the metadata list extracted from uploaded ebooks: epubcheck validation,
// EPUB metadata/ToC/tags extraction, cover extraction for both EPUB and PDF,
// and cover-slot assignment.
export function useEbookProcessing(options: UseEbookProcessingOptions) {
  const { t: $t } = useI18n()

  const epubMetadataList = ref<EpubMetadata[]>([])

  // False when the cover could not be hashed. Names and types the file here so
  // GENERATED_COVER_SUFFIX and the MIME type cannot drift apart.
  const attachCover = async (
    blob: Blob,
    baseName: string,
    metadata: EpubMetadata,
  ): Promise<boolean> => {
    const coverFile = new File(
      [blob],
      `${baseName}${GENERATED_COVER_SUFFIX}`,
      { type: 'image/jpeg' },
    )
    const coverInfo = await options.getFileInfo(coverFile)
    if (!coverInfo) { return false }

    const { fileSHA256, ipfsHash: ipfsThumbnailHash } = coverInfo
    metadata.thumbnailIpfsHash = ipfsThumbnailHash

    const coverFileRecord: FileRecord = {
      fileName: coverFile.name,
      fileSize: coverFile.size,
      fileType: coverFile.type,
      fileBlob: coverFile,
      ipfsHash: ipfsThumbnailHash ?? undefined,
      fileSHA256,
      isGeneratedCover: true,
    }
    // Preview bytes only: the cover still uploads from its blob and
    // hashes, so an unreadable one must not cost the entry its spine
    // items and excerpt.
    try {
      coverFileRecord.fileData = await fileToDataUrl(coverFile)
      metadata.coverData = coverFileRecord.fileData
    }
    catch (coverError) {
      // eslint-disable-next-line no-console
      console.warn('Failed to build the cover preview:', coverError)
    }
    options.onCoverExtracted?.(coverFileRecord)
    return true
  }

  const formatLanguage = (language: string) => {
    let formattedLanguage = ''
    if (language) {
      if (language.toLowerCase().startsWith('en')) {
        formattedLanguage = 'en'
      }
      else if (language.toLowerCase().startsWith('zh')) {
        formattedLanguage = 'zh'
      }
      else {
        formattedLanguage = language
      }
    }
    return formattedLanguage
  }

  const validateEpub = async (buffer: ArrayBuffer): Promise<{ errors: string, warnings: string, hasIssues: boolean }> => {
    try {
      const { EpubCheck } = await import('@likecoin/epubcheck-ts')
      const result = await EpubCheck.validate(new Uint8Array(buffer))

      const errorMessages = result.messages
        .filter(msg => msg.severity === 'error' || msg.severity === 'fatal')
        .map((msg) => {
          let location = ''
          if (msg.location) {
            location = ` (${msg.location.path}${msg.location.line ? ':' + msg.location.line : ''})`
          }
          return `• ${msg.message}${location}`
        })
        .join('\n')

      const warningMessages = result.messages
        .filter(msg => msg.severity === 'warning')
        .map((msg) => {
          let location = ''
          if (msg.location) {
            location = ` (${msg.location.path}${msg.location.line ? ':' + msg.location.line : ''})`
          }
          return `• ${msg.message}${location}`
        })
        .join('\n')

      return {
        errors: errorMessages,
        warnings: warningMessages,
        hasIssues: !!(errorMessages || warningMessages),
      }
    }
    catch (error) {
      return {
        errors: (error as Error).message || $t('upload_form.epub_validation_failed'),
        warnings: '',
        hasIssues: true,
      }
    }
  }

  const processEPub = async ({ buffer, file }: { buffer: ArrayBuffer, file: File }) => {
    try {
      const { default: ePub } = await import('@likecoin/epub-ts')
      const book = ePub(buffer)
      await book.ready

      const epubMetadata: EpubMetadata = {}

      // Get metadata
      const metadata = book.packaging?.metadata
      if (metadata) {
        epubMetadata.epubFileName = file.name
        epubMetadata.title = metadata.title
        epubMetadata.author = metadata.creator
        epubMetadata.language = formatLanguage(metadata.language)
        epubMetadata.description = metadata.description
      }

      // Get table of contents
      if (book.navigation?.toc?.length) {
        interface TocItem {
          label?: string
          subitems?: TocItem[]
        }
        const tocToMarkdown = (items: TocItem[], indent = 0): string => {
          return items.map((item) => {
            const prefix = ' '.repeat(indent * 2) + '- '
            const line = prefix + (item.label?.trim() || '')
            const subLines = item.subitems?.length ? tocToMarkdown(item.subitems, indent + 1) : ''
            return subLines ? line + '\n' + subLines : line
          }).join('\n')
        }
        epubMetadata.tableOfContents = tocToMarkdown(book.navigation.toc)
      }

      // Get spine table and content excerpt in one pass (best-effort)
      try {
        const { spineItems, contentExcerpt } = await extractSpineData(book)
        epubMetadata.spineItems = spineItems
        epubMetadata.contentExcerpt = contentExcerpt
      }
      catch (spineError) {
        // eslint-disable-next-line no-console
        console.error(spineError)
      }

      // Get tags
      if (book.path && book.archive) {
        const opfFilePath = book.path.toString()
        const opfContent = await book.archive.getText(opfFilePath)
        if (opfContent) {
          const parser = new DOMParser()
          const opfDocument = parser.parseFromString(opfContent, 'application/xml')
          const dcSubjectElements = opfDocument.querySelectorAll(
            'dc\\:subject, subject',
          )
          const subjects: string[] = []
          dcSubjectElements.forEach((element) => {
            const subject = element.textContent
            if (subject) {
              subjects.push(subject)
            }
          })
          epubMetadata.tags = subjects
        }
      }

      // Get cover file
      const coverUrl = await book.coverUrl()
      if (coverUrl) {
        const response = await fetch(coverUrl)
        const blobData = await response.blob()
        if (blobData) {
          await attachCover(blobData, metadata?.title || 'cover', epubMetadata)
        }
      }
      epubMetadataList.value.push(epubMetadata)
    }
    catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      options.onError?.(err)
    }
  }

  // Filtered before reaching the form; see ~/utils/pdf-metadata for why. Left
  // unset rather than blanked, so seedDetailsFromMetadata only marks a field
  // prefilled-from-file when the file really supplied it.
  const applyPdfInfo = async (pdf: PDFDocumentProxy, metadata: EpubMetadata) => {
    // pdf.js types `info` as bare Object: it mirrors whatever the information
    // dictionary held, so every entry is optional and untyped. XMP is not
    // consulted — across the sample its dc:title never differed from Title.
    const { info } = await pdf.getMetadata() as {
      info?: { Title?: unknown, Author?: unknown, Language?: unknown }
    }
    const rawTitle = typeof info?.Title === 'string' ? info.Title : ''
    const rawAuthor = typeof info?.Author === 'string' ? info.Author : ''

    const title = sanitizePdfTitle(rawTitle)
    const author = sanitizePdfAuthor(rawAuthor)
    const language = formatLanguage(
      typeof info?.Language === 'string' ? info.Language.trim() : '')
    if (title) { metadata.title = title }
    if (author) { metadata.author = author }
    if (language) { metadata.language = language }

    // Rejections are logged alongside the hits: the filters can only be tuned
    // against how often real authors' PDFs carry something worth keeping.
    useLogEvent('book_publish_pdf_metadata_extracted', {
      has_title: !!title,
      has_author: !!author,
      has_language: !!language,
      title_rejected: !!rawTitle.trim() && !title,
      author_rejected: !!rawAuthor.trim() && !author,
    })
  }

  const applyPdfCover = async (pdf: PDFDocumentProxy, file: File, metadata: EpubMetadata) => {
    const page = await pdf.getPage(1)
    const unscaled = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({
      scale: Math.min(PDF_COVER_TARGET_WIDTH / unscaled.width, PDF_COVER_MAX_SCALE),
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    // Stated rather than left to the default: JPEG has no alpha, so a
    // transparent page background would otherwise come out black.
    await page.render({ canvas, viewport, background: '#ffffff' }).promise

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', PDF_COVER_JPEG_QUALITY))
    // Rendering is what fills page.objs with the decoded page image — on a
    // scanned cover the largest allocation here, and attachCover's hashing
    // would otherwise hold it live.
    page.cleanup()
    if (!blob) { return }

    const baseName = file.name.replace(/\.pdf$/i, '') || 'cover'
    if (await attachCover(blob, baseName, metadata)) {
      useLogEvent('book_publish_cover_generated_from_pdf')
    }
  }

  const judgePdfTextLayer = async (
    pdf: PDFDocumentProxy,
    excerptStats: PdfPageStat[],
  ): Promise<PdfTextLayerVerdict> => {
    try {
      const { stats, source } = await samplePdfTextLayer(pdf, excerptStats)
      // No sample at all means no verdict, which is not the same as "scan".
      if (!stats.length) { return {} }
      const searchable = hasTextLayer(stats)
      const legible = hasLegibleTextLayer(stats)
      // The ratios ship so the one-third rule and the unmapped-character line
      // can be re-tuned against real uploads instead of argued about, and
      // `sample_source` is what keeps them tunable: the two samplers read a
      // different number of pages from different parts of the book, so a pooled
      // sampled_pages means nothing.
      useLogEvent('book_publish_pdf_text_detected', {
        has_searchable_text: searchable,
        has_legible_text: legible,
        sample_source: source,
        page_count: pdf.numPages,
        sampled_pages: stats.length,
        pages_with_text: countPagesWithText(stats.map(stat => stat.chars)),
        pages_with_legible_text: countPagesWithText(stats.map(stat => stat.legibleChars)),
      })
      return { hasSearchableText: searchable, hasLegibleText: legible }
    }
    catch (textLayerError) {
      // eslint-disable-next-line no-console
      console.warn('Failed to judge the PDF text layer:', textLayerError)
      return {}
    }
  }

  // Best-effort by design: an encrypted or damaged file simply leaves the book
  // without a cover or metadata, and validateFiles then asks the author for a
  // cover. That path is recoverable, so it stays silent rather than raising
  // onError.
  const processPdf = async (
    { buffer, file }: { buffer: ArrayBuffer, file: File },
  ): Promise<PdfTextLayerVerdict> => {
    let pdf: PDFDocumentProxy
    try {
      pdf = await getPdfDocument(buffer)
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to open the PDF:', error)
      return {}
    }

    try {
      // Named after the PDF so removeMetadataForDeletedFile can find this entry
      // again; without it a deleted PDF would leave its cover behind.
      const metadata: EpubMetadata = { epubFileName: file.name }

      // Three independent best-effort steps, ordered by how soon the author
      // sees the result: the Info fields seed the next step's form, the cover
      // lands in the file list as it renders, and nothing reads the excerpt
      // until the AI suggestion two steps later.
      try {
        await applyPdfInfo(pdf, metadata)
      }
      catch (infoError) {
        // eslint-disable-next-line no-console
        console.warn('Failed to read the PDF information dictionary:', infoError)
      }

      try {
        await applyPdfCover(pdf, file, metadata)
      }
      catch (coverError) {
        // eslint-disable-next-line no-console
        console.warn('Failed to extract a cover from the PDF:', coverError)
      }

      let excerptStats: PdfPageStat[] = []
      try {
        // Left unset when the PDF is a scan or reads as glyph indices:
        // handleFilesCollected merges this entry over the last one, so an empty
        // string would blank an excerpt an earlier pass had read.
        const { excerpt, pageStats } = await extractPdfExcerpt(pdf)
        excerptStats = pageStats
        if (excerpt) { metadata.contentExcerpt = excerpt }
      }
      catch (excerptError) {
        // eslint-disable-next-line no-console
        console.warn('Failed to read the PDF text:', excerptError)
      }

      // A PDF that yielded nothing is not worth an entry: UploadForm hands the
      // wizard epubMetadataList[0], so an empty one would shadow the metadata
      // of an EPUB uploaded alongside it. useManualCover creates its own.
      //
      // The verdicts deliberately do not live here. A false would fail the
      // some(Boolean) below, so the entry carrying it would be dropped for
      // exactly the files it describes; they ride on the FileRecord instead.
      const { epubFileName, ...extracted } = metadata
      if (Object.values(extracted).some(Boolean)) {
        epubMetadataList.value.push(metadata)
      }

      return await judgePdfTextLayer(pdf, excerptStats)
    }
    finally {
      // A book-sized PDF stays resident in the worker until destroyed. Caught
      // because finally runs after the steps above, so a rejection here would
      // escape this otherwise-silent path.
      await pdf.destroy().catch(() => {})
    }
  }

  const removeMetadataForDeletedFile = (removedFile: FileRecord) => {
    if (removedFile.fileType?.startsWith('image/')) {
      epubMetadataList.value = epubMetadataList.value
        .map((metadata: EpubMetadata) => {
          if (metadata.thumbnailIpfsHash === removedFile.ipfsHash) {
            return { ...metadata, thumbnailIpfsHash: null, coverData: null }
          }
          return metadata
        })
        .filter((metadata: EpubMetadata) =>
          metadata.epubFileName || metadata.thumbnailIpfsHash,
        )
    }
    else if (removedFile.fileType && EBOOK_FILE_TYPES.includes(removedFile.fileType)) {
      epubMetadataList.value = epubMetadataList.value.filter(
        (metadata: EpubMetadata) => metadata.epubFileName !== removedFile.fileName,
      )
    }
  }

  return {
    epubMetadataList,
    validateEpub,
    processEPub,
    processPdf,
    removeMetadataForDeletedFile,
  }
}
