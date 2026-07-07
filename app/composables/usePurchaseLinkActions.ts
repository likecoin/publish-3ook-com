// Shared QR-modal selection state and copy action for purchase-link rows
// (generator page and status-page card); each host keeps its own row type
// and QR filename logic.
export function usePurchaseLinkActions<T extends { url: string }>(
  options: { copyEventName?: string } = {},
) {
  const { t: $t } = useI18n()

  const selectedPurchaseLink = shallowRef<T | undefined>(undefined)

  const isOpenQRCodeModal = computed({
    get: () => !!selectedPurchaseLink.value,
    set: (value) => {
      if (!value) {
        selectedPurchaseLink.value = undefined
      }
    },
  })

  function copyLink(text = '') {
    if (options.copyEventName) {
      useLogEvent(options.copyEventName)
    }
    copyToClipboard(text, $t('purchase_link.copied_to_clipboard'))
  }

  return {
    selectedPurchaseLink,
    isOpenQRCodeModal,
    copyLink,
  }
}
