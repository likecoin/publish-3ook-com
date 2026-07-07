<template>
  <UModal v-model:open="open">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="w-6 h-6 text-yellow-500 shrink-0"
        />
        <h3 class="font-semibold text-gray-900">
          {{ $t('upload_form.epub_validation_title') }}
        </h3>
      </div>
      <p class="text-sm text-gray-500 mt-2">
        {{ $t('upload_form.epub_validation_notice') }}
      </p>
    </template>
    <template #body>
      <div class="max-h-[300px] overflow-y-auto space-y-2 text-sm">
        <div
          v-if="errors"
          class="text-red-600"
        >
          <p class="font-semibold mb-1">
            {{ $t('upload_form.epub_validation_errors') }}:
          </p>
          <pre class="whitespace-pre-wrap text-xs">{{ errors }}</pre>
        </div>
        <div
          v-if="warnings"
          class="text-yellow-600"
        >
          <p class="font-semibold mb-1">
            {{ $t('upload_form.epub_validation_warnings') }}:
          </p>
          <pre class="whitespace-pre-wrap text-xs">{{ warnings }}</pre>
        </div>
      </div>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="open = false"
      >
        {{ $t('auth_state.close') }}
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

defineProps<{
  errors: string
  warnings: string
}>()
</script>
