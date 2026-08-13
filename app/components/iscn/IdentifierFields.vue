<template>
  <div class="grid w-full grid-cols-3 gap-4">
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

    <UFormField :label="$t('form_labels.book_info')">
      <UInput
        v-model="formData.bookInfoUrl"
        :placeholder="$t('iscn_form.enter_book_info_url')"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { ISCNFormData } from '~/types'
import type { ISCNPrefillableField } from '~/types/iscn'

import { languageOptions } from '~/constant/index'

const { t: $t } = useI18n()

const { prefilledFields = [] } = defineProps<{
  prefilledFields?: ISCNPrefillableField[]
}>()

const formData = defineModel<ISCNFormData>({ required: true })

const prefilledHint = useIscnPrefilledHint(() => prefilledFields)
</script>
