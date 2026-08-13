<template>
  <div class="flex flex-col gap-4">
    <!-- Content fingerprints -->
    <div class="flex flex-col border p-4 rounded-lg gap-4">
      <h3
        class="font-medium"
        v-text="$t('iscn_form.content_fingerprint')"
      />
      <div
        v-for="(fingerprint, index) in contentFingerprints"
        :key="index"
        class="flex gap-4 items-end"
      >
        <div class="flex justify-between items-end w-full gap-[8px]">
          <UFormField
            :name="`contentFingerprints.${index}.url`"
            class="w-full"
            :label="`URL #${index + 1}`"
          >
            <UInput
              v-model="fingerprint.url"
              class="w-full"
              :placeholder="$t('iscn_form.enter_content_fingerprint_url')"
            />
          </UFormField>
          <UButton
            v-if="fingerprint.url && !fingerprint.url.startsWith('hash://')"
            :to="localeRoute({ name: 'preview-book', query: { url: fingerprint.url } })"
            target="_blank"
            rel="noopener noreferrer"
            :label="$t('iscn_form.preview')"
            icon="i-heroicons-eye"
            variant="ghost"
            size="xs"
          />
          <UButton
            v-if="contentFingerprints.length > 1"
            color="error"
            class="w-min"
            variant="soft"
            icon="i-heroicons-trash"
            @click="removeContentFingerprint(index)"
          />
        </div>
        <UButton
          v-if="index === contentFingerprints.length - 1"
          variant="soft"
          icon="i-heroicons-plus"
          class="mb-[2px]"
          @click="addContentFingerprint"
        />
      </div>
      <UButton
        v-if="!contentFingerprints.length"
        variant="soft"
        icon="i-heroicons-plus"
        class="self-start"
        @click="addContentFingerprint"
      />
    </div>

    <!-- Downloadable URLs -->
    <div class="border p-4 rounded-lg">
      <h3
        class="font-medium mb-4"
        v-text="$t('iscn_form.downloadable_url')"
      />
      <UAlert
        v-if="!hasValidReadAction"
        color="warning"
        icon="i-heroicons-exclamation-triangle"
        :description="$t('iscn_form.no_read_action_warning')"
        class="mb-4"
      />
      <div
        v-for="(download, index) in downloadableUrls"
        :key="index"
        class="flex gap-4 items-end"
      >
        <div class="grid grid-cols-3 gap-4 flex-1">
          <UFormField :label="$t('iscn_form.type')">
            <USelect
              v-model="download.type"
              :items="downloadTypeOptions"
              :placeholder="$t('iscn_form.type')"
            />
          </UFormField>
          <UFormField :label="$t('iscn_form.url')">
            <UInput
              v-model="download.url"
              :placeholder="$t('iscn_form.enter_download_url')"
            />
          </UFormField>
          <UFormField :label="$t('iscn_form.filename')">
            <UInput
              v-model="download.fileName"
              :placeholder="$t('iscn_form.enter_filename')"
            />
          </UFormField>
        </div>
        <UButton
          v-if="download.url"
          :to="localeRoute({ name: 'preview-book', query: { url: download.url } })"
          target="_blank"
          rel="noopener noreferrer"
          :label="$t('iscn_form.preview')"
          icon="i-heroicons-eye"
          variant="ghost"
          size="xs"
        />
      </div>
      <UButton
        variant="soft"
        icon="i-heroicons-plus"
        class="mb-[2px]"
        @click="addDownloadableUrl"
      />
      <UButton
        v-if="downloadableUrls.length > 1"
        color="error"
        variant="soft"
        icon="i-heroicons-trash"
        @click="removeDownloadableUrl(downloadableUrls.length - 1)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IscnFileLinksContext } from '~/utils/iscnFileLinks'

const { t: $t } = useI18n()
const localeRoute = useLocaleRoute()

const downloadTypeOptions = [
  { label: 'EPUB', value: 'epub' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Image', value: 'image' },
  { label: 'Other', value: 'other' },
]

// The raw rows behind 書檔's replacement flow, kept reachable for the one case
// the flow cannot serve: a URL that has to be repaired by hand. The rows belong
// to the host's chain form — which is what the pending-changes ledger diffs —
// so they are edited in place through the host's own refs.
const { links } = defineProps<{ links: IscnFileLinksContext }>()
const { contentFingerprints, downloadableUrls } = links

const hasValidReadAction = computed(() => downloadableUrls.value.some(d => !!d.url))

function addContentFingerprint() {
  contentFingerprints.value.push({ url: '' })
}

function removeContentFingerprint(index: number) {
  contentFingerprints.value.splice(index, 1)
}

function addDownloadableUrl() {
  downloadableUrls.value.push({ url: '', type: '', fileName: '' })
}

function removeDownloadableUrl(index: number) {
  downloadableUrls.value.splice(index, 1)
}
</script>
