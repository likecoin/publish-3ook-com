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
    </template>

    <UProgress
      v-if="isISCNLoading"
      animation="carousel"
      color="primary"
      class="w-full"
    />

    <!-- Read-only combined view for moderators: they can see the book they
         moderate but only the owner can sign the class update tx. -->
    <div
      v-else-if="!userIsOwner"
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

    <!-- Owner: fields are always live; the page's pending-changes bar owns
         saving and discarding. -->
    <div
      v-else
      class="flex flex-col gap-6 text-left"
    >
      <ISCNForm
        ref="iscnFormRef"
        v-model="iscnFormData"
        v-model:description-full="descriptionFull"
        :guard-unsaved-changes="false"
      />

      <BookTableOfContentsField v-model="tableOfContents" />

      <!-- Share sales data (moderator wallets) -->
      <UCard
        :ui="{
          header: 'flex justify-between items-center',
          body: 'space-y-8 p-0 sm:p-0',
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
import type { BookListingSettingsContext } from '~/composables/useBookListingSettings'
import { shouldHideDownload, createEmptyISCNFormData } from '~/utils/iscn'
import { mergeIscnFileLinks, type IscnFileLinks, type IscnFileLinksContext } from '~/utils/iscnFileLinks'
import { resolveShortDescription } from '~/utils/description'
import { MAX_DESCRIPTION_LENGTH } from '~/constant'

const { t: $t } = useI18n()

const bookstoreApiStore = useBookstoreApiStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
// The connected wallet, which is what the recent-genre list is keyed on — not
// sessionWallet above, whose address the chips in ISCNForm never read.
const { wallet } = storeToRefs(useWalletStore())
const { loadClassMetadataIntoForm, saveClassMetadata } = useNFTClassUpdater()

const { classId, classListingInfo, settings } = defineProps<{
  classId: string
  classListingInfo: ClassListingData
  // Page-owned: the settings POST echoes every field back, so all tabs must
  // edit the same instance.
  settings: BookListingSettingsContext
}>()

const isISCNLoading = ref(false)
const iscnFormRef = ref<InstanceType<typeof ISCNForm> | null>(null)

// On-chain metadata form state; seed one empty URL row for the edit form.
const iscnFormData = ref<ISCNFormData>(createEmptyISCNFormData({
  contentFingerprints: [{ url: '' }],
  downloadableUrls: [{ url: '', type: '', fileName: '' }],
}))
const iscnChainData = ref({} as ClassMetadata)
const { payload } = useISCN({ iscnFormData, iscnChainData })

// Listing-owned fields (REST /settings), shared with the other tabs.
const {
  hideDownload,
  descriptionFull,
  tableOfContents,
  moderatorWallets,
} = settings
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
  { label: $t('common.description'), value: descriptionFull.value },
  { label: $t('iscn_form.description_short'), value: iscnFormData.value.description },
  { label: $t('iscn_form.author_name'), value: iscnFormData.value.author.name },
  { label: $t('form.publisher'), value: iscnFormData.value.publisher.name },
  { label: $t('form.isbn'), value: iscnFormData.value.isbn },
  { label: $t('form.publication_date'), value: iscnFormData.value.publicationDate },
  { label: $t('form.language'), value: iscnFormData.value.language },
  { label: $t('form.genre'), value: iscnFormData.value.genre },
  { label: $t('iscn_form.license'), value: iscnFormData.value.license },
  { label: $t('form.cover_image'), value: iscnFormData.value.coverUrl, mono: true },
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
    // The form is mounted before the async load lands, so its own mount-time
    // snapshot would be of the empty seed and count everything as changed.
    await nextTick()
    iscnFormRef.value?.resetSnapshot()
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

// The owner branch (and with it the form ref) can mount after the metadata
// already loaded; retake the baseline then too.
watch(iscnFormRef, (form) => {
  if (form && !isISCNLoading.value) {
    nextTick(() => form.resetSnapshot())
  }
})

const coverUrl = computed(() => iscnFormData.value.coverUrl)

// The 書檔 tab owns the cover but not the transaction that writes it, so it
// hands the new URL here, where it joins the rest of the chain diff.
function setCoverUrl(url: string) {
  iscnFormData.value.coverUrl = url
}

// Same hand-off for a replaced book file. Merged rather than assigned: the
// replacement covers one format, and the rest of a published book's files have
// readers depending on them.
function setFiles(incoming: IscnFileLinks) {
  const merged = mergeIscnFileLinks(iscnFormData.value, incoming)
  iscnFormData.value.downloadableUrls = merged.downloadableUrls
  iscnFormData.value.contentFingerprints = merged.contentFingerprints
}

// Handed to 書檔's 技術資料 drawer, which edits the rows in place — they are
// the chain form's own arrays, which is what the pending-changes ledger diffs.
// A stable object of refs, so the drawer keeps working across a metadata reload.
const fileLinks: IscnFileLinksContext = {
  downloadableUrls: computed(() => iscnFormData.value.downloadableUrls),
  contentFingerprints: computed(() => iscnFormData.value.contentFingerprints),
}

function addModeratorWallet() {
  if (!moderatorWalletInput.value) { return }
  moderatorWallets.value.push(moderatorWalletInput.value)
  moderatorWalletInput.value = ''
}

const isChainDirty = computed(() => !!iscnFormRef.value?.hasUnsavedChanges)
const changedFields = computed<string[]>(() => iscnFormRef.value?.changedFields ?? [])
const pendingModeratorInput = computed(() => !!moderatorWalletInput.value)

// The chain half of a save: validates, signs the class update tx, and keeps
// hideDownload in sync with the saved fingerprints (which can re-dirty the
// listing settings — the caller re-checks them after this). Returns false when
// validation failed (the form already showed the errors); throws on tx errors.
async function saveChain(): Promise<boolean> {
  // Same resolution the wizard does at publish: 短簡介 is optional for the
  // author, never optional on chain.
  iscnFormData.value.description = resolveShortDescription(
    iscnFormData.value.description,
    descriptionFull.value,
    MAX_DESCRIPTION_LENGTH,
  )
  if (!(await iscnFormRef.value?.validate())) {
    return false
  }
  const { metadata } = await saveClassMetadata(classId, payload.value)
  useLogEvent('iscn_metadata_updated', { class_id: classId })
  // Same point the wizard records it: a genre written on chain, not one
  // browsed past. A settings-only save never reaches here.
  rememberRecentGenre(wallet.value || '', iscnFormData.value.genre)
  iscnFormRef.value?.resetSnapshot()
  // Fingerprints may have switched between encrypted and open; keep the
  // listing's hideDownload in sync.
  const contentFingerprints = metadata.contentFingerprints as string[] | undefined
  if (contentFingerprints) {
    // No encryptEbook here even now that 書檔 can replace a file: the tier the
    // author picked in that modal is a request, the fingerprints that came back
    // are what the upload actually became.
    const nextHideDownload = shouldHideDownload({ contentFingerprints })
    if (nextHideDownload !== hideDownload.value) {
      hideDownload.value = nextHideDownload
    }
  }
  return true
}

// Discard the chain half: reload from (cached) metadata and retake the
// baseline. The listing half is restored by the page from its own snapshot.
async function discardChain() {
  await loadChainMetadata()
  moderatorWalletInput.value = ''
}

defineExpose({
  isChainDirty,
  changedFields,
  pendingModeratorInput,
  coverUrl,
  setCoverUrl,
  fileLinks,
  setFiles,
  saveChain,
  discardChain,
})
</script>
