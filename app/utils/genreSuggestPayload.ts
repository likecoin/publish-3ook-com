// Import-free so `node --test` can run it.

// Mirrors the suggest API's body limits, which would reject the whole request otherwise.
const MAX_TITLE_LENGTH = 500
const MAX_DESCRIPTION_LENGTH = 10000
const MAX_TABLE_OF_CONTENTS_LENGTH = 10000
const MAX_CONTENT_EXCERPT_LENGTH = 20000

export interface GenreSuggestPayload {
  title: string
  description?: string
  language?: string
  tableOfContents?: string
  contentExcerpt?: string
}

export function buildGenreSuggestPayload(
  book: { title: string, description: string, descriptionFull?: string, language?: string },
  epubContext: { tableOfContents?: string, contentExcerpt?: string } = {},
): GenreSuggestPayload {
  return {
    title: book.title.slice(0, MAX_TITLE_LENGTH),
    description: (book.descriptionFull || book.description).slice(0, MAX_DESCRIPTION_LENGTH) || undefined,
    language: book.language || undefined,
    tableOfContents: epubContext.tableOfContents?.slice(0, MAX_TABLE_OF_CONTENTS_LENGTH) || undefined,
    contentExcerpt: epubContext.contentExcerpt?.slice(0, MAX_CONTENT_EXCERPT_LENGTH) || undefined,
  }
}
