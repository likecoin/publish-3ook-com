<template>
  <!-- Category and keywords describe the book, so they belong with the title
  and description rather than with the identifiers below. -->
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end gap-3">
      <!-- w-fit: FormField's root has no width of its own, so as a flex
      item it would absorb the row and push the button to the far edge. -->
      <UFormField
        :label="$t('form.genre')"
        class="w-fit shrink-0"
      >
        <!-- Filtering is over the translated label, which is what the author
             reads: 「文學」, not the stored Literary Collections. -->
        <USelectMenu
          v-model="genreModel"
          value-key="value"
          :items="bookCategoryOptions"
          :placeholder="$t('iscn_form.select_genre')"
          :search-input="{ placeholder: $t('iscn_form.search_genre') }"
          :ui="{ content: 'w-fit min-w-(--reka-combobox-trigger-width)' }"
        />
        <div
          v-if="recentGenreOptions.length"
          class="mt-2 flex flex-wrap items-center gap-1"
        >
          <span
            class="text-xs text-muted"
            v-text="$t('iscn_form.recent_genres')"
          />
          <UButton
            v-for="option of recentGenreOptions"
            :key="option.value"
            size="xs"
            variant="soft"
            color="neutral"
            :label="option.label"
            @click="applyRecentGenre(option.value)"
          />
        </div>
        <UButton
          v-if="suggestedGenre && suggestedGenre !== formData.genre"
          class="mt-2"
          size="xs"
          variant="soft"
          icon="i-heroicons-light-bulb"
          :label="$t('iscn_form.use_suggested_genre', { genre: suggestedGenreLabel })"
          @click="applySuggestedGenre"
        />
      </UFormField>
      <UButton
        icon="i-heroicons-sparkles"
        variant="soft"
        :label="$t('iscn_form.ai_suggest')"
        :loading="isSuggesting"
        :disabled="!canSuggestMetadata"
        @click="handleSuggestMetadata"
      />
      <!-- basis-full wraps it onto its own line within the row, keeping it
      tied to the button rather than floating between the two fields. -->
      <p
        v-if="!canSuggestMetadata"
        class="basis-full text-xs text-muted"
        v-text="$t('iscn_form.ai_suggest_requires')"
      />
    </div>

    <!-- The list merges author-entered and AI keywords, so flag the provenance
    once a suggestion has run. The counter is the only cue at the cap: reka-ui
    rejects the add silently, without even its duplicate-tag invalid styling. -->
    <UFormField
      :label="$t('form.keywords')"
      class="text-left"
      :hint="`${formData.tags.length}/${MAX_BOOK_KEYWORDS}`"
      :help="hasSuggested ? $t('iscn_form.ai_keywords_hint') : prefilledHint('tags')"
    >
      <UInputTags
        v-model="formData.tags"
        :max="MAX_BOOK_KEYWORDS"
        :placeholder="$t('iscn_form.enter_keywords')"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { ISCNFormData } from '~/types'
import type { ISCNPrefillableField } from '~/types/iscn'

import { MAX_BOOK_KEYWORDS, BOOK_CATEGORIES } from '~/constant/index'

const { t: $t } = useI18n()

// contentExcerpt/tableOfContents enrich the AI suggestion where the host has
// them (the wizard); the edit flow suggests from title and description alone.
const {
  prefilledFields = [],
  contentExcerpt = '',
  tableOfContents = '',
} = defineProps<{
  prefilledFields?: ISCNPrefillableField[]
  contentExcerpt?: string
  tableOfContents?: string
}>()

const formData = defineModel<ISCNFormData>({ required: true })

// Owned by the host rather than here: it means "keywords not saved yet", which
// is the host's snapshot lifecycle, not this group's.
const hasSuggested = defineModel<boolean>('hasSuggested', { default: false })

const prefilledHint = useIscnPrefilledHint(() => prefilledFields)

// Reka UI's SelectItem rejects an empty-string value (it is reserved for the
// cleared state), so the reset option uses a sentinel mapped back to '' below.
const GENRE_NONE_VALUE = '__none__'
const bookCategoryOptions = [
  { label: $t('iscn_form.genre_none'), value: GENRE_NONE_VALUE },
  ...BOOK_CATEGORIES.map(cat => ({
    label: $t(cat.i18nKey),
    value: cat.value as string,
  })),
]

// Bridge the empty stored genre to the dropdown's non-empty sentinel option.
const genreModel = computed({
  get: () => formData.value.genre || GENRE_NONE_VALUE,
  set: (value: string) => {
    formData.value.genre = value === GENRE_NONE_VALUE ? '' : value
  },
})

const { wallet } = storeToRefs(useWalletStore())
// Read once on mount: localStorage is not reactive, and the list only changes
// on publish, which navigates away from this form.
const recentGenres = ref<string[]>([])
onMounted(() => {
  recentGenres.value = loadRecentGenres(wallet.value || '')
})

// Drops the current pick, which would be a chip that does nothing, and any
// value the category list has since dropped.
const recentGenreOptions = computed(() =>
  recentGenres.value
    .filter(genre => genre !== formData.value.genre)
    .map(genre => bookCategoryOptions.find(option => option.value === genre))
    .filter(option => !!option))

function applyRecentGenre(genre: string) {
  useLogEvent('book_genre_recent_applied', { genre })
  formData.value.genre = genre
}

const { showErrorToast } = useToastComposable()
const { isSuggesting, suggestBookMetadata } = useBookMetadataSuggest()
// Set when the AI suggests a genre while the author already picked one;
// the chip renders only while it differs from the author's pick, so it is
// applied via explicit click, never silently.
const suggestedGenre = ref('')

const canSuggestMetadata = computed(() => {
  return !!formData.value.title && !!formData.value.description
})

const suggestedGenreLabel = computed(() => {
  const option = bookCategoryOptions.find(opt => opt.value === suggestedGenre.value)
  return option?.label || suggestedGenre.value
})

async function handleSuggestMetadata() {
  if (isSuggesting.value) { return }
  useLogEvent('book_metadata_suggest_click')
  try {
    const result = await suggestBookMetadata({
      title: formData.value.title,
      description: formData.value.description,
      language: formData.value.language || undefined,
      tableOfContents: tableOfContents || undefined,
      contentExcerpt: contentExcerpt || undefined,
      existingKeywords: formData.value.tags,
    })

    // Merge instead of replace so author-entered keywords are never lost;
    // NFKC-fold keys so backend-normalized suggestions dedupe against
    // width/case variants the author typed.
    const tagKey = (tag: string) => tag.normalize('NFKC').trim().toLowerCase()
    const existingTags = formData.value.tags
    const seen = new Set(existingTags.map(tagKey))
    const mergedTags = [...existingTags]
    for (const keyword of result.keywords) {
      // Suggestions stop at the cap rather than displacing author-entered tags.
      if (mergedTags.length >= MAX_BOOK_KEYWORDS) { break }
      if (seen.has(tagKey(keyword))) { continue }
      seen.add(tagKey(keyword))
      mergedTags.push(keyword)
    }
    formData.value.tags = mergedTags
    // A full list adds nothing, so the provenance hint would be a lie.
    if (mergedTags.length > existingTags.length) { hasSuggested.value = true }

    // Guards against cross-repo drift of the duplicated category list.
    const isGenreValid = BOOK_CATEGORIES.some(cat => cat.value === result.genre)
    // Logged before the early return below so a rejected genre still counts as
    // a suggestion; an empty genre with keywords is a partial success, not none.
    const isGenreAutoApplied = isGenreValid && !formData.value.genre
    useLogEvent('book_metadata_suggest_success', {
      keywords_added: mergedTags.length - existingTags.length,
      suggested_genre: isGenreValid ? result.genre : '',
      is_genre_auto_applied: isGenreAutoApplied,
    })
    if (!isGenreValid) { return }
    if (isGenreAutoApplied) {
      formData.value.genre = result.genre
    }
    else {
      suggestedGenre.value = result.genre
    }
  }
  catch (error) {
    useLogEvent('book_metadata_suggest_failed', { error: (error as Error)?.message })
    showErrorToast($t('iscn_form.ai_suggest_failed'))
  }
}

function applySuggestedGenre() {
  useLogEvent('book_metadata_suggest_genre_applied', { genre: suggestedGenre.value })
  formData.value.genre = suggestedGenre.value
}
</script>
