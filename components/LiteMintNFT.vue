<template>
  <div class="flex flex-col items-stretch grow space-y-4">
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="red"
      variant="soft"
      :title="`${error}`"
      :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'red', variant: 'link', padded: false }"
      @close="error = ''"
    />

    <UCard
      class="flex-1"
      :ui="{ body: { base: 'space-y-4' } }"
    >
      <template #header>
        <h3 class="font-bold text-center" v-text="headerText" />
      </template>

      <div class="flex justify-center">
        <UProgress
          v-if="!imagePreviewUrl"
          animation="carousel"
          color="primary"
          class="w-full"
        />
        <img
          v-else
          :src="imagePreviewUrl"
          alt="Cover preview"
          :class="[isRestock ? 'max-w-[150px]' : 'max-w-[300px]', 'object-contain', 'rounded-lg', 'border', 'border-gray-200']"
        >
      </div>

      <UInput
        v-if="isRestock && bookName"
        v-model="formState.mintCount"
        type="number"
        class="w-full max-w-[180px] mx-auto"
        :placeholder="$t('nft.mint_count_placeholder')"
      />

      <div v-if="isLoading && bookName" class="w-full">
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <UBadge variant="soft">
              {{ isRestock ? $t('nft.minting_restock') : $t('nft.minting') }}
            </UBadge>
            <p class="text-xs text-gray-500">
              {{ isRestock ? $t('nft.minting_restock_in_progress',{ count: formState.mintCount }) : $t('nft.minting_in_progress') }}
            </p>
          </div>
          <UProgress
            animation="carousel"
            color="primary"
            class="w-full"
          />
        </div>
      </div>
      <div v-if="shouldShowSubmit" class="flex justify-center">
        <UButton
          :label="bookName ? $t('common.submit') : $t('loading.progress')"
          :loading="isLoading"
          size="lg"
          :disabled="isLoading"
          @click="startNFTMintFlow"
        />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useWriteContract } from '@wagmi/vue'
import { storeToRefs } from 'pinia'
import { NFT_DEFAULT_MINT_AMOUNT, NFT_DEFAULT_RESTOCK_AMOUNT } from '~/constant'

import { useWalletStore } from '~/stores/wallet'
import { useToastComposable } from '~/composables/useToast'

import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'

const { t: $t } = useI18n()
const { writeContractAsync } = useWriteContract()
const {
  getClassOwner,
  getClassMetadata,
  checkNFTClassIsBookNFT,
  getClassCurrentTokenId
} = useNFTContractReader()
const { checkAndGrantMinter, assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()

const store = useWalletStore()
const { wallet } = storeToRefs(store)
const { validateWalletConsistency } = store

const props = defineProps({
  iscnData: {
    type: Object,
    default: null
  },
  shouldShowSubmit: {
    type: Boolean,
    default: true
  },
  iscnId: {
    type: String,
    default: ''
  },
  isRestock: {
    type: Boolean,
    default: false
  },
  restockCount: {
    type: Number,
    default: 0
  }
})

const error = ref('')
const isLoading = ref(false)

const localISCNData = ref<any>(null)
const localISCNId = ref('')

const nftMintListData = ref<any>([])
const nftMintDefaultData = ref<any>(null)

const classId = ref<string>(props.iscnId || '')

const formState = reactive({
  mintCount: NFT_DEFAULT_MINT_AMOUNT,
  imageUrl: '',
  externalUrl: ''
})

const emit = defineEmits(['submit', 'formValidChange'])
const { showErrorToast } = useToastComposable()

const formError = computed(() => {
  const requiredFields = {
    mintCount: formState.mintCount !== undefined,
    imageUrl: !!formState.imageUrl
  }

  return Object.entries(requiredFields)
    .filter(([_, isValid]) => !isValid)
    .map(([key]) => key.toUpperCase())
})

const isFormValid = computed(() => !formError.value?.length)
const bookName = computed(() => localISCNData.value?.contentMetadata?.name || '')

const imagePreviewUrl = computed(() => {
  return parseImageURLFromMetadata(formState.imageUrl)
})

const headerText = computed(() => {
  if (!bookName.value) {
    return $t('nft.minting_loading')
  }
  if (props.isRestock) {
    return bookName.value
  }
  return $t('nft.mint_by_filling_info', { bookName: bookName.value })
})

watch(isFormValid, (val: boolean) => {
  emit('formValidChange', val)
}, { immediate: true })

watch(isLoading, (val: boolean) => {
  if (val) {
    error.value = ''
  }
}, { immediate: true })

watchEffect(async () => {
  if (props.iscnData) {
    localISCNData.value = props.iscnData
    localISCNId.value = props.iscnData['@id']
    formState.imageUrl = props.iscnData.contentMetadata?.thumbnailUrl || ''
    classId.value = props.iscnData['@id']
  } else if (props.iscnId) {
    await fetchISCNById(props.iscnId)
  }
})

watch(isLoading, (newIsLoading: boolean) => {
  if (newIsLoading) { error.value = '' }
})

watch(() => props.isRestock, (isRestock: boolean) => {
  if (isRestock) {
    if (props.restockCount < 0) {
      formState.mintCount = Math.abs(props.restockCount)
    } else {
      formState.mintCount = NFT_DEFAULT_RESTOCK_AMOUNT
    }
  }
}, { immediate: true })

function generateNFTMintListData ({
  nftMintCount,
  imgUrl
}: {
  nftMintCount: number;
  imgUrl: string;
}) {
  const dataRows = []
  for (let i = 0; i < nftMintCount; i++) {
    dataRows.push({
      image: imgUrl,
      metadata: ''
    })
  }
  return dataRows
}

async function startNFTMintFlow () {
  try {
    const { contentMetadata } = localISCNData.value

    if (!isFormValid.value) {
      const missingFields = formError.value.join(', ')
      showErrorToast($t('errors.required_field_missing', { fields: missingFields }))
      return
    }

    isLoading.value = true

    const nftsDefaultData = {
      metadata: {
        name: contentMetadata.name,
        description: contentMetadata.description,
        symbol: 'BOOK',
        ...contentMetadata,
        image: formState.imageUrl,
        external_url: formState.externalUrl
      }
    }

    if (typeof formState.mintCount !== 'number') {
      formState.mintCount = Number(formState.mintCount)
    }

    nftMintDefaultData.value = nftsDefaultData
    nftMintListData.value = generateNFTMintListData({
      nftMintCount: formState.mintCount,
      imgUrl: formState.imageUrl
    })
    formState.mintCount = nftMintListData.value.length

    if (formState.mintCount > 0) {
      await mintNFTs()
    }
    if (classId.value) {
      emit('submit', {
        classId: classId.value,
        nftMintCount: formState.mintCount
      })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast(`${$t('nft.mint_error')}: ${(error as Error).toString()}`)
  } finally {
    isLoading.value = false
  }
}

async function mintNFTs () {
  try {
    isLoading.value = true
    if (!wallet.value) {
      await validateWalletConsistency()
    }
    if (!wallet.value) { return }
    if (!nftMintDefaultData.value) { throw new Error($t('errors.no_mint_data')) }
    const defaultMetadata = nftMintDefaultData.value.metadata
    const nfts = [...Array(formState.mintCount).keys()].map((i) => {
      const {
        image: dataImage,
        metadata: dataMetadataString,
        ...otherData
      } = nftMintListData?.value?.[i] || {}
      const dataMetadata = JSON.parse(dataMetadataString || '{}')
      const data = { ...defaultMetadata, ...dataMetadata }
      if (dataImage) { data.image = dataImage }
      Object.entries(otherData).forEach(([key, value]) => {
        if (value) {
          try {
            data[key] = JSON.parse(value as string)
          } catch (err) {
            data[key] = value
          }
        }
      })
      return {
        id: -1,
        metadata: data
      }
    })
    const fromTokenId = await getClassCurrentTokenId(classId.value)
    const { BOOK3_URL } = useRuntimeConfig().public
    await checkAndGrantMinter({
      classId: classId.value,
      wallet: wallet.value
    })

    const txParams = {
      address: classId.value as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'safeMintWithTokenId' as const,
      args: [
        fromTokenId,
        Array(formState.mintCount).fill(wallet.value),
        Array(formState.mintCount).fill(''),
        nfts.map((nft, index) => JSON.stringify({
          image: nft.metadata.image,
          external_url: `${BOOK3_URL}/store/${classId.value}/${Number(fromTokenId) + index}`,
          description: `Copy #${Number(fromTokenId) + index} of ${nft.metadata.name}`,
          name: `${nft.metadata.name} #${Number(fromTokenId) + index}`,
          attributes: nft.metadata.attributes
        }))
      ]
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value,
      ...txParams
    })

    const res = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: res })
    // eslint-disable-next-line no-console
    console.log(receipt)
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    if (!receipt.logs?.[0]?.topics?.[3]) { throw new Error('INVALID_NFT_ID') }
  } catch (err) {
    throw new Error('MINT_NFT_ERROR:' + (err as Error).toString())
  } finally {
    isLoading.value = false
  }
}

async function fetchISCNById (iscnId: string) {
  isLoading.value = true
  try {
    localISCNId.value = iscnId
    const isBookNFT = await checkNFTClassIsBookNFT(iscnId)
    if (!isBookNFT) {
      throw new Error('Invalid NFT Class ID')
    }
    const [data, owner] = await Promise.all([
      getClassMetadata(iscnId),
      getClassOwner(iscnId)
    ])
    if (!data) {
      throw new Error('Invalid NFT Class ID')
    }
    localISCNData.value = { contentMetadata: data, owner, '@id': iscnId }
    formState.imageUrl = localISCNData.value.contentMetadata?.thumbnailUrl || ''
    formState.externalUrl = localISCNData.value.contentMetadata?.url || ''
    classId.value = iscnId
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

defineExpose({
  startNFTMintFlow
})

</script>
