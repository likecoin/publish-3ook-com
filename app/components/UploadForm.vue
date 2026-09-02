<template>
  <div class="flex flex-col gap-4">
    <!-- Alerts first, above everything: they are standing facts about the
       upload as a whole — the free quota, the cover in force — rather than
       captions on any one file. -->
    <div class="flex flex-col gap-2 empty:hidden">
      <ArweaveSponsorStatus
        :is-sponsored="isArweaveSponsored"
        :remaining-uploads="arweaveRemainingUploads"
        :required-uploads="arweaveRequiredUploads"
      />
      <UAlert
        v-if="canRevertCover && requireCover"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-information-circle"
        :description="$t('publish_cover.replaced_hint')"
      />
      <slot name="alerts" />
    </div>

    <div class="flex flex-col gap-3">
      <UploadFileRecordList
        v-if="fileRecords.length"
        :file-records="fileRecords"
        :can-revert-cover="canRevertCover"
        @delete="handleDeleteFile"
        @reselect="openFilePicker"
        @revert-cover="revertCover"
      />

      <form
        :class="[computedFormClasses, isDragging ? 'bg-default' : '']"
        @drop.prevent="onFileUpload"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @click="openFilePicker"
      >
        <UIcon
          name="i-heroicons-folder-arrow-down"
          class="w-5 h-5"
        />
        <p
          class="text-muted my-[16px]"
          v-text="$t('upload_form.drag_files_here')"
        />
        <UButton
          type="button"
          variant="subtle"
          @click.stop="openFilePicker"
        >
          {{ $t('common.select_file') }}
        </UButton>
        <p
          class="text-xs text-muted mt-2"
          v-text="$t('upload_form.file_size_suggestion')"
        />
        <!-- Inside the zone, and only once something is in: what another drop
           would do is a fact about this gesture. -->
        <p
          v-if="fileRecords.length"
          class="text-xs text-muted mt-2"
          v-text="$t('upload_form.drop_to_replace_hint')"
        />
        <input
          ref="imageFile"
          type="file"
          multiple
          class="hidden"
          :accept="UPLOAD_ACCEPT_ATTRIBUTE"
          @change="onFileUpload"
        >
      </form>
    </div>
    <UploadProgressModal
      :upload-status="uploadStatus"
      :current-file-index="currentFileIndex"
      :total-files="totalFiles"
      :completed-files="completedFiles"
    />
    <UploadValidationWarningModal
      v-model:open="showValidationWarning"
      :error-message="validationErrorMessage"
      :can-proceed-anyway="canProceedAnyway"
      @fix="pendingSubmitAfterConfirm = false"
      @proceed="confirmProceedAnyway"
    />
  </div>
</template>

<script setup lang="ts">
import { EBOOK_FILE_TYPES, UPLOAD_ACCEPT_ATTRIBUTE, UPLOADABLE_FILE_TYPES } from '~/constant'
import { isGeneratedCoverRecord, isManualCoverRecord } from '~/utils/arweave'

import type { FileRecord, EpubMetadata } from '~/types'

const { t: $t } = useI18n()

const UPLOAD_FILESIZE_MAX = 200 * 1024 * 1024

const store = useWalletStore()
const { validateWalletConsistency } = store
const { wallet } = storeToRefs(store)
const { showErrorToast } = useToastComposable()
const imageFile = ref<HTMLInputElement | null>(null)
const openFilePicker = () => imageFile.value?.click()
const { uploadFileRecordsToArweave } = useArweaveUpload()
export type { FileRecord }

const props = defineProps({
  // The wizard hides the control and asks at its pricing step instead. It still
  // binds the model: the tier decides what a record's stored upload result
  // means, so guessing it here would clear a resumed draft's real uploads.
  // Collect-only mode (new-book wizard): onSubmit validates and emits the
  // selected files without uploading; the publish pipeline uploads later.
  collectOnly: { type: Boolean, default: false },
  // A replacement upload on a published book already has a cover on chain, and
  // 書檔's dropzone is what changes it. A PDF that yields no extractable cover
  // would otherwise be blocked outright from being replaced.
  requireCover: { type: Boolean, default: true },
  requireEbook: { type: Boolean, default: true },
  // Restores a previously collected selection (e.g. resumed wizard draft);
  // records restored without a blob must be re-selected before publish.
  initialFileRecords: {
    type: Array as PropType<FileRecord[]>,
    default: () => [],
  },
})

const fileRecords = ref<FileRecord[]>([])

const isDragging = ref(false)

// Both hosts seed this and both must keep it bound even when the radio is
// hidden: the tier decides what a record's stored upload result means, so a
// wrong value here silently discards a resumed draft's real uploads.
const isEncryptEBookData = defineModel<boolean>('encryptEbook', { default: true })

const emit = defineEmits<{
  arweaveUploaded: [payload: { arweaveId?: string, arweaveLink?: string }]
  submit: [payload: { fileRecords: FileRecord[], epubMetadata?: EpubMetadata }]
  fileReady: [records: FileRecord[], epubMetadata?: EpubMetadata]
  fileUploadStatus: [status: string]
}>()

// The wizard restores its draft after this form has mounted, so a one-shot copy
// left a resumed draft's list empty. Declared below the emit it calls: with
// immediate the first run happens during setup, before a hoisted const exists.
watch(() => props.initialFileRecords, (records: FileRecord[]) => {
  if (!records.length || fileRecords.value.length) { return }
  // Shared, not cloned: the host rebuilds a resumed draft's cover previews into
  // these objects afterwards, and a clone would never see it — leaving the
  // author's cover with nothing to restore.
  fileRecords.value = [...records]
  emit('fileReady', fileRecords.value)
}, { immediate: true })

const uploadStatus = ref('')
const showValidationWarning = ref(false)
const validationErrorMessage = ref('')
const pendingSubmitAfterConfirm = ref(false)
const canProceedAnyway = ref(true)
const currentFileIndex = ref(0)
const totalFiles = ref(0)
const completedFiles = ref(0)

const computedFormClasses = computed(() => [
  'flex w-full flex-col items-center justify-between',
  'border border-dashed border-default rounded-[12px]',
  'text-muted cursor-pointer bg-transparent hover:bg-muted',
  // Tighter once it sits above a file list, so it stays reachable without
  // pushing the list off screen.
  fileRecords.value.length ? 'p-[16px]' : 'p-[28px]',
])

// The quota cost is the same either way, but the tier is not: re-check so an
// ebook's duplicate status is re-derived under the new DRM setting.
watch(isEncryptEBookData, async () => {
  await runUploadQuotaCheck()
})

watch(uploadStatus, (val: string) => {
  emit('fileUploadStatus', val)
}, { immediate: true })

const getFileInfoWithToast = async (file: Blob) => {
  try {
    return await getFileInfo(file)
  }
  catch (error) {
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
    })
    return null
  }
}

// Replaces a blob-less record restored from a resumed draft when the user
// re-selects the same file; otherwise appends.
const upsertFileRecord = (record: FileRecord) => {
  const staleIndex = fileRecords.value.findIndex(
    r => r.fileName === record.fileName && !r.fileBlob,
  )
  if (staleIndex >= 0) {
    fileRecords.value.splice(staleIndex, 1, record)
  }
  else {
    fileRecords.value.push(record)
  }
}

const {
  epubMetadataList,
  validateEpub,
  processEPub,
  processPdf,
  removeMetadataForDeletedFile,
} = useEbookProcessing({
  getFileInfo: getFileInfoWithToast,
  onCoverExtracted: upsertFileRecord,
  onError: (err) => {
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (err as Error).message || $t('upload_form.epub_processing_error'),
    })
  },
})

// Carries the metadata with the records: the cover can be replaced without
// leaving the file step, and the wizard's review screen reads it from there.
// Merged by the host, so an entry it already has keeps what this one lacks.
const emitFileReady = () => {
  emit('fileReady', fileRecords.value, epubMetadataList.value[0])
}

// A generated cover belongs to the file it came out of, so it leaves with it —
// whether the author deleted that file or dropped a replacement over it. Left
// behind, the next ebook's own cover would land beside it and the list would
// show two 自動產生 rows. Matched by provenance, since both are named after the
// book rather than after the file.
const dropGeneratedCoverOf = (removed: FileRecord) => {
  fileRecords.value = fileRecords.value.filter(record => !(
    isGeneratedCoverRecord(record) && record.sourceFileName === removed.fileName
  ))
}

// One file per format, so the dropzone alone decides between adding and replacing.
const releaseEbookSlot = (fileType: string) => {
  const index = fileRecords.value.findIndex(record => record.fileType === fileType)
  if (index < 0) { return }
  const [removed] = fileRecords.value.splice(index, 1)
  if (!removed) { return }
  dropGeneratedCoverOf(removed)
  removeMetadataForDeletedFile(removed)
  // Only reached when a file was actually displaced, so this counts drops that
  // the author meant as a replacement rather than as their first upload.
  useLogEvent('book_publish_file_replaced', { file_type: fileType })
}

const { applyManualCover, canRevertCover, revertToGeneratedCover } = useManualCover({
  fileRecords,
  // Fills a book still missing a cover before replacing one that has it, and
  // creates the entry when no EPUB supplied metadata at all (PDF + cover).
  resolveTarget: () => {
    const pending = epubMetadataList.value.find(
      (metadata: EpubMetadata) => !metadata.thumbnailIpfsHash,
    ) || epubMetadataList.value[0]
    if (pending) { return pending }
    const created: EpubMetadata = { thumbnailIpfsHash: null, coverData: null }
    epubMetadataList.value.push(created)
    return created
  },
})

const {
  isArweaveSponsored,
  arweaveRemainingUploads,
  arweaveRequiredUploads,
  checkUploadQuota,
} = useArweaveUploadPrecheck({
  fileRecords,
  isEncryptEbook: isEncryptEBookData,
  onExistingUpload: (record) => {
    const metadata = epubMetadataList.value.find(
      (data: EpubMetadata) => data.thumbnailIpfsHash === record.ipfsHash,
    )
    if (metadata) {
      metadata.thumbnailArweaveId = record.arweaveId
    }
  },
})

// The single slot a dropped file competes for: one per ebook format, and one
// shared by every image type, since the book has one cover.
const uploadSlotOf = (file: File) => file.type.startsWith('image/') ? 'image' : file.type

const onFileUpload = async (event: Event) => {
  try {
    uploadStatus.value = $t('upload_form.loading')
    const files
      = (event as InputEvent).dataTransfer?.files || (event.target as HTMLInputElement)?.files

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('bg-elevated')
    }

    if (files?.length) {
      // Sort files so images are processed last,
      // ensuring EPUB metadata is ready before assigning cover images.
      const sortedFiles = Array.from(files).sort((a, b) => {
        const isImageA = a.type.startsWith('image/')
        const isImageB = b.type.startsWith('image/')

        if (isImageA === isImageB) { return 0 }
        return isImageA ? 1 : -1
      })
      for (const [index, file] of sortedFiles.entries()) {
        let fileRecord: FileRecord = {}

        if (!UPLOADABLE_FILE_TYPES.includes(file.type)) {
          showErrorToast($t('upload_form.unsupported_file_type_title'), {
            description: $t('upload_form.unsupported_file_type', { fileName: file.name }),
          })
          continue
        }

        // Of several files competing for one slot in a single drop, only the
        // last is kept. Skipped here rather than evicted later, so a 200MB EPUB
        // is not hashed and parsed just to lose its slot to the next one.
        const slot = uploadSlotOf(file)
        if (sortedFiles.some((other, i) => i > index && uploadSlotOf(other) === slot)) {
          continue
        }

        if (file.size < UPLOAD_FILESIZE_MAX) {
          const info = await getFileInfoWithToast(file)
          if (info) {
            const { fileBytes, fileSHA256, ipfsHash } = info
            fileRecord = {
              ...fileRecord,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              ipfsHash: ipfsHash || undefined,
              fileSHA256,
              fileBlob: file,
            }
            if (EBOOK_FILE_TYPES.includes(file.type)) {
              releaseEbookSlot(file.type)
            }
            if (fileRecord.fileType === 'application/epub+zip') {
              const validation = await validateEpub(fileBytes)
              if (validation.hasIssues) {
                fileRecord.validationErrors = validation.errors
                fileRecord.validationWarnings = validation.warnings
                fileRecord.hasValidationIssues = true
              }
              await processEPub({ buffer: fileBytes, file })
            }
            else if (fileRecord.fileType === 'application/pdf') {
              uploadStatus.value = $t('upload_form.reading_pdf')
              // Detaches fileBytes; nothing below reads it again.
              const { hasSearchableText, hasLegibleText }
                = await processPdf({ buffer: fileBytes, file })
              fileRecord.hasSearchableText = hasSearchableText
              fileRecord.hasLegibleText = hasLegibleText
              uploadStatus.value = $t('upload_form.loading')
            }
            else if (fileRecord.fileType?.startsWith('image/')) {
              // Images only: a data URL is ~33% larger than the bytes it
              // encodes, so a 200MB ebook would hold ~267MB of string for the
              // record's lifetime.
              fileRecord.fileData = await fileToDataUrl(file)
              applyManualCover(fileRecord)
              useLogEvent('book_publish_cover_replaced')
              uploadStatus.value = ''
              continue
            }
          }
        }
        else {
          showErrorToast($t('errors.api_file_size_limit_exceeded'), {
            description: file.name,
          })
        }
        // A file too large to accept, or one that failed to hash, leaves the
        // record untouched. Listing it would show a nameless row and count as a
        // file the wizard can move on from.
        if (fileRecord.fileName) {
          upsertFileRecord(fileRecord)
        }
        uploadStatus.value = ''
      }
    }
  }
  finally {
    try {
      await runUploadQuotaCheck()
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    // Clear the input value to allow re-uploading the same file
    if (imageFile.value) {
      imageFile.value.value = ''
    }
    uploadStatus.value = ''
    emitFileReady()
  }
}

const handleDeleteFile = (index: number) => {
  // Discarding the author's own cover puts the ebook's back rather than leaving
  // the book with none: the generated one is still held, just not listed.
  if (isManualCoverRecord(fileRecords.value[index] || {}) && canRevertCover.value) {
    revertCover()
    return
  }
  const [removedFile] = fileRecords.value.splice(index, 1)
  if (!removedFile) { return }
  dropGeneratedCoverOf(removedFile)
  removeMetadataForDeletedFile(removedFile)
  emitFileReady()
}

const revertCover = () => {
  if (!revertToGeneratedCover()) { return }
  useLogEvent('book_publish_cover_reverted')
  emitFileReady()
}

const runUploadQuotaCheck = async (): Promise<void> => {
  try {
    uploadStatus.value = $t('upload_form.checking_quota')
    await checkUploadQuota()
  }
  catch (err) {
    console.error(err)
    showErrorToast($t('upload_form.error_during_upload'), {
      description: getApiErrorMessage(err, $t),
    })
  }
  finally {
    uploadStatus.value = ''
  }
}

const handleRecordUploaded = (record: FileRecord) => {
  // Match on the hash the metadata points at, not on the generated name: a
  // manual cover replaces the EPUB's, and only the hash follows that.
  if (record.fileType?.startsWith('image/')) {
    const metadata = epubMetadataList.value.find(
      (file: EpubMetadata) => file.thumbnailIpfsHash === record.ipfsHash,
    )
    if (metadata) {
      metadata.thumbnailArweaveId = record.arweaveId
    }
  }
  emit('arweaveUploaded', { arweaveId: record.arweaveId, arweaveLink: record.arweaveLink })
  completedFiles.value++
}

const setEbookCoverFromImages = async () => {
  const metadata = epubMetadataList.value.find(
    (m: EpubMetadata) => m.coverData || m.thumbnailIpfsHash,
  )
  if (metadata?.thumbnailArweaveId) { return }

  for (let i = 0; i < fileRecords.value.length; i += 1) {
    const file = fileRecords.value[i]
    if (!file || !file.fileType?.startsWith('image')) { continue }

    let { arweaveId } = file

    if (!arweaveId && file.fileBlob) {
      // The shared uploader mutates the record in place with the result.
      await uploadFileRecordsToArweave([file], {
        encryptEbook: isEncryptEBookData.value,
      })
      arweaveId = file.arweaveId
    }

    if (arweaveId) {
      if (metadata && file.ipfsHash === metadata.thumbnailIpfsHash) {
        metadata.thumbnailArweaveId = arweaveId
      }
      break
    }

    // eslint-disable-next-line no-console
    console.error(`Failed to upload image file ${file.fileName} to Arweave`)
  }
}

const onSubmitInternal = async () => {
  try {
    await validateWalletConsistency()
    if (!wallet.value) {
      throw new Error('WALLET_NOT_INITED')
    }
    if (!fileRecords.value.some(file => file.fileBlob)) {
      throw new Error('NO_FILE_TO_UPLOAD')
    }

    totalFiles.value = fileRecords.value.length
    currentFileIndex.value = 0
    completedFiles.value = 0

    // Uploads are sponsored-only, so an exhausted quota fails every file. The
    // wizard's collect step is deliberately not gated: it uploads much later.
    if (!isArweaveSponsored.value && arweaveRemainingUploads.value !== undefined) {
      showErrorToast($t('upload_form.error_during_upload'), {
        description: $t('errors.api_daily_quota_exceeded'),
      })
      return
    }

    uploadStatus.value = $t('upload_form.uploading')
    if (
      fileRecords.value.find(file => file.fileType === 'application/pdf')
      && !fileRecords.value.find(
        file => file.fileType === 'application/epub+zip',
      )
    ) {
      uploadStatus.value = $t('upload_form.preparing_cover')
      await setEbookCoverFromImages()
    }

    await uploadFileRecordsToArweave(fileRecords.value, {
      encryptEbook: isEncryptEBookData.value,
      skipMissingBlob: true,
      onRecordSkipped: (_record, index) => {
        currentFileIndex.value = index + 1
        completedFiles.value++
      },
      onRecordPrepare: (_record, index) => {
        currentFileIndex.value = index + 1
      },
      onRecordUploaded: handleRecordUploaded,
    })
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    uploadStatus.value = ''
    showErrorToast($t('upload_form.error_during_upload'), {
      description: getApiErrorMessage(error, $t),
    })
    return
  }
  finally {
    uploadStatus.value = ''
    totalFiles.value = 0
    currentFileIndex.value = 0
    completedFiles.value = 0
  }

  const uploadFileData = {
    fileRecords: fileRecords.value.map(record => ({
      fileType: record.fileType,
      fileName: record.fileName,
      arweaveId: record.arweaveId,
      arweaveLink: record.arweaveLink,
      arweaveKey: record.arweaveKey,
      ipfsHash: record.ipfsHash,
      fileSHA256: record.fileSHA256,
    })),
    epubMetadata: epubMetadataList.value[0],
  }

  emit('submit', uploadFileData)
}

const validateFiles = (): { valid: boolean, error?: string, canProceedAnyway?: boolean } => {
  const pdfFiles = fileRecords.value.filter(
    file => file.fileType === 'application/pdf',
  )
  const epubFiles = fileRecords.value.filter(
    file => file.fileType === 'application/epub+zip',
  )
  const coverFiles = fileRecords.value.filter((file) => {
    return file.fileType?.startsWith('image/')
  })
  const manualCoverFiles = coverFiles.filter((file) => {
    return !isGeneratedCoverRecord(file)
  })

  // Not required where the book already has its files and the drop is only
  // meant to change one of them — the cover, say.
  if (props.requireEbook && epubFiles.length === 0 && pdfFiles.length === 0) {
    return {
      valid: false,
      error: $t('upload_form.missing_ebook_file'),
    }
  }

  if (pdfFiles.length > 1) {
    return {
      valid: false,
      error: $t('upload_form.too_many_pdfs'),
    }
  }

  if (manualCoverFiles.length > 1) {
    return {
      valid: false,
      error: $t('upload_form.only_one_cover_image'),
    }
  }

  if (props.requireCover && coverFiles.length === 0) {
    return {
      valid: false,
      error: pdfFiles.length > 0
        ? $t('upload_form.missing_cover_for_pdf')
        : $t('upload_form.missing_cover_for_epub'),
      canProceedAnyway: false,
    }
  }

  return { valid: true }
}

// Collect-only submit: hand the selection (blobs included) to the wizard
// without uploading anything.
const emitCollected = () => {
  emit('submit', {
    fileRecords: fileRecords.value,
    epubMetadata: epubMetadataList.value[0],
  })
}

const confirmProceedAnyway = async () => {
  showValidationWarning.value = false
  if (pendingSubmitAfterConfirm.value) {
    pendingSubmitAfterConfirm.value = false
    if (props.collectOnly) {
      emitCollected()
      return
    }
    await onSubmitInternal()
  }
}

const onSubmit = async () => {
  const validation = validateFiles()
  if (!validation.valid) {
    validationErrorMessage.value = validation.error || ''
    canProceedAnyway.value = validation.canProceedAnyway !== false
    showValidationWarning.value = true
    pendingSubmitAfterConfirm.value = true
    return
  }
  if (props.collectOnly) {
    emitCollected()
    return
  }
  await onSubmitInternal()
}

defineExpose({
  onSubmit,
  validateFiles,
})
</script>
