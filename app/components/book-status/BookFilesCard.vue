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
        <div
          class="flex flex-col gap-2 items-start rounded-lg border border-dashed p-3 transition-colors"
          :class="isDraggingCover ? 'border-primary bg-primary/5' : 'border-default'"
          @dragover.prevent="isDraggingCover = true"
          @dragleave="isDraggingCover = false"
          @drop.prevent="handleCoverDrop"
        >
          <p
            class="text-sm text-muted"
            v-text="$t('form.cover_image')"
          />
          <BookCoverThumbnail
            :src="coverSrc"
            size="lg"
          />
          <p
            class="text-xs text-muted break-all max-w-[120px]"
            v-text="coverMeta"
          />
          <UButton
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
            :label="$t('status_page.cover_pending_save')"
          />
          <input
            ref="coverInput"
            type="file"
            :accept="COVER_ACCEPT_ATTRIBUTE"
            class="hidden"
            @change="handleCoverPick"
          >
        </div>

        <ul
          v-if="fileRows.length"
          class="grow space-y-2 self-start"
        >
          <li
            v-for="file in fileRows"
            :key="file.url"
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
          </li>
        </ul>
        <p
          v-else
          class="grow self-start text-sm text-muted"
          v-text="'—'"
        />
      </div>

      <!-- The book files themselves stay read-only: replacing one has to
           answer what happens to the readers who already bought it. -->
      <p
        class="mt-4 text-xs text-muted"
        v-text="$t('status_page.files_readonly_note')"
      />
    </UCard>

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
        </template>
      </UCollapsible>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import type { FileRecord } from '~/types'
import { copyToClipboard, formatBytes, parseImageURLFromMetadata } from '~/utils'
import { COVER_ACCEPT_ATTRIBUTE } from '~/constant'

const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()
const { uploadFileRecordsToArweave } = useArweaveUpload()
const { showErrorToast } = useToastComposable()
const { takeImageFile, takeDroppedImageFile } = useImageFilePick()

const { classId } = defineProps<{
  classId: string
}>()

const emit = defineEmits<{ coverReplaced: [coverUrl: string] }>()

const isLoading = ref(false)
const coverUrl = ref('')
const fileRows = ref<{ url: string, type: string, fileName: string }[]>([])
const contentFingerprints = ref<string[]>([])
const isTechnicalOpen = ref(false)

const coverInput = ref<HTMLInputElement | null>(null)
const isDraggingCover = ref(false)
const isUploadingCover = ref(false)
const pendingCover = ref<{ file: File, width: number, height: number } | null>(null)
const pendingCoverFile = computed(() => pendingCover.value?.file)
const pendingCoverPreview = useObjectUrl(pendingCoverFile)

const coverSrc = computed(() => (
  pendingCoverPreview.value || parseImageURLFromMetadata(coverUrl.value)
))

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

const technicalRows = computed(() => [
  { label: $t('status_page.technical_class_id'), value: classId },
  { label: $t('form.cover_image'), value: coverUrl.value },
  {
    label: $t('publish_review.files_title'),
    value: fileRows.value.map(file => [file.fileName, file.url].filter(Boolean).join(' — ')).join('\n'),
  },
  { label: $t('iscn_form.content_fingerprint'), value: contentFingerprints.value.join('\n') },
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
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load class metadata for the files tab:', error)
  }
  finally {
    isLoading.value = false
  }
}, { immediate: true })

function handleCoverDrop(event: DragEvent) {
  isDraggingCover.value = false
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
