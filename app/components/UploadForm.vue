<template>
  <div class="flex flex-col gap-4">
    <div class="flex gap-3">
      <form
        :class="[computedFormClasses, isDragging ? 'bg-white' : '']"
        @drop.prevent="onFileUpload"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @click="($refs.imageFile as HTMLInputElement)?.click()"
      >
        <UIcon
          name="i-heroicons-folder-arrow-down"
          class="w-5 h-5"
        />
        <p
          class="text-gray-600 my-[16px]"
          v-text="$t('upload_form.drag_files_here')"
        />
        <UButton
          type="button"
          variant="ghost"
          @click.stop="($refs.imageFile as HTMLInputElement)?.click()"
        >
          {{ $t('common.select_file') }}
        </UButton>
        <p
          class="text-xs text-gray-500 mt-2"
          v-text="$t('upload_form.file_size_suggestion')"
        />
        <a
          :href="PUBLISH_GUIDE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-primary-500 hover:text-primary-600 mt-2 flex items-center gap-1"
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
          accept="image/*,application/pdf,application/epub+zip"
          @change="onFileUpload"
        >
      </form>

      <UploadFileRecordList
        v-if="fileRecords.length"
        :file-records="fileRecords"
        @delete="handleDeleteFile"
        @show-issues="showEpubIssuesForFile"
      />
    </div>
    <URadioGroup
      v-model="drmOption"
      :items="drmOptions"
      orientation="vertical"
      :ui="{ label: 'text-left' }"
    >
      <template #label="{ item }">
        <span>{{ item.label }}</span>
        <UTooltip
          v-if="item.value === 'open'"
          :text="$t('upload_form.drm_option_open_tooltip')"
        >
          <a
            :href="$t('upload_form.drm_option_open_tooltip')"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center ml-1"
            @click.stop
          >
            <UIcon
              name="i-heroicons-question-mark-circle"
              class="w-4 h-4 text-gray-400 hover:text-primary-500"
            />
          </a>
        </UTooltip>
      </template>
    </URadioGroup>
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
    <UploadEpubIssuesModal
      v-model:open="showEpubValidationModal"
      :errors="epubValidationErrors"
      :warnings="epubValidationWarnings"
    />
  </div>
</template>

<script setup lang="ts">
import { BigNumber } from 'bignumber.js'
import {
  estimateBundlrFilePrice,
  canSponsorArweaveUpload,
} from '~/utils/arweave'
import { PUBLISH_GUIDE_URL } from '~/constant'

import type { FileRecord, EpubMetadata, ArweaveEstimate } from '~/types'

const { t: $t } = useI18n()

const UPLOAD_FILESIZE_MAX = 200 * 1024 * 1024

const store = useWalletStore()
const { validateWalletConsistency } = store
const { wallet } = storeToRefs(store)
const bookstoreApiStore = useBookstoreApiStore()
const { token } = storeToRefs(bookstoreApiStore)
const toast = useToast()
const { showErrorToast } = useToastComposable()
const imageFile = ref<HTMLInputElement | null>(null)
const { prepareArweaveUpload, executeArweaveUpload: executeArweaveUploadComposable, uploadToArweave } = useArweaveUpload()
export type { FileRecord }

const props = defineProps({
  defaultEncrypted: { type: Boolean, default: true },
  // Collect-only mode (new-book wizard): onSubmit validates and emits the
  // selected files without uploading; the publish pipeline uploads later.
  collectOnly: { type: Boolean, default: false },
  // Restores a previously collected selection (e.g. resumed wizard draft);
  // records restored without a blob must be re-selected before publish.
  initialFileRecords: {
    type: Array as PropType<FileRecord[]>,
    default: () => [],
  },
})

const fileRecords = ref<FileRecord[]>([])

onMounted(() => {
  if (props.initialFileRecords.length && !fileRecords.value.length) {
    fileRecords.value = props.initialFileRecords.map(record => ({ ...record }))
    emit('fileReady', fileRecords.value)
  }
})

const isSizeExceeded = ref(false)
const isDragging = ref(false)

const arweaveFee = ref(new BigNumber(0))
const arweaveFeeMap = ref({} as Record<string, string>)
const arweaveFeeTargetAddress = ref('')
const isArweaveSponsored = ref(false)
const arweaveRemainingUploads = ref<number | undefined>()
const arweaveRequiredUploads = ref<number | undefined>()
const sentArweaveTransactionInfo = ref(new Map())
const drmOption = ref(props.defaultEncrypted ? 'encrypted' : 'open')
const isEncryptEBookData = computed(() => drmOption.value === 'encrypted')
const drmOptions = computed(() => [
  { label: $t('upload_form.drm_option_encrypted'), value: 'encrypted' },
  { label: $t('upload_form.drm_option_open'), value: 'open' },
])

const emit = defineEmits(['arweaveUploaded', 'submit', 'fileReady', 'fileUploadStatus', 'drmChange'])
const uploadStatus = ref('')
const showValidationWarning = ref(false)
const validationErrorMessage = ref('')
const pendingSubmitAfterConfirm = ref(false)
const canProceedAnyway = ref(true)
const showEpubValidationModal = ref(false)
const epubValidationErrors = ref('')
const epubValidationWarnings = ref('')
const currentFileIndex = ref(0)
const totalFiles = ref(0)
const completedFiles = ref(0)

const computedFormClasses = computed(() => [
  'block',
  'flex',
  'w-full',
  fileRecords.value.length ? 'max-w-[320px]' : '',
  'flex-col',
  'justify-center',
  isSizeExceeded.value ? 'bg-transparent' : '',
  'items-center',
  'justify-between',
  'p-[28px]',
  'mb-[12px]',
  'border-2',
  'border-dashed',
  'border-gray-300',
  'rounded-[12px]',
  'text-gray-500',
  'cursor-pointer',
  'bg-gray-100',
  'hover:bg-gray-200',
])

watch(isEncryptEBookData, async (value: boolean) => {
  emit('drmChange', value)
  uploadStatus.value = $t('upload_form.loading')
  await estimateArweaveFee()
  uploadStatus.value = ''
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
  assignManualCoverImage,
  removeMetadataForDeletedFile,
} = useEpubProcessing({
  getFileInfo: getFileInfoWithToast,
  onCoverExtracted: upsertFileRecord,
  onError: (err) => {
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (err as Error).message || $t('upload_form.epub_processing_error'),
    })
  },
})

const onFileUpload = async (event: Event) => {
  try {
    uploadStatus.value = $t('upload_form.loading')
    isSizeExceeded.value = false
    const files
      = (event as InputEvent).dataTransfer?.files || (event.target as HTMLInputElement)?.files

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('bg-gray-100')
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
        const reader = new FileReader()
        let fileRecord: FileRecord = {}

        if (file.size < UPLOAD_FILESIZE_MAX) {
          reader.onload = (e) => {
            if (!e.target) {
              return
            }
            fileRecord.fileData = e.target.result as string
          }
          reader.readAsDataURL(file)

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

                epubValidationErrors.value = validation.errors
                epubValidationWarnings.value = validation.warnings
                showEpubValidationModal.value = true
              }
              await processEPub({ buffer: fileBytes, file })
            }
            else if (fileRecord.fileType?.startsWith('image/')) {
              if (!assignManualCoverImage(file, ipfsHash)) {
                // A cover image has already been assigned — only one cover is allowed
                toast.add({
                  icon: 'i-heroicons-exclamation-circle',
                  title: $t('upload_form.warning'),
                  description: $t('upload_form.only_one_cover_image'),
                  duration: 3000,
                  color: 'warning',
                })
                return
              }
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
      await estimateArweaveFee()
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

const showEpubIssuesForFile = (fileRecord: FileRecord) => {
  if (fileRecord.validationErrors || fileRecord.validationWarnings) {
    epubValidationErrors.value = fileRecord.validationErrors || ''
    epubValidationWarnings.value = fileRecord.validationWarnings || ''
    showEpubValidationModal.value = true
  }
}

const handleDeleteFile = (index: number) => {
  const [removedFile] = fileRecords.value.splice(index, 1)
  if (!removedFile) { return }
  removeMetadataForDeletedFile(removedFile)
}

const estimateArweaveFee = async (): Promise<void> => {
  try {
    uploadStatus.value = $t('upload_form.estimating_fees')
    const results: ArweaveEstimate[] = []
    for (const record of fileRecords.value) {
      await sleep(100)
      const isEbook = record.fileType === 'application/epub+zip' || record.fileType === 'application/pdf'
      const priceResult = await estimateBundlrFilePrice({
        fileSize: record.fileBlob?.size || 0,
        ipfsHash: (isEbook && isEncryptEBookData.value) ? undefined : record.ipfsHash,
        token: token.value,
      })
      results.push({
        ...priceResult,
        ipfsHash: record.ipfsHash,
      })
    }

    const firstResult = results[0]
    arweaveRemainingUploads.value = firstResult?.remainingUploads
    if (firstResult) {
      const totalSize = fileRecords.value.reduce((sum, r) => sum + (r.fileBlob?.size || 0), 0)
      const fileCount = fileRecords.value.filter(r => r.fileBlob).length
      isArweaveSponsored.value = canSponsorArweaveUpload(firstResult, totalSize, fileCount)
      arweaveRequiredUploads.value = fileCount
    }

    let totalFee = new BigNumber(0)
    results.forEach((result) => {
      const { evmAddress, arweaveId, ETH, ipfsHash } = result
      if (!ipfsHash) { return }
      if (ETH && !isArweaveSponsored.value) {
        totalFee = totalFee.plus(new BigNumber(ETH))
        arweaveFeeMap.value[ipfsHash] = ETH
      }
      if (arweaveId) {
        sentArweaveTransactionInfo.value.set(ipfsHash, {
          transactionHash: '',
          arweaveId,
        })
        const metadata = epubMetadataList.value.find(
          (data: EpubMetadata) => data.thumbnailIpfsHash === ipfsHash,
        )
        if (metadata) {
          metadata.thumbnailArweaveId = arweaveId
        }
      }
      if (!arweaveFeeTargetAddress.value && evmAddress) {
        arweaveFeeTargetAddress.value = evmAddress
      }
    })

    arweaveFee.value = totalFee
  }
  catch (err) {
    console.error(err)
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (err as Error).message || $t('upload_form.fee_estimation_error'),
    })
  }
  finally {
    uploadStatus.value = ''
  }
}

const storeArweaveResult = (record: FileRecord, result: { arweaveId: string, arweaveLink: string, arweaveKey?: string }) => {
  const { arweaveId, arweaveLink, arweaveKey } = result
  const existingData = sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
  sentArweaveTransactionInfo.value.set(record.ipfsHash, {
    ...existingData,
    arweaveId,
    arweaveLink,
    arweaveKey,
  })
  if (record.fileName?.endsWith('cover.jpeg')) {
    const metadata = epubMetadataList.value.find(
      (file: EpubMetadata) => file.thumbnailIpfsHash === record.ipfsHash,
    )
    if (metadata) {
      metadata.thumbnailArweaveId = arweaveId
    }
  }
  emit('arweaveUploaded', { arweaveId, arweaveLink })
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

    const existingData = sentArweaveTransactionInfo.value.get(file.ipfsHash) || {}
    let { arweaveId } = existingData

    if (!arweaveId && file.fileBlob) {
      const result = await uploadToArweave({
        arrayBuffer: await file.fileBlob.arrayBuffer(),
        fileSize: file.fileBlob.size,
        fileType: file.fileType,
        encrypt: false,
      })
      arweaveId = result.arweaveId
      sentArweaveTransactionInfo.value.set(file.ipfsHash, {
        ...existingData,
        arweaveId: result.arweaveId,
        arweaveLink: result.arweaveLink,
      })
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

    // Pipeline: collect next signature while previous file uploads
    let pendingUpload: Promise<void> = Promise.resolve()
    let uploadError: Error | null = null

    for (let i = 0; i < fileRecords.value.length; i += 1) {
      const record = fileRecords.value[i]
      if (record) {
        currentFileIndex.value = i + 1
        if (uploadError) { break }

        const existingData = sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
        if (existingData.arweaveId || !record.fileBlob) {
          completedFiles.value++
          continue
        }

        const shouldEncrypt
          = (record.fileType === 'application/epub+zip'
            || record.fileType === 'application/pdf')
          && isEncryptEBookData.value

        // Prepare: encrypt + sign transaction (interactive, requires wallet)
        const prepareResult = await prepareArweaveUpload({
          arrayBuffer: await record.fileBlob.arrayBuffer(),
          fileSize: record.fileBlob.size,
          fileType: record.fileType as string,
          encrypt: shouldEncrypt,
          sponsored: isArweaveSponsored.value,
        })

        if ('alreadyExists' in prepareResult) {
          storeArweaveResult(record, prepareResult.result)
        }
        else {
          // Chain upload after previous upload completes, but don't await here
          // so the next file's signature can be collected concurrently
          const capturedRecord = record
          const prevUpload = pendingUpload
          pendingUpload = prevUpload
            .then(() => executeArweaveUploadComposable(prepareResult))
            .then(result => storeArweaveResult(capturedRecord, result))
            .catch((err) => { uploadError = err; throw err })
        }
      }
    }

    // Wait for the last upload to finish
    await pendingUpload
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    uploadStatus.value = ''
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
    })
    return
  }
  finally {
    uploadStatus.value = ''
    totalFiles.value = 0
    currentFileIndex.value = 0
    completedFiles.value = 0
  }

  fileRecords.value.forEach((record: FileRecord, index: number) => {
    if (!record || !fileRecords.value[index]) { return }
    if (sentArweaveTransactionInfo.value.has(record.ipfsHash)) {
      const info = sentArweaveTransactionInfo.value.get(record.ipfsHash)
      if (info) {
        const { arweaveId, arweaveLink, arweaveKey } = info
        if (arweaveId) {
          fileRecords.value[index].arweaveId = arweaveId
        }
        if (arweaveLink) {
          fileRecords.value[index].arweaveLink = arweaveLink
          fileRecords.value[index].arweaveKey = arweaveKey
        }
      }
    }
  })

  const uploadFileData = {
    fileRecords: fileRecords.value.map(record => ({
      fileType: record.fileType,
      fileName: record.fileName,
      arweaveId: record.arweaveId,
      arweaveLink: record.arweaveLink,
      arweaveKey: record.arweaveKey,
      ipfsHash: record.ipfsHash,
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
    return !(file.fileName?.endsWith('_cover.jpeg'))
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

  if (pdfFiles.length > 0 && coverFiles.length === 0) {
    return {
      valid: false,
      error: $t('upload_form.missing_cover_for_pdf'),
      canProceedAnyway: false,
    }
  }

  if (epubFiles.length > 0 && coverFiles.length === 0) {
    return {
      valid: false,
      error: $t('upload_form.missing_cover_for_epub'),
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
    isEncrypt: isEncryptEBookData.value,
    isSponsored: isArweaveSponsored.value,
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
