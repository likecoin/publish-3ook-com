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
        <UIcon name="i-heroicons-folder-arrow-down" class="w-5 h-5" />
        <p class="text-gray-600 my-[16px]" v-text="$t('upload_form.drag_files_here')" />
        <UButton type="button" variant="ghost" @click.stop="($refs.imageFile as HTMLInputElement)?.click()">
          {{ $t('common.select_file') }}
        </UButton>
        <p class="text-xs text-gray-500 mt-2" v-text="$t('upload_form.file_size_suggestion')" />
        <a
          :href="PUBLISH_GUIDE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-primary-500 hover:text-primary-600 mt-2 flex items-center gap-1"
          @click.stop
        >
          <UIcon name="i-heroicons-question-mark-circle" class="w-4 h-4" />
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

      <div v-if="fileRecords.length" class="flex flex-col w-full">
        <table class="w-full">
          <tbody class="w-full">
            <tr
              v-for="(
                { fileData, fileName, fileSize, fileType }, index
              ) of fileRecords"
              :key="fileName"
              class="flex justify-between items-center border-b-shade-gray border-b text-dark-gray hover:bg-light-gray transition-colors w-full"
            >
              <td class="py-[4px]">
                <ImgPreviewer
                  :file-type="fileType"
                  :file-data="fileData"
                  size="small"
                />
              </td>
              <td>
                <div class="flex flex-col">
                  <p class="font-semibold text-gray-700">
                    {{ fileName }}
                  </p>
                  <p class="text-gray-500 text-sm">
                    {{ Math.round((fileSize || 0) * 0.001) }} KB
                  </p>
                </div>
              </td>
              <td class="flex items-center gap-2">
                <UIcon
                  v-if="fileRecords[index]?.hasValidationIssues"
                  name="i-heroicons-exclamation-triangle"
                  class="w-5 h-5 text-yellow-500 cursor-help"
                  :title="$t('upload_form.epub_has_issues')"
                  @click="showEpubIssuesForFile(fileRecords[index])"
                />
                <UIcon
                  name="i-heroicons-trash"
                  class="cursor-pointer text-red-500"
                  @click="handleDeleteFile(index)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <URadioGroup
      v-model="drmOption"
      :items="drmOptions"
      orientation="vertical"
      :ui="{ label: 'text-left' }"
    >
      <template #label="{ item }">
        <span>{{ item.label }}</span>
        <UTooltip v-if="item.value === 'open'" :text="$t('upload_form.drm_option_open_tooltip')">
          <a
            :href="$t('upload_form.drm_option_open_tooltip')"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center ml-1"
            @click.stop
          >
            <UIcon name="i-heroicons-question-mark-circle" class="w-4 h-4 text-gray-400 hover:text-primary-500" />
          </a>
        </UTooltip>
      </template>
    </URadioGroup>
    <UModal
      :open="!!uploadStatus"
      :dismissible="false"
      class="p-4 gap-2"
    >
      <template #body>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <UBadge variant="soft">
              {{ uploadStatus }}
            </UBadge>
            <p class="text-xs text-gray-500">
              {{ $t('upload_form.do_not_close_upload') }}
            </p>
          </div>
          <template v-if="totalFiles > 1">
            <div class="flex items-center text-sm text-gray-600">
              <span>{{ $t('upload_form.processing_file', { index: currentFileIndex, total: totalFiles }) }}</span>
            </div>
            <UProgress :value="Math.round((completedFiles / totalFiles) * 100)" color="primary" class="w-full" />
          </template>
          <UProgress
            v-else
            animation="carousel"
            color="primary"
            class="w-full"
          />
        </div>
      </template>
    </UModal>
    <UModal v-model:open="showValidationWarning">
      <template #body>
        <div class="flex items-start gap-3 p-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
          <div class="space-y-2">
            <h3 class="font-semibold text-gray-900">
              {{ $t('upload_form.validation_error') }}
            </h3>
            <p class="text-gray-600">
              {{ validationErrorMessage }}
            </p>
            <p class="text-sm text-gray-500 whitespace-pre-line">
              {{ $t('upload_form.valid_combinations') }}
            </p>
            <a
              :href="PUBLISH_GUIDE_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1"
            >
              <UIcon name="i-heroicons-question-mark-circle" class="w-4 h-4" />
              {{ $t('upload_form.help_link') }}
            </a>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            @click="showValidationWarning = false; pendingSubmitAfterConfirm = false"
          >
            {{ $t('upload_form.fix_files') }}
          </UButton>
          <UButton
            v-if="canProceedAnyway"
            color="warning"
            @click="confirmProceedAnyway"
          >
            {{ $t('upload_form.proceed_anyway') }}
          </UButton>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="showEpubValidationModal">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-yellow-500 shrink-0" />
          <h3 class="font-semibold text-gray-900">
            {{ $t('upload_form.epub_validation_title') }}
          </h3>
        </div>
        <p class="text-sm text-gray-500 mt-2">
          {{ $t('upload_form.epub_validation_notice') }}
        </p>
      </template>
      <template #body>
        <div class="max-h-[300px] overflow-y-auto space-y-2 text-sm">
          <div v-if="epubValidationErrors" class="text-red-600">
            <p class="font-semibold mb-1">
              {{ $t('upload_form.epub_validation_errors') }}:
            </p>
            <pre class="whitespace-pre-wrap text-xs">{{ epubValidationErrors }}</pre>
          </div>
          <div v-if="epubValidationWarnings" class="text-yellow-600">
            <p class="font-semibold mb-1">
              {{ $t('upload_form.epub_validation_warnings') }}:
            </p>
            <pre class="whitespace-pre-wrap text-xs">{{ epubValidationWarnings }}</pre>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          @click="showEpubValidationModal = false"
        >
          {{ $t('auth_state.close') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { BigNumber } from 'bignumber.js'
import { useSendTransaction } from '@wagmi/vue'
import { parseEther } from 'viem'
import {
  estimateBundlrFilePrice,
  uploadSingleFileToBundlr
} from '~/utils/arweave'
import { PUBLISH_GUIDE_URL } from '~/constant'

import type { FileRecord, EpubMetadata, ArweaveEstimate } from '~/types'
const { t: $t } = useI18n()

const UPLOAD_FILESIZE_MAX = 200 * 1024 * 1024

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { validateWalletConsistency } = store
const { waitForTransactionReceipt, assertSufficientBalanceForTransfer } = useNFTContractWriter()
const bookstoreApiStore = useBookstoreApiStore()
const { token } = storeToRefs(bookstoreApiStore)
const toast = useToast()
const imageFile = ref<HTMLInputElement | null>(null)
export type { FileRecord }

const props = defineProps({
  defaultEncrypted: { type: Boolean, default: true }
})

const fileRecords = ref<FileRecord[]>([])
const { sendTransactionAsync } = useSendTransaction()

const isSizeExceeded = ref(false)
const isDragging = ref(false)
const epubMetadataList = ref<EpubMetadata[]>([])

const arweaveFee = ref(new BigNumber(0))
const arweaveFeeMap = ref({} as Record<string, string>)
const arweaveFeeTargetAddress = ref('')
const sentArweaveTransactionInfo = ref(new Map())
const drmOption = ref(props.defaultEncrypted ? 'encrypted' : 'open')
const isEncryptEBookData = computed(() => drmOption.value === 'encrypted')
const drmOptions = computed(() => [
  { label: $t('upload_form.drm_option_encrypted'), value: 'encrypted' },
  { label: $t('upload_form.drm_option_open'), value: 'open' }
])

const emit = defineEmits(['arweaveUploaded', 'submit', 'fileReady', 'fileUploadStatus'])
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
  'hover:bg-gray-200'
])

watch(isEncryptEBookData, async () => {
  uploadStatus.value = $t('upload_form.loading')
  await estimateArweaveFee()
  uploadStatus.value = ''
})

watch(uploadStatus, (val: string) => {
  emit('fileUploadStatus', val)
}, { immediate: true })

const formatLanguage = (language: string) => {
  let formattedLanguage = ''
  if (language) {
    if (language.toLowerCase().startsWith('en')) {
      formattedLanguage = 'en'
    } else if (language.toLowerCase().startsWith('zh')) {
      formattedLanguage = 'zh'
    } else {
      formattedLanguage = language
    }
  }
  return formattedLanguage
}

const getFileInfo = async (file: Blob) => {
  try {
    const fileBytes = (await fileToArrayBuffer(file)) as ArrayBuffer
    if (!fileBytes) {
      return null
    }
    const [fileSHA256, ipfsHash] = await Promise.all([
      digestFileSHA256(fileBytes),
      calculateIPFSHash(Buffer.from(fileBytes))
    ])
    return {
      fileBytes,
      fileSHA256,
      ipfsHash
    }
  } catch (error) {
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('upload_form.error_during_upload'),
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
      duration: 3000,
      color: 'error'
    })
    return null
  }
}

const onFileUpload = async (event: Event) => {
  try {
    uploadStatus.value = $t('upload_form.loading')
    isSizeExceeded.value = false
    const files =
      (event as InputEvent).dataTransfer?.files || (event.target as HTMLInputElement)?.files

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

          const info = await getFileInfo(file)
          if (info) {
            const { fileBytes, fileSHA256, ipfsHash } = info
            fileRecord = {
              ...fileRecord,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              ipfsHash: ipfsHash || undefined,
              fileSHA256,
              fileBlob: file
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
            } else if (fileRecord.fileType?.startsWith('image/')) {
              let emptyCoverMetadata = epubMetadataList.value.find(
                (metadata: EpubMetadata) => !metadata.thumbnailIpfsHash
              )
              if (!emptyCoverMetadata) {
                if (epubMetadataList.value.length === 0) {
                  // No EPUB file was uploaded — epubMetadataList is still empty
                  emptyCoverMetadata = {
                    thumbnailIpfsHash: null,
                    coverData: null
                  }
                  epubMetadataList.value.push(emptyCoverMetadata)
                } else {
                  // A cover image has already been assigned — only one cover is allowed
                  toast.add({
                    icon: 'i-heroicons-exclamation-circle',
                    title: $t('upload_form.warning'),
                    description: $t('upload_form.only_one_cover_image'),
                    duration: 3000,
                    color: 'warning'
                  })
                  return
                }
              }

              const coverReader = new FileReader()
              coverReader.onload = (e) => {
                if (!e.target) { return }
                emptyCoverMetadata.thumbnailIpfsHash = ipfsHash
                emptyCoverMetadata.coverData = e.target.result as string
              }
              coverReader.readAsDataURL(file)
            }
          }
        } else {
          isSizeExceeded.value = true
        }
        fileRecords.value.push(fileRecord)
        uploadStatus.value = ''
      }
    }
  } finally {
    try {
      await estimateArweaveFee()
    } catch (error) {
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
      hasIssues: !!(errorMessages || warningMessages)
    }
  } catch (error) {
    return {
      errors: (error as Error).message || $t('upload_form.epub_validation_failed'),
      warnings: '',
      hasIssues: true
    }
  }
}

const processEPub = async ({ buffer, file }: { buffer: ArrayBuffer; file: File }) => {
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
          'dc\\:subject, subject'
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
            type: 'image/jpeg'
          }
        )

        const coverInfo = await getFileInfo(coverFile)
        if (coverInfo) {
          const {
            fileSHA256,
            ipfsHash: ipfsThumbnailHash
          } = coverInfo

          epubMetadata.thumbnailIpfsHash = ipfsThumbnailHash

          const coverFileRecord: FileRecord = {
            fileName: coverFile.name,
            fileSize: coverFile.size,
            fileType: coverFile.type,
            fileBlob: coverFile,
            ipfsHash: ipfsThumbnailHash ?? undefined,
            fileSHA256
          }
          const coverReader = new FileReader()
          coverReader.onload = (e) => {
            if (!e.target) {
              return
            }
            coverFileRecord.fileData = e.target.result as string
            fileRecords.value.push(coverFileRecord)
            epubMetadata.coverData = e.target.result as string
            epubMetadataList.value.push(epubMetadata)
          }
          coverReader.readAsDataURL(coverFile)
          return
        }
      }
    }
    epubMetadataList.value.push(epubMetadata)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('upload_form.error_during_upload'),
      description: (err as Error).message || $t('upload_form.epub_processing_error'),
      duration: 3000,
      color: 'error'
    })
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
  if (removedFile.fileType?.startsWith('image/')) {
    epubMetadataList.value = epubMetadataList.value
      .map((metadata: EpubMetadata) => {
        if (metadata.thumbnailIpfsHash === removedFile.ipfsHash) {
          return { ...metadata, thumbnailIpfsHash: null, coverData: null }
        }
        return metadata
      })
      .filter((metadata: EpubMetadata) =>
        metadata.epubFileName || metadata.thumbnailIpfsHash
      )
  } else if (removedFile.fileType === 'application/epub+zip') {
    epubMetadataList.value = epubMetadataList.value.filter(
      (metadata: EpubMetadata) => metadata.epubFileName !== removedFile.fileName
    )
  }
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
        ipfsHash: (isEbook && isEncryptEBookData.value) ? undefined : record.ipfsHash
      })
      results.push({
        ...priceResult,
        ipfsHash: record.ipfsHash
      })
    }

    let totalFee = new BigNumber(0)
    results.forEach((result) => {
      const { evmAddress, arweaveId, ETH, ipfsHash } = result
      if (!ipfsHash) { return }
      if (ETH) {
        totalFee = totalFee.plus(new BigNumber(ETH))
        arweaveFeeMap.value[ipfsHash] = ETH
      }
      if (arweaveId) {
        sentArweaveTransactionInfo.value.set(ipfsHash, {
          transactionHash: '',
          arweaveId
        })
        const metadata = epubMetadataList.value.find(
          (data: EpubMetadata) => data.thumbnailIpfsHash === ipfsHash
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
  } catch (err) {
    console.error(err)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('upload_form.error_during_upload'),
      description: (err as Error).message || $t('upload_form.fee_estimation_error'),
      duration: 3000,
      color: 'error'
    })
  } finally {
    uploadStatus.value = ''
  }
}

interface PreparedUpload {
  txHash: string
  buffer: Buffer
  ipfsHash: string
  key?: string
}

const prepareArweaveSubmission = async (record: FileRecord): Promise<PreparedUpload | null> => {
  const existingData =
    sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
  const { transactionHash, arweaveId: uploadArweaveId } = existingData

  if (uploadArweaveId || !record.fileBlob) {
    return null
  }

  let txHash = transactionHash
  let key
  const arrayBuffer = await record.fileBlob.arrayBuffer()
  let buffer = Buffer.from(arrayBuffer)
  let { ipfsHash } = record

  const shouldEncrypt =
      (record.fileType === 'application/epub+zip' ||
        record.fileType === 'application/pdf') &&
      isEncryptEBookData.value

  if (shouldEncrypt) {
    if (!record.encryptedIpfsHash) {
      uploadStatus.value = $t('upload_form.encrypting')
      const { rawEncryptedKeyAsBase64, combinedArrayBuffer } =
        await encryptDataWithAES({ data: arrayBuffer })
      const encryptedBuffer = Buffer.from(combinedArrayBuffer)
      ipfsHash = await calculateIPFSHash(encryptedBuffer) || ''
      key = rawEncryptedKeyAsBase64
      buffer = encryptedBuffer
      record.encryptedIpfsHash = ipfsHash
      record.encryptedBuffer = encryptedBuffer
      record.encryptionKey = key
    } else {
      ipfsHash = record.encryptedIpfsHash
      buffer = record.encryptedBuffer || buffer
      key = record.encryptionKey || undefined
    }
  }

  if (!txHash) {
    // HACK: override ipfsHash memo to match arweave tag later
    txHash = await sendArweaveFeeTx(record)
    if (!txHash) {
      throw new Error('TRANSACTION_NOT_SENT')
    }
  }

  return { txHash, buffer, ipfsHash: ipfsHash as string, key }
}

const executeArweaveUpload = async (record: FileRecord, prepared: PreparedUpload): Promise<void> => {
  const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(prepared.buffer, {
    fileSize: record.fileBlob?.size || 0,
    ipfsHash: prepared.ipfsHash,
    fileType: record.fileType as string,
    txHash: prepared.txHash,
    token: token.value,
    key: prepared.key
  })

  if (!arweaveId) {
    throw new Error(`Failed to upload file ${record.fileName} with IPFS hash ${prepared.ipfsHash}`)
  }

  const uploadedData =
    sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
  sentArweaveTransactionInfo.value.set(record.ipfsHash, {
    ...uploadedData,
    arweaveId,
    arweaveLink,
    arweaveKey: prepared.key
  })
  if (record.fileName?.endsWith('cover.jpeg')) {
    const metadata = epubMetadataList.value.find(
      (file: EpubMetadata) => file.thumbnailIpfsHash === record.ipfsHash
    )
    if (metadata) {
      metadata.thumbnailArweaveId = arweaveId
    }
  }
  emit('arweaveUploaded', { arweaveId, arweaveLink })
  completedFiles.value++
}

const sendArweaveFeeTx = async (record: FileRecord): Promise<string> => {
  const recordIpfsHash = record.ipfsHash
  if (!recordIpfsHash) {
    throw new Error('IPFS_HASH_NOT_SET')
  }
  if (sentArweaveTransactionInfo.value.has(recordIpfsHash)) {
    const transactionInfo = sentArweaveTransactionInfo.value.get(
      recordIpfsHash
    )
    if (transactionInfo && transactionInfo.transactionHash) {
      return transactionInfo.transactionHash
    }
  }
  if (!wallet.value || !signer.value) {
    await validateWalletConsistency()
  }
  if (!wallet.value || !signer.value) {
    throw new Error('SIGNER_NOT_INITED')
  }
  if (!arweaveFeeTargetAddress.value) {
    throw new Error('TARGET_ADDRESS_NOT_SET')
  }
  if (!arweaveFeeMap.value[recordIpfsHash]) {
    throw new Error('ARWEAVE_FEE_NOT_SET')
  }
  uploadStatus.value = $t('upload_form.checking_balance')
  try {
    await assertSufficientBalanceForTransfer({
      wallet: wallet.value,
      to: arweaveFeeTargetAddress.value as `0x${string}`,
      value: parseEther(arweaveFeeMap.value[recordIpfsHash])
    })
    uploadStatus.value = $t('upload_form.waiting_signature')
    const transactionHash = await sendTransactionAsync({
      to: arweaveFeeTargetAddress.value as `0x${string}`,
      value: parseEther(arweaveFeeMap.value[recordIpfsHash])
    })
    uploadStatus.value = $t('upload_form.waiting_confirmation')
    const receipt = await waitForTransactionReceipt({ hash: transactionHash })
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    if (transactionHash) {
      const existingData =
        sentArweaveTransactionInfo.value.get(recordIpfsHash) || {}
      sentArweaveTransactionInfo.value.set(recordIpfsHash, {
        ...existingData,
        transactionHash
      })
      return transactionHash
    }
  } finally {
    uploadStatus.value = $t('upload_form.uploading')
  }

  return ''
}

const uploadFileAndGetArweaveId = async (file: FileRecord, txHash: string) => {
  if (!file.fileBlob || !file.ipfsHash) {
    throw new Error('FILE_BLOB_OR_IPFS_HASH_NOT_SET')
  }
  const arrayBuffer = await file.fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(buffer, {
    fileSize: file.fileBlob.size || 0,
    ipfsHash: file.ipfsHash,
    fileType: file.fileType,
    txHash,
    token: token.value
  })
  return { arweaveId, arweaveLink }
}

const setEbookCoverFromImages = async () => {
  const metadata = epubMetadataList.value.find(
    (m: EpubMetadata) => m.coverData || m.thumbnailIpfsHash
  )
  if (metadata?.thumbnailArweaveId) { return }

  for (let i = 0; i < fileRecords.value.length; i += 1) {
    const file = fileRecords.value[i]
    if (!file || !file.fileType?.startsWith('image')) { continue }
    const existingData = sentArweaveTransactionInfo.value.get(file.ipfsHash) || {}
    let { transactionHash, arweaveId, arweaveLink } = existingData

    if (!arweaveId) {
      if (!transactionHash) {
        transactionHash = await sendArweaveFeeTx(file)
      }
      const uploadResult = await uploadFileAndGetArweaveId(file, transactionHash)
      arweaveId = uploadResult.arweaveId
      arweaveLink = uploadResult.arweaveLink
      if (arweaveId) {
        sentArweaveTransactionInfo.value.set(file.ipfsHash, {
          transactionHash,
          arweaveId,
          arweaveLink
        })
      }
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
    if (!signer.value) {
      await validateWalletConsistency()
    }
    if (!signer.value) {
      throw new Error('SIGNER_NOT_INITED')
    }
    if (!fileRecords.value.some(file => file.fileBlob)) {
      throw new Error('NO_FILE_TO_UPLOAD')
    }

    totalFiles.value = fileRecords.value.length
    currentFileIndex.value = 0
    completedFiles.value = 0

    uploadStatus.value = $t('upload_form.uploading')
    if (
      fileRecords.value.find(file => file.fileType === 'application/pdf') &&
      !fileRecords.value.find(
        file => file.fileType === 'application/epub+zip'
      )
    ) {
      uploadStatus.value = $t('upload_form.preparing_cover')
      await setEbookCoverFromImages()
    }

    // Pipeline: collect next signature while previous file uploads
    let pendingUpload: Promise<void> = Promise.resolve()

    for (let i = 0; i < fileRecords.value.length; i += 1) {
      const record = fileRecords.value[i]
      if (record) {
        currentFileIndex.value = i + 1
        // Prepare: encrypt + sign transaction (interactive, requires wallet)
        const prepared = await prepareArweaveSubmission(record)
        if (prepared) {
          // Chain upload after previous upload completes, but don't await here
          // so the next file's signature can be collected concurrently
          const prevUpload = pendingUpload
          pendingUpload = prevUpload.then(() => executeArweaveUpload(record, prepared))
        } else {
          completedFiles.value++
        }
      }
    }

    // Wait for the last upload to finish
    await pendingUpload
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    uploadStatus.value = ''
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('upload_form.error_during_upload'),
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
      duration: 3000,
      color: 'error'
    })
    return
  } finally {
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
        }
        if (arweaveKey) {
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
      ipfsHash: record.ipfsHash
    })),
    epubMetadata: epubMetadataList.value[0]
  }

  emit('submit', uploadFileData)
}

const validateFiles = (): { valid: boolean; error?: string; canProceedAnyway?: boolean } => {
  const pdfFiles = fileRecords.value.filter(
    file => file.fileType === 'application/pdf'
  )
  const epubFiles = fileRecords.value.filter(
    file => file.fileType === 'application/epub+zip'
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
      error: $t('upload_form.missing_ebook_file')
    }
  }

  if (pdfFiles.length > 1) {
    return {
      valid: false,
      error: $t('upload_form.too_many_pdfs')
    }
  }

  if (manualCoverFiles.length > 1) {
    return {
      valid: false,
      error: $t('upload_form.only_one_cover_image')
    }
  }

  if (pdfFiles.length > 0 && coverFiles.length === 0) {
    return {
      valid: false,
      error: $t('upload_form.missing_cover_for_pdf'),
      canProceedAnyway: false
    }
  }

  if (epubFiles.length > 0 && coverFiles.length === 0) {
    return {
      valid: false,
      error: $t('upload_form.missing_cover_for_epub'),
      canProceedAnyway: false
    }
  }

  return { valid: true }
}

const confirmProceedAnyway = async () => {
  showValidationWarning.value = false
  if (pendingSubmitAfterConfirm.value) {
    pendingSubmitAfterConfirm.value = false
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
  await onSubmitInternal()
}

defineExpose({
  onSubmit,
  validateFiles
})
</script>
