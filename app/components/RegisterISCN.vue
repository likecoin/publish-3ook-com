<template>
  <div>
    <ISCNForm v-model="iscnFormData" />
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
              {{ $t('notifications.iscn_registration_complete') }}
            </p>
          </div>
          <UProgress
            animation="carousel"
            color="primary"
            class="w-full"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ISCNFormData } from '~/types/iscn'

const walletStore = useWalletStore()

const { wallet, signer } = storeToRefs(walletStore)
const { validateWalletConsistency } = walletStore
const { createNFTClass } = useNFTClassCreator()
const { stripHtmlTags, formatLanguage } = useFileUploadLocal()
const { showErrorToast } = useToastComposable()

const iscnFormData = ref<ISCNFormData>({
  type: 'Book',
  title: '',
  description: '',
  alternativeHeadline: '',
  isbn: '',
  publisher: {
    name: '',
    description: '',
  },
  publicationDate: '',
  author: {
    name: '',
    description: '',
  },
  license: 'All Rights Reserved',
  customLicense: '',
  contentFingerprints: [{ url: '' }],
  downloadableUrls: [{
    url: '',
    type: '',
    fileName: '',
  }],
  language: '',
  bookInfoUrl: '',
  tags: [],
  coverUrl: '',
  genre: '',
})

const uploadStatus = ref('')
const error = ref('')
const emit = defineEmits(['handleSubmit', 'submit', 'formValidChange'])

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
  // descriptionFull is no longer written on-chain; carry the author's input via
  // the bridge so it survives navigation to mint and lands on listing creation.
  const pendingDescriptionFull = getPendingDescriptionFull()
  if (pendingDescriptionFull) {
    iscnFormData.value.descriptionFull = pendingDescriptionFull
  }
})

watch(() => iscnFormData.value.descriptionFull, (value) => {
  setPendingDescriptionFull(value || '')
})

const initializeFromSessionStorage = () => {
  const data = getUploadFileData()
  if (!data) { return null }

  const baseData: ISCNFormData = {
    type: 'Book',
    title: data.epubMetadata?.title || '',
    description: stripHtmlTags(data.epubMetadata?.description || ''),
    isbn: '',
    publisher: {
      name: '',
      description: '',
    },
    publicationDate: new Date().toISOString().split('T')[0] || '',
    author: {
      name: data.epubMetadata?.author ?? '',
      description: '',
    },
    license: 'All Rights Reserved',
    customLicense: '',
    contentFingerprints: [],
    downloadableUrls: [],
    coverUrl: data.epubMetadata?.thumbnailArweaveId
      ? `ar://${data.epubMetadata.thumbnailArweaveId}`
      : '',
    language: formatLanguage(data.epubMetadata?.language || 'zh'),
    bookInfoUrl: '',
    tags: data.epubMetadata?.tags || [],
    genre: '',
  }

  const links = buildIscnLinksFromFileRecords(data.fileRecords)
  baseData.downloadableUrls = links.downloadableUrls
  baseData.contentFingerprints = links.contentFingerprints

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
    const { classId, txHash } = await createNFTClass({ iscnFormData })
    uploadStatus.value = 'success'
    emit('submit', {
      iscnId: classId,
      txHash,
    })
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    showErrorToast(`'SIGNING_ERROR':${err as string}`)
    uploadStatus.value = ''
  }
  finally {
    uploadStatus.value = ''
  }
}

defineExpose({
  onSubmit,
})
</script>

<style scoped>
.grid {
  @apply w-full;
}
</style>
