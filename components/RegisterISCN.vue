<template>
  <div>
    <ISCNForm v-model="iscnFormData" />
    <UModal
      :model-value="!!uploadStatus"
      :prevent-close="true"
      :ui="{ base: 'p-4 gap-2' }"
    >
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <UBadge variant="soft">
            {{ uploadStatus }}
          </UBadge>
          <p class="text-xs text-gray-500">
            {{ $t('notifications.iscn_registration_complete') }}
          </p>
        </div>
        <UProgress animation="carousel" color="primary" class="w-full" />
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useWriteContract } from '@wagmi/vue'
import { getUploadFileData } from '~/utils/uploadFile'
import { useFileUpload } from '~/composables/useFileUpload'
import { useWalletStore } from '~/stores/wallet'

import { useISCN } from '~/composables/useISCN'
import { LIKE_NFT_ABI } from '~/contracts/likeNFT'
import { useToastComposable } from '~/composables/useToast'
import { DEFAULT_MAX_SUPPLY } from '~/constant'

const walletStore = useWalletStore()
const { getFileType } = useFileUpload()
const {
  LIKE_EVM_NFT_TARGET_ADDRESS
} = useRuntimeConfig().public

const { wallet, signer } = storeToRefs(walletStore)
const { validateWalletConsistency } = walletStore
const { assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()
const { stripHtmlTags, formatLanguage } = useFileUpload()
const { showErrorToast } = useToastComposable()
const { t: $t } = useI18n()
const { LIKE_NFT_CONTRACT_ADDRESS } = useRuntimeConfig().public

const iscnFormData = ref({
  type: 'Book',
  title: '',
  description: '',
  isbn: '',
  publisher: '',
  publicationDate: '',
  author: {
    name: '',
    description: ''
  },
  license: 'All Rights Reserved',
  customLicense: '',
  contentFingerprints: [{ url: '' }],
  downloadableUrls: [{
    url: '',
    type: '',
    fileName: ''
  }],
  language: '',
  bookInfoUrl: '',
  tags: [],
  coverUrl: ''
})

const uploadStatus = ref('')
const error = ref('')
const emit = defineEmits(['handleSubmit', 'submit', 'formValidChange'])

const { payload, computeISCNSalt } = useISCN({ iscnFormData })
const { writeContractAsync } = useWriteContract()

const formError = computed(() => validateISCNForm(iscnFormData.value))

const isFormValid = computed(() => {
  return !formError.value?.length
})

watch(isFormValid, (val: boolean) => {
  emit('formValidChange', val)
}, { immediate: true })

onMounted(() => {
  const initialData = initializeFromSessionStorage()
  if (initialData) {
    iscnFormData.value = initialData
  }
})

const initializeFromSessionStorage = () => {
  const data = getUploadFileData()
  if (!data) { return null }

  const baseData: any = {
    type: 'Book',
    title: data.epubMetadata?.title || '',
    description: stripHtmlTags(data.epubMetadata?.description || ''),
    isbn: '',
    publisher: '',
    publicationDate: new Date().toISOString().split('T')[0],
    author: {
      name: data.epubMetadata?.author || '',
      description: ''
    },
    license: 'All Rights Reserved',
    contentFingerprints: [],
    downloadableUrls: [],
    coverUrl: data.epubMetadata?.thumbnailArweaveId
      ? `ar://${data.epubMetadata.thumbnailArweaveId}`
      : '',
    language: formatLanguage(data.epubMetadata?.language || 'zh'),
    tags: data.epubMetadata?.tags || []
  }

  baseData.downloadableUrls = data.fileRecords
    .filter(r => r.fileType === 'application/pdf' || r.fileType === 'application/epub+zip')
    .map(file => ({
      url: file.arweaveKey ? file.arweaveLink : `ar://${file.arweaveId}`,
      type: getFileType(file.fileType),
      fileName: file.fileName
    }))

  baseData.contentFingerprints = [
    ...new Set(
      data.fileRecords
        .map((r) => {
          const arweaveUrl = r.arweaveKey
            ? r.arweaveLink
            : `ar://${r.arweaveId}`
          return r.fileType === 'application/epub+zip' || r.fileType === 'application/pdf'
            ? arweaveUrl
            : `ar://${r.arweaveId}`
        })
        .filter(Boolean)
    )
  ].map(url => ({ url }))

  return baseData
}

const onSubmit = async (): Promise<void> => {
  uploadStatus.value = 'checking'

  if (!isFormValid.value) {
    showErrorToast(formError.value.join(', '))
    return
  }
  if (
    iscnFormData.value.contentFingerprints.length
  ) {
    await submitToISCN()
  }
}

const submitToISCN = async (): Promise<void> => {
  uploadStatus.value = 'loading'
  await validateWalletConsistency()

  if (!wallet.value || !signer.value) {
    error.value = 'MISSING_SIGNER'
    uploadStatus.value = ''
    return
  }

  try {
    uploadStatus.value = 'signing'
    const contentMetadata = formatISCNTxPayload(payload.value)
    const metadata = {
      name: contentMetadata.name,
      description: contentMetadata.description,
      ...contentMetadata,
      symbol: 'BOOK',
      image: contentMetadata?.thumbnailUrl || '',
      external_link: contentMetadata?.url || '',
      nft_meta_collection_id: 'nft_book',
      nft_meta_collection_name: 'NFT Book',
      nft_meta_collection_description: 'NFT Book by Liker Land',
      recordTimestamp: new Date().toISOString()
    }
    const salt = computeISCNSalt(wallet.value)

    const txParams = {
      address: LIKE_NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: LIKE_NFT_ABI,
      functionName: 'newBookNFT' as const,
      args: [
        salt,
        {
          creator: wallet.value,
          updaters: [wallet.value, LIKE_EVM_NFT_TARGET_ADDRESS],
          minters: [wallet.value, LIKE_EVM_NFT_TARGET_ADDRESS],
          config: {
            name: metadata.name,
            symbol: 'BOOK',
            metadata: JSON.stringify(metadata),
            max_supply: DEFAULT_MAX_SUPPLY
          }
        },
        500
      ]
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value,
      ...txParams
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash })
    // eslint-disable-next-line no-console
    console.log(receipt)
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    if (!receipt.logs?.[0]?.address) { throw new Error('INVALID_CLASS_ID') }
    const classId = receipt.logs[0].address
    uploadStatus.value = 'success'
    emit('submit', {
      iscnId: classId,
      txHash
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    showErrorToast(`'SIGNING_ERROR':${err as string}`)
    uploadStatus.value = ''
  } finally {
    uploadStatus.value = ''
  }
}

defineExpose({
  onSubmit
})
</script>

<style scoped>
.grid {
  @apply w-full;
}
</style>
