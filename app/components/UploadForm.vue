<template>
  <div class="flex flex-col gap-4">
    <!-- Stacked so the dropzone stays full width once files are listed, making
         adding a cover the same gesture as the first drop. -->
    <div class="flex flex-col gap-3">
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
          variant="ghost"
          @click.stop="openFilePicker"
        >
          {{ $t('common.select_file') }}
        </UButton>
        <p
          class="text-xs text-muted mt-2"
          v-text="$t('upload_form.file_size_suggestion')"
        />
        <a
          :href="PUBLISH_GUIDE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-primary hover:text-primary/80 mt-2 flex items-center gap-1"
          @click.stop
        >
          <UIcon
            name="i-heroicons-question-mark-circle"
            class="w-4 h-4"
          />
          {{ $t('upload_form.help_link') }}
        </a>
        <input
          ref="imageFile"
          type="file"
          multiple
          class="hidden"
          :accept="UPLOAD_ACCEPT_ATTRIBUTE"
          @change="onFileUpload"
        >
      </form>

      <UploadFileRecordList
        v-if="fileRecords.length"
        :file-records="fileRecords"
        @delete="handleDeleteFile"
        @reselect="openFilePicker"
      />
    </div>
    <PublishFileProtectionField
      v-if="showDrmOption"
      v-model="isEncryptEBookData"
    />
    <ArweaveSponsorStatus
      :is-sponsored="isArweaveSponsored"
      :remaining-uploads="arweaveRemainingUploads"
      :required-uploads="arweaveRequiredUploads"
    />
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
import { PUBLISH_GUIDE_URL, UPLOAD_ACCEPT_ATTRIBUTE, UPLOADABLE_FILE_TYPES } from '~/constant'
import { isGeneratedCoverRecord } from '~/utils/arweave'

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
  showDrmOption: { type: Boolean, default: true },
  // Collect-only mode (new-book wizard): onSubmit validates and emits the
  // selected files without uploading; the publish pipeline uploads later.
  collectOnly: { type: Boolean, default: false },
  // A replacement upload on a published book already has a cover on chain, and
  // 書檔's dropzone is what changes it. A PDF that yields no extractable cover
  // would otherwise be blocked outright from being replaced.
  requireCover: { type: Boolean, default: true },
  // Restores a previously collected selection (e.g. resumed wizard draft);
  // records restored without a blob must be re-selected before publish.
  initialFileRecords: {
    type: Array as PropType<FileRecord[]>,
    default: () => [],
  },
})

const fileRecords = ref<FileRecord[]>([])

const isSizeExceeded = ref(false)
const isDragging = ref(false)

// Both hosts seed this and both must keep it bound even when the radio is
// hidden: the tier decides what a record's stored upload result means, so a
// wrong value here silently discards a resumed draft's real uploads.
const isEncryptEBookData = defineModel<boolean>('encryptEbook', { default: true })

const emit = defineEmits(['arweaveUploaded', 'submit', 'fileReady', 'fileUploadStatus'])

// The wizard restores its draft after this form has mounted, so a one-shot copy
// left a resumed draft's list empty. Declared below the emit it calls: with
// immediate the first run happens during setup, before a hoisted const exists.
watch(() => props.initialFileRecords, (records: FileRecord[]) => {
  if (!records.length || fileRecords.value.length) { return }
  fileRecords.value = records.map(record => ({ ...record }))
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
  'border-2 border-dashed border-default rounded-[12px]',
  'text-muted cursor-pointer hover:bg-accented',
  // Tighter once it sits above a file list, so it stays reachable without
  // pushing the list off screen.
  fileRecords.value.length ? 'p-[16px]' : 'p-[28px]',
  isSizeExceeded.value ? 'bg-transparent' : 'bg-elevated',
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

const { applyManualCover } = useManualCover({
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

const onFileUpload = async (event: Event) => {
  try {
    uploadStatus.value = $t('upload_form.loading')
    isSizeExceeded.value = false
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
      for (const file of sortedFiles) {
        let fileRecord: FileRecord = {}

        if (!UPLOADABLE_FILE_TYPES.includes(file.type)) {
          showErrorToast($t('upload_form.unsupported_file_type_title'), {
            description: $t('upload_form.unsupported_file_type', { fileName: file.name }),
          })
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
              const { hasSearchableText } = await processPdf({ buffer: fileBytes, file })
              fileRecord.hasSearchableText = hasSearchableText
              uploadStatus.value = $t('upload_form.loading')
            }
            else if (fileRecord.fileType?.startsWith('image/')) {
              // Images only: a data URL is ~33% larger than the bytes it
              // encodes, so a 200MB ebook would hold ~267MB of string for the
              // record's lifetime.
              fileRecord.fileData = await fileToDataUrl(file)
              applyManualCover(fileRecord)
              uploadStatus.value = ''
              continue
            }
          }
        }
        else {
          isSizeExceeded.value = true
        }
        upsertFileRecord(fileRecord)
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
    emit('fileReady', fileRecords.value)
  }
}

const handleDeleteFile = (index: number) => {
  const [removedFile] = fileRecords.value.splice(index, 1)
  if (!removedFile) { return }
  removeMetadataForDeletedFile(removedFile)
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

  if (epubFiles.length === 0 && pdfFiles.length === 0) {
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
