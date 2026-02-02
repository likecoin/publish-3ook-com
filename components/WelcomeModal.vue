<template>
  <UModal
    v-model="showModal"
    :ui="{ width: 'w-full !max-w-[390px]' }"
  >
    <div class="flex justify-end p-4">
      <UButton
        color="gray"
        variant="ghost"
        icon="i-heroicons-x-mark-20-solid"
        size="lg"
        @click="onClose"
      />
    </div>
    <div class="flex flex-col items-center gap-[12px] px-6 pt-0 pb-12 text-center">
      <img
        src="~/assets/images/migration-notice.png"
        :alt="$t('welcome_modal.migration_icon_alt')"
        class="h-[80px]"
      >
      <div class="space-y-4 text-[15px] text-center text-gray-700">
        <h3 class="text-[24px] font-semibold">
          {{ $t('welcome_modal.latest_update') }}
        </h3>
        <p class="text-[16px]">
          {{ $t('welcome_modal.welcome_message') }}
        </p>
      </div>

      <div class="flex flex-col w-full gap-4 mt-4">
        <UButton
          size="lg"
          block
          :label="$t('welcome_modal.understood')"
          color="black"
          @click="onClose"
        />
        <p class="text-[14px] font-semibold">
          {{ $t('welcome_modal.first_time_message') }}
          <a
            class="text-[#20A492] hover:underline"
            :href="migrationURL"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ $t('welcome_modal.click_here') }}
          </a>
        </p>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
const { show: showModal, close: onClose } = useOneTimePopup('welcomePopup:v3')
const { LIKECOIN_V3_BOOK_MIGRATION_SITE_URL } = useRuntimeConfig().public
const { t: $t } = useI18n()
const migrationURL = appendUTMParamsToURL({
  url: LIKECOIN_V3_BOOK_MIGRATION_SITE_URL,
  medium: 'popup',
  campaign: 'migration'
})

</script>
