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

  <UCard
    :title="$t('nft_book_form.free_preview')"
    class="max-w-2xl"
    :ui="{ header: ['flex justify-between items-center gap-4'] }"
  >
    <template #header>
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-1">
          <UIcon
            class="size-5"
            :name="(
              isPreviewEnabled
                ? 'i-material-symbols-visibility-outline-rounded'
                : 'i-material-symbols-visibility-off-outline-rounded'
            )"
          />
          <div
            class="text-highlighted font-semibold"
            v-text="$t('nft_book_form.free_preview')"
          />
        </div>
        <div
          class="text-sm text-muted"
          v-text="(
            isPreviewEnabled
              ? $t('nft_book_form.free_preview_description_enabled')
              : $t('nft_book_form.free_preview_description_disabled')
          )"
        />
      </div>

      <USwitch
        v-model="isPreviewEnabled"
        :label="(
          isPreviewEnabled
            ? $t('nft_book_form.free_preview_enable')
            : $t('nft_book_form.free_preview_disable')
        )"
        :ui="{
          root: 'flex-row-reverse gap-2',
          wrapper: 'ms-0',
        }"
      />
    </template>

    <template
      v-if="isPreviewEnabled"
      #default
    >
      <UFormField
        :label="$t('nft_book_form.preview_percentage')"
        :help="$t('nft_book_form.preview_percentage_hint', {
          min: PREVIEW_PERCENTAGE_MIN,
          max: PREVIEW_PERCENTAGE_MAX,
        })"
      >
        <div class="flex items-center gap-4">
          <div class="grow flex items-center">
            <USlider
              :id="previewSliderId"
              v-model="previewPercentage"
              class="shrink-0 grow -mr-4"
              :style="{ width: `${PREVIEW_PERCENTAGE_MAX}%` }"
              :min="PREVIEW_PERCENTAGE_MIN"
              :max="PREVIEW_PERCENTAGE_MAX"
              :step="1"
              :ui="{ track: 'rounded-r-none' }"
              :aria-label="$t('nft_book_form.preview_percentage')"
            />
            <!-- Dummy div to fill the remaining space of the slider track -->
            <div
              class="shrink-0 h-2 rounded-r-full bg-accented"
              :style="{ width: `${100 - PREVIEW_PERCENTAGE_MAX}%` }"
            />
          </div>
          <UInput
            :id="previewInputId"
            v-model="previewPercentageDraft"
            class="shrink-0 w-16"
            size="sm"
            :ui="{ base: 'text-right tabular-nums' }"
            inputmode="numeric"
            :aria-label="$t('nft_book_form.preview_percentage')"
            @focus="previewPercentageDraft = String(previewPercentage)"
            @blur="commitPreviewPercentage"
            @keydown.enter.prevent="commitPreviewPercentage"
          >
            <template #trailing>
              <span class="text-gray-500 text-sm">%</span>
            </template>
          </UInput>
        </div>
      </UFormField>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { PREVIEW_PERCENTAGE_MIN, PREVIEW_PERCENTAGE_MAX } from '~/constant'

// Shared class-level content settings (adult-only, AI audio, Plus reading,
// free preview) used by the new-book pricing step and the status page's
// details editor.
const isAdultOnly = defineModel<boolean>('isAdultOnly', { required: true })
const hideAudio = defineModel<boolean>('hideAudio', { required: true })
const isPlusReadingEnabled = defineModel<boolean>('isPlusReadingEnabled', { required: true })
const isPreviewEnabled = defineModel<boolean>('isPreviewEnabled', { required: true })
const previewPercentage = defineModel<number>('previewPercentage', { required: true })

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

// UFormField shares one generated id with every control inside it, so the
// slider and the input must carry explicit ones to avoid a duplicate id.
const previewSliderId = useId()
const previewInputId = useId()

// The typed field keeps its own draft so half-finished input (empty, "5" on the
// way to "50") survives until blur or Enter, instead of being clamped mid-typing.
const previewPercentageDraft = ref(String(previewPercentage.value))
watch(previewPercentage, (value) => {
  previewPercentageDraft.value = String(value)
})

// clampPreviewPercentage() maps anything unparseable to the default 10, which
// would silently move the cut; keep the current value on junk input instead.
function commitPreviewPercentage() {
  const parsed = Number(previewPercentageDraft.value)
  const committed = Number.isFinite(parsed) && parsed > 0
    ? clampPreviewPercentage(parsed)
    : previewPercentage.value
  previewPercentage.value = committed
  previewPercentageDraft.value = String(committed)
}

// Free books always opt into Plus all-you-can-read; force the flag on.
watch(() => isFreeBook, (isFree) => {
  if (isFree) { isPlusReadingEnabled.value = true }
}, { immediate: true })
</script>
