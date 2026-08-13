<template>
  <UFormField
    :label="$t('form.cover_image')"
    class="text-left"
  >
    <div class="flex items-start gap-4">
      <img
        v-if="src"
        :src="src"
        :alt="$t('form.cover_image')"
        class="w-[96px] shrink-0 rounded-md border border-default object-contain"
      >
      <div
        v-else
        class="flex w-[96px] h-[136px] shrink-0 items-center justify-center rounded-md border border-dashed border-default text-dimmed"
      >
        <UIcon
          name="i-heroicons-photo"
          class="w-6 h-6"
        />
      </div>

      <div class="flex flex-col items-start gap-2">
        <div class="flex flex-wrap gap-2">
          <UButton
            size="xs"
            variant="soft"
            icon="i-heroicons-arrow-up-tray"
            :loading="isReading"
            :label="$t('publish_cover.replace')"
            @click="openFilePicker"
          />
          <UButton
            v-if="canRevertCover"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-uturn-left"
            :label="$t('publish_cover.revert')"
            @click="handleRevert"
          />
        </div>
        <p
          class="text-xs text-muted"
          v-text="canRevertCover ? $t('publish_cover.replaced_hint') : $t('publish_cover.hint')"
        />
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      :accept="COVER_ACCEPT_ATTRIBUTE"
      class="hidden"
      @change="handlePick"
    >
  </UFormField>
</template>

<script setup lang="ts">
import type { EpubMetadata, FileRecord } from '~/types'
import { COVER_ACCEPT_ATTRIBUTE } from '~/constant'

const { t: $t } = useI18n()
const { showErrorToast } = useToastComposable()
const { takeImageFile } = useImageFilePick()

const { src = '' } = defineProps<{
  src?: string
}>()

const fileRecords = defineModel<FileRecord[]>('fileRecords', { required: true })
const epubMetadata = defineModel<EpubMetadata | undefined>('epubMetadata')

const fileInput = ref<HTMLInputElement | null>(null)
const isReading = ref(false)

const { canRevertCover, selectManualCoverFile, revertToGeneratedCover } = useManualCover({
  fileRecords,
  // The wizard has a single metadata object by this step; a PDF-only book has
  // none until a cover is picked, so create it on demand.
  resolveTarget: () => {
    if (!epubMetadata.value) {
      epubMetadata.value = { thumbnailIpfsHash: null, coverData: null }
    }
    return epubMetadata.value
  },
})

const openFilePicker = () => fileInput.value?.click()

async function handlePick(event: Event) {
  const file = takeImageFile(event)
  if (!file) { return }
  isReading.value = true
  try {
    await selectManualCoverFile(file)
    useLogEvent('book_publish_cover_replaced')
  }
  catch (error) {
    showErrorToast($t('upload_form.error_during_upload'), {
      description: (error as Error).message || $t('upload_form.upload_error_occurred'),
    })
  }
  finally {
    isReading.value = false
  }
}

function handleRevert() {
  if (revertToGeneratedCover()) {
    useLogEvent('book_publish_cover_reverted')
  }
}
</script>
