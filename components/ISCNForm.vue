<template>
  <div class="flex flex-col gap-6">
    <UFormGroup
      :label="$t('common.title')"
      :error="!formData.title && $t('iscn_form.title_required')"
      class="flex-1 text-left"
      required
    >
      <UInput
        v-model="formData.title"
        :placeholder="$t('iscn_form.enter_iscn_title')"
      />
    </UFormGroup>

    <UFormGroup
      :label="$t('iscn_form.subtitle')"
      class="flex-1 text-left"
      :hint="`${(formData.alternativeHeadline || '').length}/${MAX_ALTERNATIVE_HEADLINE_LENGTH}`"
      :error="alternativeHeadlineError"
    >
      <UInput
        v-model="formData.alternativeHeadline"
        :placeholder="$t('iscn_form.enter_subtitle')"
      />
    </UFormGroup>

    <UFormGroup
      :label="$t('common.description')"
      class="flex-1 text-left"
      :hint="`${formData.description.length}/${MAX_DESCRIPTION_LENGTH}`"
      :error="descriptionError"
      required
    >
      <UTextarea
        v-model="formData.description"
        :placeholder="$t('iscn_form.enter_iscn_description')"
        autoresize
      />
    </UFormGroup>

    <UFormGroup
      :label="$t('iscn_form.description_full')"
      class="flex-1 text-left"
      :hint="`${(formData.descriptionFull || '').length}/${MAX_DESCRIPTION_FULL_LENGTH}`"
      :error="descriptionFullError"
    >
      <UTextarea
        v-model="formData.descriptionFull"
        :placeholder="$t('iscn_form.enter_iscn_description_full')"
        autoresize
      />
    </UFormGroup>

    <div class="grid grid-cols-3 gap-4">
      <UFormGroup :label="$t('form.isbn')">
        <UInput v-model="formData.isbn" :placeholder="$t('form.enter_isbn')" />
      </UFormGroup>

      <UFormGroup :label="$t('form.publisher')">
        <UInput
          v-model="formData.publisher"
          :placeholder="$t('form.enter_publisher_name')"
        />
      </UFormGroup>

      <UFormGroup :label="$t('form.publication_date')">
        <UInput
          v-model="formData.publicationDate"
          type="date"
          :placeholder="$t('iscn_form.select_date')"
        />
      </UFormGroup>

      <UFormGroup :label="$t('form.language')" required>
        <USelect
          v-model="formData.language"
          :options="languageOptions"
          :placeholder="$t('iscn_form.select_language')"
        />
      </UFormGroup>

      <UFormGroup
        required
        :label="$t('form.cover_image')"
        :error="!formData.coverUrl && $t('iscn_form.cover_image_required')"
        class="text-left"
      >
        <UInput
          v-model="formData.coverUrl"
          placeholder="ar://{arweave_id}"
          class="font-mono"
        />
      </UFormGroup>

      <UFormGroup :label="$t('form_labels.book_info')">
        <UInput
          v-model="formData.bookInfoUrl"
          :placeholder="$t('iscn_form.enter_book_info_url')"
        />
      </UFormGroup>
    </div>

    <!-- Author Info -->
    <div class="grid grid-cols-2 gap-4">
      <UFormGroup
        :label="$t('iscn_form.author_name')"
        :error="!formData.author.name && $t('iscn_form.author_name_required')"
        class="text-left"
        required
      >
        <UInput
          v-model="formData.author.name"
          :placeholder="$t('iscn_form.enter_author_name')"
        />
      </UFormGroup>

      <UFormGroup :label="$t('iscn_form.author_description')">
        <UTextarea
          v-model="formData.author.description"
          :placeholder="$t('iscn_form.enter_author_description')"
          autoresize
        />
      </UFormGroup>
    </div>

    <UFormGroup :label="$t('iscn_form.license')" class="flex-1">
      <div class="space-y-2">
        <USelect
          v-model="formData.license"
          :options="licenseOptions"
          :placeholder="$t('iscn_form.select_license')"
        />
        <UInput
          v-if="modelValue.license === 'Other'"
          v-model="formData.customLicense"
          :placeholder="$t('iscn_form.enter_custom_license')"
        />
      </div>
    </UFormGroup>

    <!-- Content Fingerprints -->
    <div class="flex flex-col border p-4 rounded-lg gap-4">
      <div class="flex flex-col gap-2 mb-4">
        <div class="flex justify-between items-center">
          <h3 class="font-medium" v-text="$t('iscn_form.content_fingerprint')" />
        </div>
        <p
          v-if="hasContentFingerprintChanged"
          class="text-sm text-amber-600 dark:text-amber-400"
          v-text="$t('iscn_form.content_fingerprint_not_saved')"
        />
      </div>
      <div
        v-for="(fingerprint, index) in formData.contentFingerprints"
        :key="index"
        class="flex gap-4 items-end"
      >
        <div class="flex justify-between items-end w-full gap-[8px]">
          <UFormGroup class="w-full" :label="`URL #${index + 1}`">
            <UInput
              v-model="fingerprint.url"
              class="w-full"
              :placeholder="$t('iscn_form.enter_content_fingerprint_url')"
            />
          </UFormGroup>
          <UButton
            v-if="formData.contentFingerprints.length > 1"
            color="red"
            class="w-min"
            variant="soft"
            icon="i-heroicons-trash"
            @click="removeContentFingerprint(index)"
          />
        </div>
        <UButton
          v-if="index === formData.contentFingerprints.length - 1"
          variant="soft"
          icon="i-heroicons-plus"
          class="mb-[2px]"
          @click="addContentFingerprint"
        />
      </div>

      <div class="flex items-center justify-center">
        <UButton
          variant="soft"
          :label="$t('form.upload_update_content')"
          @click="shouldShowUploadModal = true"
        />
      </div>
    </div>

    <!-- Downloadable URLs -->
    <div class="border p-4 rounded-lg">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-medium" v-text="$t('iscn_form.downloadable_url')" />
      </div>
      <div
        v-for="(download, index) in formData.downloadableUrls"
        :key="index"
        class="flex gap-4 items-end"
      >
        <div class="grid grid-cols-3 gap-4 flex-1">
          <UFormGroup :label="$t('iscn_form.type')">
            <USelect
              v-model="download.type"
              :options="downloadTypeOptions"
              placeholder="Select file type"
            />
          </UFormGroup>
          <UFormGroup :label="$t('iscn_form.url')">
            <UInput v-model="download.url" :placeholder="$t('iscn_form.enter_download_url')" />
          </UFormGroup>
          <UFormGroup :label="$t('iscn_form.filename')">
            <UInput v-model="download.fileName" :placeholder="$t('iscn_form.enter_filename')" />
          </UFormGroup>
        </div>
      </div>
      <UButton
        variant="soft"
        icon="i-heroicons-plus"
        class="mb-[2px]"
        @click="addDownloadableUrl"
      />
      <UButton
        v-if="formData.downloadableUrls?.length > 1"
        color="red"
        variant="soft"
        icon="i-heroicons-trash"
        @click="removeDownloadableUrl(formData.downloadableUrls.length - 1)"
      />
    </div>

    <UModal
      v-model="shouldShowUploadModal"
      :prevent-close="true"
      :ui="{ width: 'w-full max-w-[80vw]' }"
    >
      <UCard
        :ui="{
          header: { base: 'flex justify-between items-center' },
          body: { base: 'space-y-4' },
          footer: { base: 'flex justify-end items-center' },
        }"
      >
        <template #header>
          <h2 class="font-bold font-mono" v-text="$t('iscn_form.upload_files')" />
        </template>
        <UploadForm
          ref="uploadFormRef"
          :default-encrypted="isContentFingerprintsEncrypted"
          @file-upload-status="(status: string) => (uploadStatus = status)"
          @file-ready="(records: FileRecord[]) => (fileRecords = records)"
          @submit="handleUploadSubmit"
        />
        <template #footer>
          <div class="w-full flex justify-center items-center gap-2">
            <UButton color="gray" variant="soft" @click="shouldShowUploadModal = false">
              Cancel
            </UButton>
            <UButton
              color="primary"
              :loading="false"
              :disabled="!hasFiles || shouldDisableAction"
              :label="$t('iscn_form.confirm_upload')"
              @click="startUpload"
            />
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { FileRecord } from '~/components/UploadForm.vue'

import { licenseOptions, languageOptions, MAX_DESCRIPTION_LENGTH, MAX_DESCRIPTION_FULL_LENGTH, MAX_ALTERNATIVE_HEADLINE_LENGTH } from '~/constant/index'
import { getApiEndpoints } from '~/constant/api'
const { t: $t } = useI18n()

const downloadTypeOptions = [
  { label: 'EPUB', value: 'epub' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Image', value: 'image' },
  { label: 'Other', value: 'other' }
]

const shouldShowUploadModal = ref(false)
const uploadFormRef = ref()
const fileRecords = ref<FileRecord[]>([])
const uploadStatus = ref('')

const formData = defineModel<ISCNFormData>({ required: true })

const initialFormDataSnapshot = ref<string>('')

const hasContentFingerprintChanged = computed(() => {
  if (!initialFormDataSnapshot.value) { return false }
  try {
    const initial = JSON.parse(initialFormDataSnapshot.value)
    const currentFingerprints = JSON.stringify(formData.value.contentFingerprints)
    const initialFingerprints = JSON.stringify(initial.contentFingerprints)
    return currentFingerprints !== initialFingerprints
  } catch {
    return false
  }
})

const hasUnsavedChanges = computed(() => {
  if (!initialFormDataSnapshot.value) { return false }
  return JSON.stringify(formData.value) !== initialFormDataSnapshot.value
})

useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = $t('unsaved_changes_warning')
    return $t('unsaved_changes_warning')
  }
})

onBeforeRouteLeave(() => {
  if (hasUnsavedChanges.value) {
    return window.confirm($t('unsaved_changes_warning'))
  }
})

function resetSnapshot () {
  initialFormDataSnapshot.value = JSON.stringify(formData.value)
}

nextTick(() => {
  resetSnapshot()
})

defineExpose({
  resetSnapshot
})

const hasFiles = computed(() => {
  return fileRecords.value?.length > 0
})

const shouldDisableAction = computed(() => {
  return uploadStatus.value !== ''
})

const descriptionError = computed(() => {
  const desc = formData.value.description || ''
  if (!desc) {
    return 'Description is required'
  } else if (desc.length > MAX_DESCRIPTION_LENGTH) {
    return $t('validation.description_cannot_exceed', { max: MAX_DESCRIPTION_LENGTH })
  }
  return ''
})

const descriptionFullError = computed(() => {
  const desc = formData.value.descriptionFull || ''
  if (desc.length > MAX_DESCRIPTION_FULL_LENGTH) {
    return $t('validation.text_cannot_exceed', { max: MAX_DESCRIPTION_FULL_LENGTH })
  }
  return ''
})

const alternativeHeadlineError = computed(() => {
  const headline = formData.value.alternativeHeadline || ''
  if (headline.length > MAX_ALTERNATIVE_HEADLINE_LENGTH) {
    return $t('validation.text_cannot_exceed', { max: MAX_ALTERNATIVE_HEADLINE_LENGTH })
  }
  return ''
})

const isContentFingerprintsEncrypted = computed(() => {
  const contentFingerprints = formData.value.contentFingerprints.map(f => f.url)
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK
  return contentFingerprints.some((fingerprint) => {
    return !!fingerprint.startsWith(arweaveLinkEndpoint) || fingerprint.includes('?key=')
  })
})

const addContentFingerprint = () => {
  formData.value.contentFingerprints.push({ url: '' })
}

const removeContentFingerprint = (index: number) => {
  if (formData.value.contentFingerprints.length) {
    formData.value.contentFingerprints.splice(index, 1)
  }
}

const addDownloadableUrl = () => {
  formData.value.downloadableUrls.push({ url: '', type: '', fileName: '' })
}

const removeDownloadableUrl = (index: number) => {
  if (formData.value.downloadableUrls.length) {
    formData.value.downloadableUrls.splice(index, 1)
  }
}

const startUpload = async () => {
  await uploadFormRef.value.onSubmit()
}

const { getFileType } = useFileUpload()

const handleUploadSubmit = (uploadData: any) => {
  const { fileRecords, epubMetadata } = uploadData
  if (!fileRecords.length) {
    return
  }

  const downloadableUrls = fileRecords
    .filter((r: any) => r.fileType === 'application/pdf' || r.fileType === 'application/epub+zip')
    .map((file: any) => ({
      url: file.arweaveKey ? file.arweaveLink : `ar://${file.arweaveId}`,
      type: getFileType(file.fileType),
      fileName: file.fileName
    }))

  const contentFingerprints = [
    ...new Set<string>(
      fileRecords
        .map((r: any) => {
          const arweaveUrl: string = r.arweaveKey
            ? r.arweaveLink
            : `ar://${r.arweaveId}`
          return r.fileType === 'application/epub+zip' || r.fileType === 'application/pdf'
            ? arweaveUrl
            : `ar://${r.arweaveId}`
        })
        .filter((r: string) => !!r)
    )
  ].map(url => ({ url }))

  formData.value.downloadableUrls = downloadableUrls
  formData.value.contentFingerprints = contentFingerprints

  if (epubMetadata?.thumbnailArweaveId) {
    formData.value.coverUrl = `ar://${epubMetadata?.thumbnailArweaveId}`
  }
  shouldShowUploadModal.value = false
}
</script>

<style scoped>
.grid {
  @apply w-full;
}
</style>
