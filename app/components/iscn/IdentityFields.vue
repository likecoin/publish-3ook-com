<template>
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

  <!-- The full description first: it is the one the author has in mind, and
  the catalog line below is derived from it when they leave it empty. -->
  <UFormField
    name="descriptionFull"
    :label="$t('common.description')"
    class="flex-1 text-left"
    :hint="`${(descriptionFull || '').length}/${MAX_DESCRIPTION_FULL_LENGTH}`"
    :help="prefilledHint('descriptionFull')"
    :required="!formData.description"
  >
    <UTextarea
      v-model="descriptionFull"
      :placeholder="$t('iscn_form.enter_iscn_description')"
      :maxlength="MAX_DESCRIPTION_FULL_LENGTH"
      :rows="6"
      autoresize
    />
  </UFormField>

  <UFormField
    name="description"
    class="flex-1 text-left"
    :hint="`${formData.description.length}/${MAX_DESCRIPTION_LENGTH}`"
    :help="$t('iscn_form.description_short_help')"
    :ui="{ label: 'w-full flex items-center gap-2' }"
  >
    <template #label>
      <span v-text="$t('iscn_form.description_short')" />
      <USwitch
        v-model="isShortDescriptionAuto"
        size="xs"
        :label="$t('iscn_form.description_short_auto')"
        :ui="{ root: 'flex-row-reverse gap-1 py-0.5 px-2 border border-accented rounded-md', wrapper: 'ms-0' }"
      />
    </template>
    <!-- Read-only while it follows the description, so the author sees what will be stored.
         The trailing button is how they take it over. -->
    <UTextarea
      ref="shortDescriptionInput"
      v-model="formData.description"
      autoresize
      :readonly="isShortDescriptionAuto"
      :variant="isShortDescriptionAuto ? 'subtle' : 'outline'"
      :placeholder="derivedShortDescription || $t('iscn_form.enter_iscn_description_short')"
    >
      <template #trailing>
        <UTooltip :text="isShortDescriptionAuto ? $t('common.edit') : $t('iscn_form.description_short_auto')">
          <UButton
            v-if="isShortDescriptionAuto"
            icon="i-heroicons-pencil-square"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="$t('common.edit')"
            @click="editShortDescription"
          />
          <UButton
            v-else
            icon="i-heroicons-sparkles"
            color="primary"
            variant="ghost"
            size="xs"
            :aria-label="$t('iscn_form.description_short_auto')"
            @click="() => { isShortDescriptionAuto = true }"
          />
        </UTooltip>
      </template>
    </UTextarea>
  </UFormField>
</template>

<script setup lang="ts">
import type { ISCNFormData } from '~/types'
import type { ISCNPrefillableField } from '~/types/iscn'

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_FULL_LENGTH,
  MAX_ALTERNATIVE_HEADLINE_LENGTH,
} from '~/constant/index'

const { t: $t } = useI18n()

const { prefilledFields = [] } = defineProps<{
  prefilledFields?: ISCNPrefillableField[]
}>()

const formData = defineModel<ISCNFormData>({ required: true })

const descriptionFull = defineModel<string>('descriptionFull')

const prefilledHint = useIscnPrefilledHint(() => prefilledFields)

// What the catalog line becomes when it is not written by hand. ISCNForm
// resolves the same value at submit, so this is a readout, not the source.
const derivedShortDescription = computed(() =>
  deriveShortDescription(descriptionFull.value || '', MAX_DESCRIPTION_LENGTH))

// Auto until the author says otherwise. Inferred rather than stored, because a
// book published before this existed has the two fields identical — which is
// derivation, not a deliberate override, and should keep following the long one.
const isAutoOverride = ref<boolean | null>(null)
const isShortDescriptionAuto = computed({
  get: () => isAutoOverride.value ?? (
    !formData.value.description || formData.value.description === derivedShortDescription.value
  ),
  set: (value: boolean) => {
    isAutoOverride.value = value
    if (value) { formData.value.description = derivedShortDescription.value }
  },
})

const shortDescriptionInput = useTemplateRef<{ textareaRef?: HTMLTextAreaElement }>('shortDescriptionInput')
function editShortDescription() {
  isShortDescriptionAuto.value = false
  shortDescriptionInput.value?.textareaRef?.focus()
}

// Keeps the derived line current while it is the one in force; writing it into
// the field rather than leaving it empty is what stops a stale copy surviving
// an edit to the long description.
//
// Auto-ness is judged against the *previous* derived value, not the computed
// above: by the time this runs the computed has already invalidated, so it
// would compare the untouched field against the new derivation and conclude
// the author had written it by hand — flipping the switch off mid-keystroke.
watch(derivedShortDescription, (value, previous) => {
  const isFollowing = isAutoOverride.value ?? (
    !formData.value.description || formData.value.description === previous
  )
  if (isFollowing && value !== formData.value.description) {
    formData.value.description = value
  }
})
</script>
