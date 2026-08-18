import type { ClassListingData } from '~/types'
import { PREVIEW_PERCENTAGE_DEFAULT } from '~/constant'

// The page-level instance shared by every tab that edits listing fields. One
// instance per class: the settings POST echoes every field back, so two
// instances would overwrite each other's edits.
export type BookListingSettingsContext = ReturnType<typeof useBookListingSettings>

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
  const isPreviewEnabled = ref(false)
  const previewPercentage = ref(PREVIEW_PERCENTAGE_DEFAULT)
  const mustClaimToView = ref(true)
  const descriptionFull = ref<string | undefined>('')
  const tableOfContents = ref('')
  const moderatorWallets = ref<string[]>([])
  const connectedWallets = ref<Record<string, number> | null>(null)
  // Snapshot of the listing fields taken on load/save; save only POSTs when the
  // current values diverge from it.
  const listingSnapshot = ref('')

  function currentListingFields(): Record<string, unknown> {
    return {
      isAdultOnly: isAdultOnly.value,
      hideAudio: hideAudio.value,
      hideDownload: hideDownload.value,
      isPlusReadingEnabled: isPlusReadingEnabled.value,
      isPreviewEnabled: isPreviewEnabled.value,
      previewPercentage: previewPercentage.value,
      descriptionFull: descriptionFull.value ?? '',
      tableOfContents: tableOfContents.value,
      moderatorWallets: moderatorWallets.value,
    }
  }

  function currentListingSnapshot(): string {
    return JSON.stringify(currentListingFields())
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
    // Existing listings without the field are treated as preview-disabled.
    isPreviewEnabled.value = classListingInfo.isPreviewEnabled ?? false
    previewPercentage.value = clampPreviewPercentage(classListingInfo.previewPercentage ?? PREVIEW_PERCENTAGE_DEFAULT)
    tableOfContents.value = classListingInfo.tableOfContents ?? ''
    descriptionFull.value = classListingInfo.descriptionFull ?? ''
    listingSnapshot.value = currentListingSnapshot()
  }

  watch(() => options.classListingInfo().ownerWallet, () => {
    // The page fetches listing info async; (re-)init once it arrives.
    initListingFieldsFromInfo()
  }, { immediate: true })

  // The load above already forces it, but pricing an edition down to free
  // mid-session has to force it too. The server has no equivalent default — it
  // writes whatever we send — so this is the only thing that opts a free book in.
  watch(() => options.isFreeBook.value, (isFree) => {
    if (isFree) { isPlusReadingEnabled.value = true }
  })

  // Derived from the key list so what the pending-changes bar counts and what
  // save decides to POST can never disagree.
  function isListingSettingsDirty(): boolean {
    return changedSettingKeys().length > 0
  }

  // The snapshotted keys that currently differ, for hosts that list pending
  // changes individually rather than as one boolean.
  function changedSettingKeys(): string[] {
    return getChangedKeysFromSnapshot(listingSnapshot.value, currentListingFields())
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
      isPreviewEnabled.value = snapshot.isPreviewEnabled
      previewPercentage.value = snapshot.previewPercentage
      descriptionFull.value = snapshot.descriptionFull
      tableOfContents.value = snapshot.tableOfContents
      moderatorWallets.value = snapshot.moderatorWallets
    }
    catch {
      initListingFieldsFromInfo()
    }
  }

  // Echoes back loaded-but-uneditable fields (mustClaimToView, connectedWallets)
  // so the API keeps them. enableCustomMessagePage is omitted on purpose: the API
  // turns it on by itself (signature upload), so echoing a stale value clears it.
  function buildSettingsPayload() {
    return {
      moderatorWallets: moderatorWallets.value,
      connectedWallets: connectedWallets.value,
      hideDownload: hideDownload.value,
      hideAudio: hideAudio.value,
      isAdultOnly: isAdultOnly.value,
      isPlusReadingEnabled: isPlusReadingEnabled.value,
      isPreviewEnabled: isPreviewEnabled.value,
      previewPercentage: previewPercentage.value,
      mustClaimToView: mustClaimToView.value,
      tableOfContents: tableOfContents.value,
      // Toggling the field off sets this to undefined; send '' so the listing
      // value is cleared instead of omitted (which would keep the old value).
      descriptionFull: descriptionFull.value ?? '',
    }
  }

  return {
    isAdultOnly,
    hideAudio,
    hideDownload,
    isPlusReadingEnabled,
    isPreviewEnabled,
    previewPercentage,
    descriptionFull,
    tableOfContents,
    moderatorWallets,
    isListingSettingsDirty,
    changedSettingKeys,
    commitListingSnapshot,
    restoreListingFromSnapshot,
    buildSettingsPayload,
  }
}
