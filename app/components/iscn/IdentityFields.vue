<template>
  <div class="flex flex-col gap-6">
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
  </div>
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

// Listing-owned, so it stays a separate model all the way down: keeping it out
// of formData keeps it out of the on-chain dirty check.
const descriptionFull = defineModel<string>('descriptionFull')

const prefilledHint = useIscnPrefilledHint(() => prefilledFields)

// Forces the long field open when the short one is over its cap, so the
// author can see somewhere to move the overflow to.
const isDescriptionOverMax = computed(() =>
  (formData.value.description || '').length > MAX_DESCRIPTION_LENGTH)
</script>
