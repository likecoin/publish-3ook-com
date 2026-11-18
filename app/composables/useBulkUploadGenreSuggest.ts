import type { Ref } from 'vue'
import { BOOK_CATEGORY_VALUES } from '~/constant'
import type { BulkUploadBook } from '~/types/bulk-upload'
import { runGenreSuggestQueue } from '~/utils/genreSuggestQueue'
import { buildGenreSuggestPayload } from '~/utils/genreSuggestPayload'

type EpubSuggestionContext = Awaited<ReturnType<typeof readEpubSuggestionContext>>

// Best effort: a PDF-only book or an unreadable EPUB is suggested from its title and description alone.
async function readBookEpubContext(book: BulkUploadBook): Promise<EpubSuggestionContext> {
  if (!book.epubFile) { return {} }
  try {
    return await readEpubSuggestionContext(book.epubFile)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read the EPUB for category suggestion:', error)
    return {}
  }
}

// Fills in the category of books whose CSV left it blank, using the same AI suggestion as the new-book form.
export function useBulkUploadGenreSuggest(books: Ref<BulkUploadBook[]>) {
  const { suggestBookMetadata } = useBookMetadataSuggest()

  const isSuggesting = ref(false)
  const suggestingBookId = ref('')
  const totalCount = ref(0)
  const doneCount = ref(0)
  const runBookIds = ref<string[]>([])

  // Each call is a paid LLM request, so going back to review never asks twice for the same book.
  const attemptedBookIds = new Set<string>()
  // Parsed only on the book's turn, and kept for the run so a rate-limited retry does not parse again.
  const epubContextByBookId = new Map<string, Promise<EpubSuggestionContext>>()
  let runId = 0

  function needsSuggestion(book: BulkUploadBook): boolean {
    return !book.classId && !hasGenre(book) && !attemptedBookIds.has(book.id)
  }

  function hasGenre(book: BulkUploadBook): boolean {
    return !!book.genre || !!book.genreSource
  }

  async function suggestBookGenre(book: BulkUploadBook, currentRunId: number) {
    suggestingBookId.value = book.id
    let epubContext = epubContextByBookId.get(book.id)
    if (!epubContext) {
      epubContext = readBookEpubContext(book)
      epubContextByBookId.set(book.id, epubContext)
    }
    const context = await epubContext
    // Parsing a large EPUB takes a while, during which the run may stop or the author may pick a category.
    if (runId !== currentRunId || hasGenre(book)) { return }
    attemptedBookIds.add(book.id)
    const { genre } = await suggestBookMetadata(buildGenreSuggestPayload(book, context))
    // Guards against cross-repo drift of the duplicated category list.
    if (!BOOK_CATEGORY_VALUES.includes(genre)) {
      throw new Error(`Unknown genre: ${genre}`)
    }
    // A stopped run has let the upload start, which may already have read this book's genre;
    // the author may also have picked one while the request was in flight.
    if (runId !== currentRunId || hasGenre(book)) { return }
    book.genre = genre
    book.genreSource = 'ai'
  }

  // Read from the books themselves, so a manual pick clears the warning and a new CSV never inherits it.
  const hasUnfilledBooks = computed(() => {
    if (isSuggesting.value) { return false }
    const ids = new Set(runBookIds.value)
    return books.value.some(book => ids.has(book.id) && !hasGenre(book))
  })

  async function suggestGenres() {
    const queue = books.value.filter(needsSuggestion)
    if (!queue.length) { return }
    runBookIds.value = [...runBookIds.value, ...queue.map(book => book.id)]

    const currentRunId = ++runId
    isSuggesting.value = true
    totalCount.value = queue.length
    doneCount.value = 0

    // A stopped run's in-flight request still settles, and must not touch a newer run's progress.
    const isCurrentRun = () => runId === currentRunId
    await runGenreSuggestQueue(queue, {
      suggest: book => suggestBookGenre(book, currentRunId),
      onSettled: () => {
        if (isCurrentRun()) { doneCount.value += 1 }
      },
      shouldSkip: hasGenre,
      shouldContinue: isCurrentRun,
    })
    if (!isCurrentRun()) { return }
    isSuggesting.value = false
    suggestingBookId.value = ''
    epubContextByBookId.clear()
  }

  // Stopping is the author's choice to fill the rest in, so it is not reported as unfilled.
  function stopSuggesting() {
    if (isSuggesting.value) { runBookIds.value = [] }
    runId += 1
    isSuggesting.value = false
    suggestingBookId.value = ''
    epubContextByBookId.clear()
  }

  onScopeDispose(stopSuggesting)

  return {
    isSuggesting,
    suggestingBookId,
    totalCount,
    doneCount,
    hasUnfilledBooks,
    suggestGenres,
    stopSuggesting,
  }
}
