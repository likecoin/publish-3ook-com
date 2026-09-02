<template>
  <div class="flex flex-col gap-[16px] text-left">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h3
            class="font-bold font-mono"
            v-text="$t('publish_review.files_title')"
          />
          <UButton
            v-if="canEdit"
            variant="subtle"
            icon="i-heroicons-arrow-path"
            :label="$t('common.replace')"
            @click="isReplaceModalOpen = true"
          />
        </div>
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
        <div class="w-40 shrink-0 flex flex-col items-start gap-2">
          <BookCoverThumbnail
            :src="coverSrc"
            size="lg"
          />
          <!-- No sizing advice here: nothing on this card takes a new cover,
               so the guidance belongs where one is dropped. -->
          <p
            class="text-sm font-semibold"
            v-text="$t('upload_form.file_cover')"
          />
          <UBadge
            v-if="isCoverPending"
            color="warning"
            variant="subtle"
            size="sm"
            :label="$t('status_page.pending_save')"
          />
          <p
            v-if="coverError"
            class="text-sm text-error"
            v-text="coverError"
          />
        </div>

        <div class="grow min-w-0 self-start flex flex-col items-start gap-3">
          <ul
            v-if="coverRow || displayedFileRows.length"
            class="w-full flex flex-col gap-2"
          >
            <!-- The cover is a file like the others, so it gets a row too: the
                 picture beside the list is not the manifest of what is stored. -->
            <li
              v-if="coverRow"
              class="w-full rounded-lg border border-default px-3 py-2 flex items-center gap-3"
            >
              <UIcon
                name="i-heroicons-photo"
                class="shrink-0 w-10 h-10 text-muted"
              />
              <div class="flex items-center gap-2 grow min-w-0">
                <UBadge
                  variant="soft"
                  color="neutral"
                  size="sm"
                  :label="$t('upload_form.file_cover')"
                />
                <UBadge
                  v-if="coverRow.isPending"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  :label="$t('status_page.pending_save')"
                />
              </div>
            </li>

            <!-- Keyed by index, like 技術資料's own rows: a URL is editable
                 there, so keying by it would rebuild the row on every keystroke
                 and collide the moment two rows read the same. -->
            <li
              v-for="(file, index) in displayedFileRows"
              :key="index"
              class="w-full rounded-lg border border-default px-3 py-2 flex items-center gap-3"
            >
              <UIcon
                name="i-heroicons-book-open"
                class="shrink-0 w-10 h-10 text-muted"
              />
              <div class="flex flex-col items-start grow min-w-0">
                <p
                  class="font-semibold text-highlighted break-all"
                  v-text="file.fileName || file.url"
                />
                <div class="mt-1 flex items-center gap-2">
                  <UBadge
                    variant="soft"
                    color="neutral"
                    size="sm"
                    class="uppercase"
                    :label="file.type || '?'"
                  />
                  <UBadge
                    v-if="file.isPending"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    :label="$t('status_page.pending_save')"
                  />
                </div>
              </div>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
            v-text="'—'"
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
      :title="$t('status_page.replace_book_file')"
      :ui="{
        title: 'font-bold font-mono',
        footer: 'block p-0 sm:p-0',
      }"
      class="w-full max-w-5xl"
    >
      <template #body>
        <UploadForm
          ref="uploadFormRef"
          :key="replaceFormKey"
          v-model:encrypt-ebook="encryptEbook"
          :require-cover="false"
          :require-ebook="false"
          @file-upload-status="(status: string) => (uploadStatus = status)"
          @file-ready="(records: FileRecord[]) => (pickedRecords = records)"
          @submit="handleReplacementUploaded"
        >
          <template #alerts>
            <UAlert
              v-if="hasPickedEbook"
              color="warning"
              variant="subtle"
              icon="i-heroicons-exclamation-triangle"
              :description="soldCount > 0
                ? $t('status_page.replace_book_file_warning', { count: soldCount })
                : $t('status_page.replace_book_file_warning_none')"
            />
          </template>
        </UploadForm>
      </template>
      <template #footer>
        <!-- The tier belongs to the book file, so it only asks when one is
           being replaced: a new cover is stored the same way either way. -->
        <PublishFileProtectionField
          v-if="hasPickedEbook"
          v-model="encryptEbook"
          class="p-4 sm:px-6"
        />
        <div
          class="flex justify-center items-center gap-2 p-4 sm:px-6"
          :class="hasPickedEbook ? 'border-t border-default' : ''"
        >
          <UButton
            color="primary"
            :disabled="!pickedRecords.length || !!uploadStatus"
            :label="$t('iscn_form.confirm_upload')"
            @click="startReplacementUpload"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { FileRecord } from '~/types'
import { parseImageURLFromMetadata } from '~/utils'
import { isManualCoverRecord } from '~/utils/arweave'
import { isContentFingerprintEncrypted } from '~/utils/iscn'
import { buildIscnLinksFromFileRecords } from '~/utils/iscnLinks'
import type { IscnFileLinks, IscnFileLinksContext } from '~/utils/iscnFileLinks'
import { EBOOK_FILE_TYPES } from '~/constant'

const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

const {
  classId,
  canEdit = false,
  coverError = '',
  fileLinksError = '',
  soldCount = 0,
  fileLinks = null,
  savedFileUrls = [],
  coverUrl = '',
  isCoverPending = false,
} = defineProps<{
  classId: string
  // Moderators reach this tab too, and nothing here can be saved without the
  // owner's signature — so an upload they make would only strand bytes.
  canEdit?: boolean
  // The save's complaint about the cover, shown where the cover is fixed.
  coverError?: string
  // Same, for a book left with no content URL — 技術資料 at the foot of the
  // tab is the fix.
  fileLinksError?: string
  // How many copies a replacement would reach; named in the confirm dialog.
  soldCount?: number
  // The chain form's own file arrays, so the list shows what will be saved
  // rather than what was last fetched.
  fileLinks?: IscnFileLinksContext | null
  // The URLs the last save wrote — what 待儲存 is judged against.
  savedFileUrls?: string[]
  // The chain form's cover, pending replacement included.
  coverUrl?: string
  // Judged by the page, off the same diff the save bar reads.
  isCoverPending?: boolean
}>()

const emit = defineEmits<{
  coverReplaced: [coverUrl: string]
  filesReplaced: [links: IscnFileLinks]
}>()

const isLoading = ref(false)
// This card's own read of the chain; the props above win, since this one can
// still be stale after a save.
const fetchedCoverUrl = ref('')
const fileRows = ref<{ url: string, type: string, fileName: string }[]>([])
const contentFingerprints = ref<string[]>([])

const isReplaceModalOpen = ref(false)
const uploadFormRef = ref<{ onSubmit: () => Promise<void> } | null>(null)
const uploadStatus = ref('')
const pickedRecords = ref<FileRecord[]>([])
const encryptEbook = ref(false)
// Remounts the upload form on close, so a second replacement starts from an
// empty list instead of re-uploading the file the first one already handled.
const replaceFormKey = ref(0)

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
// in the save bar. Anything the last save did not write is unsaved.
const displayedFileRows = computed(() => {
  const rows = fileLinks?.downloadableUrls.value.length ? fileLinks.downloadableUrls.value : fileRows.value
  const savedUrls = new Set(savedFileUrls)
  return rows
    .filter(row => row.url)
    .map(row => ({ ...row, isPending: !savedUrls.has(row.url) }))
})

// The chain form's cover, which a replacement writes the moment it uploads, so
// the picture here is already the pending one.
const coverSrc = computed(() => parseImageURLFromMetadata(coverUrl || fetchedCoverUrl.value))

// The stored cover, as a row: what the list shows is storage ids, and the
// cover has one like every other file.
const coverRow = computed(() => {
  const url = coverUrl || fetchedCoverUrl.value
  return url ? { url, isPending: isCoverPending } : null
})

watch(() => classId, async () => {
  if (!classId) { return }
  try {
    isLoading.value = true
    const loaded = await loadClassMetadataIntoForm(classId)
    if (!loaded) { return }
    fetchedCoverUrl.value = loaded.formData.coverUrl || ''
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
  if (hasPickedEbook.value) {
    const message = soldCount > 0
      ? $t('status_page.replace_book_file_confirm', { count: soldCount })
      : $t('status_page.replace_book_file_confirm_none')
    if (!window.confirm(message)) { return }
  }
  await uploadFormRef.value?.onSubmit()
}

// Only the author's own image becomes the cover: a replacement EPUB brings its
// own embedded one, and swapping the author's for it silently is not what
// replacing a file means.
//
// The file links are built from the ebook records alone for the same reason —
// passing the image through would fingerprint a cover this book does not use.
// Both changes land as pending edits, so the tx still waits for 儲存變更.
function handleReplacementUploaded({ fileRecords }: { fileRecords: FileRecord[] }) {
  const manualCover = fileRecords.find(
    record => isManualCoverRecord(record) && record.arweaveId,
  )
  if (manualCover) {
    emit('coverReplaced', `ar://${manualCover.arweaveId}`)
    useLogEvent('book_cover_replaced', { class_id: classId })
  }

  const ebookRecords = fileRecords.filter(
    record => EBOOK_FILE_TYPES.includes(record.fileType || ''),
  )
  const { downloadableUrls, contentFingerprints } = ebookRecords.length
    ? buildIscnLinksFromFileRecords(ebookRecords)
    : { downloadableUrls: [], contentFingerprints: [] }
  if (downloadableUrls.length) {
    emit('filesReplaced', { downloadableUrls, contentFingerprints })
    useLogEvent('book_file_replaced', { class_id: classId })
  }

  if (!manualCover && !downloadableUrls.length) { return }
  isReplaceModalOpen.value = false
}
</script>
