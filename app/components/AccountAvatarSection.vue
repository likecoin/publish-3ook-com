<template>
  <section class="flex flex-col items-center gap-3">
    <div class="relative">
      <UAvatar
        class="bg-white border border-(--ui-border) size-24"
        :src="userLikerInfo?.avatar"
        :alt="displayName"
        icon="i-heroicons-user"
        size="3xl"
      />
      <div class="absolute -bottom-1 -right-1 rounded-full bg-(--ui-bg)">
        <UButton
          class="rounded-[inherit]"
          icon="i-heroicons-pencil-square"
          variant="outline"
          color="neutral"
          :loading="isUploadingAvatar || isRequestingPermission"
          :aria-label="$t('user_settings.avatar_change')"
          @click="handleAvatarEditButtonClick"
        />
      </div>
      <input
        ref="avatarFileInput"
        class="hidden"
        type="file"
        :accept="COVER_ACCEPT_ATTRIBUTE"
        @change="handleAvatarFileChange"
      >
    </div>

    <div
      v-if="displayName"
      class="font-bold"
      v-text="displayName"
    />
  </section>
</template>

<script setup lang="ts">
import { OPEN_IMAGE_FILE_TYPES, COVER_ACCEPT_ATTRIBUTE } from '~/constant'

const { t: $t } = useI18n()

const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)
const { showErrorToast, showSuccessToast } = useToastComposable()

const { canEditProfile, isRequestingPermission, requestProfilePermission } = useProfilePermission()

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_MAX_DIMENSION = 256

const avatarFileInput = useTemplateRef<HTMLInputElement>('avatarFileInput')
const isUploadingAvatar = ref(false)

const displayName = computed(() => userLikerInfo.value?.displayName || userLikerInfo.value?.user || '')

async function handleAvatarEditButtonClick() {
  if (isUploadingAvatar.value) { return }
  useLogEvent('account_avatar_edit_click')
  // Opening the picker after an await loses user activation in Safari, so a
  // freshly granted permission takes a second click rather than resuming.
  if (!canEditProfile.value) {
    await requestProfilePermission()
    return
  }
  avatarFileInput.value?.click()
}

async function handleAvatarFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) { return }
  if (!OPEN_IMAGE_FILE_TYPES.includes(file.type)) {
    showErrorToast($t('user_settings.avatar_invalid_file'))
    return
  }
  isUploadingAvatar.value = true
  try {
    // Size is checked after the resize: a phone photo is megabytes as picked
    // but a few KB once scaled down, and rejecting it upfront would be wrong.
    const resizedFile = await resizeImageFile(file, AVATAR_MAX_DIMENSION)
    if (resizedFile.size > AVATAR_MAX_BYTES) {
      showErrorToast($t('user_settings.avatar_too_large'))
      return
    }
    await userStore.uploadUserAvatar(resizedFile)
    useLogEvent('account_avatar_update_success')
    showSuccessToast($t('user_settings.avatar_update_success'))
  }
  catch (error) {
    showErrorToast(error)
  }
  finally {
    isUploadingAvatar.value = false
  }
}
</script>
