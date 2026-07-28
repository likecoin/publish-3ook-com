export interface BookMetadataSuggestion {
  genre: string
  keywords: string[]
}

// AI genre/keyword suggestion via the LIKE_CO_API backend (Gemini on Vertex AI).
export function useBookMetadataSuggest() {
  const isSuggesting = ref(false)

  async function suggestBookMetadata(payload: {
    title: string
    description?: string
    language?: string
    tableOfContents?: string
    contentExcerpt?: string
    existingKeywords?: string[]
  }): Promise<BookMetadataSuggestion> {
    isSuggesting.value = true
    try {
      const apiFetch = useLikeCoApiFetch()
      return await apiFetch<BookMetadataSuggestion>('/likernft/book/metadata/suggest', {
        method: 'POST',
        body: payload,
      })
    }
    finally {
      isSuggesting.value = false
    }
  }

  return {
    isSuggesting,
    suggestBookMetadata,
  }
}
