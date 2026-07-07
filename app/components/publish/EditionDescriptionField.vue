<template>
  <div class="space-y-2">
    <UButton
      v-if="collapsible && !isOpen"
      variant="link"
      color="neutral"
      class="p-0"
      icon="i-heroicons-plus-small"
      :label="$t('nft_book_form.add_description')"
      @click="isOpen = true"
    />
    <template v-else>
      <span
        class="block text-[14px] text-[#374151]"
        v-text="$t('nft_book_form.description_optional')"
      />
      <md-editor
        v-model="description"
        language="en-US"
        :editor-id="editorId"
        :placeholder="$t('new_nft_book.edition_example')"
        :toolbars="toolbarOptions"
        :sanitize="sanitizeHtml"
        :style="{ height: '200px', width: '100%', marginTop: '0px' }"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { MdEditor, config, type ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

import { sanitizeHtml } from '~/utils/newClass'

// Disallow raw HTML and code fences in the markdown parser.
config({
  markdownItConfig(mdit) {
    mdit.options.html = false
    mdit.disable('fence')
  },
})

const toolbarOptions: ToolbarNames[] = [
  'bold',
  'italic',
  'strikeThrough',
  'title',
  '-',
  'unorderedList',
  'orderedList',
  '-',
  'code',
  'link',
  '=',
  'preview',
]

const { editorId, collapsible = false } = defineProps<{
  editorId: string
  collapsible?: boolean
}>()

const description = defineModel<string>({ required: true })

// Start open when editing an edition that already has a description;
// only a collapsible + empty field starts collapsed.
const isOpen = ref(!collapsible || !!description.value)
</script>

<style scoped>
.md-editor {
  width: 100%;
  min-width: 300px;
}
</style>
