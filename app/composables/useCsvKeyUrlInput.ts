import { parse as csvParse } from 'csv-parse/sync'

const CSV_HEADER = 'key,url'

// Shared paste-or-upload `key,url` CSV input for the batch QR-code and
// short-link pages. Parse errors throw; callers toast with their own copy.
export function useCsvKeyUrlInput(options: { sessionKey?: string, onLoaded?: () => void } = {}) {
  const { consumeBatchInput } = useBatchLinkHandoff()

  const csvInput = ref('')
  const csvInputPlaceholder = `${CSV_HEADER}
example01,https://example01.com
example02,https://example02.com`

  function handleFileChange(event: Event) {
    const files = (event.target as HTMLInputElement)?.files
    if (!files?.length) { return }
    const file = files[0]
    if (!file) { return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        csvInput.value = text
      }
    }
    reader.readAsText(file)
  }

  function parseKeyUrlCsv(): { key: string, url: string }[] {
    let input = csvInput.value
    if (!input.includes(CSV_HEADER)) {
      input = `${CSV_HEADER}\n${input}`
    }
    return csvParse(input, {
      columns: true,
      skip_empty_lines: true,
    }) as { key: string, url: string }[]
  }

  onMounted(() => {
    if (options.sessionKey) {
      const loadedInput = consumeBatchInput(options.sessionKey)
      if (loadedInput) {
        csvInput.value = loadedInput
      }
    }
    options.onLoaded?.()
  })

  return {
    csvInput,
    csvInputPlaceholder,
    handleFileChange,
    parseKeyUrlCsv,
  }
}
