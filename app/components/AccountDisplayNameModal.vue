<template>
  <UModal
    :title="$t('user_settings.display_name_edit_title')"
    :dismissible="!isUpdatingDisplayName"
    :close="!isUpdatingDisplayName"
    :ui="{
      title: 'text-lg font-bold',
      footer: 'flex justify-end gap-3',
    }"
    @update:open="open => !open && emit('close')"
  >
    <template #body>
      <UInput
        v-model="displayNameInput"
        class="w-full"
        autofocus
        :placeholder="$t('user_settings.display_name_edit_placeholder')"
        :disabled="isUpdatingDisplayName"
        @keydown.enter="confirmDisplayNameEdit"
      />
    </template>

    <template #footer>
      <UButton
        :label="$t('common.cancel')"
        variant="outline"
        color="neutral"
        :disabled="isUpdatingDisplayName"
        @click="emit('close')"
      />
      <UButton
        :label="$t('user_settings.display_name_edit_save')"
        color="primary"
        :loading="isUpdatingDisplayName"
        :disabled="!isDisplayNameInputValid"
        @click="confirmDisplayNameEdit"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  close: []
}>()

const { t: $t } = useI18n()

const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)
const { showErrorToast, showSuccessToast } = useToastComposable()

const displayNameInput = ref(userLikerInfo.value?.displayName ?? '')
const isUpdatingDisplayName = ref(false)
const isDisplayNameInputValid = computed(() => {
  const trimmed = displayNameInput.value.trim()
  return trimmed.length > 0 && trimmed !== userLikerInfo.value?.displayName
})

async function confirmDisplayNameEdit() {
  if (!isDisplayNameInputValid.value || isUpdatingDisplayName.value) { return }
  isUpdatingDisplayName.value = true
  try {
    await userStore.updateUserProfile({ displayName: displayNameInput.value.trim() })
    useLogEvent('account_display_name_update_success')
    showSuccessToast($t('user_settings.display_name_update_success'))
    emit('close')
  }
  catch (error) {
    showErrorToast(error)
  }
  finally {
    isUpdatingDisplayName.value = false
  }
}
</script>
