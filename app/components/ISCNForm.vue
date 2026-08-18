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
      :store-sourced-fields="storeSourcedFields"
      :store-conflicts="storeConflicts"
      @apply-store-value="(field: StoreMetadataDriftField) => emit('applyStoreValue', field)"
    />

    <IscnIdentifierFields
      v-model="formData"
      :prefilled-fields="prefilledFields"
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
  </UForm>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { FormError } from '#ui/types'
import type { ISCNFormData } from '~/types'
import type { ISCNPrefillableField } from '~/types/iscn'
import type { StoreMetadataConflict, StoreMetadataDriftField } from '~/utils/store-metadata-drift'

import {
  licenseOptions,
  MAX_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_FULL_LENGTH,
  MAX_ALTERNATIVE_HEADLINE_LENGTH,
} from '~/constant/index'

const { t: $t } = useI18n()

const formRef = ref()
const { validateWithFeedback } = useFormValidateFeedback()

// guardUnsavedChanges=false disables the leave-confirmation guards for hosts
// that persist the form some other way (the wizard's localStorage draft).
// contentExcerpt/tableOfContents enrich AI metadata suggestions when the host
// has them (the wizard); the edit flow works from title/description alone.
const props = withDefaults(defineProps<{
  guardUnsavedChanges?: boolean
  contentExcerpt?: string
  tableOfContents?: string
  // Fields the host filled in from an uploaded file, so they read as something
  // to check rather than as the author's own entry.
  prefilledFields?: ISCNPrefillableField[]
  // Fields currently holding a value the host took from the bookstore listing,
  // and the ones the store disagrees with rather than fills in. Both are empty
  // in the wizard: a book being published has no listing to differ from.
  storeSourcedFields?: StoreMetadataDriftField[]
  storeConflicts?: StoreMetadataConflict[]
}>(), {
  guardUnsavedChanges: true,
  contentExcerpt: '',
  tableOfContents: '',
  prefilledFields: () => [],
  storeSourcedFields: () => [],
  storeConflicts: () => [],
})

const emit = defineEmits<{ applyStoreValue: [field: StoreMetadataDriftField] }>()

const formData = defineModel<ISCNFormData>({ required: true })

// descriptionFull is listing-owned, so it is a separate model: keeping it out of
// formData keeps it out of the on-chain dirty check that decides whether saving
// costs a transaction.
const descriptionFull = defineModel<string>('descriptionFull')

// Owned here rather than in the classification group: it means "the suggested
// keywords are not saved yet", which resetSnapshot below decides, not the group.
const hasSuggested = ref(false)

const initialFormDataSnapshot = ref<string>('')

// Top-level ISCNFormData keys that differ from the snapshot, for hosts that
// list pending changes individually rather than as one boolean.
const changedFields = computed<string[]>(() => getChangedKeysFromSnapshot(
  initialFormDataSnapshot.value,
  formData.value as unknown as Record<string, unknown>,
))

const hasUnsavedChanges = computed(() => changedFields.value.length > 0)

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

// Hosts that fill fields in from somewhere else pass the baseline explicitly, so
// what counts as changed stays what they decide rather than whatever the form
// happens to hold when this runs.
function resetSnapshot(snapshot?: string) {
  initialFormDataSnapshot.value = snapshot ?? JSON.stringify(formData.value)
  // Saved keywords are the author's own now, so drop the review-me hint.
  hasSuggested.value = false
}

nextTick(() => {
  resetSnapshot()
})

defineExpose({
  resetSnapshot,
  hasUnsavedChanges,
  changedFields,
  validate,
})

const isDescriptionOverMax = computed(() => {
  return (formData.value.description || '').length > MAX_DESCRIPTION_LENGTH
})

// UForm routes each returned error to the UFormField with the matching name,
// so every error pushed here needs one that is actually rendered.
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
    errors.push({ name: 'descriptionFull', message: $t('validation.text_cannot_exceed', { max: MAX_DESCRIPTION_FULL_LENGTH }) })
  }
  return errors
}

// Hosts call this on submit: shows inline errors on invalid fields, toasts
// the messages, and scrolls the first offender into view.
async function validate(): Promise<boolean> {
  return validateWithFeedback(formRef.value)
}
</script>

<style scoped>
.grid {
  @apply w-full;
}
</style>
