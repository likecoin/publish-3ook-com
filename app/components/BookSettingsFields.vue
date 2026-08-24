<template>
  <div class="flex flex-col gap-4">
    <BookSettingsToggleRow
      v-model="isAdultOnly"
      name="isAdultOnly"
      :label="$t('nft_book_form.is_adult_only')"
      :description="$t('nft_book_form.is_adult_only_hint')"
    />

    <BookSettingsToggleRow
      v-model="isAudioAllowed"
      name="isAudioAllowed"
      :label="$t('nft_book_form.ai_audio')"
      :description="$t('nft_book_form.ai_audio_hint')"
    />

    <BookSettingsToggleRow
      v-model="isPreviewEnabled"
      name="isPreviewEnabled"
      :label="$t('nft_book_form.free_preview')"
      :description="(
        isPreviewEnabled
          ? $t('nft_book_form.free_preview_description_enabled')
          : $t('nft_book_form.free_preview_description_disabled')
      )"
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
              <span class="text-muted text-sm">%</span>
            </template>
          </UInput>
        </div>
      </UFormField>
    </BookSettingsToggleRow>
  </div>
</template>

<script setup lang="ts">
import { PREVIEW_PERCENTAGE_MIN, PREVIEW_PERCENTAGE_MAX } from '~/constant'

// Shared class-level content settings (adult-only, AI audio, free preview),
// used by the wizard's pricing step and the book page's 販售與內容設定. Lending
// is not among them: it has a card of its own in both flows.
const isAdultOnly = defineModel<boolean>('isAdultOnly', { required: true })
const hideAudio = defineModel<boolean>('hideAudio', { required: true })
const isPreviewEnabled = defineModel<boolean>('isPreviewEnabled', { required: true })
const previewPercentage = defineModel<number>('previewPercentage', { required: true })

// The stored flag is the prohibition, the control is the permission. Inverting
// here is what lets the row default to on without changing the stored default.
const isAudioAllowed = computed({
  get: () => !hideAudio.value,
  set: (value: boolean) => { hideAudio.value = !value },
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
</script>
