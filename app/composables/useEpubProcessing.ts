import type { FileRecord, EpubMetadata } from '~/types'

interface UseEpubProcessingOptions {
  // File hashing delegate; return null to skip (the host surfaces its own error).
  getFileInfo: (file: Blob) => Promise<Awaited<ReturnType<typeof getFileInfo>> | null>
  // Receives the cover record auto-extracted from an EPUB for the host's file list.
  onCoverExtracted?: (record: FileRecord) => void
  onError?: (error: unknown) => void
}

// Owns the EPUB metadata list extracted from uploaded files: epubcheck
// validation, metadata/ToC/tags/cover extraction, and cover-slot assignment.
export function useEpubProcessing(options: UseEpubProcessingOptions) {
  const { t: $t } = useI18n()

  const epubMetadataList = ref<EpubMetadata[]>([])

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
          const coverFile = new File(
            [blobData],
            `${metadata?.title || 'cover'}_cover.jpeg`,
            {
              type: 'image/jpeg',
            },
          )

          const coverInfo = await options.getFileInfo(coverFile)
          if (coverInfo) {
            const {
              fileSHA256,
              ipfsHash: ipfsThumbnailHash,
            } = coverInfo

            epubMetadata.thumbnailIpfsHash = ipfsThumbnailHash

            const coverFileRecord: FileRecord = {
              fileName: coverFile.name,
              fileSize: coverFile.size,
              fileType: coverFile.type,
              fileBlob: coverFile,
              ipfsHash: ipfsThumbnailHash ?? undefined,
              fileSHA256,
            }
            const coverReader = new FileReader()
            coverReader.onload = (e) => {
              if (!e.target) {
                return
              }
              coverFileRecord.fileData = e.target.result as string
              options.onCoverExtracted?.(coverFileRecord)
              epubMetadata.coverData = e.target.result as string
              epubMetadataList.value.push(epubMetadata)
            }
            coverReader.readAsDataURL(coverFile)
            return
          }
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

  // Assigns a manually selected image as cover. Returns false when a cover
  // is already assigned (only one manual cover is allowed).
  const assignManualCoverImage = (file: File, ipfsHash?: string | null): boolean => {
    let emptyCoverMetadata = epubMetadataList.value.find(
      (metadata: EpubMetadata) => !metadata.thumbnailIpfsHash,
    )
    if (!emptyCoverMetadata) {
      if (epubMetadataList.value.length !== 0) {
        return false
      }
      // No EPUB file was uploaded — epubMetadataList is still empty
      emptyCoverMetadata = {
        thumbnailIpfsHash: null,
        coverData: null,
      }
      epubMetadataList.value.push(emptyCoverMetadata)
    }

    const targetMetadata = emptyCoverMetadata
    const coverReader = new FileReader()
    coverReader.onload = (e) => {
      if (!e.target) { return }
      targetMetadata.thumbnailIpfsHash = ipfsHash
      targetMetadata.coverData = e.target.result as string
    }
    coverReader.readAsDataURL(file)
    return true
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
    else if (removedFile.fileType === 'application/epub+zip') {
      epubMetadataList.value = epubMetadataList.value.filter(
        (metadata: EpubMetadata) => metadata.epubFileName !== removedFile.fileName,
      )
    }
  }

  return {
    epubMetadataList,
    validateEpub,
    processEPub,
    assignManualCoverImage,
    removeMetadataForDeletedFile,
  }
}
