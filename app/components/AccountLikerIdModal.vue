<template>
  <UModal
    :title="$t('user_settings.liker_id_edit_title')"
    :description="$t('user_settings.liker_id_edit_description')"
    :dismissible="!isUpdatingLikerId"
    :close="!isUpdatingLikerId"
    :ui="{
      title: 'text-lg font-bold',
      body: 'space-y-4',
      footer: 'flex justify-end gap-3',
    }"
    @update:open="open => !open && emit('close')"
  >
    <template #body>
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="warning"
        variant="subtle"
        :title="$t('user_settings.liker_id_edit_warning')"
      />

      <UFormField
        :error="hint.error"
        :help="hint.help"
        :ui="{ help: hint.helpClass }"
      >
        <UInput
          v-model="likerIdInput"
          class="w-full font-mono"
          autofocus
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="$t('user_settings.liker_id_edit_placeholder')"
          :disabled="isUpdatingLikerId"
          :loading="availabilityStatus === 'checking'"
          @keydown.enter="confirmLikerIdEdit"
        >
          <template #leading>
            <span
              class="text-(--ui-text-muted) text-sm"
              v-text="'@'"
            />
          </template>
        </UInput>
      </UFormField>
    </template>

    <template #footer>
      <UButton
        :label="$t('common.cancel')"
        variant="outline"
        color="neutral"
        :disabled="isUpdatingLikerId"
        @click="emit('close')"
      />
      <UButton
        :label="$t('user_settings.liker_id_edit_save')"
        color="primary"
        :loading="isUpdatingLikerId"
        :disabled="!isSubmittable"
        @click="confirmLikerIdEdit"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

const emit = defineEmits<{
  close: []
}>()

const { t: $t } = useI18n()
const userStore = useUserStore()
const { publicLikerId } = usePublicLikerId()
const { showErrorToast, showSuccessToast } = useToastComposable()

const AVAILABILITY_DEBOUNCE_MS = 300
// The API client carries no timeout, so a wedged probe would strand 'checking'
// and leave Save disabled for good.
const AVAILABILITY_TIMEOUT_MS = 30_000

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'failed'
type HintStatus = 'empty' | 'invalid' | 'unchanged' | Exclude<AvailabilityStatus, 'idle'>

const likerIdInput = ref('')
const isUpdatingLikerId = ref(false)

// The probe verdict, paired with the value it was run for, so a verdict
// cannot outlive its input during the debounce window.
const probedLikerId = ref('')
const probeStatus = ref<AvailabilityStatus>('idle')
const availabilityCache = new Map<string, boolean>()
let probeController: AbortController | undefined

const normalizedLikerId = computed(() => getCanonicalLikerId(likerIdInput.value))
const isFormatValid = computed(() => checkLikerIdValid(normalizedLikerId.value))
const isUnchanged = computed(() => normalizedLikerId.value === publicLikerId.value.toLowerCase())
const availabilityStatus = computed<AvailabilityStatus>(() =>
  probedLikerId.value === normalizedLikerId.value ? probeStatus.value : 'idle')

// A failed probe must not block the rename: the POST is the real gate and answers
// with HANDLE_ALREADY_TAKEN if the pre-check was too optimistic.
const isSubmittable = computed(() => (
  isFormatValid.value
  && !isUnchanged.value
  && !isUpdatingLikerId.value
  && ['available', 'failed'].includes(availabilityStatus.value)
))

const hintStatus = computed<HintStatus>(() => {
  if (!isFormatValid.value) { return normalizedLikerId.value ? 'invalid' : 'empty' }
  if (isUnchanged.value) { return 'unchanged' }
  // 'idle' covers both an untouched field and the debounce window before a probe.
  if (availabilityStatus.value === 'idle') { return 'empty' }
  return availabilityStatus.value
})

const HINT_VARIANTS: Record<HintStatus, { key: string, isError?: boolean, helpClass?: string }> = {
  empty: { key: 'format' },
  invalid: { key: 'format', isError: true },
  unchanged: { key: 'unchanged' },
  checking: { key: 'checking' },
  available: { key: 'available', helpClass: 'text-success' },
  taken: { key: 'taken', isError: true },
  failed: { key: 'check_failed' },
}

function getFormatHint() {
  return $t('user_settings.liker_id_edit_hint_format', {
    min: LIKER_ID_MIN_LENGTH,
    max: LIKER_ID_MAX_LENGTH,
  })
}

const hint = computed(() => {
  const { key, isError, helpClass } = HINT_VARIANTS[hintStatus.value]
  const message = key === 'format' ? getFormatHint() : $t(`user_settings.liker_id_edit_hint_${key}`)
  // Undefined, not '': UFormField types `error` as [Boolean, String], so Vue's
  // boolean casting turns an empty string into `true` and marks the field invalid.
  return {
    error: isError ? message : undefined,
    help: isError ? undefined : message,
    helpClass: helpClass || 'text-(--ui-text-muted)',
  }
})

async function probeAvailability(likerId: string) {
  const cached = availabilityCache.get(likerId)
  if (cached !== undefined) {
    probedLikerId.value = likerId
    probeStatus.value = cached ? 'available' : 'taken'
    return
  }

  const controller = new AbortController()
  probeController = controller
  probedLikerId.value = likerId
  probeStatus.value = 'checking'
  let isTimedOut = false
  const timeoutId = setTimeout(() => {
    isTimedOut = true
    controller.abort()
  }, AVAILABILITY_TIMEOUT_MS)

  try {
    const { isAvailable } = await userStore.checkLikerIdAvailability(likerId, {
      signal: controller.signal,
    })
    availabilityCache.set(likerId, isAvailable)
    probeStatus.value = isAvailable ? 'available' : 'taken'
  }
  catch (error) {
    // Superseded by a newer probe (or the modal closed), which owns the status.
    if (controller.signal.aborted && !isTimedOut) { return }
    // eslint-disable-next-line no-console
    console.warn('Failed to check username availability:', error)
    probeStatus.value = 'failed'
  }
  finally {
    clearTimeout(timeoutId)
  }
}

watchDebounced(normalizedLikerId, (likerId) => {
  probeController?.abort()
  if (!isFormatValid.value || isUnchanged.value) { return }
  probeAvailability(likerId)
}, { debounce: AVAILABILITY_DEBOUNCE_MS })

onScopeDispose(() => probeController?.abort())

function getUpdateErrorDescription(error: unknown, code: string | undefined) {
  switch (code) {
    case 'HANDLE_ALREADY_TAKEN':
      return $t('user_settings.liker_id_update_failed_taken')
    case 'HANDLE_ALREADY_CHANGED':
      return $t('user_settings.liker_id_update_failed_already_changed')
    case 'HANDLE_UNCHANGED':
      return $t('user_settings.liker_id_edit_hint_unchanged')
    case 'INVALID_USER_ID':
      return getFormatHint()
    default:
      return getApiErrorMessage(error, $t)
  }
}

async function confirmLikerIdEdit() {
  if (!isSubmittable.value) { return }
  const nextLikerId = normalizedLikerId.value
  isUpdatingLikerId.value = true
  try {
    await userStore.updateUserLikerId(nextLikerId)
    useLogEvent('account_liker_id_update_success')
    showSuccessToast($t('user_settings.liker_id_update_success'))
    emit('close')
  }
  catch (error) {
    const code = getApiErrorCode(error)
    showErrorToast($t('user_settings.liker_id_update_failed'), {
      description: getUpdateErrorDescription(error, code),
    })
    if (code === 'HANDLE_ALREADY_TAKEN') {
      // Claimed since the probe: overwrite its stale verdict so Save stays disabled.
      availabilityCache.set(nextLikerId, false)
      probedLikerId.value = nextLikerId
      probeStatus.value = 'taken'
    }
    else if (code === 'HANDLE_ALREADY_CHANGED') {
      // Renamed elsewhere since this page loaded: resync so the edit button goes away.
      emit('close')
      userStore.fetchUserLikerInfo()
    }
  }
  finally {
    isUpdatingLikerId.value = false
  }
}
</script>
