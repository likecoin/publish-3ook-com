<template>
  <UModal
    :ui="{ width: 'w-full !max-w-[390px]' }"
    :prevent-close="false"
    :overlay="true"
  >
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-bold">
            {{ $t('registration_modal_title') }}
          </h3>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            class="-my-1"
            @click="emit('close')"
          />
        </div>
      </template>
      <UFormGroup
        v-if="!isAccountIdHidden"
        :label="$t('registration_modal_account_id_label')"
        :error="accountIdError"
        required
      >
        <UInput
          v-model="accountId"
          class="w-full"
        />
      </UFormGroup>

      <UFormGroup
        :label="$t('registration_modal_email_label')"
        :error="emailError"
        required
      >
        <UInput
          v-model="email"
          class="w-full"
          placeholder="you@example.com"
          type="email"
        />
      </UFormGroup>

      <UFormGroup
        v-if="!props.isDisplayNameHidden"
        :label="$t('registration_modal_display_name_label')"
        :hint="$t('registration_modal_optional_label')"
      >
        <UInput
          v-model="displayName"
          class="w-full"
          :placeholder="$t('registration_modal_display_name_placeholder')"
        />
      </UFormGroup>
      <template #footer>
        <div class="flex justify-end w-full items-center">
          <UButton
            :label="$t('registration_modal_register_button_label')"
            size="md"
            color="black"
            @click="handleRegisterButtonClick"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

interface RegistrationModalProps {
  email?: string
  accountId?: string
  isAccountIdHidden?: boolean
  displayName?: string
  isDisplayNameHidden?: boolean
}

const props = withDefaults(defineProps<RegistrationModalProps>(), {
  email: '',
  accountId: '',
  isAccountIdHidden: true,
  displayName: '',
  isDisplayNameHidden: true
})

const accountId = ref(props.accountId || '')
const isAccountIdHidden = ref(props.isAccountIdHidden || false)
const accountIdError = ref('')
const email = ref(props.email || '')
const emailError = ref('')
const displayName = ref(props.displayName || '')

const emit = defineEmits<{
  close: [result?: { accountId: string, email: string, displayName?: string }]
  submit: [data: { accountId: string, email: string, displayName?: string }]
}>()

watch(accountIdError, (newValue) => {
  // If accountId has an error, show the accountId field if it was hidden
  if (newValue && isAccountIdHidden.value) {
    isAccountIdHidden.value = false
  }
})

function handleRegisterButtonClick () {
  accountIdError.value = ''
  emailError.value = ''

  if (!accountId.value) {
    accountIdError.value = $t('registration_modal_error_account_id_required')
    return
  }

  if (!verifyAccountId(accountId.value)) {
    accountIdError.value = $t('registration_modal_error_account_id_invalid')
    return
  }

  if (!email.value) {
    emailError.value = $t('registration_modal_error_email_required')
    return
  }

  if (!verifyEmail(email.value)) {
    emailError.value = $t('registration_modal_error_email_invalid')
    return
  }

  const result = {
    accountId: accountId.value,
    email: email.value,
    displayName: displayName.value
  }

  emit('submit', result)
  emit('close', result)
}
</script>
