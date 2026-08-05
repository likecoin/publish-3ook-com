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
    :label="$t('iscn_form.description_short')"
    class="flex-1 text-left"
    :hint="`${formData.description.length}/${MAX_DESCRIPTION_LENGTH}`"
    :help="$t('iscn_form.description_short_help')"
  >
    <UTextarea
      v-model="formData.description"
      :placeholder="derivedShortDescription || $t('iscn_form.enter_iscn_description_short')"
      autoresize
    />
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

// Shown as the short field's placeholder so the author can see what will be
// stored if they leave it alone. ISCNForm writes the same value at submit.
const derivedShortDescription = computed(() =>
  deriveShortDescription(descriptionFull.value || '', MAX_DESCRIPTION_LENGTH))
</script>
