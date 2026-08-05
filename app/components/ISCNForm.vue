<template>
  <UForm
    ref="formRef"
    :state="formData"
    :validate="onFormValidate"
    :validate-on="['change', 'blur']"
    class="flex flex-col gap-6"
    @submit.prevent
  >
    <UFormField
      name="title"
      :label="$t('common.title')"
      class="flex-1 text-left"
      :help="prefilledHint('title')"
      required
    >
      <UInput
        v-model="formData.title"
        :placeholder="$t('iscn_form.enter_iscn_title')"
      />
    </UFormField>

    <UFormField
      name="alternativeHeadline"
      :label="$t('iscn_form.subtitle')"
      class="flex-1 text-left"
      :hint="`${(formData.alternativeHeadline || '').length}/${MAX_ALTERNATIVE_HEADLINE_LENGTH}`"
    >
      <UInput
        v-model="formData.alternativeHeadline"
        :placeholder="$t('iscn_form.enter_subtitle')"
      />
    </UFormField>

    <UFormField
      name="description"
      :label="$t('common.description')"
      class="flex-1 text-left"
      :hint="`${formData.description.length}/${MAX_DESCRIPTION_LENGTH}`"
      :help="prefilledHint('description')"
      required
    >
      <UTextarea
        v-model="formData.description"
        :placeholder="$t('iscn_form.enter_iscn_description')"
        autoresize
      />
    </UFormField>

    <ToggleTextarea
      v-model="descriptionFull"
      :label="$t('iscn_form.description_full')"
      :toggle-label="$t('iscn_form.enable_description_full')"
      :placeholder="$t('iscn_form.enter_iscn_description_full', { maxLength: MAX_DESCRIPTION_FULL_LENGTH })"
      :max-length="MAX_DESCRIPTION_FULL_LENGTH"
      :force-open="isDescriptionOverMax"
    />

    <!-- Category and keywords describe the book, so they belong with the title
    and description rather than with the identifiers below. -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <!-- w-fit: FormField's root has no width of its own, so as a flex
        item it would absorb the row and push the button to the far edge. -->
        <UFormField
          :label="$t('form.genre')"
          class="w-fit shrink-0"
        >
          <USelect
            v-model="genreModel"
            :items="bookCategoryOptions"
            :placeholder="$t('iscn_form.select_genre')"
            :ui="{ content: 'w-fit min-w-(--reka-select-trigger-width)' }"
          />
          <UButton
            v-if="suggestedGenre && suggestedGenre !== formData.genre"
            class="mt-2"
            size="xs"
            variant="soft"
            icon="i-heroicons-light-bulb"
            :label="$t('iscn_form.use_suggested_genre', { genre: suggestedGenreLabel })"
            @click="applySuggestedGenre"
          />
        </UFormField>
        <UButton
          icon="i-heroicons-sparkles"
          variant="soft"
          :label="$t('iscn_form.ai_suggest')"
          :loading="isSuggesting"
          :disabled="!canSuggestMetadata"
          @click="handleSuggestMetadata"
        />
        <!-- basis-full wraps it onto its own line within the row, keeping it
        tied to the button rather than floating between the two fields. -->
        <p
          v-if="!canSuggestMetadata"
          class="basis-full text-xs text-muted"
          v-text="$t('iscn_form.ai_suggest_requires')"
        />
      </div>

      <!-- The list merges author-entered and AI keywords, so flag the provenance
      once a suggestion has run. The counter is the only cue at the cap: reka-ui
      rejects the add silently, without even its duplicate-tag invalid styling. -->
      <UFormField
        :label="$t('form.keywords')"
        class="text-left"
        :hint="`${formData.tags.length}/${MAX_BOOK_KEYWORDS}`"
        :help="hasSuggested ? $t('iscn_form.ai_keywords_hint') : prefilledHint('tags')"
      >
        <UInputTags
          v-model="formData.tags"
          :max="MAX_BOOK_KEYWORDS"
          :placeholder="$t('iscn_form.enter_keywords')"
        />
      </UFormField>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <UFormField :label="$t('form.isbn')">
        <UInput
          v-model="formData.isbn"
          :placeholder="$t('form.enter_isbn')"
        />
      </UFormField>

      <UFormField :label="$t('form.publication_date')">
        <UInput
          v-model="formData.publicationDate"
          type="date"
          :placeholder="$t('iscn_form.select_date')"
        />
      </UFormField>

      <UFormField
        :label="$t('form.language')"
        :help="prefilledHint('language')"
        required
      >
        <USelect
          v-model="formData.language"
          :items="languageOptions"
          :placeholder="$t('iscn_form.select_language')"
        />
      </UFormField>

      <UFormField
        v-if="showFileFields"
        name="coverUrl"
        required
        :label="$t('form.cover_image')"
        class="text-left"
      >
        <UInput
          v-model="formData.coverUrl"
          placeholder="ar://{arweave_id}"
          class="font-mono"
        />
      </UFormField>

      <UFormField :label="$t('form_labels.book_info')">
        <UInput
          v-model="formData.bookInfoUrl"
          :placeholder="$t('iscn_form.enter_book_info_url')"
        />
      </UFormField>
    </div>

    <!-- Author Info -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField
        name="author.name"
        :label="$t('iscn_form.author_name')"
        class="text-left"
        :help="prefilledHint('author.name')"
        required
      >
        <UInput
          v-model="formData.author.name"
          :placeholder="$t('iscn_form.enter_author_name')"
        />
      </UFormField>

      <UFormField :label="$t('iscn_form.author_description')">
        <UTextarea
          v-model="formData.author.description"
          :placeholder="$t('iscn_form.enter_author_description')"
          autoresize
        />
      </UFormField>
    </div>

    <!-- Publisher Info -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField
        :label="$t('form.publisher')"
        class="text-left"
      >
        <UInput
          v-model="formData.publisher.name"
          :placeholder="$t('form.enter_publisher_name')"
        />
      </UFormField>

      <UFormField :label="$t('iscn_form.publisher_description')">
        <UTextarea
          v-model="formData.publisher.description"
          :placeholder="$t('iscn_form.enter_publisher_description')"
          autoresize
        />
      </UFormField>
    </div>

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
import { isValidImageUrl } from '~/utils/iscn'

import {
  licenseOptions,
  languageOptions,
  MAX_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_FULL_LENGTH,
  MAX_ALTERNATIVE_HEADLINE_LENGTH,
  MAX_BOOK_KEYWORDS,
  BOOK_CATEGORIES,
} from '~/constant/index'
import { getApiEndpoints } from '~/constant/api'

const { t: $t } = useI18n()
const localeRoute = useLocaleRoute()

const downloadTypeOptions = [
  { label: 'EPUB', value: 'epub' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Image', value: 'image' },
  { label: 'Other', value: 'other' },
]

// Reka UI's SelectItem rejects an empty-string value (it is reserved for the
// cleared state), so the reset option uses a sentinel mapped back to '' below.
const GENRE_NONE_VALUE = '__none__'
const bookCategoryOptions = [
  { label: $t('iscn_form.genre_none'), value: GENRE_NONE_VALUE },
  ...BOOK_CATEGORIES.map(cat => ({
    label: $t(cat.i18nKey),
    value: cat.value as string,
  })),
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

function prefilledHint(field: ISCNPrefillableField): string | undefined {
  return props.prefilledFields.includes(field)
    ? $t('iscn_form.prefilled_from_file')
    : undefined
}

const formData = defineModel<ISCNFormData>({ required: true })

// descriptionFull is listing-owned, so it is a separate model: keeping it out of
// formData keeps it out of the on-chain dirty check that decides whether saving
// costs a transaction.
const descriptionFull = defineModel<string>('descriptionFull')

// Bridge the empty stored genre to the dropdown's non-empty sentinel option.
const genreModel = computed({
  get: () => formData.value.genre || GENRE_NONE_VALUE,
  set: (value: string) => {
    formData.value.genre = value === GENRE_NONE_VALUE ? '' : value
  },
})

const { showErrorToast } = useToastComposable()
const { isSuggesting, suggestBookMetadata } = useBookMetadataSuggest()
// Set when the AI suggests a genre while the author already picked one;
// the chip renders only while it differs from the author's pick, so it is
// applied via explicit click, never silently.
const suggestedGenre = ref('')
const hasSuggested = ref(false)

const canSuggestMetadata = computed(() => {
  return !!formData.value.title && !!formData.value.description
})

const suggestedGenreLabel = computed(() => {
  const option = bookCategoryOptions.find(opt => opt.value === suggestedGenre.value)
  return option?.label || suggestedGenre.value
})

async function handleSuggestMetadata() {
  if (isSuggesting.value) { return }
  useLogEvent('book_metadata_suggest_click')
  try {
    const result = await suggestBookMetadata({
      title: formData.value.title,
      description: formData.value.description,
      language: formData.value.language || undefined,
      tableOfContents: props.tableOfContents || undefined,
      contentExcerpt: props.contentExcerpt || undefined,
      existingKeywords: formData.value.tags,
    })

    // Merge instead of replace so author-entered keywords are never lost;
    // NFKC-fold keys so backend-normalized suggestions dedupe against
    // width/case variants the author typed.
    const tagKey = (tag: string) => tag.normalize('NFKC').trim().toLowerCase()
    const existingTags = formData.value.tags
    const seen = new Set(existingTags.map(tagKey))
    const mergedTags = [...existingTags]
    for (const keyword of result.keywords) {
      // Suggestions stop at the cap rather than displacing author-entered tags.
      if (mergedTags.length >= MAX_BOOK_KEYWORDS) { break }
      if (seen.has(tagKey(keyword))) { continue }
      seen.add(tagKey(keyword))
      mergedTags.push(keyword)
    }
    formData.value.tags = mergedTags
    // A full list adds nothing, so the provenance hint would be a lie.
    if (mergedTags.length > existingTags.length) { hasSuggested.value = true }

    // Guards against cross-repo drift of the duplicated category list.
    const isGenreValid = BOOK_CATEGORIES.some(cat => cat.value === result.genre)
    // Logged before the early return below so a rejected genre still counts as
    // a suggestion; an empty genre with keywords is a partial success, not none.
    const isGenreAutoApplied = isGenreValid && !formData.value.genre
    useLogEvent('book_metadata_suggest_success', {
      keywords_added: mergedTags.length - existingTags.length,
      suggested_genre: isGenreValid ? result.genre : '',
      is_genre_auto_applied: isGenreAutoApplied,
    })
    if (!isGenreValid) { return }
    if (isGenreAutoApplied) {
      formData.value.genre = result.genre
    }
    else {
      suggestedGenre.value = result.genre
    }
  }
  catch (error) {
    useLogEvent('book_metadata_suggest_failed', { error: (error as Error)?.message })
    showErrorToast($t('iscn_form.ai_suggest_failed'))
  }
}

function applySuggestedGenre() {
  useLogEvent('book_metadata_suggest_genre_applied', { genre: suggestedGenre.value })
  formData.value.genre = suggestedGenre.value
}

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
  if (!data.description) {
    errors.push({ name: 'description', message: $t('iscn_form.description_required') })
  }
  else if (isDescriptionOverMax.value) {
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
  return validateWithFeedback(formRef.value)
}

const hasValidReadAction = computed(() => {
  return formData.value.downloadableUrls?.some(d => !!d.url)
})

const isContentFingerprintsEncrypted = computed(() => {
  const contentFingerprints = formData.value.contentFingerprints.map(f => f.url)
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK
  return contentFingerprints.some((fingerprint) => {
    return !!fingerprint.startsWith(arweaveLinkEndpoint) || fingerprint.includes('?key=')
  })
})

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
