<template>
  <!-- Sticky so the save action stays reachable however long the tab is; the
       page owns what saving and discarding actually do. -->
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-200"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="changes.length"
      class="sticky bottom-4 z-20"
    >
      <div class="flex items-center justify-between gap-4 rounded-full border border-default bg-elevated/95 backdrop-blur px-4 py-2 shadow-lg">
        <div class="flex items-center gap-3 min-w-0">
          <UDropdownMenu :items="dropdownItems">
            <UButton
              variant="soft"
              color="primary"
              size="sm"
              class="rounded-full"
              :label="$t('status_page.pending_changes_count', { count: changes.length })"
              trailing-icon="i-heroicons-chevron-down"
            />
          </UDropdownMenu>
          <p
            v-if="needsWalletSignature"
            class="hidden sm:block text-xs text-muted truncate"
            v-text="$t('status_page.wallet_signature_hint')"
          />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            variant="link"
            color="neutral"
            :label="$t('status_page.discard_changes')"
            :disabled="isSaving"
            @click="emit('discard')"
          />
          <UButton
            :label="$t('status_page.save_changes')"
            :loading="isSaving"
            :disabled="isSaving"
            @click="emit('save')"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '#ui/types'
import type { BookEditChangeEntry } from '~/composables/useBookEditChanges'

const { t: $t } = useI18n()

const { changes, needsWalletSignature = false, isSaving = false } = defineProps<{
  changes: BookEditChangeEntry[]
  needsWalletSignature?: boolean
  isSaving?: boolean
}>()

const emit = defineEmits<{
  save: []
  discard: []
  jump: [tab: BookEditChangeEntry['tab']]
}>()

// Each entry jumps to the tab that owns the field; the wallet icon marks the
// ones whose save will ask for a signature.
const dropdownItems = computed<DropdownMenuItem[]>(() => changes.map(entry => ({
  label: entry.label,
  icon: entry.needsWallet ? 'i-heroicons-wallet' : undefined,
  onSelect: () => emit('jump', entry.tab),
})))
</script>
