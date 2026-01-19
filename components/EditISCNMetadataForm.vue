<template>
  <div class="my-4">
    <UProgress
      v-if="isISCNLoading"
      animation="carousel"
      color="primary"
      class="w-full"
    />
    <ISCNForm
      v-else
      v-model="iscnFormData"
    />
    <div class="w-full flex justify-center items-center gap-2 my-4">
      <UButton
        color="primary"
        :loading="isSaving"
        @click="handleSave"
      >
        {{ $t('common.save') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useWriteContract } from '@wagmi/vue'
import type { ISCNFormData } from '~/utils/iscn.type'
import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import { DEFAULT_MAX_SUPPLY } from '~/constant'

// eslint-disable-next-line func-call-spacing
const emit = defineEmits<{
  (e: 'iscnUpdated', payload: { classId: string; metadata: Record<string, any> }): void
}>()

const nftStore = useNftStore()
const toast = useToast()
const walletStore = useWalletStore()
const { wallet, signer } = storeToRefs(walletStore)
const { validateWalletConsistency } = walletStore
const { writeContractAsync } = useWriteContract()
const { checkAndGrantUpdater, waitForTransactionReceipt } = useNFTContractWriter()
const { getNFTClassConfig } = useNFTContractReader()
const { refreshBookMetadata } = useBookstoreApiStore()

const props = defineProps<{
  classId: string
}>()

const classData = ref({} as any)
const isSaving = ref(false)
const isISCNLoading = ref(false)

const iscnFormData = ref<ISCNFormData>({
  type: 'Book',
  title: '',
  description: '',
  descriptionFull: '',
  isbn: '',
  publisher: '',
  publicationDate: '',
  author: {
    name: '',
    description: ''
  },
  license: 'All rights reserved',
  contentFingerprints: [{ url: '' }],
  downloadableUrls: [
    {
      url: '',
      type: '',
      fileName: ''
    }
  ],
  customLicense: '',
  language: '',
  bookInfoUrl: '',
  tags: [],
  coverUrl: ''
})

const iscnChainData = ref({} as any)

const { payload, getFileTypeFromMime } = useISCN({ iscnFormData, iscnChainData })

const formError = computed(() => validateISCNForm(iscnFormData.value))
const isFormValid = computed(() => !formError.value?.length)

watch(
  () => props.classId,
  async (newClassId: string) => {
    if (newClassId) {
      try {
        isISCNLoading.value = true
        classData.value = await nftStore.lazyFetchClassMetadataById(newClassId)
        const metadata = classData.value

        // Parse sameAs URLs into downloadableUrls
        let downloadableUrls = [{
          url: '',
          type: '',
          fileName: ''
        }]
        if (metadata.potentialAction?.target && Array.isArray(metadata.potentialAction.target)) {
          downloadableUrls = metadata.potentialAction.target.map((target: any) => ({
            type: getFileTypeFromMime(target.contentType),
            url: target.url,
            fileName: target.name
          }))
        } else if (metadata.sameAs && Array.isArray(metadata.sameAs)) {
          downloadableUrls = metadata.sameAs.map(parseDownloadableUrl)
        }
        const tags: string[] = []
        if (metadata.keywords) {
          if (Array.isArray(metadata.keywords)) {
            tags.push(...metadata.keywords)
          } else {
            tags.push(...metadata.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k))
          }
        }
        iscnChainData.value = metadata
        iscnFormData.value = {
          ...metadata,
          type: metadata['@type'] || 'Book',
          title: metadata.name || '',
          description: metadata.description || '',
          descriptionFull: metadata.descriptionFull || '',
          isbn: metadata.isbn || '',
          publisher: metadata.publisher || '',
          publicationDate: metadata.datePublished || '',
          author: {
            name: metadata.author?.name || metadata.author || '',
            description: metadata.author?.description || ''
          },
          license: metadata.usageInfo || 'All Rights Reserved',
          contentFingerprints: metadata.contentFingerprints?.map((url: string) => ({
            url
          })) || [{ url: '' }],
          downloadableUrls,
          customLicense: '',
          language: metadata.inLanguage || '',
          bookInfoUrl: metadata.url || '',
          tags,
          coverUrl: metadata.thumbnailUrl || metadata.image || ''
        }
      } catch (error) {
        console.error('Error fetching ISCN data:', error)
      } finally {
        isISCNLoading.value = false
      }
    }
  },
  { immediate: true }
)

function parseDownloadableUrl (url: string) {
  try {
    const urlObj = new URL(url)
    const fileName = urlObj.searchParams.get('name') || ''
    const [name, type] = fileName.split('.')
    return {
      url: url.split('?')[0],
      fileName: name,
      type: type || ''
    }
  } catch (e) {
    return {
      url,
      fileName: '',
      type: ''
    }
  }
}

async function handleSave () {
  await validateWalletConsistency()
  if (!wallet.value || !signer.value) {
    toast.add({
      title: $t('auth.login_required'),
      color: 'red'
    })
    return
  }
  if (!isFormValid.value) {
    toast.add({
      title: formError.value.join(', '),
      color: 'red'
    })
    return
  }
  isSaving.value = true
  try {
    const contentMetadata = formatISCNTxPayload(payload.value)
    const metadata = {
      name: contentMetadata.name,
      description: contentMetadata.description,
      ...contentMetadata,
      symbol: 'BOOK',
      external_link: contentMetadata?.url || '',
      image: contentMetadata?.thumbnailUrl || '',
      nft_meta_collection_id: 'nft_book',
      nft_meta_collection_name: 'NFT Book',
      nft_meta_collection_description: 'NFT Book by Liker Land',
      recordTimestamp: new Date().toISOString()
    }
    const bookConfig = await getNFTClassConfig(props.classId)
    await checkAndGrantUpdater({
      classId: props.classId,
      wallet: wallet.value
    })
    const txHash = await writeContractAsync({
      address: props.classId as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'update',
      args: [{
        name: metadata.name,
        symbol: bookConfig.symbol,
        metadata: JSON.stringify(metadata),
        max_supply: DEFAULT_MAX_SUPPLY
      }]
    })
    const receipt = await waitForTransactionReceipt({ hash: txHash })
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    toast.add({
      title: $t('edit_iscn.update_success'),
      color: 'blue'
    })
    await nftStore.fetchClassMetadataById(props.classId)
    await refreshBookMetadata(props.classId)
    emit('iscnUpdated', {
      classId: props.classId,
      metadata
    })
  } catch (error) {
    toast.add({
      title: $t('edit_iscn.update_failed'),
      description: (error as Error).message,
      color: 'red'
    })
  } finally {
    isSaving.value = false
  }
}

</script>
