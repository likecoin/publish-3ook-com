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
        :help="storeHint('genre')"
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
        <!-- The store holds a different genre from the chain. Offered rather
             than filled in: overwriting a category the author did pick with one
             only as fresh as the last store refresh is theirs to decide. -->
        <UButton
          v-if="storeGenreConflictLabel"
          class="mt-2"
          size="xs"
          variant="soft"
          icon="i-heroicons-building-storefront"
          :label="$t('iscn_form.use_store_genre', { genre: storeGenreConflictLabel })"
          @click="emit('applyStoreValue', 'genre')"
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
      :help="storeHint('tags') || (hasSuggested ? $t('iscn_form.ai_keywords_hint') : prefilledHint('tags'))"
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
import { mergeBookKeywords, type StoreMetadataConflict, type StoreMetadataDriftField } from '~/utils/store-metadata-drift'

import { MAX_BOOK_KEYWORDS, BOOK_CATEGORIES, BOOK_CATEGORY_VALUES } from '~/constant/index'

const { t: $t } = useI18n()

// contentExcerpt/tableOfContents enrich the AI suggestion where the host has
// them (the wizard); the edit flow suggests from title and description alone.
const {
  prefilledFields = [],
  contentExcerpt = '',
  tableOfContents = '',
  descriptionFull = '',
  storeSourcedFields = [],
  storeConflicts = [],
} = defineProps<{
  prefilledFields?: ISCNPrefillableField[]
  contentExcerpt?: string
  tableOfContents?: string
  // The author writes the full description first and may leave the short one
  // empty, so the suggestion reads whichever they actually filled in.
  descriptionFull?: string
  // Genre and keywords are the two fields the bookstore backfills wrote, so the
  // drift hints land here rather than in any other field group.
  storeSourcedFields?: StoreMetadataDriftField[]
  storeConflicts?: StoreMetadataConflict[]
}>()

const emit = defineEmits<{ applyStoreValue: [field: StoreMetadataDriftField] }>()

const formData = defineModel<ISCNFormData>({ required: true })

const hasSuggested = defineModel<boolean>('hasSuggested', { default: false })

const prefilledHint = useIscnPrefilledHint(() => prefilledFields)

// Same job as prefilledHint, for a value the host filled in from the bookstore
// listing rather than from an uploaded file.
function storeHint(field: StoreMetadataDriftField): string | undefined {
  return storeSourcedFields.includes(field) ? $t('iscn_form.from_store_data') : undefined
}

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

function getGenreLabel(genre: string) {
  return bookCategoryOptions.find(option => option.value === genre)?.label || genre
}

// Only set while the store's genre differs from the chain's; the button it
// renders is the only way that value is ever applied.
const storeGenreConflictLabel = computed(() => {
  const conflict = storeConflicts.find(entry => entry.field === 'genre')
  return conflict ? getGenreLabel(conflict.storeValue) : ''
})

// Bridge the empty stored genre to the dropdown's non-empty sentinel option.
const genreModel = computed({
  get: () => formData.value.genre || GENRE_NONE_VALUE,
  set: (value: string) => {
    formData.value.genre = value === GENRE_NONE_VALUE ? '' : value
  },
})

const { wallet } = storeToRefs(useWalletStore())
// Keyed off the wallet rather than read once on mount: wagmi restores the
// connection asynchronously, so a form mounted at page load would read an
// empty address and show no chips for the rest of the session.
const recentGenres = ref<string[]>([])
watch(wallet, (address) => {
  recentGenres.value = loadRecentGenres(address || '')
}, { immediate: true })

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

const effectiveDescription = computed(() =>
  descriptionFull || formData.value.description)

const canSuggestMetadata = computed(() => {
  return !!formData.value.title && !!effectiveDescription.value
})

const suggestedGenreLabel = computed(() => getGenreLabel(suggestedGenre.value))

async function handleSuggestMetadata() {
  if (isSuggesting.value) { return }
  useLogEvent('book_metadata_suggest_click')
  try {
    const result = await suggestBookMetadata({
      title: formData.value.title,
      description: effectiveDescription.value,
      language: formData.value.language || undefined,
      tableOfContents: tableOfContents || undefined,
      contentExcerpt: contentExcerpt || undefined,
      existingKeywords: formData.value.tags,
    })

    // The same merge the bookstore-drift staging runs: keywords the author did
    // not type are appended, deduped and capped, never replacing theirs.
    const existingTags = formData.value.tags
    const mergedTags = mergeBookKeywords(existingTags, result.keywords, MAX_BOOK_KEYWORDS)
    formData.value.tags = mergedTags
    // A full list adds nothing, so the provenance hint would be a lie.
    if (mergedTags.length > existingTags.length) { hasSuggested.value = true }

    // Guards against cross-repo drift of the duplicated category list.
    const isGenreValid = BOOK_CATEGORY_VALUES.includes(result.genre)
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
