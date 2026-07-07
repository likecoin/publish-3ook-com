<template>
  <UFormField class="flex items-center">
    <UTooltip
      class="flex items-center gap-2"
      :text="$t('nft_book_form.is_adult_only_tooltip')"
    >
      <UCheckbox
        v-model="isAdultOnly"
        name="isAdultOnly"
        :label="$t('nft_book_form.is_adult_only')"
      />

      <UIcon name="i-heroicons-question-mark-circle" />
    </UTooltip>
  </UFormField>

  <UFormField :label="$t('nft_book_form.ai_audio')">
    <URadioGroup
      v-model="hideAudioRadio"
      :items="[
        { label: $t('nft_book_form.ai_audio_allow'), value: 'allow' },
        { label: $t('nft_book_form.ai_audio_forbid'), value: 'forbid' },
      ]"
      orientation="vertical"
    />
  </UFormField>

  <UFormField :label="$t('nft_book_form.plus_reading')">
    <URadioGroup
      v-model="isPlusReadingEnabledRadio"
      :disabled="isFreeBook"
      :items="[
        { label: $t('nft_book_form.plus_reading_join'), value: 'join' },
        { label: $t('nft_book_form.plus_reading_skip'), value: 'skip' },
      ]"
      orientation="vertical"
    />
    <p
      v-if="isFreeBook"
      class="text-muted text-[12px] mt-1"
      v-text="$t('nft_book_form.plus_reading_free_forced')"
    />
  </UFormField>
</template>

<script setup lang="ts">
// Shared class-level content settings (adult-only, AI audio, Plus reading)
// used by the new-book pricing step and the status page's details editor.
const isAdultOnly = defineModel<boolean>('isAdultOnly', { required: true })
const hideAudio = defineModel<boolean>('hideAudio', { required: true })
const isPlusReadingEnabled = defineModel<boolean>('isPlusReadingEnabled', { required: true })

const { isFreeBook = false } = defineProps<{
  isFreeBook?: boolean
}>()

const hideAudioRadio = computed({
  get: () => (hideAudio.value ? 'forbid' : 'allow'),
  set: (val: string) => { hideAudio.value = val === 'forbid' },
})

const isPlusReadingEnabledRadio = computed({
  get: () => (isPlusReadingEnabled.value ? 'join' : 'skip'),
  set: (val: string) => { isPlusReadingEnabled.value = val === 'join' },
})

// Free books always opt into Plus all-you-can-read; force the flag on.
watch(() => isFreeBook, (isFree) => {
  if (isFree) { isPlusReadingEnabled.value = true }
}, { immediate: true })
</script>
