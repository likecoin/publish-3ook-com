<template>
  <!-- Collapsed by default: identifiers are what support asks for when
       something has gone wrong, never something to read while publishing. -->
  <UCard>
    <UCollapsible v-model:open="isTechnicalOpen">
      <UButton
        variant="link"
        color="neutral"
        class="px-0"
        :label="$t('status_page.technical_details')"
        :trailing-icon="isTechnicalOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
      />
      <template #content>
        <dl class="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2 pt-4 text-sm">
          <template
            v-for="row in technicalRows"
            :key="row.label"
          >
            <dt
              class="text-muted"
              v-text="row.label"
            />
            <dd class="flex items-start gap-2 min-w-0">
              <span
                class="font-mono text-xs break-all whitespace-pre-line text-highlighted"
                v-text="row.value || '—'"
              />
              <UButton
                v-if="row.value"
                icon="i-heroicons-document-duplicate"
                variant="ghost"
                color="neutral"
                size="xs"
                class="shrink-0"
                :aria-label="$t('common.copy')"
                @click="copyToClipboard(row.value)"
              />
            </dd>
          </template>
        </dl>

        <!-- The escape hatch the replacement flow cannot serve: a URL that
             has to be repaired by hand when support asks for it. -->
        <IscnFileLinksFields
          v-if="canEdit && fileLinks"
          class="pt-4"
          :links="fileLinks"
        />
      </template>
    </UCollapsible>
  </UCard>
</template>

<script setup lang="ts">
import { copyToClipboard } from '~/utils'
import type { IscnFileLinksContext } from '~/utils/iscnFileLinks'

const { t: $t } = useI18n()

const { classId, canEdit = false, coverUrl = '', fileLinksError = '', fileLinks = null } = defineProps<{
  classId: string
  // Moderators reach this tab too, and nothing here can be saved without the
  // owner's signature — so a hand-edited URL would never land.
  canEdit?: boolean
  // Both of these are 書籍資料's own chain form rather than a second fetch, so
  // the rows read what will be saved rather than what was last loaded.
  coverUrl?: string
  fileLinks?: IscnFileLinksContext | null
  // The save's complaint about a book left with no content URL; the rows below
  // are the fix, so it decides whether this drawer opens itself.
  fileLinksError?: string
}>()

const isTechnicalOpen = ref(false)

// Immediate, because a save that fails on the tab this card already sits on
// sets the error before the watcher would otherwise run — and an error
// pointing at something the author cannot see is only half a message.
watch(() => fileLinksError, (message) => {
  if (message) { isTechnicalOpen.value = true }
}, { immediate: true })

// The file and fingerprint rows are read-only here only for a viewer who has no
// editable copy below; showing both to an owner would be the same data twice.
const technicalRows = computed(() => [
  { label: $t('status_page.technical_class_id'), value: classId },
  { label: $t('form.cover_image'), value: coverUrl },
  ...(canEdit && fileLinks
    ? []
    : [
        {
          label: $t('publish_review.files_title'),
          value: (fileLinks?.downloadableUrls.value || [])
            .map(file => [file.fileName, file.url].filter(Boolean).join(' — '))
            .join('\n'),
        },
        {
          label: $t('iscn_form.content_fingerprint'),
          value: (fileLinks?.contentFingerprints.value || [])
            .map(fingerprint => fingerprint.url)
            .filter(Boolean)
            .join('\n'),
        },
      ]),
])
</script>
