import type { ClassListingData } from '~/types'

// Owns the listing-owned (REST /settings) fields of a book class: init from
// the fetched listing info, snapshot-based dirty tracking, cancel-restore,
// and the settings POST payload.
export function useBookListingSettings(options: {
  classListingInfo: () => ClassListingData
  isFreeBook: Ref<boolean>
}) {
  const isAdultOnly = ref(false)
  const hideAudio = ref(false)
  const hideDownload = ref(false)
  const isPlusReadingEnabled = ref(false)
  const mustClaimToView = ref(true)
  const enableCustomMessagePage = ref(true)
  const descriptionFull = ref<string | undefined>('')
  const tableOfContents = ref('')
  const moderatorWallets = ref<string[]>([])
  const connectedWallets = ref<Record<string, number> | null>(null)
  // Snapshot of the listing fields taken on load/save; save only POSTs when the
  // current values diverge from it.
  const listingSnapshot = ref('')

  function currentListingSnapshot(): string {
    return JSON.stringify({
      isAdultOnly: isAdultOnly.value,
      hideAudio: hideAudio.value,
      hideDownload: hideDownload.value,
      isPlusReadingEnabled: isPlusReadingEnabled.value,
      descriptionFull: descriptionFull.value ?? '',
      tableOfContents: tableOfContents.value,
      moderatorWallets: moderatorWallets.value,
    })
  }

  function initListingFieldsFromInfo() {
    const classListingInfo = options.classListingInfo()
    moderatorWallets.value = [...(classListingInfo.moderatorWallets || [])]
    connectedWallets.value = classListingInfo.connectedWallets || null
    mustClaimToView.value = classListingInfo.mustClaimToView ?? true
    hideDownload.value = classListingInfo.hideDownload ?? false
    hideAudio.value = classListingInfo.hideAudio ?? false
    isAdultOnly.value = classListingInfo.isAdultOnly ?? false
    // Legacy books default to opt-out; free books always opt in regardless of stored value.
    isPlusReadingEnabled.value = options.isFreeBook.value || (classListingInfo.isPlusReadingEnabled ?? false)
    enableCustomMessagePage.value = classListingInfo.enableCustomMessagePage ?? true
    tableOfContents.value = classListingInfo.tableOfContents ?? ''
    descriptionFull.value = classListingInfo.descriptionFull ?? ''
    listingSnapshot.value = currentListingSnapshot()
  }

  watch(() => options.classListingInfo().ownerWallet, () => {
    // The page fetches listing info async; (re-)init once it arrives.
    initListingFieldsFromInfo()
  }, { immediate: true })

  function isListingSettingsDirty(): boolean {
    return listingSnapshot.value !== currentListingSnapshot()
  }

  function commitListingSnapshot() {
    listingSnapshot.value = currentListingSnapshot()
  }

  function restoreListingFromSnapshot() {
    try {
      const snapshot = JSON.parse(listingSnapshot.value)
      isAdultOnly.value = snapshot.isAdultOnly
      hideAudio.value = snapshot.hideAudio
      hideDownload.value = snapshot.hideDownload
      isPlusReadingEnabled.value = snapshot.isPlusReadingEnabled
      descriptionFull.value = snapshot.descriptionFull
      tableOfContents.value = snapshot.tableOfContents
      moderatorWallets.value = snapshot.moderatorWallets
    }
    catch {
      initListingFieldsFromInfo()
    }
  }

  // Echoes back loaded-but-uneditable fields (mustClaimToView,
  // connectedWallets, enableCustomMessagePage) so the API keeps them.
  function buildSettingsPayload() {
    return {
      moderatorWallets: moderatorWallets.value,
      connectedWallets: connectedWallets.value,
      hideDownload: hideDownload.value,
      hideAudio: hideAudio.value,
      isAdultOnly: isAdultOnly.value,
      isPlusReadingEnabled: isPlusReadingEnabled.value,
      mustClaimToView: mustClaimToView.value,
      tableOfContents: tableOfContents.value,
      // Toggling the field off sets this to undefined; send '' so the listing
      // value is cleared instead of omitted (which would keep the old value).
      descriptionFull: descriptionFull.value ?? '',
      enableCustomMessagePage: enableCustomMessagePage.value,
    }
  }

  return {
    isAdultOnly,
    hideAudio,
    hideDownload,
    isPlusReadingEnabled,
    descriptionFull,
    tableOfContents,
    moderatorWallets,
    isListingSettingsDirty,
    commitListingSnapshot,
    restoreListingFromSnapshot,
    buildSettingsPayload,
  }
}
