<template>
  <UForm
    ref="formRef"
    :state="formData"
    :validate="onFormValidate"
    :validate-on="['change', 'blur']"
    class="flex flex-col gap-6"
    @submit.prevent
  >
    <IscnIdentityFields
      v-model="formData"
      v-model:description-full="descriptionFull"
      :prefilled-fields="prefilledFields"
    />

    <IscnClassificationFields
      v-model="formData"
      v-model:has-suggested="hasSuggested"
      :prefilled-fields="prefilledFields"
      :content-excerpt="contentExcerpt"
      :table-of-contents="tableOfContents"
      :description-full="descriptionFull"
    />

    <IscnIdentifierFields
      v-model="formData"
      :prefilled-fields="prefilledFields"
      :show-file-fields="showFileFields"
    />

    <IscnPeopleFields
      v-model="formData"
      :prefilled-fields="prefilledFields"
    />

    <UFormField
      :label="$t('iscn_form.license')"
      class="flex-1"
    >
      <div class="space-y-2">
        <USelect
          v-model="formData.license"
          :items="licenseOptions"
          :placeholder="$t('iscn_form.select_license')"
        />
        <UInput
          v-if="modelValue.license === 'Other'"
          v-model="formData.customLicense"
          :placeholder="$t('iscn_form.enter_custom_license')"
        />
      </div>
    </UFormField>

    <!-- Content Fingerprints -->
    <div
      v-if="showFileFields"
      class="flex flex-col border p-4 rounded-lg gap-4"
    >
      <div class="flex flex-col gap-2 mb-4">
        <div class="flex justify-between items-center">
          <h3
            class="font-medium"
            v-text="$t('iscn_form.content_fingerprint')"
          />
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
          <UFormField
            :name="`contentFingerprints.${index}.url`"
            class="w-full"
            :label="`URL #${index + 1}`"
          >
            <UInput
              v-model="fingerprint.url"
              class="w-full"
              :placeholder="$t('iscn_form.enter_content_fingerprint_url')"
            />
          </UFormField>
          <UButton
            v-if="fingerprint.url && !fingerprint.url.startsWith('hash://')"
            :to="localeRoute({ name: 'preview-book', query: { url: fingerprint.url } })"
            target="_blank"
            rel="noopener noreferrer"
            :label="$t('iscn_form.preview')"
            icon="i-heroicons-eye"
            variant="ghost"
            size="xs"
          />
          <UButton
            v-if="formData.contentFingerprints.length > 1"
            color="error"
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
    <div
      v-if="showFileFields"
      class="border p-4 rounded-lg"
    >
      <div class="flex justify-between items-center mb-4">
        <h3
          class="font-medium"
          v-text="$t('iscn_form.downloadable_url')"
        />
      </div>
      <UAlert
        v-if="!hasValidReadAction"
        color="warning"
        icon="i-heroicons-exclamation-triangle"
        :description="$t('iscn_form.no_read_action_warning')"
        class="mb-4"
      />
      <div
        v-for="(download, index) in formData.downloadableUrls"
        :key="index"
        class="flex gap-4 items-end"
      >
        <div class="grid grid-cols-3 gap-4 flex-1">
          <UFormField :label="$t('iscn_form.type')">
            <USelect
              v-model="download.type"
              :items="downloadTypeOptions"
              placeholder="Select file type"
            />
          </UFormField>
          <UFormField :label="$t('iscn_form.url')">
            <UInput
              v-model="download.url"
              :placeholder="$t('iscn_form.enter_download_url')"
            />
          </UFormField>
          <UFormField :label="$t('iscn_form.filename')">
            <UInput
              v-model="download.fileName"
              :placeholder="$t('iscn_form.enter_filename')"
            />
          </UFormField>
        </div>
        <UButton
          v-if="download.url"
          :to="localeRoute({ name: 'preview-book', query: { url: download.url } })"
          target="_blank"
          rel="noopener noreferrer"
          :label="$t('iscn_form.preview')"
          icon="i-heroicons-eye"
          variant="ghost"
          size="xs"
        />
      </div>
      <UButton
        variant="soft"
        icon="i-heroicons-plus"
        class="mb-[2px]"
        @click="addDownloadableUrl"
      />
      <UButton
        v-if="formData.downloadableUrls?.length > 1"
        color="error"
        variant="soft"
        icon="i-heroicons-trash"
        @click="removeDownloadableUrl(formData.downloadableUrls.length - 1)"
      />
    </div>

    <UModal
      v-if="showFileFields"
      v-model:open="shouldShowUploadModal"
      :dismissible="false"
      class="w-full max-w-[80vw]"
    >
      <template #header>
        <h2
          class="font-bold font-mono"
          v-text="$t('iscn_form.upload_files')"
        />
      </template>
      <template #body>
        <div class="space-y-4">
          <UploadForm
            ref="uploadFormRef"
            v-model:encrypt-ebook="encryptEbook"
            @file-upload-status="(status: string) => (uploadStatus = status)"
            @file-ready="(records: FileRecord[]) => (fileRecords = records)"
            @submit="handleUploadSubmit"
          />
        </div>
      </template>
      <template #footer>
        <div class="w-full flex justify-center items-center gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="shouldShowUploadModal = false"
          >
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
    </UModal>
  </UForm>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { FormError } from '#ui/types'
import type { FileRecord, ISCNFormData } from '~/types'
import type { ISCNPrefillableField } from '~/types/iscn'
import { isValidImageUrl, isContentFingerprintEncrypted } from '~/utils/iscn'

import {
  licenseOptions,
  MAX_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_FULL_LENGTH,
  MAX_ALTERNATIVE_HEADLINE_LENGTH,
} from '~/constant/index'

const { t: $t } = useI18n()
const localeRoute = useLocaleRoute()

const downloadTypeOptions = [
  { label: 'EPUB', value: 'epub' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Image', value: 'image' },
  { label: 'Other', value: 'other' },
]

const shouldShowUploadModal = ref(false)
const uploadFormRef = ref()
const formRef = ref()
const fileRecords = ref<FileRecord[]>([])
const uploadStatus = ref('')
const { validateWithFeedback } = useFormValidateFeedback()

// showFileFields=false hides coverUrl/fingerprints/downloadableUrls for the
// collect-only wizard, where those URLs only exist after publish uploads.
// guardUnsavedChanges=false disables the leave-confirmation guards for hosts
// that persist the form some other way (the wizard's localStorage draft).
// contentExcerpt/tableOfContents enrich AI metadata suggestions when the host
// has them (the wizard); the edit flow works from title/description alone.
const props = withDefaults(defineProps<{
  showFileFields?: boolean
  guardUnsavedChanges?: boolean
  contentExcerpt?: string
  tableOfContents?: string
  // Fields the host filled in from an uploaded file, so they read as something
  // to check rather than as the author's own entry.
  prefilledFields?: ISCNPrefillableField[]
}>(), {
  showFileFields: true,
  guardUnsavedChanges: true,
  contentExcerpt: '',
  tableOfContents: '',
  prefilledFields: () => [],
})

const formData = defineModel<ISCNFormData>({ required: true })

// descriptionFull is listing-owned, so it is a separate model: keeping it out of
// formData keeps it out of the on-chain dirty check that decides whether saving
// costs a transaction.
const descriptionFull = defineModel<string>('descriptionFull')

// Owned here rather than in the classification group: it means "the suggested
// keywords are not saved yet", which resetSnapshot below decides, not the group.
const hasSuggested = ref(false)

const initialFormDataSnapshot = ref<string>('')

const hasContentFingerprintChanged = computed(() => {
  if (!initialFormDataSnapshot.value) { return false }
  try {
    const initial = JSON.parse(initialFormDataSnapshot.value)
    const currentFingerprints = JSON.stringify(formData.value.contentFingerprints)
    const initialFingerprints = JSON.stringify(initial.contentFingerprints)
    return currentFingerprints !== initialFingerprints
  }
  catch {
    return false
  }
})

const hasUnsavedChanges = computed(() => {
  if (!initialFormDataSnapshot.value) { return false }
  return JSON.stringify(formData.value) !== initialFormDataSnapshot.value
})

useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (props.guardUnsavedChanges && hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = $t('unsaved_changes_warning')
    return $t('unsaved_changes_warning')
  }
})

onBeforeRouteLeave(() => {
  if (props.guardUnsavedChanges && hasUnsavedChanges.value) {
    return window.confirm($t('unsaved_changes_warning'))
  }
})

function resetSnapshot() {
  initialFormDataSnapshot.value = JSON.stringify(formData.value)
  // Saved keywords are the author's own now, so drop the review-me hint.
  hasSuggested.value = false
}

nextTick(() => {
  resetSnapshot()
})

defineExpose({
  resetSnapshot,
  hasUnsavedChanges,
  validate,
})

const hasFiles = computed(() => {
  return fileRecords.value?.length > 0
})

const shouldDisableAction = computed(() => {
  return uploadStatus.value !== ''
})

const isDescriptionOverMax = computed(() => {
  return (formData.value.description || '').length > MAX_DESCRIPTION_LENGTH
})

// UForm routes each returned error to the UFormField with the matching name;
// errors without a matching field (fingerprints, descriptionFull) surface via
// the validate() toast only.
function onFormValidate(): FormError[] {
  const errors: FormError[] = []
  const data = formData.value
  if (!data.title) {
    errors.push({ name: 'title', message: $t('iscn_form.title_required') })
  }
  // The short description is optional for the author but never optional in the
  // payload, so what is required is having something to derive it from.
  if (!data.description && !descriptionFull.value) {
    errors.push({ name: 'descriptionFull', message: $t('iscn_form.description_required') })
  }
  if (isDescriptionOverMax.value) {
    errors.push({ name: 'description', message: $t('validation.description_cannot_exceed', { max: MAX_DESCRIPTION_LENGTH }) })
  }
  if ((data.alternativeHeadline || '').length > MAX_ALTERNATIVE_HEADLINE_LENGTH) {
    errors.push({ name: 'alternativeHeadline', message: $t('validation.text_cannot_exceed', { max: MAX_ALTERNATIVE_HEADLINE_LENGTH }) })
  }
  if (!data.author.name) {
    errors.push({ name: 'author.name', message: $t('iscn_form.author_name_required') })
  }
  if ((descriptionFull.value || '').length > MAX_DESCRIPTION_FULL_LENGTH) {
    errors.push({ message: $t('validation.text_cannot_exceed', { max: MAX_DESCRIPTION_FULL_LENGTH }) })
  }
  // File-derived URLs only exist where the file fields are shown; the wizard
  // injects them at publish time instead.
  if (props.showFileFields) {
    if (!data.contentFingerprints?.some(f => !!f.url)) {
      // Bind to the first row's field (always rendered) so the error shows
      // inline and useFormValidateFeedback can scroll to it.
      errors.push({ name: 'contentFingerprints.0.url', message: $t('iscn_form.content_fingerprint_required') })
    }
    if (!data.coverUrl) {
      errors.push({ name: 'coverUrl', message: $t('iscn_form.cover_image_required') })
    }
    else if (!isValidImageUrl(data.coverUrl)) {
      errors.push({ name: 'coverUrl', message: $t('iscn_form.cover_image_invalid') })
    }
  }
  return errors
}

// Hosts call this on submit: shows inline errors on invalid fields, toasts
// the messages, and scrolls the first offender into view.
async function validate(): Promise<boolean> {
  // Derived on the way out rather than on every keystroke. description is the
  // catalog field — Stripe, Google Merchant, Meta, OpenAI all read it — so it
  // is filled here whenever the author left the box empty.
  if (!formData.value.description) {
    formData.value.description = deriveShortDescription(
      descriptionFull.value || '',
      MAX_DESCRIPTION_LENGTH,
    )
  }
  return validateWithFeedback(formRef.value)
}

const hasValidReadAction = computed(() => {
  return formData.value.downloadableUrls?.some(d => !!d.url)
})

const isContentFingerprintsEncrypted = computed(() =>
  isContentFingerprintEncrypted(formData.value.contentFingerprints.map(f => f.url)))

const encryptEbook = ref(isContentFingerprintsEncrypted.value)

// Re-derive whenever the fingerprints change: a replacement upload rewrites
// them, and the radio should then show what the files actually became.
watch(isContentFingerprintsEncrypted, (value: boolean) => {
  encryptEbook.value = value
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

const handleUploadSubmit = (uploadData: { fileRecords: FileRecord[], epubMetadata?: { thumbnailArweaveId?: string } }) => {
  const { fileRecords, epubMetadata } = uploadData
  if (!fileRecords.length) {
    return
  }

  const { downloadableUrls, contentFingerprints } = buildIscnLinksFromFileRecords(fileRecords)
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
