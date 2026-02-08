<template>
  <PageBody>
    <h1 class="text-lg font-bold font-mono">
      Deliver NFT Book "{{ nftClassName || classId }}"
    </h1>

    <UAlert
      v-if="error.message"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="`${error.message}`"
      :actions="error.actions"
      :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
      @close="error = { message: '', actions: [] }"
    />

    <UProgress v-if="isLoading" animation="carousel">
      <template #indicator>
        Loading...
      </template>
    </UProgress>

    <UCard
      v-if="bookstoreApiStore.isAuthenticated"
      :ui="{
        body: 'space-y-6',
        footer: 'flex justify-center gap-2'
      }"
    >
      <UCard :ui="{ body: 'p-0' }">
        <table class="divide-y w-full">
          <tbody>
            <tr>
              <th class="text-left px-4 py-3">
                {{ $t('table.buyer_email') }}
              </th><td class="px-4 py-3">
                {{ orderInfo.email }}
              </td>
            </tr>
            <tr v-if="orderInfo.giftInfo?.toEmail">
              <th class="text-left px-4 py-3">
                {{ $t('table.reader_email') }}
              </th><td class="px-4 py-3">
                {{ orderInfo.giftInfo?.toEmail || orderInfo.email }}
              </td>
            </tr>
            <tr>
              <th class="text-left px-4 py-3">
                {{ $t('table.status') }}
              </th><td class="px-4 py-3">
                {{ orderInfo.status }}
              </td>
            </tr>
            <tr>
              <th class="text-left px-4 py-3">
                Buyer Wallet
              </th><td class="px-4 py-3">
                {{ orderInfo.wallet }}
              </td>
            </tr>
            <tr>
              <th class="text-left px-4 py-3">
                {{ $t('table.price_name') }}
              </th><td class="px-4 py-3">
                {{ orderInfo.priceName }}
              </td>
            </tr>
            <tr>
              <th class="text-left px-4 py-3">
                Price
              </th><td class="px-4 py-3">
                {{ orderInfo.price }}
              </td>
            </tr>
            <tr>
              <th class="text-left px-4 py-3">
                Quantity
              </th><td class="px-4 py-3">
                {{ orderInfo.quantity }}
              </td>
            </tr>
            <tr>
              <th class="text-left px-4 py-3">
                Sales channel
              </th><td class="px-4 py-3">
                {{ orderInfo.from }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <UCard>
        <div class="space-y-2 mb-4">
          <h5 class="text-sm font-bold" v-text="`${$t('nft_book_form.buyer_message')}`" />
          <p v-text="orderInfo.message" />
        </div>

        <UFormField
          :label="$t('nft_book_form.author_message')"
          :error="isLimitReached"
          :hint="`${messageCharCount} / ${AUTHOR_MESSAGE_LIMIT}`"
        >
          <UTextarea
            v-model="memo"
          />
        </UFormField>
      </UCard>

      <UFormField
        :label="$t('form.nft_id_label')"
        class="mb-4"
        :error="nftIdError || validationError || false"
        :help="isNftIdConfirmed && isSingleQuantity ? $t('button.confirmed') : undefined"
        :ui="{ description: 'text-gray-400 dark:text-gray-600', help: 'text-green-500' }"
      >
        <div class="flex flex-wrap items-center justify-center gap-2 w-full">
          <div
            v-if="orderInfo.quantity"
            :class="[orderInfo.quantity > 1 ? 'w-full' : 'grow', 'space-y-1']"
          >
            <UInput
              v-for="i in orderInfo.quantity"
              :key="`nft-id-input-${i}`"
              ref="nftIdInputRef"
              v-model="nftIdInput[i - 1]"
              :disabled="!isSingleQuantity"
              class="font-mono"
            >
              <template v-if="orderInfo.quantity > 1" #leading>
                <span class="text-sm text-gray-400 dark:text-gray-600">#{{ i }}</span>
              </template>
            </UInput>
          </div>
          <UButton
            v-if="isSingleQuantity"
            :label="$t('button.confirm_nft_id')"
            :disabled="isLoading || isVerifyingNFTId || !hasValidNftInput"
            variant="outline"
            :loading="isVerifyingNFTId"
            color="primary"
            @click="handleConfirmNFTId"
          />
          <USeparator v-if="isSingleQuantity" :class="['text-sm text-gray-600', 'sm:w-min']">
            OR
          </USeparator>
          <UButton
            v-if="isSingleQuantity"
            :label="$t('button.check_all_nft_ids')"
            :disabled="isLoading"
            variant="outline"
            @click="onCheckOwnedIds"
          />
        </div>
      </UFormField>

      <PlaceholderCard class="h-[300px]">
        <img
          v-if="nftImage"
          class="max-w-[180px] w-full h-full object-contain"
          alt="preview"
          :src="nftImage"
        >
      </PlaceholderCard>

      <template #footer>
        <UButton
          :label="$t('nft_send.sign_and_send')"
          :disabled="isSendButtonDisabled"
          size="xl"
          @click="onSendNFTStart"
        />
      </template>
    </UCard>
    <UModal v-model:open="showRestockModal">
      <template #content>
        <LiteMintNFT
          :is-restock="true"
          :iscn-id="classId"
          @submit="handleFinishRestock"
        />
      </template>
    </UModal>
  </PageBody>
</template>

<script setup lang="ts">
import { useWriteContract } from '@wagmi/vue'
import { parseImageURLFromMetadata } from '~/utils'
import { AUTHOR_MESSAGE_LIMIT } from '~/constant'
import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'

const { LIKE_CO_API } = useRuntimeConfig().public

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { validateWalletConsistency } = store

const bookstoreApiStore = useBookstoreApiStore()
const { token, wallet: sessionWallet } = storeToRefs(bookstoreApiStore)

const nftStore = useNftStore()
const { lazyFetchClassMetadataById } = nftStore

const route = useRoute()
const localeRoute = useLocaleRoute()

const { writeContractAsync } = useWriteContract()
const { getBalanceOf, getTokenIdByOwnerIndex } = useNFTContractReader()
const { assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()

const { showErrorToast } = useToastComposable()
const error = ref({ message: '', actions: [] as { label: string; variant: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'; color: 'error' | 'primary' | 'neutral'; click: () => void }[] })
const isLoading = ref(false)
const classId = computed(() => route.params.classId as string)
const paymentId = computed(() => route.query.payment_id as string)
const ownerWallet = computed(() => route.query.owner_wallet as string || sessionWallet.value)
const memo = ref($t('nft_book_form.default_memo'))
const { messageCharCount, isLimitReached } = useMessageCharCount(memo, AUTHOR_MESSAGE_LIMIT)
const { getNFTMetadata, getNFTOwner } = useNFTContractReader()

const nftIdInput = ref([] as string[])
const nftIds = ref([] as number[])
const isVerifyingNFTId = ref(false)
const nftIdError = ref<string | false>(false)
const isNftIdConfirmed = ref(false)
const nftIdInputRef = ref<string[] | undefined>(undefined)

interface OrderInfo {
  email?: string
  giftInfo?: { toEmail?: string }
  status?: string
  wallet?: string
  priceName?: string
  price?: number
  quantity?: number
  from?: string
  message?: string
}
const orderInfo = ref<OrderInfo>({})
const nftImage = ref('')

const showRestockModal = ref(false)
const validationError = ref('')

const { NFT_ITEM_URL } = useRuntimeConfig().public
const hasValidNftInput = computed(() => nftIdInput.value.some(id => id.trim() !== ''))
const isSendButtonDisabled = computed(() => isLoading.value || isVerifyingNFTId.value || !!nftIdError.value || isLimitReached.value || !isNftIdConfirmed.value)
const isSingleQuantity = computed(() => orderInfo.value.quantity === 1)

const nftClassName = computed(() => nftStore.getClassMetadataById(classId.value as string)?.name)

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = { message: '', actions: [] } }
})

watch(nftIdInput, (_, oldVal) => {
  if (oldVal && oldVal.length > 0 && isSingleQuantity.value) {
    isNftIdConfirmed.value = false
    validationError.value = ''
    nftIdError.value = false
  }
}, { deep: true })

onMounted(async () => {
  const data = await $fetch(`${LIKE_CO_API}/likernft/book/purchase/${classId.value}/status/${paymentId.value}`,
    {
      headers: {
        authorization: `Bearer ${token.value}`
      }
    })
  orderInfo.value = data as OrderInfo
  lazyFetchClassMetadataById(classId.value as string)
  await fetchNextNFTId(orderInfo.value.quantity || 1)
})

async function handleConfirmNFTId () {
  if (!hasValidNftInput.value) { return }

  try {
    validationError.value = ''
    nftIdError.value = false

    nftIds.value = nftIdInput.value.filter(id => id.trim() !== '').map(id => Number(id))

    if (nftIds.value.includes(0)) {
      validationError.value = $t('error.nft_id_reserved_for_author')
      nftIds.value = []
      return
    }

    const firstNftId = nftIds.value[0]
    if (!firstNftId) {
      validationError.value = $t('error.invalid_nft_id')
      return
    }

    const [metadata, ownerResult] = await Promise.all([
      fetchNFTMetadata(),
      getNFTOwner(classId.value, firstNftId)
    ])
    const owner = ownerResult as string
    if (!metadata || owner !== sessionWallet.value) {
      validationError.value = $t('error.fetch_nft_metadata_failed')
      nftIds.value = []
      return
    }

    isNftIdConfirmed.value = true
  } catch (err) {
    validationError.value = (err as Error).message
    nftIds.value = []
    isNftIdConfirmed.value = false
  }
}

async function fetchNFTMetadata () {
  try {
    isVerifyingNFTId.value = true
    if (!nftIds.value.length || nftIds.value[0] === undefined) {
      nftImage.value = ''
      return
    }
    try {
      const metadata = await getNFTMetadata(classId.value, nftIds.value[0])
      nftImage.value = parseImageURLFromMetadata(metadata?.image || '')
      return metadata
    } catch (err) {
      nftImage.value = ''
      if ((err as { data?: { code?: number } })?.data?.code === 2) {
        nftIdError.value = 'NFT not found'
      } else {
        nftIdError.value = (err as Error).toString()
      }
    }
  } catch (err) {
    error.value = {
      message: (err as Error).toString(),
      actions: []
    }
    showErrorToast((err as Error).toString())
  } finally {
    isVerifyingNFTId.value = false
  }
}

async function fetchNextNFTId (_count = 1) {
  try {
    nftIds.value = []
    nftIdError.value = false
    if (!wallet.value || !signer.value) {
      await validateWalletConsistency()
    }
    if (!ownerWallet.value) {
      throw new Error('Missing owner wallet')
    }

    const balance = await getBalanceOf(classId.value, ownerWallet.value) as bigint
    if (balance < BigInt(_count)) {
      throw new Error(`No NFTs available for classId: ${classId.value} in wallet: ${ownerWallet.value}`)
    }

    const collected: number[] = []

    for (let idx = 0; idx < Number(balance); idx++) {
      const tokenId = await getTokenIdByOwnerIndex(classId.value, ownerWallet.value, idx)
      if (tokenId !== 0n) {
        collected.push(Number(tokenId))
        if (collected.length >= _count) {
          break
        }
      }
    }

    if (collected.length < _count) {
      throw new Error(`Failed to collect enough available NFTs. Collected ${collected.length}/${_count}`)
    }

    nftIds.value = collected
    nftIdInput.value = collected.map(String)
    isNftIdConfirmed.value = true

    await fetchNFTMetadata()
  } catch (err) {
    const message = (err as Error).toString()
    nftIdError.value = message
    error.value = {
      message,
      actions: [
        {
          label: $t('button.restock_nft'),
          variant: 'outline',
          color: 'error',
          click: () => {
            showRestockModal.value = true
          }
        }
      ]
    }
    showErrorToast(message)
  }
}

function onCheckOwnedIds () {
  window.open(`${NFT_ITEM_URL}/${classId.value}`, '_blank', 'noopener')
}

async function onSendNFTStart () {
  if (isSendButtonDisabled.value) { return }
  try {
    isLoading.value = true
    if (!wallet.value || !signer.value) {
      await validateWalletConsistency()
    }
    if (!wallet.value || !signer.value) { return }
    if (nftIds.value) {
      const owners = await Promise.all(nftIds.value.map((nftId: number) => getNFTOwner(classId.value, nftId)))
      const mismatchNftIdIndex = owners.findIndex(owner => owner !== ownerWallet.value)
      if (mismatchNftIdIndex >= 0) {
        const mismatchNftId = nftIds.value[mismatchNftIdIndex]
        throw new Error(`NFT classId: ${classId.value} nftId:${mismatchNftId} is not owned by sender!`)
      }
    } else {
      await fetchNextNFTId(orderInfo.value.quantity || 1)
    }

    const txParams = {
      address: classId.value as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'batchTransferWithMemo',
      args: [
        wallet.value,
        Array(orderInfo.value.quantity).fill(orderInfo.value.wallet),
        nftIds.value,
        Array(orderInfo.value.quantity).fill(memo.value)
      ]
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value,
      ...txParams
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash })
    if (receipt?.status === 'success') {
      await $fetch(`${LIKE_CO_API}/likernft/book/purchase/${classId.value}/sent/${paymentId.value}`,
        {
          method: 'POST',
          body: {
            txHash,
            quantity: orderInfo.value.quantity || 1
          },
          headers: {
            authorization: `Bearer ${token.value}`
          }
        })

      await navigateTo(localeRoute({
        name: 'my-books-status-classId',
        params: {
          classId: classId.value
        }
      }))
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    error.value = {
      message: (err as Error).toString(),
      actions: []
    }
    showErrorToast((err as Error).toString())
  } finally {
    isLoading.value = false
  }
}

function handleFinishRestock () {
  showRestockModal.value = false
  fetchNextNFTId(orderInfo.value.quantity || 1)
}

</script>
