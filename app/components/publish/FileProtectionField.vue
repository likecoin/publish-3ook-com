<template>
  <URadioGroup
    v-model="drmOption"
    :items="drmOptions"
    orientation="vertical"
    :ui="{ label: 'text-left' }"
  >
    <template #label="{ item }">
      <span>{{ item.label }}</span>
      <UTooltip
        v-if="item.value === 'open'"
        :text="$t('upload_form.drm_option_open_link_label')"
      >
        <a
          :href="$t('upload_form.drm_option_open_link')"
          :aria-label="$t('upload_form.drm_option_open_link_label')"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center ml-1"
          @click.stop
        >
          <UIcon
            name="i-heroicons-question-mark-circle"
            class="w-4 h-4 text-dimmed hover:text-primary"
          />
        </a>
      </UTooltip>
    </template>
  </URadioGroup>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const encryptEbook = defineModel<boolean>({ required: true })

// The radio needs a discriminated value, but the choice is a boolean everywhere
// it is consumed — getUploadTier, hideDownload, and the publish payload.
const drmOption = computed<'encrypted' | 'open'>({
  get: () => (encryptEbook.value ? 'encrypted' : 'open'),
  set: (value) => { encryptEbook.value = value === 'encrypted' },
})

const drmOptions = computed(() => [
  { label: $t('upload_form.drm_option_encrypted'), value: 'encrypted' },
  { label: $t('upload_form.drm_option_open'), value: 'open' },
])
</script>
