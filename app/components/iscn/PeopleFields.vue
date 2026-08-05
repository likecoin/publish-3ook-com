<template>
  <div class="flex flex-col gap-6">
    <!-- Author Info -->
    <div class="grid w-full grid-cols-2 gap-4">
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
    <div class="grid w-full grid-cols-2 gap-4">
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
  </div>
</template>

<script setup lang="ts">
import type { ISCNFormData } from '~/types'
import type { ISCNPrefillableField } from '~/types/iscn'

const { t: $t } = useI18n()

const { prefilledFields = [] } = defineProps<{
  prefilledFields?: ISCNPrefillableField[]
}>()

const formData = defineModel<ISCNFormData>({ required: true })

const prefilledHint = useIscnPrefilledHint(() => prefilledFields)
</script>
