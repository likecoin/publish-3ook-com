<template>
  <UCard
    :ui="{
      header: 'flex justify-between items-center',
      body: 'p-4',
    }"
  >
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('status_page.book_details_title')"
      />
      <UButton
        v-if="!isEditing"
        icon="i-heroicons-pencil-square"
        variant="outline"
        :label="$t('common.edit')"
        :disabled="isISCNLoading"
        @click="isEditing = true"
      />
      <div
        v-else
        class="flex gap-2"
      >
        <UButton
          variant="outline"
          color="neutral"
          :label="$t('status_page.cancel_edit')"
          :disabled="isSaving"
          @click="handleCancel"
        />
        <UButton
          :label="$t('common.save')"
          :loading="isSaving"
          :disabled="isSaving"
          @click="handleSave"
        />
      </div>
    </template>

    <UProgress
      v-if="isISCNLoading"
      animation="carousel"
      color="primary"
      class="w-full"
    />

    <!-- Read-only combined view: on-chain metadata + listing settings -->
    <div
      v-else-if="!isEditing"
      class="flex flex-col gap-6 text-left"
    >
      <dl class="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-6 gap-y-2 text-sm">
        <template
          v-for="row in readOnlyRows"
          :key="row.label"
        >
          <dt
            class="text-gray-500"
            v-text="row.label"
          />
          <dd
            class="text-gray-700 whitespace-pre-wrap break-words"
            :class="row.mono ? 'font-mono' : ''"
            v-text="row.value || '—'"
          />
        </template>
      </dl>
    </div>

    <!-- Edit mode: one form, smart save (chain tx and/or settings POST) -->
    <div
      v-else
      class="flex flex-col gap-6 text-left"
    >
      <ISCNForm
        ref="iscnFormRef"
        v-model="iscnFormData"
        :show-description-full="false"
      />

      <h4
        class="font-bold font-mono"
        v-text="$t('nft_book_form.sale_settings')"
      />

      <BookSettingsFields
        v-model:is-adult-only="isAdultOnly"
        v-model:hide-audio="hideAudio"
        v-model:is-plus-reading-enabled="isPlusReadingEnabled"
        :is-free-book="isFreeBook"
      />

      <ToggleTextarea
        v-model="descriptionFull"
        :label="$t('iscn_form.description_full')"
        :toggle-label="$t('iscn_form.enable_description_full')"
        :placeholder="$t('iscn_form.enter_iscn_description_full', { maxLength: MAX_DESCRIPTION_FULL_LENGTH })"
        :max-length="MAX_DESCRIPTION_FULL_LENGTH"
      />

      <UFormField :label="$t('form.table_of_content')">
        <UTextarea
          v-model="tableOfContents"
          :rows="8"
          placeholder="- Chapter 1&#10;- Chapter 2&#10;  - Section 2.1"
        />
      </UFormField>

      <!-- Share sales data (moderator wallets) -->
      <UCard
        :ui="{
          header: 'flex justify-between items-center',
          body: 'space-y-8 p-0',
        }"
      >
        <template #header>
          <h4
            class="text-sm font-bold font-mono"
            v-text="$t('form.share_sales_data')"
          />
          <div class="flex gap-2">
            <UInput
              v-model="moderatorWalletInput"
              class="font-mono"
              placeholder="0x..."
            />
            <UButton
              :label="$t('common.add')"
              :variant="moderatorWalletInput ? 'outline' : 'solid'"
              :color="moderatorWalletInput ? 'primary' : 'neutral'"
              :disabled="!moderatorWalletInput"
              @click="addModeratorWallet"
            />
          </div>
        </template>
        <UTable
          :columns="moderatorWalletsTableColumns"
          :data="moderatorWalletsTableRows"
        >
          <template #wallet-cell="{ row }">
            <UTooltip :text="row.original.wallet">
              <UButton
                class="font-mono"
                :label="row.original.shortenWallet"
                :to="row.original.walletLink"
                variant="link"

                size="xs"
              />
            </UTooltip>
          </template>
          <template #remove-cell="{ row }">
            <div class="flex justify-end items-center">
              <UButton
                icon="i-heroicons-x-mark"
                variant="soft"
                color="error"
                @click="() => { moderatorWallets.splice(row.original.index, 1) }"
              />
            </div>
          </template>
        </UTable>
      </UCard>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { getPortfolioURL } from '~/utils'
import type { ClassListingData } from '~/types'
import type { ISCNFormData, ClassMetadata } from '~/types/iscn'
import type ISCNForm from '~/components/ISCNForm.vue'
import { MAX_DESCRIPTION_FULL_LENGTH } from '~/constant/index'
import { isContentFingerprintEncrypted, createEmptyISCNFormData } from '~/utils/iscn'

const { t: $t } = useI18n()
const { showSuccessToast, showInfoToast, showErrorToast } = useToastComposable()

const bookstoreApiStore = useBookstoreApiStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { updateBookListingSetting } = bookstoreApiStore
const { loadClassMetadataIntoForm, saveClassMetadata } = useNFTClassUpdater()

const { classId, classListingInfo } = defineProps<{
  classId: string
  classListingInfo: ClassListingData
}>()

const emit = defineEmits<{ saved: [] }>()

const isEditing = ref(false)
const isISCNLoading = ref(false)
const isSaving = ref(false)
const iscnFormRef = ref<InstanceType<typeof ISCNForm> | null>(null)

// On-chain metadata form state; seed one empty URL row for the edit form.
const iscnFormData = ref<ISCNFormData>(createEmptyISCNFormData({
  contentFingerprints: [{ url: '' }],
  downloadableUrls: [{ url: '', type: '', fileName: '' }],
}))
const iscnChainData = ref({} as ClassMetadata)
const { payload } = useISCN({ iscnFormData, iscnChainData })

const isFreeBook = computed(() => (classListingInfo.prices || []).some(p => Number(p.price) === 0))

// Listing-owned fields (REST /settings)
const {
  isAdultOnly,
  hideAudio,
  hideDownload,
  isPlusReadingEnabled,
  descriptionFull,
  tableOfContents,
  moderatorWallets,
  isListingSettingsDirty,
  commitListingSnapshot,
  restoreListingFromSnapshot,
  buildSettingsPayload,
} = useBookListingSettings({
  classListingInfo: () => classListingInfo,
  isFreeBook,
})
const moderatorWalletInput = ref('')

const userIsOwner = computed(() => sessionWallet.value && classListingInfo.ownerWallet === sessionWallet.value)

const moderatorWalletsTableColumns = computed(() => {
  const columns = [{ accessorKey: 'wallet', header: $t('table.wallet') }]

  if (userIsOwner.value) {
    columns.push(
      { accessorKey: 'remove', header: '' },
    )
  }

  return columns
})

const moderatorWalletsTableRows = computed(() => moderatorWallets.value.map((wallet, index) => {
  return {
    index,
    wallet,
    shortenWallet: shortenWalletAddress(wallet),
    walletLink: getPortfolioURL(wallet),
  }
}))

const readOnlyRows = computed(() => [
  { label: $t('common.title'), value: iscnFormData.value.title },
  { label: $t('iscn_form.subtitle'), value: iscnFormData.value.alternativeHeadline },
  { label: $t('common.description'), value: iscnFormData.value.description },
  { label: $t('iscn_form.author_name'), value: iscnFormData.value.author.name },
  { label: $t('form.publisher'), value: iscnFormData.value.publisher.name },
  { label: $t('form.isbn'), value: iscnFormData.value.isbn },
  { label: $t('form.publication_date'), value: iscnFormData.value.publicationDate },
  { label: $t('form.language'), value: iscnFormData.value.language },
  { label: $t('form.genre'), value: iscnFormData.value.genre },
  { label: $t('iscn_form.license'), value: iscnFormData.value.license },
  { label: $t('form.cover_image'), value: iscnFormData.value.coverUrl, mono: true },
  {
    label: $t('nft_book_form.is_adult_only'),
    value: isAdultOnly.value ? $t('status_page.value_yes') : $t('status_page.value_no'),
  },
  {
    label: $t('nft_book_form.ai_audio'),
    value: hideAudio.value ? $t('nft_book_form.ai_audio_forbid') : $t('nft_book_form.ai_audio_allow'),
  },
  {
    label: $t('nft_book_form.plus_reading'),
    value: isPlusReadingEnabled.value ? $t('nft_book_form.plus_reading_join') : $t('nft_book_form.plus_reading_skip'),
  },
  { label: $t('iscn_form.description_full'), value: descriptionFull.value },
  { label: $t('form.table_of_content'), value: tableOfContents.value },
  {
    label: $t('form.share_sales_data'),
    value: moderatorWallets.value.map(shortenWalletAddress).join('\n'),
    mono: true,
  },
])

async function loadChainMetadata() {
  try {
    isISCNLoading.value = true
    const loaded = await loadClassMetadataIntoForm(classId)
    if (loaded) {
      iscnFormData.value = loaded.formData
      iscnChainData.value = loaded.chainData
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching ISCN data:', error)
  }
  finally {
    isISCNLoading.value = false
  }
}

watch(() => classId, () => {
  if (classId) {
    loadChainMetadata()
  }
}, { immediate: true })

function addModeratorWallet() {
  if (!moderatorWalletInput.value) { return }
  moderatorWallets.value.push(moderatorWalletInput.value)
  moderatorWalletInput.value = ''
}

async function handleCancel() {
  // Discard edits: reload chain form from (cached) metadata and restore the
  // listing fields from the last saved snapshot.
  await loadChainMetadata()
  restoreListingFromSnapshot()
  moderatorWalletInput.value = ''
  isEditing.value = false
}

async function handleSave() {
  try {
    if (moderatorWalletInput.value) {
      throw new Error($t('errors.add_moderator_wallet'))
    }
    isSaving.value = true

    // Decide both dirty states up-front: chain tx only if on-chain fields
    // changed, settings POST only if listing fields changed.
    const isChainDirty = !!iscnFormRef.value?.hasUnsavedChanges
    let isListingDirty = isListingSettingsDirty()

    if (!isChainDirty && !isListingDirty) {
      showInfoToast($t('status_page.no_changes'))
      isEditing.value = false
      return
    }

    if (isChainDirty) {
      // Inline errors + toast + scroll are handled by the form itself.
      if (!(await iscnFormRef.value?.validate())) {
        return
      }
      const { metadata } = await saveClassMetadata(classId, payload.value)
      useLogEvent('iscn_metadata_updated', { class_id: classId })
      iscnFormRef.value?.resetSnapshot()
      // Fingerprints may have switched between encrypted and open; keep the
      // listing's hideDownload in sync within the same settings POST.
      const contentFingerprints = metadata.contentFingerprints as string[] | undefined
      if (contentFingerprints) {
        const shouldHideDownload = isContentFingerprintEncrypted(contentFingerprints)
        if (shouldHideDownload !== hideDownload.value) {
          hideDownload.value = shouldHideDownload
          isListingDirty = true
        }
      }
    }

    if (isListingDirty) {
      await updateBookListingSetting(classId, buildSettingsPayload())
      commitListingSnapshot()
    }

    showSuccessToast($t('status_page.settings_saved'))
    isEditing.value = false
    emit('saved')
  }
  catch (err) {
    const errorData = (err as { data?: string }).data || err
    // eslint-disable-next-line no-console
    console.error(errorData)
    showErrorToast(String(errorData), { duration: 5000 })
  }
  finally {
    isSaving.value = false
  }
}
</script>
