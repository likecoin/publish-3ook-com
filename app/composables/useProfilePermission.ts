// Module-level so the settings page and its cards share one pending flag —
// `useAuth()` allocates a fresh `isAuthenticating` ref per call.
const isRequestingPermission = ref(false)

export function useProfilePermission() {
  const { t: $t } = useI18n()
  const { canEditProfile } = storeToRefs(useBookstoreApiStore())
  const { upgradeSessionPermissions } = useAuth()
  const { showSuccessToast } = useToastComposable()

  // Resolves true when the session may write the profile, re-signing first
  // if the current token predates the profile scope.
  async function requestProfilePermission() {
    if (canEditProfile.value) { return true }
    if (isRequestingPermission.value) { return false }
    isRequestingPermission.value = true
    try {
      const isUpgraded = await upgradeSessionPermissions()
      if (isUpgraded) {
        showSuccessToast($t('user_settings.profile_permission_granted'))
      }
      return isUpgraded
    }
    finally {
      isRequestingPermission.value = false
    }
  }

  return { canEditProfile, isRequestingPermission, requestProfilePermission }
}
