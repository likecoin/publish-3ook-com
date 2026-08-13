<template>
  <div class="flex flex-col gap-[16px] text-left">
    <UCard>
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.files_title')"
        />
      </template>

      <UProgress
        v-if="isLoading"
        animation="carousel"
        color="primary"
        class="w-full"
      />

      <div
        v-else
        class="flex gap-6"
      >
        <!-- The cover is a file like the others, so it lives in the file list
             rather than as an ar:// string typed into 書籍資料. Dropping an
             image here is the only way to change it. -->
        <!-- w-fit beats the app-wide `formField.root: w-full`, which in a flex
             row would give the cover the whole width and squeeze the file list
             down to a filename broken mid-word. -->
        <UFormField
          class="w-fit shrink-0"
          :label="$t('form.cover_image')"
          :error="coverError"
        >
          <div
            class="flex flex-col gap-2 items-start rounded-lg p-3 transition-colors"
            :class="coverDropzoneClass"
            @dragover.prevent="isDraggingCover = true"
            @dragleave="isDraggingCover = false"
            @drop.prevent="handleCoverDrop"
          >
            <BookCoverThumbnail
              :src="coverSrc"
              size="lg"
            />
            <p
              class="text-xs text-muted break-all max-w-[120px]"
              v-text="coverMeta"
            />
            <UButton
              v-if="canEdit"
              size="xs"
              variant="soft"
              icon="i-heroicons-arrow-up-tray"
              :loading="isUploadingCover"
              :label="$t('publish_cover.replace')"
              @click="coverInput?.click()"
            />
            <UBadge
              v-if="pendingCover"
              color="warning"
              variant="subtle"
              size="sm"
              :label="$t('status_page.pending_save')"
            />
            <input
              ref="coverInput"
              type="file"
              :accept="COVER_ACCEPT_ATTRIBUTE"
              class="hidden"
              @change="handleCoverPick"
            >
          </div>
        </UFormField>

        <div class="grow min-w-0 self-start flex flex-col items-start gap-3">
          <ul
            v-if="displayedFileRows.length"
            class="w-full space-y-2"
          >
            <!-- Keyed by index, like the drawer's own rows: a URL is editable
                 there, so keying by it would rebuild the row on every keystroke
                 and collide the moment two rows read the same. -->
            <li
              v-for="(file, index) in displayedFileRows"
              :key="index"
              class="flex items-center gap-3 text-sm"
            >
              <UBadge
                variant="soft"
                color="neutral"
                size="xs"
                class="uppercase"
              >
                {{ file.type || '?' }}
              </UBadge>
              <span
                class="font-medium text-highlighted break-all"
                v-text="file.fileName || file.url"
              />
              <UBadge
                v-if="file.isPending"
                color="warning"
                variant="subtle"
                size="sm"
                :label="$t('status_page.pending_save')"
              />
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
            v-text="'—'"
          />
          <UButton
            v-if="canEdit"
            size="xs"
            variant="soft"
            icon="i-heroicons-arrow-up-tray"
            :label="$t('status_page.replace_book_file')"
            @click="isReplaceModalOpen = true"
          />
          <p
            v-if="fileLinksError"
            class="text-sm text-error"
            v-text="fileLinksError"
          />
        </div>
      </div>
    </UCard>

    <UModal
      v-model:open="isReplaceModalOpen"
      :dismissible="false"
      class="w-full max-w-[80vw]"
    >
      <template #header>
        <h2
          class="font-bold font-mono"
          v-text="$t('status_page.replace_book_file')"
        />
      </template>
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :description="soldCount > 0
              ? $t('status_page.replace_book_file_warning', { count: soldCount })
              : $t('status_page.replace_book_file_warning_none')"
          />
          <UploadForm
            ref="uploadFormRef"
            :key="replaceFormKey"
            v-model:encrypt-ebook="encryptEbook"
            :require-cover="false"
            @file-upload-status="(status: string) => (uploadStatus = status)"
            @file-ready="(records: FileRecord[]) => (pickedRecords = records)"
            @submit="handleReplacementUploaded"
          />
        </div>
      </template>
      <template #footer>
        <div class="w-full flex justify-center items-center gap-2">
          <UButton
            color="neutral"
            variant="soft"
            :label="$t('common.cancel')"
            @click="isReplaceModalOpen = false"
          />
          <UButton
            color="primary"
            :disabled="!hasPickedEbook || !!uploadStatus"
            :label="$t('iscn_form.confirm_upload')"
            @click="startReplacementUpload"
          />
        </div>
      </template>
    </UModal>

    <!-- Collapsed: identifiers are what an author needs when something has
         gone wrong and support asks for them, never while publishing. -->
    <UCard v-if="!isLoading">
      <UCollapsible v-model:open="isTechnicalOpen">
        <UButton
          variant="link"
          color="neutral"
          class="px-0"
          :label="$t('status_page.technical_details')"
          :trailing-icon="isTechnicalOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        />
        <template #content>
          <dl class="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2 pt-4 text-sm">
            <template
              v-for="row in technicalRows"
              :key="row.label"
            >
              <dt
                class="text-muted"
                v-text="row.label"
              />
              <dd class="flex items-start gap-2 min-w-0">
                <span
                  class="font-mono text-xs break-all whitespace-pre-line text-highlighted"
                  v-text="row.value || '—'"
                />
                <UButton
                  v-if="row.value"
                  icon="i-heroicons-document-duplicate"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  class="shrink-0"
                  :aria-label="$t('common.copy')"
                  @click="copyToClipboard(row.value)"
                />
              </dd>
            </template>
          </dl>

          <!-- The escape hatch the replacement flow cannot serve: a URL that
               has to be repaired by hand when support asks for it. -->
          <IscnFileLinksFields
            v-if="canEdit && fileLinks"
            class="pt-4"
            :links="fileLinks"
          />
        </template>
      </UCollapsible>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import type { FileRecord } from '~/types'
import { copyToClipboard, formatBytes, parseImageURLFromMetadata } from '~/utils'
import { isContentFingerprintEncrypted } from '~/utils/iscn'
import { buildIscnLinksFromFileRecords } from '~/utils/iscnLinks'
import type { IscnFileLinks, IscnFileLinksContext } from '~/utils/iscnFileLinks'
import { COVER_ACCEPT_ATTRIBUTE, EBOOK_FILE_TYPES } from '~/constant'

const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()
const { uploadFileRecordsToArweave } = useArweaveUpload()
const { showErrorToast } = useToastComposable()
const { takeImageFile, takeDroppedImageFile } = useImageFilePick()

const { classId, canEdit = false, coverError = '', fileLinksError = '', soldCount = 0, fileLinks = null } = defineProps<{
  classId: string
  // Moderators reach this tab too, and nothing here can be saved without the
  // owner's signature — so an upload they make would only strand bytes.
  canEdit?: boolean
  // The save's complaint about the cover, shown where the cover is fixed.
  coverError?: string
  // Same, for a book left with no content URL — 技術資料 below is the fix.
  fileLinksError?: string
  // How many copies a replacement would reach; named in the confirm dialog.
  soldCount?: number
  // The chain form's own file arrays, so the list shows what will be saved
  // rather than what was last fetched, and 技術資料 can edit them in place.
  fileLinks?: IscnFileLinksContext | null
}>()

const emit = defineEmits<{
  coverReplaced: [coverUrl: string]
  filesReplaced: [links: IscnFileLinks]
}>()

const isLoading = ref(false)
const coverUrl = ref('')
const fileRows = ref<{ url: string, type: string, fileName: string }[]>([])
const contentFingerprints = ref<string[]>([])
const isTechnicalOpen = ref(false)

const isReplaceModalOpen = ref(false)
const uploadFormRef = ref<{ onSubmit: () => Promise<void> } | null>(null)
const uploadStatus = ref('')
const pickedRecords = ref<FileRecord[]>([])
const encryptEbook = ref(false)
// Remounts the upload form on close, so a second replacement starts from an
// empty list instead of re-uploading the file the first one already handled.
const replaceFormKey = ref(0)

// The rows that fix this live in the drawer, which is collapsed by default —
// an error pointing at something the author cannot see is only half a message.
watch(() => fileLinksError, (message) => {
  if (message) { isTechnicalOpen.value = true }
})

watch(isReplaceModalOpen, (isOpen) => {
  if (!isOpen) {
    pickedRecords.value = []
    // Back to the book's own tier, not the one an abandoned attempt left behind:
    // the modal opens on what the book already is, every time.
    encryptEbook.value = isContentFingerprintEncrypted(contentFingerprints.value)
    replaceFormKey.value += 1
  }
})

const hasPickedEbook = computed(() => pickedRecords.value.some(
  record => EBOOK_FILE_TYPES.includes(record.fileType || ''),
))

// Prefer the chain form's live arrays over this card's own fetch, so a pending
// replacement — or a row hand-edited in 技術資料 — shows here rather than only
// in the save bar. Anything the last fetch did not carry is unsaved.
const displayedFileRows = computed(() => {
  const rows = fileLinks?.downloadableUrls.value.length ? fileLinks.downloadableUrls.value : fileRows.value
  const savedUrls = new Set(fileRows.value.map(file => file.url))
  return rows
    .filter(row => row.url)
    .map(row => ({ ...row, isPending: !savedUrls.has(row.url) }))
})

const coverInput = ref<HTMLInputElement | null>(null)
const isDraggingCover = ref(false)
const isUploadingCover = ref(false)
const pendingCover = ref<{ file: File, width: number, height: number } | null>(null)
const pendingCoverFile = computed(() => pendingCover.value?.file)
const pendingCoverPreview = useObjectUrl(pendingCoverFile)

const coverSrc = computed(() => (
  pendingCoverPreview.value || parseImageURLFromMetadata(coverUrl.value)
))

// Only a droppable zone looks like one: without the right to replace it, the
// cover is just a picture.
const coverDropzoneClass = computed(() => canEdit && [
  'border border-dashed',
  isDraggingCover.value ? 'border-primary bg-primary/5' : 'border-default',
])

// Only what we actually know: a replacement carries its own name, dimensions
// and size; a cover already on chain is just an id.
const coverMeta = computed(() => {
  const picked = pendingCover.value
  if (picked) {
    return [
      picked.file.name,
      `${picked.width} × ${picked.height}`,
      formatBytes(picked.file.size),
    ].join(' · ')
  }
  return coverUrl.value || '—'
})

// The file and fingerprint rows are read-only here only for a viewer who has no
// editable copy below; showing both to an owner would be the same data twice.
const technicalRows = computed(() => [
  { label: $t('status_page.technical_class_id'), value: classId },
  { label: $t('form.cover_image'), value: coverUrl.value },
  ...(canEdit && fileLinks
    ? []
    : [
        {
          label: $t('publish_review.files_title'),
          value: fileRows.value.map(file => [file.fileName, file.url].filter(Boolean).join(' — ')).join('\n'),
        },
        { label: $t('iscn_form.content_fingerprint'), value: contentFingerprints.value.join('\n') },
      ]),
])

watch(() => classId, async () => {
  if (!classId) { return }
  try {
    isLoading.value = true
    const loaded = await loadClassMetadataIntoForm(classId)
    if (!loaded) { return }
    coverUrl.value = loaded.formData.coverUrl || ''
    fileRows.value = (loaded.formData.downloadableUrls || []).filter(file => file.url)
    contentFingerprints.value = loaded.formData.contentFingerprints
      .map(fingerprint => fingerprint.url)
      .filter(Boolean)
    // Open the replacement modal on the tier the book already has, so keeping
    // it is the default and changing it is the deliberate act.
    encryptEbook.value = isContentFingerprintEncrypted(contentFingerprints.value)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load class metadata for the files tab:', error)
  }
  finally {
    isLoading.value = false
  }
}, { immediate: true })

// Confirmed before the upload rather than before the save: the bar announces
// the audience too, but Arweave is where this stops being reversible.
async function startReplacementUpload() {
  const message = soldCount > 0
    ? $t('status_page.replace_book_file_confirm', { count: soldCount })
    : $t('status_page.replace_book_file_confirm_none')
  if (!window.confirm(message)) { return }
  await uploadFormRef.value?.onSubmit()
}

// Ebook records only, so the cover the upload carried is dropped whole: a
// replacement EPUB brings its own embedded cover, and swapping the author's for
// it silently is not what replacing a file means. Passing the image through
// would also fingerprint a cover this book does not use. The cover has its own
// dropzone above, and its own entry in the save bar.
function handleReplacementUploaded({ fileRecords }: { fileRecords: FileRecord[] }) {
  const ebookRecords = fileRecords.filter(
    record => EBOOK_FILE_TYPES.includes(record.fileType || ''),
  )
  if (!ebookRecords.length) { return }
  const { downloadableUrls, contentFingerprints } = buildIscnLinksFromFileRecords(ebookRecords)
  if (!downloadableUrls.length) { return }
  emit('filesReplaced', { downloadableUrls, contentFingerprints })
  useLogEvent('book_file_replaced', { class_id: classId })
  isReplaceModalOpen.value = false
}

function handleCoverDrop(event: DragEvent) {
  isDraggingCover.value = false
  if (!canEdit) { return }
  const file = takeDroppedImageFile(event)
  if (file) { replaceCover(file) }
}

function handleCoverPick(event: Event) {
  const file = takeImageFile(event)
  if (file) { replaceCover(file) }
}

// Uploads on pick rather than on save, because the chain metadata stores a URL
// and there is nowhere to put the bytes otherwise. Writing coverUrl is what
// joins the pending-changes bar, so the tx still waits for 儲存變更.
async function replaceCover(file: File) {
  isUploadingCover.value = true
  try {
    const { width, height } = await readImageDimensions(file)
    const record: FileRecord = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileBlob: file,
      isGeneratedCover: false,
    }
    await uploadFileRecordsToArweave([record], { encryptEbook: false })
    if (!record.arweaveId) {
      throw new Error('Upload returned no Arweave ID for the cover')
    }
    pendingCover.value = { file, width, height }
    emit('coverReplaced', `ar://${record.arweaveId}`)
    useLogEvent('book_cover_replaced', { class_id: classId })
  }
  catch (error) {
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
    })
  }
  finally {
    isUploadingCover.value = false
  }
}

function readImageDimensions(file: File): Promise<{ width: number, height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    // Dimensions are a readout, not a gate: a file the browser cannot decode
    // still uploads, and the server is what judges it.
    image.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}
</script>
