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
              class="flex justify-between items-center border-b-shade-gray border-b-[1px] text-dark-gray hover:bg-light-gray transition-colors w-full"
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
              <td>
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
    <div class="flex items-center gap-2 mt-4">
      <UCheckbox v-model="isEncryptEBookData" :label="$t('upload_form.drm_encrypt_disable')" />
    </div>
    <UModal
      :model-value="!!uploadStatus"
      :prevent-close="true"
      :ui="{
        base: 'p-4 gap-2'
      }"
    >
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <UBadge variant="soft">
            {{ uploadStatus }}
          </UBadge>
          <p class="text-xs text-gray-500">
            {{ $t('upload_form.do_not_close_upload') }}
          </p>
        </div>
        <UProgress
          animation="carousel"
          color="primary"
          class="w-full"
        />
      </div>
    </UModal>
    <UModal
      v-model="showValidationWarning"
      :ui="{
        base: 'p-4 gap-4',
        body: 'flex items-start gap-3',
        footer: 'flex justify-end gap-2'
      }"
    >
      <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
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
      <template #footer>
        <UButton
          variant="outline"
          color="gray"
          @click="showValidationWarning = false; pendingSubmitAfterConfirm = false"
        >
          {{ $t('upload_form.fix_files') }}
        </UButton>
        <UButton
          color="yellow"
          @click="confirmProceedAnyway"
        >
          {{ $t('upload_form.proceed_anyway') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import ePub from 'epubjs'
import { BigNumber } from 'bignumber.js'
import { useSendTransaction, useBalance } from '@wagmi/vue'
import { parseEther, formatUnits } from 'viem'
import { encryptDataWithAES } from '~/utils/encryption'
import { fileToArrayBuffer, digestFileSHA256, calculateIPFSHash, sleep } from '~/utils/index'
import {
  estimateBundlrFilePrice,
  uploadSingleFileToBundlr
} from '~/utils/arweave'
import { useWalletStore } from '~/stores/wallet'
import { useBookstoreApiStore } from '~/stores/book-store-api'
import { PUBLISH_GUIDE_URL } from '~/constant'
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

export interface FileRecord {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileBlob?: Blob;
  ipfsHash?: string;
  fileSHA256?: string;
  encryptedIpfsHash?: string | null;
  encryptedBuffer?: Buffer<ArrayBuffer> | null;
  encryptionKey?: string | null;
  fileData?: string;
  arweaveId?: string
  arweaveLink?: string
  arweaveKey?: string
}

interface epubMetadata {
  title?: string;
  author?: string;
  language?: string;
  description?: string;
  tags?: string[];
  epubFileName?: string;
  thumbnailIpfsHash?: string | null;
  thumbnailArweaveId?: string | null;
  coverData?: string | null;
}

const props = defineProps({
  defaultEncrypted: { type: Boolean, default: true }
})

const fileRecords = ref<FileRecord[]>([])
const { sendTransactionAsync } = useSendTransaction()

const isSizeExceeded = ref(false)
const isDragging = ref(false)
const epubMetadataList = ref<epubMetadata[]>([])

const arweaveFee = ref(new BigNumber(0))
const arweaveFeeMap = ref({} as any)
const arweaveFeeTargetAddress = ref('')
const sentArweaveTransactionInfo = ref(new Map())
const isEncryptEBookData = ref(props.defaultEncrypted)

const emit = defineEmits(['arweaveUploaded', 'submit', 'fileReady', 'fileUploadStatus'])
const uploadStatus = ref('')
const showValidationWarning = ref(false)
const validationErrorMessage = ref('')
const pendingSubmitAfterConfirm = ref(false)
const balance = useBalance({
  address: wallet.value
})

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
  'border-[2px]',
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
      timeout: 3000,
      color: 'red'
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
              await processEPub({ buffer: fileBytes, file })
            } else if (fileRecord.fileType?.startsWith('image/')) {
              let emptyCoverMetadata = epubMetadataList.value.find(
                (metadata: any) => !metadata.thumbnailIpfsHash
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
                    timeout: 3000,
                    color: 'yellow'
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

const processEPub = async ({ buffer, file }: { buffer: ArrayBuffer; file: File }) => {
  try {
    const book = ePub(buffer)
    await book.ready

    const epubMetadata: any = {}

    // Get metadata
    const { metadata } = book.packaging
    if (metadata) {
      epubMetadata.epubFileName = file.name
      epubMetadata.title = metadata.title
      epubMetadata.author = metadata.creator
      epubMetadata.language = formatLanguage(metadata.language)
      epubMetadata.description = metadata.description
    }

    // Get tags
    const opfFilePath = await (book.path as any).path
    const opfContent = await book.archive.getText(opfFilePath)
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

    // Get cover file
    const coverUrl = await book.coverUrl()
    if (coverUrl) {
      const response = await fetch(coverUrl)
      const blobData = await response.blob()
      if (blobData) {
        const coverFile = new File(
          [blobData],
          `${metadata.title}_cover.jpeg`,
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

          const coverFileRecord: any = {
            fileName: coverFile.name,
            fileSize: coverFile.size,
            fileType: coverFile.type,
            fileBlob: coverFile,
            ipfsHash: ipfsThumbnailHash,
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
      timeout: 3000,
      color: 'red'
    })
  }
}

const handleDeleteFile = (index: number) => {
  const [removedFile] = fileRecords.value.splice(index, 1)
  if (!removedFile) { return }
  if (removedFile.fileType?.startsWith('image/')) {
    epubMetadataList.value = epubMetadataList.value
      .map((metadata: any) => {
        if (metadata.thumbnailIpfsHash === removedFile.ipfsHash) {
          return { ...metadata, thumbnailIpfsHash: null, coverData: null }
        }
        return metadata
      })
      .filter((metadata: any) =>
        metadata.epubFileName || metadata.thumbnailIpfsHash
      )
  } else if (removedFile.fileType === 'application/epub+zip') {
    epubMetadataList.value = epubMetadataList.value.filter(
      (metadata: any) => metadata.epubFileName !== removedFile.fileName
    )
  }
}

const estimateArweaveFee = async (): Promise<void> => {
  try {
    uploadStatus.value = $t('upload_form.loading')
    const results = []
    for (const record of fileRecords.value) {
      await sleep(100)
      const isEbook = record.fileType === 'application/epub+zip' || record.fileType === 'application/pdf'
      const priceResult: any = await estimateBundlrFilePrice({
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
          (data: any) => data.thumbnailIpfsHash === ipfsHash
        )
        if (metadata) {
          metadata.thumbnailArweaveId = arweaveId
        }
      }
      if (!arweaveFeeTargetAddress.value) {
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
      timeout: 3000,
      color: 'red'
    })
  } finally {
    uploadStatus.value = ''
  }
}

const submitToArweave = async (record: FileRecord): Promise<void> => {
  const existingData =
    sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
  const { transactionHash, arweaveId: uploadArweaveId } = existingData

  if (uploadArweaveId || !record.fileBlob) {
    return
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
    txHash = await sendArweaveFeeTx(record, ipfsHash)
    if (!txHash) {
      throw new Error('TRANSACTION_NOT_SENT')
    }
  }

  const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(buffer, {
    fileSize: record.fileBlob?.size || 0,
    ipfsHash: ipfsHash as string,
    fileType: record.fileType as string,
    txHash,
    token: token.value,
    key
  })

  if (!arweaveId) {
    throw new Error(`Failed to upload file ${record.fileName} with IPFS hash ${ipfsHash}`)
  }

  const uploadedData =
  sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
  sentArweaveTransactionInfo.value.set(record.ipfsHash, {
    ...uploadedData,
    arweaveId,
    arweaveLink,
    arweaveKey: key
  })
  if (record.fileName?.endsWith('cover.jpeg')) {
    const metadata = epubMetadataList.value.find(
      (file: any) => file.thumbnailIpfsHash === record.ipfsHash
    )
    if (metadata) {
      metadata.thumbnailArweaveId = arweaveId
    }
  }
  emit('arweaveUploaded', { arweaveId, arweaveLink })
}

const sendArweaveFeeTx = async (record: any, memoIpfsOveride?: string): Promise<string> => {
  if (sentArweaveTransactionInfo.value.has(record.ipfsHash)) {
    const transactionInfo = sentArweaveTransactionInfo.value.get(
      record.ipfsHash
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
  if (!arweaveFeeMap.value[record.ipfsHash]) {
    throw new Error('ARWEAVE_FEE_NOT_SET')
  }
  uploadStatus.value = $t('upload_form.signing')
  const memo = JSON.stringify({
    ipfs: memoIpfsOveride || record.ipfsHash,
    fileSize: record.fileBlob?.size || 0
  })
  try {
    await assertSufficientBalanceForTransfer({
      wallet: wallet.value,
      to: arweaveFeeTargetAddress.value as `0x${string}`,
      value: parseEther(arweaveFeeMap.value[record.ipfsHash] as string),
      data: `0x${Buffer.from(memo, 'utf-8').toString('hex')}` as `0x${string}`
    })
    const transactionHash = await sendTransactionAsync({
      to: arweaveFeeTargetAddress.value as `0x${string}`,
      value: parseEther(arweaveFeeMap.value[record.ipfsHash] as string),
      data: `0x${Buffer.from(memo, 'utf-8').toString('hex')}`
    })
    const receipt = await waitForTransactionReceipt({ hash: transactionHash })
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    if (transactionHash) {
      const existingData =
        sentArweaveTransactionInfo.value.get(record.ipfsHash) || {}
      sentArweaveTransactionInfo.value.set(record.ipfsHash, {
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

const uploadFileAndGetArweaveId = async (file: any, txHash: string) => {
  const arrayBuffer = await file.fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const { arweaveId, arweaveLink } = await uploadSingleFileToBundlr(buffer, {
    fileSize: file.fileBlob?.size || 0,
    ipfsHash: file.ipfsHash,
    fileType: file.fileType,
    txHash,
    token: token.value
  })
  return { arweaveId, arweaveLink }
}

const setEbookCoverFromImages = async () => {
  const metadata = epubMetadataList.value.find(
    (m: any) => m.coverData || m.thumbnailIpfsHash
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
    uploadStatus.value = $t('upload_form.uploading')

    if (!balance?.data?.value?.value || new BigNumber(formatUnits(balance.data.value.value, balance.data.value.decimals)).lt(arweaveFee.value)) {
      throw new Error(`INSUFFICIENT_BASE_ETH_BALANCE: NEED ${arweaveFee.value.toString()} ETH`)
    }

    if (!fileRecords.value.some(file => file.fileBlob)) {
      throw new Error('NO_FILE_TO_UPLOAD')
    }

    uploadStatus.value = $t('upload_form.uploading')
    if (
      fileRecords.value.find(file => file.fileType === 'application/pdf') &&
      !fileRecords.value.find(
        file => file.fileType === 'application/epub+zip'
      )
    ) {
      await setEbookCoverFromImages()
    }

    for (let i = 0; i < fileRecords.value.length; i += 1) {
      const record = fileRecords.value[i]
      if (record) {
        await submitToArweave(record)
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    uploadStatus.value = ''
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('upload_form.error_during_upload'),
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
      timeout: 3000,
      color: 'red'
    })
    return
  } finally {
    uploadStatus.value = ''
  }

  fileRecords.value.forEach((record: any, index: number) => {
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

const validateFiles = (): { valid: boolean; error?: string } => {
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
      error: $t('upload_form.missing_cover_for_pdf')
    }
  }

  if (epubFiles.length > 0 && coverFiles.length === 0) {
    return {
      valid: false,
      error: $t('upload_form.missing_cover_for_epub')
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
