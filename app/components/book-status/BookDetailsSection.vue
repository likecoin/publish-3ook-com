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
      <!-- Backfills wrote genre and keywords into the bookstore listing, which
           no signature reaches the chain from. Filled in here so the author's
           next save carries them, said out loud so the save is not a surprise. -->
      <UAlert
        v-if="storeSourcedFields.length"
        color="info"
        variant="subtle"
        icon="i-heroicons-building-storefront"
        :title="$t('status_page.store_metadata_staged_title')"
        :description="$t('status_page.store_metadata_staged_description')"
        :actions="[{
          label: $t('status_page.store_metadata_staged_dismiss'),
          color: 'neutral',
          variant: 'outline',
          onClick: dismissStoreMetadata,
        }]"
      />

      <ISCNForm
        ref="iscnFormRef"
        v-model="iscnFormData"
        v-model:description-full="descriptionFull"
        :guard-unsaved-changes="false"
        :store-sourced-fields="storeSourcedFields"
        :store-conflicts="storeConflicts"
        @apply-store-value="applyStoreValue"
      />

      <BookTableOfContentsField v-model="tableOfContents" />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { ClassListingData } from '~/types'
import type { ISCNFormData, ClassMetadata } from '~/types/iscn'
import type ISCNForm from '~/components/ISCNForm.vue'
import type { BookListingSettingsContext } from '~/composables/useBookListingSettings'
import { shouldHideDownload, createEmptyISCNFormData } from '~/utils/iscn'
import { mergeIscnFileLinks, type IscnFileLinks, type IscnFileLinksContext } from '~/utils/iscnFileLinks'
import { resolveShortDescription } from '~/utils/description'
import {
  getStoreMetadataDrift,
  getStoreSourcedFields,
  type StoreMetadataDriftField,
} from '~/utils/store-metadata-drift'
import { MAX_DESCRIPTION_LENGTH, MAX_BOOK_KEYWORDS, BOOK_CATEGORY_VALUES } from '~/constant'

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
} = settings

const userIsOwner = computed(() => sessionWallet.value && classListingInfo.ownerWallet === sessionWallet.value)

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
])

// Values written in from the bookstore listing, and the chain values they
// replaced, so 「不要套用」can put those back without touching anything else.
type StoreMetadataFieldValues = Partial<Record<StoreMetadataDriftField, string | string[]>>
const stagedStoreMetadata = ref<StoreMetadataFieldValues>({})
const chainBaselineForStagedFields = ref<StoreMetadataFieldValues>({})
const isStoreMetadataDismissed = ref(false)
// The form as the chain has it, taken before anything is staged over it. Handed
// to the form as its baseline, so a filled-in value counts as a change no matter
// when the form mounts.
const chainFormSnapshot = ref('')

// Recomputed from the live form, so a conflict the author resolves — by hand or
// with the apply button — stops being one without anything to keep in step.
const storeDrift = computed(() => getStoreMetadataDrift({
  listing: classListingInfo,
  formData: iscnFormData.value,
  genreVocabulary: BOOK_CATEGORY_VALUES,
  maxKeywords: MAX_BOOK_KEYWORDS,
}))

// Moderators reach this page read-only: they can neither apply a store value nor
// sign the tx that would save it, so there is nothing to tell them about.
const storeConflicts = computed(() => (
  isStoreMetadataDismissed.value || !userIsOwner.value ? [] : storeDrift.value.conflicts
))

// Provenance is derived: edit a staged field by hand and it becomes an ordinary
// pending change rather than one attributed to the store.
const storeSourcedFields = computed(() => getStoreSourcedFields(stagedStoreMetadata.value, iscnFormData.value))

// Staged against the chain baseline, which is what turns these into entries in
// the page's pending-changes ledger rather than an invisible edit.
function applyStoreMetadata() {
  stagedStoreMetadata.value = {}
  chainBaselineForStagedFields.value = {}
  if (isStoreMetadataDismissed.value || !userIsOwner.value) { return }
  const { staged } = storeDrift.value
  for (const field of Object.keys(staged) as StoreMetadataDriftField[]) {
    stageStoreValue(field, staged[field])
  }
}

function stageStoreValue(field: StoreMetadataDriftField, value: string | string[] | undefined) {
  if (value === undefined) { return }
  // Copied on both sides: the keywords field edits its array in place, which
  // would otherwise move the staged value and the chain baseline with it — and
  // then a keyword the author added would still read as the store's.
  chainBaselineForStagedFields.value[field] = copyFieldValue(iscnFormData.value[field])
  stagedStoreMetadata.value[field] = copyFieldValue(value)
  writeFormField(field, copyFieldValue(value))
}

function copyFieldValue(value: string | string[]) {
  return Array.isArray(value) ? [...value] : value
}

// Per field rather than an indexed write: the two staged fields hold different
// types, and matching them here is what keeps the staging maps cast-free. Total
// on purpose — a missing value clears the field rather than silently doing
// nothing, which would leave a staged value in place while claiming it was undone.
function writeFormField(field: StoreMetadataDriftField, value: string | string[] | undefined) {
  if (field === 'tags') { iscnFormData.value.tags = Array.isArray(value) ? value : [] }
  else { iscnFormData.value.genre = typeof value === 'string' ? value : '' }
}

// The conflict cases: the author asked for the store's value, so it is staged
// like the filled-in ones and carries the same provenance.
function applyStoreValue(field: StoreMetadataDriftField) {
  const conflict = storeConflicts.value.find(entry => entry.field === field)
  if (conflict) { stageStoreValue(field, conflict.storeValue) }
}

// Puts the chain values back under every field still holding a staged one.
function unstageStoreMetadata() {
  for (const field of storeSourcedFields.value) {
    writeFormField(field, chainBaselineForStagedFields.value[field])
  }
  stagedStoreMetadata.value = {}
  chainBaselineForStagedFields.value = {}
}

// 「不要套用」: unstage and stop re-offering until the page reloads. Nothing
// persists it — there is no backend field for 「the author declined the store's
// genre」, and a stored refusal would outlive the value it refused.
function dismissStoreMetadata() {
  isStoreMetadataDismissed.value = true
  unstageStoreMetadata()
}

async function loadChainMetadata() {
  // Cleared up front: a failed load leaves the old form in place, and provenance
  // pointing at values from a book that is no longer on screen.
  stagedStoreMetadata.value = {}
  chainBaselineForStagedFields.value = {}
  try {
    isISCNLoading.value = true
    const loaded = await loadClassMetadataIntoForm(classId)
    if (loaded) {
      iscnFormData.value = loaded.formData
      iscnChainData.value = loaded.chainData
    }
    await nextTick()
    chainFormSnapshot.value = JSON.stringify(iscnFormData.value)
    applyStoreMetadata()
    // The form is mounted before the async load lands, so its own mount-time
    // snapshot would be of the empty seed and count everything as changed.
    iscnFormRef.value?.resetSnapshot(chainFormSnapshot.value)
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
    // A refusal belongs to the book it was made on, not to the next one.
    isStoreMetadataDismissed.value = false
    loadChainMetadata()
  }
}, { immediate: true })

// The owner branch (and with it the form ref) mounts once ownership resolves,
// which can be after the metadata loaded. The baseline is the chain snapshot
// either way, so no ordering between this and the form's own reset matters.
watch(iscnFormRef, (form) => {
  if (!form || isISCNLoading.value) { return }
  nextTick(() => {
    form.resetSnapshot(chainFormSnapshot.value)
    // Ownership resolving is also what unblocks staging, so stage now — but only
    // while the form still holds exactly what was loaded, never over an edit.
    // An empty snapshot means the load failed, and there is nothing to stage
    // against; the form would call that unchanged.
    if (chainFormSnapshot.value && !form.hasUnsavedChanges) {
      applyStoreMetadata()
    }
  })
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

// The file URLs the last save wrote, out of the same snapshot the pending-changes
// ledger diffs against, so 書檔's 待儲存 agrees with the save bar rather than with
// a chain re-read that can still be answering with the state the tx replaced.
// Row-level, which `changedFields` cannot be: it only says the array moved.
const savedFileUrls = computed<string[]>(() => {
  if (!chainFormSnapshot.value) { return [] }
  const saved = JSON.parse(chainFormSnapshot.value) as ISCNFormData
  return (saved.downloadableUrls || []).map(row => row.url).filter(Boolean)
})

const isChainDirty = computed(() => !!iscnFormRef.value?.hasUnsavedChanges)
const changedFields = computed<string[]>(() => iscnFormRef.value?.changedFields ?? [])

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
  const savedStoreSourcedFields = storeSourcedFields.value
  const { metadata } = await saveClassMetadata(classId, payload.value)
  useLogEvent('iscn_metadata_updated', { class_id: classId })
  // How often the store's backfilled metadata actually reaches the chain, which
  // is the only measure of whether this closes the drift.
  if (savedStoreSourcedFields.length) {
    useLogEvent('book_store_metadata_drift_applied', {
      class_id: classId,
      fields: savedStoreSourcedFields.join(','),
    })
  }
  // On chain now, so no longer the store's proposal.
  stagedStoreMetadata.value = {}
  chainBaselineForStagedFields.value = {}
  // Same point the wizard records it: a genre written on chain, not one
  // browsed past. A settings-only save never reaches here.
  rememberRecentGenre(wallet.value || '', iscnFormData.value.genre)
  // What was just signed is the chain truth now, for this snapshot as much as
  // for the form's baseline — a later remount must not restore the pre-save one.
  chainFormSnapshot.value = JSON.stringify(iscnFormData.value)
  iscnFormRef.value?.resetSnapshot(chainFormSnapshot.value)
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
// Discarding covers the store's proposals too, or the bar could never go clean.
async function discardChain() {
  isStoreMetadataDismissed.value = true
  await loadChainMetadata()
}

defineExpose({
  isChainDirty,
  changedFields,
  storeSourcedFields,
  storeConflicts,
  coverUrl,
  setCoverUrl,
  fileLinks,
  savedFileUrls,
  setFiles,
  saveChain,
  discardChain,
})
</script>
