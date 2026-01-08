<template>
  <UModal :model-value="showOpenModal" :ui="{ width: 'min-w-[80vw]' }">
    <UCard
      :ui="{
        header: { base: 'flex justify-between items-center' },
        body: { base: 'space-y-4' },
        footer: { base: 'flex justify-end items-center' },
      }"
    >
      <template #header>
        <h2 class="font-bold font-mono">
          {{ $t('iscn.metadata_title') }}
        </h2>

        <UButton
          color="gray"
          variant="ghost"
          icon="i-heroicons-x-mark-20-solid"
          class="-my-1"
          @click="handleClickBack"
        />
      </template>
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
      <template #footer>
        <div class="w-full flex justify-center items-center gap-2">
          <UButton color="gray" variant="soft" @click="handleClickBack">
            {{ $t('edit_iscn_modal.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="isSaving"
            @click="handleSave"
          >
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useWriteContract } from '@wagmi/vue'
import { useNftStore } from '~/stores/nft'
import { formatISCNTxPayload, validateISCNForm } from '~/utils/iscn'
import { useWalletStore } from '~/stores/wallet'
import { useISCN } from '~/composables/useISCN'
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
const { checkAndGrantUpdater, assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()
const { getNFTClassConfig } = useNFTContractReader()
const { refreshBookMetadata } = useBookstoreApiStore()

const props = defineProps<{
  classId: string
}>()

const showOpenModal = defineModel<boolean>('modelValue')

const classData = ref({} as any)
const isSaving = ref(false)
const isISCNLoading = ref(false)

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

watchEffect(async () => {
  if (showOpenModal.value && props.classId) {
    try {
      isISCNLoading.value = true
      if (props.classId) {
        classData.value = await nftStore.lazyFetchClassMetadataById(
          props.classId
        )
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
          isbn: metadata.isbn || '',
          publisher: metadata.publisher || '',
          publicationDate: metadata.datePublished || '',
          author: {
            name: metadata.author?.name || metadata.author || '',
            description: metadata.author?.description || ''
          },
          license: metadata.usageInfo || 'All Rights Reserved',
          contentFingerprints: metadata.contentFingerprints.map((url: string) => ({
            url
          })) || [{ url: '' }],
          downloadableUrls,
          customLicense: '',
          language: metadata.inLanguage || '',
          bookInfoUrl: metadata.url || '',
          tags,
          coverUrl: metadata.thumbnailUrl || ''
        }
      }
    } catch (error) {
      console.error('Error fetching ISCN data:', error)
    } finally {
      isISCNLoading.value = false
    }
  }
})

function handleClickBack () {
  showOpenModal.value = false
}

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
      image: contentMetadata?.thumbnailUrl || '',
      external_link: contentMetadata?.url || '',
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

    const txParams = {
      address: props.classId as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'update',
      args: [{
        name: metadata.name,
        symbol: bookConfig.symbol,
        metadata: JSON.stringify(metadata),
        max_supply: DEFAULT_MAX_SUPPLY
      }]
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value,
      ...txParams
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash })
    console.log(receipt)
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    toast.add({
      title: 'ISCN updated successfully',
      color: 'blue'
    })
    await nftStore.fetchClassMetadataById(props.classId)
    await refreshBookMetadata(props.classId)
    emit('iscnUpdated', {
      classId: props.classId,
      metadata
    })
    handleClickBack()
  } catch (error) {
    toast.add({
      title: 'Failed to update ISCN',
      description: (error as Error).message,
      color: 'red'
    })
  } finally {
    isSaving.value = false
  }
}

</script>
