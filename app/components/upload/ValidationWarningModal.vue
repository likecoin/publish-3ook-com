<template>
  <UModal v-model:open="open">
    <template #body>
      <div class="flex items-start gap-3 p-4">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="w-6 h-6 text-yellow-500 shrink-0 mt-0.5"
        />
        <div class="space-y-2">
          <h3 class="font-semibold text-gray-900">
            {{ $t('upload_form.validation_error') }}
          </h3>
          <p class="text-gray-600">
            {{ errorMessage }}
          </p>
          <p class="text-sm text-gray-500 whitespace-pre-line">
            {{ $t('upload_form.valid_combinations') }}
          </p>
          <a
            :href="PUBLISH_GUIDE_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1"
          >
            <UIcon
              name="i-heroicons-question-mark-circle"
              class="w-4 h-4"
            />
            {{ $t('upload_form.help_link') }}
          </a>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          @click="onFix"
        >
          {{ $t('upload_form.fix_files') }}
        </UButton>
        <UButton
          v-if="canProceedAnyway"
          color="warning"
          @click="emit('proceed')"
        >
          {{ $t('upload_form.proceed_anyway') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { PUBLISH_GUIDE_URL } from '~/constant'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  errorMessage: string
  canProceedAnyway: boolean
}>()

const emit = defineEmits<{
  fix: []
  proceed: []
}>()

function onFix() {
  open.value = false
  emit('fix')
}
</script>
