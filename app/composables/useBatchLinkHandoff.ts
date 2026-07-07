export const SESSION_KEY_BATCH_QRCODE = 'nft_book_press_batch_qrcode'
export const SESSION_KEY_BATCH_SHORTEN_URL = 'nft_book_press_batch_shorten_url'

// Hands rows off to the batch QR-code / short-link pages via sessionStorage
// as `key,url` CSV. Callers handle failures (toast titles differ per page).
export function useBatchLinkHandoff() {
  const localeRoute = useLocaleRoute()

  function openBatchQRCodePopup(rows: Record<string, unknown>[]) {
    sessionStorage.setItem(SESSION_KEY_BATCH_QRCODE, convertArrayOfObjectsToCSV(rows))
    window.open('/batch-qrcode?print=1', 'batch_qrcode', 'popup,menubar=no,location=no,status=no')
  }

  async function goToBatchShortLinks(rows: Record<string, unknown>[]) {
    sessionStorage.setItem(SESSION_KEY_BATCH_SHORTEN_URL, convertArrayOfObjectsToCSV(rows))
    await navigateTo(localeRoute({ name: 'batch-short-links', query: { print: 1 } }))
  }

  async function goToBatchQRCodePage(rows: Record<string, unknown>[]) {
    sessionStorage.setItem(SESSION_KEY_BATCH_QRCODE, convertArrayOfObjectsToCSV(rows))
    await navigateTo(localeRoute({ name: 'batch-qrcode' }))
  }

  function consumeBatchInput(key: string): string | null {
    try {
      const value = sessionStorage.getItem(key)
      if (value) {
        sessionStorage.removeItem(key)
      }
      return value
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return null
    }
  }

  return {
    openBatchQRCodePopup,
    goToBatchShortLinks,
    goToBatchQRCodePage,
    consumeBatchInput,
  }
}
