<template>
  <PageBody class="flex flex-col items-stretch grow space-y-4">
    <div class="w-full">
      <!-- Stepper Navigation -->
      <div class="justify-evenly items-center flex space-x-4 relative">
        <div class="absolute w-full h-px bg-gray-300 top-[50%] left-0 z-[-1]" />
        <button
          v-for="(s, index) in steps"
          :key="s.key"
          type="button"
          class="flex items-center space-x-2 bg-white p-2 rounded-lg"
          :class="index <= maxVisitedStepIndex && !isPublishing ? 'cursor-pointer' : 'cursor-default'"
          :disabled="index > maxVisitedStepIndex || isPublishing"
          @click="goToStep(s.key)"
        >
          <UAvatar
            :size="s.key === step ? 'lg' : 'md'"
            :text="(index + 1).toString()"
            :class="s.key === step ? 'bg-primary-100' : 'bg-gray-200'"
          />
          <p class="text-sm font-semibold">
            {{ s.title }}
          </p>
        </button>
      </div>

      <!-- Step Content -->
      <div class="mt-6 p-4 border rounded-lg bg-gray-100 flex flex-col gap-[24px]">
        <div v-if="step === 'files'">
          <UploadForm
            ref="uploadFormRef"
            collect-only
            :initial-file-records="fileRecords"
            :default-encrypted="encryptEbook"
            @file-ready="handleFileReady"
            @drm-change="(value: boolean) => (encryptEbook = value)"
            @submit="handleFilesCollected"
          />
        </div>
        <div
          v-else-if="step === 'details'"
          class="text-left flex flex-col gap-6"
        >
          <ISCNForm
            v-model="iscnFormData"
            :show-file-fields="false"
            :guard-unsaved-changes="false"
          />
          <!-- Listing-owned but reads as book metadata; collected here with
               the rest of the book details. -->
          <UFormField :label="$t('form.table_of_content')">
            <UTextarea
              v-model="listingDraft.tableOfContents"
              :rows="8"
              placeholder="- Chapter 1&#10;- Chapter 2&#10;  - Section 2.1"
            />
          </UFormField>
        </div>
        <div v-else-if="step === 'pricing'">
          <PublishPricingForm
            v-model:prices="listingDraft.prices"
            v-model:settings="listingDraft"
            v-model:signature-image="signatureImage"
            mode="new"
            :max-editions="MAX_EDITION_COUNT"
          />
        </div>
        <div
          v-else-if="step === 'review'"
          class="flex flex-col gap-[24px]"
        >
          <PublishReviewStep
            :file-records="fileRecords"
            :encrypt-ebook="encryptEbook"
            :iscn-form-data="iscnFormData"
            :listing-draft="listingDraft"
            :cover-image-src="coverImageSrc"
            @edit="goToStep"
          />
          <UCard v-if="isPublishing || hasPublishStarted">
            <template #header>
              <div class="flex justify-between items-center">
                <h3
                  class="font-bold font-mono"
                  v-text="$t('publish_wizard.publishing_title')"
                />
                <p
                  v-if="isPublishing"
                  class="text-xs text-gray-500"
                  v-text="$t('publish_wizard.publishing_do_not_close')"
                />
              </div>
            </template>
            <PublishProgressChecklist
              :status="lastStepStatus"
              :is-failed="isPublishFailed"
              :error-message="publishError"
            />
          </UCard>
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
        <p class="text-sm text-gray-600">
          {{ $t('publish_wizard.resume_draft_description', { title: pendingSessionTitle }) }}
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
import type { ISCNFormData } from '~/types/iscn'
import type {
  PublishBookInput,
  PublishListingDraft,
  PublishSession,
} from '~/types/publish'
import { BookUploadStatus } from '~/types/bulk-upload'
import { DEFAULT_STOCK } from '~/constant'
import {
  savePublishSession,
  loadPublishSession,
  updatePublishSession,
  clearPublishSession,
} from '~/utils/publishSession'
import {
  validatePriceFormItems,
  validateMappedPrices,
  mapPriceFormItemsToPayload,
} from '~/utils/listing'
import { validateISCNForm } from '~/utils/iscn'

const { t: $t } = useI18n()

const MAX_EDITION_COUNT = 2

const walletStore = useWalletStore()
const { wallet } = storeToRefs(walletStore)
const route = useRoute()
const localeRoute = useLocaleRoute()
const { showErrorToast } = useToastComposable()
const { stripHtmlTags, formatLanguage } = useFileUploadLocal()
const { publishBook, isProcessing: isPublishing } = usePublishBook()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

type WizardStep = 'files' | 'details' | 'pricing' | 'review'
const STEP_KEYS: WizardStep[] = ['files', 'details', 'pricing', 'review']

const step = ref<WizardStep>('files')
const maxVisitedStepIndex = ref(0)
const uploadFormRef = ref()

// Collected draft state; persisted to localStorage so an accidental tab close
// or browser quit keeps everything except the raw file blobs.
const fileRecords = ref<FileRecord[]>([])
const epubMetadata = ref<EpubMetadata | undefined>()
const encryptEbook = ref(true)
const sponsored = ref(false)
const iscnFormData = ref<ISCNFormData>(createEmptyISCNFormData())
const listingDraft = ref<PublishListingDraft>(createDefaultListingDraft())
const signatureImage = ref<File | null>(null)

// Commit checkpoints (survive quit; make a failed publish resumable)
const classId = ref('')
const mintTxHash = ref('')
const skipMint = ref(false)

const lastStepStatus = ref<BookUploadStatus>(BookUploadStatus.PENDING)
const isPublishFailed = ref(false)
const hasPublishStarted = ref(false)
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

const steps = computed(() => [
  { key: 'files' as const, title: $t('publish_wizard.step_files') },
  { key: 'details' as const, title: $t('publish_wizard.step_details') },
  { key: 'pricing' as const, title: $t('publish_wizard.step_pricing') },
  { key: 'review' as const, title: $t('publish_wizard.step_review') },
])

const currentStepIndex = computed(() => STEP_KEYS.indexOf(step.value))
const pendingSessionTitle = computed(() =>
  pendingSession.value?.iscnFormData?.title
  || pendingSession.value?.epubMetadata?.title
  || $t('publish_wizard.untitled_draft'))
const hasFiles = computed(() => fileRecords.value.length > 0)
const shouldDisableNext = computed(() => step.value === 'files' && !hasFiles.value)
const coverImageSrc = computed(() =>
  epubMetadata.value?.coverData
  || fileRecords.value.find(r => r.fileType?.startsWith('image/'))?.fileData
  || '')

function createEmptyISCNFormData(): ISCNFormData {
  return {
    type: 'Book',
    title: '',
    description: '',
    descriptionFull: '',
    alternativeHeadline: '',
    isbn: '',
    publisher: { name: '', description: '' },
    publicationDate: '',
    author: { name: '', description: '' },
    license: 'All Rights Reserved',
    customLicense: '',
    contentFingerprints: [],
    downloadableUrls: [],
    language: '',
    bookInfoUrl: '',
    tags: [],
    coverUrl: '',
    genre: '',
  }
}

function createDefaultListingDraft(): PublishListingDraft {
  return {
    prices: [{
      price: '-1',
      deliveryMethod: 'auto',
      autoMemo: '',
      stock: DEFAULT_STOCK,
      name: $t('prices.standard_edition'),
      description: '',
      isAllowCustomPrice: true,
      isListed: true,
      isCustomPricing: false,
      priceUSDInput: '',
      priceHKDInput: '',
      priceTWDInput: '',
    }],
    isAllowCustomPrice: true,
    isAdultOnly: false,
    hideAudio: false,
    // New titles opt into Plus all-you-can-read by default.
    isPlusReadingEnabled: true,
    tableOfContents: '',
    descriptionFull: '',
    moderatorWallets: ['0xa037Feb6508A8C2F93bb19f6721730C45921f2D0'],
    connectedWallets: null,
  }
}

onMounted(async () => {
  useLogEvent('book_publish_started')
  const session = loadPublishSession()
  const legacyClassId = route.query.class_id?.toString() || ''
  const legacyIscnId = route.query.iscn_id?.toString() || ''
  if (session) {
    pendingSession.value = session
    showResumePrompt.value = true
    return
  }
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
    fileRecords.value = session.fileRecords.map(record => ({ ...record }))
    epubMetadata.value = session.epubMetadata
    encryptEbook.value = session.encryptEbook
    sponsored.value = session.sponsored ?? false
    iscnFormData.value = session.iscnFormData
    listingDraft.value = { ...createDefaultListingDraft(), ...session.listingDraft }
    classId.value = session.classId || ''
    mintTxHash.value = session.mintTxHash || ''
    skipMint.value = session.skipMint ?? false
    publishError.value = session.error || ''
    if (session.status !== BookUploadStatus.PENDING) {
      lastStepStatus.value = session.status
      hasPublishStarted.value = true
      isPublishFailed.value = !!session.error
    }
    maxVisitedStepIndex.value = STEP_KEYS.length - 1
    const resumedStep = STEP_KEYS.find(key => key === session.wizardStep)
    step.value = hasPublishStarted.value ? 'review' : (resumedStep || 'files')
  }
  pendingSession.value = null
  showResumePrompt.value = false
  isDraftReady.value = true
}

function discardDraft() {
  clearPublishSession()
  pendingSession.value = null
  showResumePrompt.value = false
  isDraftReady.value = true
}

function serializeDraft(): PublishSession {
  return {
    version: 1,
    status: lastStepStatus.value,
    wizardStep: step.value,
    // Blobs and data-URL previews never persist (size/quota); a resumed file
    // without a blob is flagged for re-selection.
    fileRecords: fileRecords.value.map(record => ({
      fileName: record.fileName || '',
      fileType: record.fileType || '',
      ipfsHash: record.ipfsHash,
      arweaveId: record.arweaveId,
      arweaveLink: record.arweaveLink,
      arweaveKey: record.arweaveKey,
    })),
    epubMetadata: epubMetadata.value
      ? { ...epubMetadata.value, coverData: undefined }
      : undefined,
    encryptEbook: encryptEbook.value,
    sponsored: sponsored.value,
    iscnFormData: iscnFormData.value,
    listingDraft: listingDraft.value,
    classId: classId.value || undefined,
    mintTxHash: mintTxHash.value || undefined,
    skipMint: skipMint.value || undefined,
    walletAddress: wallet.value || undefined,
    error: publishError.value || undefined,
  }
}

function persistDraft() {
  if (!isDraftReady.value) { return }
  savePublishSession(serializeDraft())
}

watchDebounced(
  [fileRecords, iscnFormData, listingDraft, encryptEbook, step],
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
  const index = STEP_KEYS.indexOf(key as WizardStep)
  if (index < 0 || index > maxVisitedStepIndex.value || isPublishing.value) { return }
  step.value = key as WizardStep
}

function goToPreviousStep() {
  const index = currentStepIndex.value
  if (index > 0) {
    step.value = STEP_KEYS[index - 1] as WizardStep
  }
}

async function goToNextStep() {
  if (step.value === 'files') {
    // Collect-only submit: validates and emits, no upload happens here.
    await uploadFormRef.value?.onSubmit()
    return
  }
  if (step.value === 'details') {
    const errors = validateISCNForm(iscnFormData.value, { requireFileUrls: false })
    if (errors.length) {
      showErrorToast(errors.join(', '))
      return
    }
  }
  if (step.value === 'pricing' && !validatePricingStep()) {
    return
  }
  advanceStep()
}

function advanceStep() {
  const nextIndex = currentStepIndex.value + 1
  if (nextIndex >= STEP_KEYS.length) { return }
  step.value = STEP_KEYS[nextIndex] as WizardStep
  maxVisitedStepIndex.value = Math.max(maxVisitedStepIndex.value, nextIndex)
}

function validatePricingStep(): boolean {
  const rawErrors = validatePriceFormItems(listingDraft.value.prices, $t)
  if (rawErrors.length) {
    showErrorToast(rawErrors.map(e => e.message).join('\n'))
    return false
  }
  const mappedErrors = validateMappedPrices(
    mapPriceFormItemsToPayload(listingDraft.value.prices),
    $t,
  )
  if (mappedErrors.length) {
    showErrorToast(mappedErrors.map(e => e.message).join('\n'))
    return false
  }
  return true
}

function handleFileReady(records: FileRecord[]) {
  fileRecords.value = records
}

function handleFilesCollected(payload: {
  fileRecords: FileRecord[]
  epubMetadata?: EpubMetadata
  isEncrypt: boolean
  isSponsored: boolean
}) {
  fileRecords.value = payload.fileRecords
  if (payload.epubMetadata) {
    epubMetadata.value = payload.epubMetadata
  }
  encryptEbook.value = payload.isEncrypt
  sponsored.value = payload.isSponsored
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
  iscnFormData.value = {
    ...iscnFormData.value,
    title: meta.title || '',
    description: stripHtmlTags(meta.description || ''),
    publicationDate: new Date().toISOString().split('T')[0] || '',
    author: { name: meta.author ?? '', description: '' },
    language: formatLanguage(meta.language || 'zh'),
    tags: meta.tags || [],
  }
  if (meta.tableOfContents && !listingDraft.value.tableOfContents) {
    listingDraft.value.tableOfContents = meta.tableOfContents
  }
}

async function handlePublish() {
  if (isPublishing.value) { return }
  const missingFiles = fileRecords.value.filter(r => !r.fileBlob && !r.arweaveId)
  if (missingFiles.length) {
    showErrorToast($t('publish_wizard.reselect_before_publish', {
      files: missingFiles.map(r => r.fileName).join(', '),
    }))
    return
  }
  if (!validatePricingStep()) { return }

  isPublishFailed.value = false
  hasPublishStarted.value = true
  publishError.value = ''
  // descriptionFull is collected on the details step but listing-owned.
  listingDraft.value.descriptionFull = iscnFormData.value.descriptionFull || ''
  persistDraft()

  const input: PublishBookInput = {
    fileRecords: fileRecords.value.map(record => ({
      fileName: record.fileName || '',
      fileType: record.fileType || '',
      ipfsHash: record.ipfsHash,
      arweaveId: record.arweaveId,
      arweaveLink: record.arweaveLink,
      arweaveKey: record.arweaveKey,
      fileBlob: record.fileBlob,
    })),
    encryptEbook: encryptEbook.value,
    sponsored: sponsored.value,
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
        // The pipeline mutates our records in place; persist the checkpoints.
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
    clearPublishSession()
    useLogEvent('book_listing_created', { class_id: result.classId })
    await navigateTo(localeRoute({
      name: 'my-books-status-classId',
      params: { classId: result.classId },
    }))
  }
  else {
    isPublishFailed.value = true
  }
}
</script>
