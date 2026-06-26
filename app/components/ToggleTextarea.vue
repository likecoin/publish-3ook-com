<template>
  <div class="flex flex-col gap-2 text-left">
    <UCheckbox
      :model-value="isOpen"
      :label="toggleLabel"
      @update:model-value="handleToggle"
    />
    <UFormField
      v-if="isOpen"
      :label="label"
      class="flex-1 text-left"
      :hint="`${(modelValue || '').length}/${maxLength}`"
      :error="error"
    >
      <UTextarea
        v-model="modelValue"
        :placeholder="placeholder"
        :maxlength="maxLength"
        autoresize
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  toggleLabel: string
  placeholder: string
  maxLength: number
  forceOpen?: boolean
}>()

const modelValue = defineModel<string>()

const { t: $t } = useI18n()

const isOpen = ref(!!modelValue.value || !!props.forceOpen)

watch(modelValue, (val, oldVal) => {
  if (val && !oldVal && !isOpen.value) {
    isOpen.value = true
  }
})

// Auto-expand when the parent signals the field is required (e.g. the main
// description exceeds its limit and the overflow belongs in the full description).
watch(() => props.forceOpen, (val) => {
  if (val) {
    isOpen.value = true
  }
})

const error = computed(() => {
  const val = modelValue.value || ''
  if (val.length > props.maxLength) {
    return $t('validation.text_cannot_exceed', { max: props.maxLength })
  }
  return false
})

function handleToggle(val: boolean | 'indeterminate') {
  isOpen.value = val === true
  if (!isOpen.value) {
    modelValue.value = undefined
  }
}
</script>
