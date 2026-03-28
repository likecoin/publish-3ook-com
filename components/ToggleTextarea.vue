<template>
  <div class="flex flex-col gap-2">
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
}>()

const modelValue = defineModel<string>()

const { t: $t } = useI18n()

const isOpen = ref(!!modelValue.value)

watch(modelValue, (val, oldVal) => {
  if (val && !oldVal && !isOpen.value) {
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

function handleToggle (val: boolean | 'indeterminate') {
  isOpen.value = val === true
  if (!isOpen.value) {
    modelValue.value = undefined
  }
}
</script>
