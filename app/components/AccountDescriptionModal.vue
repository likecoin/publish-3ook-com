<template>
  <UModal
    :title="$t('user_settings.description_edit_title')"
    :dismissible="!isUpdatingDescription"
    :close="!isUpdatingDescription"
    :ui="{
      title: 'text-lg font-bold',
      footer: 'flex justify-end gap-3',
    }"
    @update:open="open => !open && emit('close')"
  >
    <template #body>
      <!-- `hint` only renders beside a label, so the count needs one. -->
      <UFormField
        :label="$t('user_settings.description')"
        :hint="`${descriptionInput.length}/${MAX_ACCOUNT_DESCRIPTION_LENGTH}`"
        :help="$t('user_settings.description_edit_help')"
      >
        <UTextarea
          v-model="descriptionInput"
          class="w-full"
          autofocus
          autoresize
          :rows="6"
          :maxrows="12"
          :maxlength="MAX_ACCOUNT_DESCRIPTION_LENGTH"
          :placeholder="$t('user_settings.description_edit_placeholder')"
          :disabled="isUpdatingDescription"
        />
      </UFormField>
    </template>

    <template #footer>
      <UButton
        :label="$t('common.cancel')"
        variant="outline"
        color="neutral"
        :disabled="isUpdatingDescription"
        @click="emit('close')"
      />
      <UButton
        :label="$t('user_settings.description_edit_save')"
        color="primary"
        :loading="isUpdatingDescription"
        :disabled="!isDescriptionChanged"
        @click="confirmDescriptionEdit"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { MAX_ACCOUNT_DESCRIPTION_LENGTH } from '~/constant'

const emit = defineEmits<{
  close: []
}>()

const { t: $t } = useI18n()

const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)
const { showErrorToast, showSuccessToast } = useToastComposable()

const descriptionInput = ref(userLikerInfo.value?.description ?? '')
const isUpdatingDescription = ref(false)
const isDescriptionChanged = computed(() => {
  return descriptionInput.value.trim() !== (userLikerInfo.value?.description ?? '')
})

async function confirmDescriptionEdit() {
  if (!isDescriptionChanged.value || isUpdatingDescription.value) { return }
  isUpdatingDescription.value = true
  try {
    // An empty string, not undefined, clears it: the API drops undefined fields.
    await userStore.updateUserProfile({ description: descriptionInput.value.trim() })
    useLogEvent('account_description_update_success')
    showSuccessToast($t('user_settings.description_update_success'))
    emit('close')
  }
  catch (error) {
    showErrorToast(error)
  }
  finally {
    isUpdatingDescription.value = false
  }
}
</script>
