<template>
  <PageBody class="flex flex-col items-stretch grow space-y-4">
    <div
      ref="stepTopRef"
      class="w-full"
    >
      <!-- Stepper Navigation -->
      <div class="justify-evenly items-center flex space-x-4 relative">
        <div class="absolute w-full h-px bg-accented top-[50%] left-0 z-[-1]" />
        <button
          v-for="(s, index) in steps"
          :key="s.key"
          type="button"
          class="flex items-center space-x-2 bg-default p-2 rounded-lg"
          :class="index <= maxVisitedStepIndex && !isPublishing ? 'cursor-pointer' : 'cursor-default'"
          :disabled="index > maxVisitedStepIndex || isPublishing"
          @click="goToStep(s.key)"
        >
          <UAvatar
            :size="s.key === step ? 'lg' : 'md'"
            :text="(index + 1).toString()"
            :class="s.key === step ? 'bg-primary/20' : 'bg-accented'"
          />
          <p class="text-sm font-semibold">
            {{ s.title }}
          </p>
        </button>
      </div>

      <!-- Step content. Cards on the page background, one titled section each,
           at the same rhythm as the book page's tab panes: the two screens are
           the same book, so they are read the same way. -->
      <div class="mt-4 space-y-10">
        <!-- One dropzone for everything: the cover is a file like the others,
             and dropping an image is what changes it. -->
        <UCard v-if="step === 'files'">
          <template #header>
            <h3
              class="font-bold font-mono"
              v-text="$t('publish_review.files_title')"
            />
          </template>
          <UploadForm
            ref="uploadFormRef"
            v-model:encrypt-ebook="encryptEbook"
            collect-only
            :show-drm-option="false"
            :initial-file-records="fileRecords"
            @file-ready="handleFileReady"
            @submit="handleFilesCollected"
          />
        </UCard>

        <!-- Same card as the book page's 書籍資料, holding the same two
             components, so the fields keep their surroundings between
             publishing a book and editing it. -->
        <UCard
          v-else-if="step === 'details'"
          :ui="{ body: 'p-4' }"
        >
          <template #header>
            <h3
              class="font-bold font-mono"
              v-text="$t('status_page.book_details_title')"
            />
          </template>
          <div class="text-left flex flex-col gap-6">
            <ISCNForm
              ref="detailsFormRef"
              v-model="iscnFormData"
              v-model:description-full="listingDraft.descriptionFull"
              :guard-unsaved-changes="false"
              :prefilled-fields="prefilledFields"
              :content-excerpt="epubMetadata?.contentExcerpt"
              :table-of-contents="listingDraft.tableOfContents"
            />

            <BookTableOfContentsField v-model="listingDraft.tableOfContents" />
          </div>
        </UCard>

        <div
          v-else-if="step === 'pricing'"
          class="space-y-10"
        >
          <!-- Ahead of pricing: how readers get the file, then what they pay
               for it. The tier stays changeable after publishing; what does not
               is an opened file, which is on Arweave for good. -->
          <UCard>
            <template #header>
              <h3
                class="font-bold font-mono"
                v-text="$t('upload_form.drm_section_title')"
              />
            </template>
            <PublishFileProtectionField v-model="encryptEbook" />
            <p
              class="mt-3 text-xs text-muted"
              v-text="$t('upload_form.drm_section_description')"
            />
          </UCard>

          <PublishPricingForm
            ref="pricingFormRef"
            v-model:prices="listingDraft.prices"
            v-model:signature-image="signatureImage"
            mode="new"
          />

          <!-- Paired with the price above, as 銷售狀態 and 借閱狀態 are paired
               on the book page: the two channels, stated with their
               consequences, before the content flags. -->
          <BookStatusBookLendingStateCard
            v-model="listingDraft.isPlusReadingEnabled"
            can-edit
            :is-free-book="isFreeBook"
          />

          <PublishSaleSettingsCard
            v-model:settings="listingDraft"
            :is-free-book="isFreeBook"
            :epub-spine-items="epubMetadata?.spineItems"
          />
        </div>
        <div
          v-else-if="step === 'review'"
          class="space-y-10"
        >
          <PublishReviewStep
            :file-records="fileRecords"
            :encrypt-ebook="encryptEbook"
            :iscn-form-data="iscnFormData"
            :listing-draft="listingDraft"
            :cover-image-src="coverImageSrc"
            @edit="goToStep"
          />
          <UModal
            v-model:open="isPublishProgressOpen"
            :title="$t('publish_wizard.publishing_title')"
            :description="isPublishing ? $t('publish_wizard.publishing_do_not_close') : undefined"
            :dismissible="!isPublishing"
            :close="!isPublishing"
          >
            <template #body>
              <PublishProgressChecklist
                :status="lastStepStatus"
                :is-failed="isPublishFailed"
                :error-message="publishError"
              />
            </template>
          </UModal>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex gap-2 justify-center mt-4">
          <UButton
            v-if="currentStepIndex > 0"
            variant="outline"
            color="neutral"
            :disabled="isPublishing"
            :label="$t('publish_wizard.back')"
            @click="goToPreviousStep"
          />
          <UButton
            v-if="step !== 'review'"
            :disabled="shouldDisableNext"
            :label="$t('publish_wizard.next')"
            @click="goToNextStep"
          />
          <UButton
            v-else
            :loading="isPublishing"
            :disabled="isPublishing"
            :label="isPublishFailed
              ? $t('publish_wizard.retry_publish')
              : $t('publish_button.publish_now')"
            @click="handlePublish"
          />
        </div>
      </div>
    </div>

    <!-- Resume draft prompt -->
    <UModal
      :open="showResumePrompt"
      :dismissible="false"
    >
      <template #header>
        <h3
          class="font-semibold"
          v-text="$t('publish_wizard.resume_draft_title')"
        />
      </template>
      <template #body>
        <p class="text-sm text-muted">
          {{ pendingSessionNeedsReselect
            ? $t('publish_wizard.resume_draft_description_reselect', { title: pendingSessionTitle })
            : $t('publish_wizard.resume_draft_description', { title: pendingSessionTitle }) }}
        </p>
      </template>
      <template #footer>
        <div class="w-full flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            :label="$t('publish_wizard.start_new')"
            @click="discardDraft"
          />
          <UButton
            color="primary"
            :label="$t('publish_wizard.resume_draft')"
            @click="resumeDraft"
          />
        </div>
      </template>
    </UModal>
  </PageBody>
</template>

<script setup lang="ts">
import { useEventListener, watchDebounced } from '@vueuse/core'
import type { FileRecord, EpubMetadata } from '~/types'
import type { ISCNFormData, ISCNPrefillableField } from '~/types/iscn'
import type {
  PublishBookInput,
  PublishListingDraft,
  PublishSession,
  PublishWizardStep,
} from '~/types/publish'
import { PUBLISH_WIZARD_STEPS, PUBLISH_WIZARD_STEP_LABEL_KEYS } from '~/types/publish'
import { BookUploadStatus } from '~/types/bulk-upload'
import { PREVIEW_PERCENTAGE_DEFAULT, MAX_BOOK_KEYWORDS, MAX_DESCRIPTION_LENGTH } from '~/constant'
import { resolveShortDescription } from '~/utils/description'
import {
  PUBLISH_RESUME_QUERY,
  savePublishSession,
  loadPublishSession,
  updatePublishSession,
  clearPublishDraft,
  getPublishSessionTitle,
  loadPublishDraftFiles,
} from '~/utils/publishSession'
import { validatePriceFormItems, createDefaultPriceFormItem, getPriceItemUSDValue } from '~/utils/listing'
import { createEmptyISCNFormData } from '~/utils/iscn'
import { isRecordUploaded, needsFileReselect, isManualCoverRecord } from '~/utils/arweave'

const { t: $t } = useI18n()

const walletStore = useWalletStore()
const { wallet } = storeToRefs(walletStore)
const route = useRoute()
const localeRoute = useLocaleRoute()
const { showErrorToast } = useToastComposable()
const { stripHtmlTags, formatLanguage } = useFileUploadLocal()
const { publishBook, isProcessing: isPublishing } = usePublishBook()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

const STEP_KEYS = PUBLISH_WIZARD_STEPS

const step = ref<PublishWizardStep>('files')
const maxVisitedStepIndex = ref(0)
const uploadFormRef = ref()
const detailsFormRef = ref()
const pricingFormRef = ref()
const stepTopRef = ref<HTMLElement | null>(null)

// Collected draft state; persisted to localStorage so an accidental tab close
// or browser quit keeps everything except the raw file blobs.
const fileRecords = ref<FileRecord[]>([])
const epubMetadata = ref<EpubMetadata | undefined>()
const encryptEbook = ref(true)
const iscnFormData = ref<ISCNFormData>(createEmptyISCNFormData())
// Fields the uploaded file filled in, so step 2 can ask for a look rather than
// present them as the author's own. Deliberately not persisted: seeding only
// runs on a fresh step 1, and a resumed draft has already been through step 2.
const prefilledFields = ref<ISCNPrefillableField[]>([])
const listingDraft = ref<PublishListingDraft>(createDefaultListingDraft())
const signatureImage = ref<File | null>(null)
// A resumed draft can't restore the signature blob (blobs never persist); this
// remembers that one was set pre-reload so publish prompts for re-selection.
const hadSignatureImage = ref(false)

// Commit checkpoints (survive quit; make a failed publish resumable)
const classId = ref('')
const mintTxHash = ref('')
const skipMint = ref(false)

const lastStepStatus = ref<BookUploadStatus>(BookUploadStatus.PENDING)
const isPublishFailed = ref(false)
const hasPublishStarted = ref(false)
const isPublishProgressOpen = ref(false)
const publishError = ref('')

// Gate persistence until the resume-or-fresh decision is made, so the watcher
// can't overwrite an existing draft with empty initial state.
const isDraftReady = ref(false)
const showResumePrompt = ref(false)
const pendingSession = ref<PublishSession | null>(null)

useSeoMeta({
  title: () => $t('seo_titles.publish_nft_book'),
  ogTitle: () => $t('seo_titles.publish_nft_book'),
})

const steps = computed(() => STEP_KEYS.map(key => ({
  key,
  title: $t(PUBLISH_WIZARD_STEP_LABEL_KEYS[key]),
})))

const currentStepIndex = computed(() => STEP_KEYS.indexOf(step.value))
const pendingSessionTitle = computed(() =>
  (pendingSession.value ? getPublishSessionTitle(pendingSession.value, $t) : ''))
// Bytes recovered from the draft file store, by fileSHA256. Held apart from
// pendingSession because the localStorage draft genuinely has no blobs in it;
// a sibling store owns them.
const restoredFileBlobs = ref<Map<string, Blob>>(new Map())

function restoredBlobFor(record: { fileSHA256?: string }): Blob | undefined {
  return record.fileSHA256 ? restoredFileBlobs.value.get(record.fileSHA256) : undefined
}

// A draft interrupted before its upload step needs the files picked again,
// unless their bytes came back — one interrupted after it never did.
const pendingSessionNeedsReselect = computed(() =>
  (pendingSession.value?.fileRecords ?? []).some(record =>
    !isRecordUploaded(record) && !restoredBlobFor(record)))
const hasFiles = computed(() => fileRecords.value.length > 0)
const shouldDisableNext = computed(() => step.value === 'files' && !hasFiles.value)
// A free price tier (0) always opts the book into Plus all-you-can-read, which
// is why the lending card and the settings card both need to know.
const isFreeBook = computed(() =>
  listingDraft.value.prices.some(p => getPriceItemUSDValue(p) === 0))
const coverImageSrc = computed(() =>
  epubMetadata.value?.coverData
  || fileRecords.value.find(r => r.fileType?.startsWith('image/'))?.fileData
  || '')

function createDefaultListingDraft(): PublishListingDraft {
  return {
    // Seed no price, so an untouched field can't be accidentally saved.
    prices: [createDefaultPriceFormItem({ price: '', name: $t('prices.standard_edition') })],
    isAdultOnly: false,
    hideAudio: false,
    // New titles opt into Plus all-you-can-read by default.
    isPlusReadingEnabled: true,
    // New titles opt into free preview by default.
    isPreviewEnabled: true,
    previewPercentage: PREVIEW_PERCENTAGE_DEFAULT,
    tableOfContents: '',
    descriptionFull: '',
    // No moderator wallet by default: a moderator is owner-equivalent on the
    // book, so who gets that access is the author's call.
    moderatorWallets: [],
    connectedWallets: null,
  }
}

onMounted(async () => {
  useLogEvent('book_publish_started')
  const session = loadPublishSession()
  const legacyClassId = route.query.class_id?.toString() || ''
  const legacyIscnId = route.query.iscn_id?.toString() || ''
  if (session) {
    // Before the prompt renders, so it can say the files are still here rather
    // than announcing a re-selection that turns out not to be needed.
    restoredFileBlobs.value = await loadPublishDraftFiles(session.fileRecords)
    pendingSession.value = session
    // Arriving from the draft row in 我的書籍: that click was the resume
    // decision, so don't ask it again — unless the files need picking again,
    // which the prompt is the only place that says.
    if (route.query.resume === PUBLISH_RESUME_QUERY.resume && !pendingSessionNeedsReselect.value) {
      resumeDraft()
      return
    }
    showResumePrompt.value = true
    return
  }
  // Files with no draft to belong to: a previous session ended without
  // reaching either clear point. Not awaited — nothing below needs it, and
  // this is the common path onto a fresh wizard.
  draftFileStore.clearDraftFiles()
  if (legacyClassId || legacyIscnId) {
    await initFromLegacyQuery(legacyClassId || legacyIscnId, !!legacyClassId)
  }
  isDraftReady.value = true
})

// Legacy pre-redesign deep links: ?iscn_id= means the class exists but is not
// minted; ?class_id= means minting is done too. Prefill the form from chain
// metadata and resume at pricing.
async function initFromLegacyQuery(legacyClassId: string, isMintDone: boolean) {
  classId.value = legacyClassId
  skipMint.value = isMintDone
  try {
    const loaded = await loadClassMetadataIntoForm(legacyClassId)
    if (loaded) {
      iscnFormData.value = loaded.formData
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load class metadata for legacy resume:', error)
  }
  maxVisitedStepIndex.value = STEP_KEYS.length - 1
  step.value = 'pricing'
}

function resumeDraft() {
  const session = pendingSession.value
  if (session) {
    useLogEvent('book_publish_draft_resumed', {
      status: session.status,
      wizard_step: session.wizardStep,
    })
    fileRecords.value = session.fileRecords.map(record => ({
      ...record,
      fileBlob: restoredBlobFor(record),
    }))
    // Already in the store, so the first debounce tick must not put them back.
    restoredFileBlobs.value.forEach((_blob, hash) => persistedFileHashes.add(hash))
    epubMetadata.value = session.epubMetadata
    hydrateCoverPreview()
    encryptEbook.value = session.encryptEbook
    iscnFormData.value = session.iscnFormData
    const draft = { ...createDefaultListingDraft(), ...session.listingDraft }
    // Drafts saved before the price select had a placeholder carry the old -1
    // sentinel; blank is how "not chosen" is spelled now, and only blank opens
    // the select on its placeholder.
    draft.prices = draft.prices.map(p => (Number(p.price) === -1 ? { ...p, price: '' } : p))
    listingDraft.value = draft
    classId.value = session.classId || ''
    mintTxHash.value = session.mintTxHash || ''
    skipMint.value = session.skipMint ?? false
    hadSignatureImage.value = session.hasSignatureImage ?? false
    publishError.value = session.error || ''
    if (session.status !== BookUploadStatus.PENDING) {
      lastStepStatus.value = session.status
      hasPublishStarted.value = true
      isPublishFailed.value = !!session.error
      isPublishProgressOpen.value = true
    }
    maxVisitedStepIndex.value = STEP_KEYS.length - 1
    const resumedStep = STEP_KEYS.find(key => key === session.wizardStep)
    step.value = hasPublishStarted.value ? 'review' : (resumedStep || 'files')
  }
  // The records hold the blobs now; keeping a second reference would pin files
  // the author goes on to delete.
  restoredFileBlobs.value = new Map()
  pendingSession.value = null
  showResumePrompt.value = false
  isDraftReady.value = true
}

// Data URLs are the one thing the draft never carries, so a resumed draft has
// no cover to show and nothing for 復原 to revert to until they are rebuilt.
async function hydrateCoverPreview() {
  const images = fileRecords.value.filter(
    record => record.fileBlob && !record.fileData && record.fileType?.startsWith('image/'),
  )
  await Promise.all(images.map(async (record) => {
    try {
      record.fileData = await fileToDataUrl(record.fileBlob!)
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to rebuild the cover preview:', error)
    }
  }))
  // The author's own cover outranks the one the EPUB supplied, which the
  // positional fallback in coverImageSrc cannot tell apart.
  const cover = fileRecords.value.find(record => isManualCoverRecord(record) && record.fileData)
    || fileRecords.value.find(record => record.fileType?.startsWith('image/') && record.fileData)
  if (epubMetadata.value && !epubMetadata.value.coverData && cover?.fileData) {
    epubMetadata.value.coverData = cover.fileData
  }
}

function discardDraft() {
  useLogEvent('book_publish_draft_discarded', { status: pendingSession.value?.status })
  clearPublishDraft()
  restoredFileBlobs.value = new Map()
  pendingSession.value = null
  showResumePrompt.value = false
  isDraftReady.value = true
}

function serializeDraft(): PublishSession {
  return {
    version: 1,
    status: lastStepStatus.value,
    wizardStep: step.value,
    // Blobs and data-URL previews stay out of localStorage (size/quota). The
    // bytes go to the draft file store instead, keyed by fileSHA256; a record
    // whose blob does not come back is flagged for re-selection.
    fileRecords: fileRecords.value.map(record => ({
      fileName: record.fileName || '',
      fileType: record.fileType || '',
      fileSize: record.fileSize,
      isGeneratedCover: record.isGeneratedCover,
      sourceFileName: record.sourceFileName,
      ipfsHash: record.ipfsHash,
      fileSHA256: record.fileSHA256,
      arweaveId: record.arweaveId,
      arweaveLink: record.arweaveLink,
      arweaveKey: record.arweaveKey,
    })),
    // contentExcerpt is regenerable and large; keep it out of the quota-bound
    // draft like coverData (a resumed draft just suggests without an excerpt).
    epubMetadata: epubMetadata.value
      ? { ...epubMetadata.value, coverData: undefined, contentExcerpt: undefined }
      : undefined,
    encryptEbook: encryptEbook.value,
    iscnFormData: iscnFormData.value,
    listingDraft: listingDraft.value,
    classId: classId.value || undefined,
    mintTxHash: mintTxHash.value || undefined,
    skipMint: skipMint.value || undefined,
    hasSignatureImage: !!signatureImage.value || hadSignatureImage.value || undefined,
    walletAddress: wallet.value || undefined,
    error: publishError.value || undefined,
  }
}

// Written once per blob rather than on every debounce tick: re-putting a 200MB
// EPUB every time an unrelated field changes would be the whole cost of the
// feature for none of the benefit. Session-scoped, which is all it needs to
// be — a reload starts with no blobs to re-save.
const persistedFileHashes = new Set<string>()

function persistDraftFiles() {
  const currentHashes = new Set(
    fileRecords.value.map(record => record.fileSHA256).filter((hash): hash is string => !!hash),
  )
  // Deleting a wrong 200MB EPUB, or replacing a cover, leaves bytes behind
  // that nothing will ever ask for again.
  const stale = [...persistedFileHashes].filter(hash => !currentHashes.has(hash))
  if (stale.length) {
    stale.forEach(hash => persistedFileHashes.delete(hash))
    draftFileStore.deleteDraftFiles(stale)
  }
  fileRecords.value.forEach((record) => {
    const { fileSHA256, fileBlob } = record
    if (!fileSHA256 || !fileBlob || persistedFileHashes.has(fileSHA256)) { return }
    // Marked before the write and left marked on failure: retrying a rejected
    // 200MB put every half second would be worse than the re-select prompt.
    persistedFileHashes.add(fileSHA256)
    draftFileStore.saveDraftFile(fileSHA256, fileBlob)
  })
}

function persistDraft() {
  if (!isDraftReady.value) { return }
  savePublishSession(serializeDraft())
  persistDraftFiles()
}

watchDebounced(
  [fileRecords, epubMetadata, iscnFormData, listingDraft, encryptEbook, signatureImage, step],
  persistDraft,
  { debounce: 500, deep: true },
)

// Losing the tab mid-publish is recoverable (checkpoints persist), but warn
// anyway: an in-flight wallet prompt or upload would be aborted.
useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (isPublishing.value) {
    event.preventDefault()
    // Some browsers still gate the confirmation dialog on returnValue.
    event.returnValue = ''
  }
})

// Mirror the current step into ?step= (pushing history entries) so the
// browser back/forward buttons navigate between steps.
watch(step, (value) => {
  if (route.query.step === value) { return }
  navigateTo(
    localeRoute({ query: { ...route.query, step: value } }),
    // The first sync replaces so back doesn't land on a step-less entry.
    { replace: !route.query.step },
  )
})

// Reset scroll to the top of the wizard on step change. The app scrolls inside
// an overflow container (not the window), so scrollIntoView the top element
// rather than window.scrollTo.
watch(step, async () => {
  await nextTick()
  stepTopRef.value?.scrollIntoView({ block: 'start' })
})

watch(() => route.query.step, (value) => {
  const key = STEP_KEYS.find(k => k === value)
  if (!key || key === step.value) { return }
  // Snap back when the history entry points at a step that isn't reachable
  // (beyond the furthest visited step, or while a publish is running).
  if (isPublishing.value || STEP_KEYS.indexOf(key) > maxVisitedStepIndex.value) {
    navigateTo(localeRoute({ query: { ...route.query, step: step.value } }), { replace: true })
    return
  }
  step.value = key
})

function goToStep(key: string) {
  const index = STEP_KEYS.indexOf(key as PublishWizardStep)
  if (index < 0 || index > maxVisitedStepIndex.value || isPublishing.value) { return }
  step.value = key as PublishWizardStep
}

function goToPreviousStep() {
  const index = currentStepIndex.value
  if (index > 0) {
    step.value = STEP_KEYS[index - 1] as PublishWizardStep
  }
}

async function goToNextStep() {
  if (step.value === 'files') {
    // Collect-only submit: validates and emits, no upload happens here.
    await uploadFormRef.value?.onSubmit()
    return
  }
  if (step.value === 'details' && !(await detailsFormRef.value?.validate())) {
    return
  }
  if (step.value === 'pricing' && !(await validatePricingStep())) {
    return
  }
  advanceStep()
}

function advanceStep() {
  const nextIndex = currentStepIndex.value + 1
  if (nextIndex >= STEP_KEYS.length) { return }
  step.value = STEP_KEYS[nextIndex] as PublishWizardStep
  maxVisitedStepIndex.value = Math.max(maxVisitedStepIndex.value, nextIndex)
}

async function validatePricingStep(): Promise<boolean> {
  // When the pricing form is mounted, UForm surfaces errors inline on the
  // offending fields; the toast fallback covers the review-step publish path.
  if (pricingFormRef.value) {
    return await pricingFormRef.value.validate()
  }
  const errors = validatePriceFormItems(listingDraft.value.prices, $t)
  if (errors.length) {
    showErrorToast(errors.map(e => e.message).join('\n'))
    return false
  }
  return true
}

function handleFileReady(records: FileRecord[], metadata?: EpubMetadata) {
  fileRecords.value = records
  // Not deferred to 下一步: the stepper can jump straight back to 確認, and
  // coverImageSrc reads the cover from here. Merged for the reason
  // handleFilesCollected merges — a cover-only drop hands back a stub.
  if (metadata) {
    epubMetadata.value = { ...epubMetadata.value, ...metadata }
  }
}

function handleFilesCollected(payload: {
  fileRecords: FileRecord[]
  epubMetadata?: EpubMetadata
}) {
  fileRecords.value = payload.fileRecords
  if (payload.epubMetadata) {
    // Merged, not replaced. Returning to step 1 remounts UploadForm with an
    // empty metadata list, so dropping only a cover there hands back a stub
    // carrying just the cover fields — replacing would drop the spine items,
    // excerpt and table of contents the EPUB pass produced.
    epubMetadata.value = { ...epubMetadata.value, ...payload.epubMetadata }
  }
  // No is_encrypted here: the choice is made two steps later, so this would
  // only ever report the default. book_listing_created carries the real value.
  useLogEvent('book_publish_upload_completed', {
    file_count: payload.fileRecords.length,
    has_epub_metadata: !!payload.epubMetadata,
  })
  seedDetailsFromMetadata()
  advanceStep()
}

// Prefill the details step from parsed EPUB metadata, but never overwrite
// what the author already typed.
function seedDetailsFromMetadata() {
  const meta = epubMetadata.value
  if (!meta || iscnFormData.value.title || iscnFormData.value.author.name) { return }
  const description = stripHtmlTags(meta.description || '')
  // A long dc:subject list would otherwise seed the form already over the
  // cap, which the keywords field can only block adds against, not trim.
  const tags = (meta.tags || []).slice(0, MAX_BOOK_KEYWORDS)
  // Into the full description, which is the field the author now writes in.
  // The short one is left empty and derived from this at submit.
  if (description && !listingDraft.value.descriptionFull) {
    listingDraft.value.descriptionFull = description
  }
  iscnFormData.value = {
    ...iscnFormData.value,
    title: meta.title || '',
    publicationDate: new Date().toISOString().split('T')[0] || '',
    author: { name: meta.author ?? '', description: '' },
    language: formatLanguage(meta.language || 'zh'),
    tags,
  }
  // Only what the file actually supplied: publicationDate is today's date and
  // language falls back to zh, so neither is the file speaking.
  const prefilled: ISCNPrefillableField[] = []
  if (meta.title) { prefilled.push('title') }
  if (description) { prefilled.push('descriptionFull') }
  if (meta.author) { prefilled.push('author.name') }
  if (meta.language) { prefilled.push('language') }
  if (tags.length) { prefilled.push('tags') }
  prefilledFields.value = prefilled
  if (meta.tableOfContents && !listingDraft.value.tableOfContents) {
    listingDraft.value.tableOfContents = meta.tableOfContents
  }
}

async function handlePublish() {
  if (isPublishing.value) { return }
  const missingFiles = fileRecords.value.filter(needsFileReselect)
  if (missingFiles.length) {
    showErrorToast($t('publish_wizard.reselect_before_publish', {
      files: missingFiles.map(r => r.fileName).join(', '),
    }))
    return
  }
  // A resumed draft loses the signature blob; remind once so it isn't dropped
  // silently, then clear the flag so publishing without it stays possible.
  if (hadSignatureImage.value && !signatureImage.value) {
    hadSignatureImage.value = false
    persistDraft()
    showErrorToast($t('publish_wizard.reselect_signature'))
    return
  }
  if (!(await validatePricingStep())) { return }
  // The details step is optional to visit — a resumed draft can jump straight
  // to pricing — so nothing else guarantees a description exists. Caught here
  // because publish validates it only after the files have cost upload quota.
  if (!resolveShortDescription(
    iscnFormData.value.description,
    listingDraft.value.descriptionFull,
    MAX_DESCRIPTION_LENGTH,
  )) {
    showErrorToast($t('iscn_form.description_required'))
    goToStep('details')
    return
  }

  isPublishFailed.value = false
  hasPublishStarted.value = true
  publishError.value = ''
  persistDraft()
  isPublishProgressOpen.value = true

  const input: PublishBookInput = {
    fileRecords: fileRecords.value.map(record => ({
      fileName: record.fileName || '',
      fileType: record.fileType || '',
      ipfsHash: record.ipfsHash,
      fileSHA256: record.fileSHA256,
      arweaveId: record.arweaveId,
      arweaveLink: record.arweaveLink,
      arweaveKey: record.arweaveKey,
      fileBlob: record.fileBlob,
    })),
    encryptEbook: encryptEbook.value,
    iscnFormData: iscnFormData.value,
    listingDraft: listingDraft.value,
    signatureImage: signatureImage.value,
    classId: classId.value || undefined,
    mintTxHash: mintTxHash.value || undefined,
    skipMint: skipMint.value,
  }

  const result = await publishBook(input, {
    onStatusChange: (status) => {
      if (status !== BookUploadStatus.FAILED && status !== BookUploadStatus.COMPLETED) {
        lastStepStatus.value = status
        updatePublishSession({ status })
      }
    },
    onProgress: (updates) => {
      if (updates.classId) { classId.value = updates.classId }
      if ('mintTxHash' in updates) { mintTxHash.value = updates.mintTxHash || '' }
      if (updates.fileRecords) {
        // Mirror the pipeline's arweave checkpoints back into the reactive
        // records — otherwise a same-session Retry rebuilds the input without
        // arweaveId and re-uploads (re-paying for encrypted files). The plain
        // records carry no fileBlob, so assigning them leaves each blob intact.
        updates.fileRecords.forEach((rec, i) => {
          const target = fileRecords.value[i]
          if (!target) { return }
          Object.assign(target, rec)
        })
        updatePublishSession({ fileRecords: updates.fileRecords })
        return
      }
      updatePublishSession(updates)
    },
    onError: (error) => {
      publishError.value = error
      updatePublishSession({ error })
    },
  })

  if (result) {
    lastStepStatus.value = BookUploadStatus.COMPLETED
    clearPublishDraft()
    // Here rather than at the picker: this is the point where a genre is known
    // to have been committed, not merely browsed past.
    rememberRecentGenre(wallet.value || '', iscnFormData.value.genre)
    useLogEvent('book_listing_created', {
      class_id: result.classId,
      is_encrypted: encryptEbook.value,
      is_preview_enabled: listingDraft.value.isPreviewEnabled,
      preview_percentage: listingDraft.value.previewPercentage,
    })
    await navigateTo(localeRoute({
      name: 'my-books-status-classId',
      params: { classId: result.classId },
    }))
  }
  else {
    isPublishFailed.value = true
    // lastStepStatus holds the step that was in flight: onStatusChange above
    // filters FAILED out, so it is never overwritten by the failure itself.
    useLogEvent('book_publish_failed', {
      step: lastStepStatus.value,
      error: publishError.value,
      class_id: classId.value || undefined,
    })
    // Reopen for an author who closed the dialog while it was still running.
    isPublishProgressOpen.value = true
  }
}
</script>
