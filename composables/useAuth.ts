export function useAuth () {
  const bookstoreApiStore = useBookstoreApiStore()
  const store = useWalletStore()
  const { wallet, isConnected } = storeToRefs(store)
  const { connect, disconnect, signMessageMemo } = store
  const { authenticate, clearSession, fetchBookListing } = bookstoreApiStore
  const { showErrorToast } = useToastComposable()
  const { t: $t } = useI18n()

  const isAuthenticating = ref(false)
  const loginStatus = ref<string | undefined>('')

  async function authenticateBySignature (signature: {
    signature: string,
    message: string,
    wallet: string,
    signMethod: string,
    expiresIn: string,
  }, context?: { email?: string }) {
    loginStatus.value = $t('auth_state.connecting')

    try {
      isAuthenticating.value = true

      await authenticate(signature.wallet, signature)
      useSetLogUser(signature.wallet, { email: context?.email })
      useLogEvent('login', { method: signature.signMethod, wallet: signature.wallet })
      loginStatus.value = $t('auth_state.success')
      try {
        await fetchBookListing()
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err)
      }
    } finally {
      isAuthenticating.value = false
      loginStatus.value = ''
    }
  }

  async function authenticateByConnectorId (connectorId = 'magic') {
    let connectResult: { walletAddress: string; email?: string; loginMethod: string; magicUserId?: string; magicDIDToken?: string } | undefined
    loginStatus.value = $t('auth_state.connecting')

    try {
      setupPostAuthRedirect()

      bookstoreApiStore.closeLoginPanel()

      useLogEvent('login_started', { method: connectorId })

      if (!wallet.value) {
        connectResult = await connect(connectorId) || undefined
      }

      isAuthenticating.value = true
      if (!wallet.value) {
        return
      }

      if (!connectResult) {
        clearSession()
        if (isConnected.value) {
          await disconnect()
        }
        return
      }

      const { walletAddress, email, loginMethod, magicUserId, magicDIDToken } = connectResult
      let isRegistered = await store.checkIsRegistered({ walletAddress, email, magicDIDToken, loginMethod })

      if (!isRegistered) {
        useLogEvent('sign_up_started', { method: loginMethod, wallet: walletAddress })
        const maxRetries = 2

        for (let retryCount = 0; retryCount < maxRetries && !isRegistered; retryCount++) {
          try {
            isRegistered = await store.register({ walletAddress, email, loginMethod, magicUserId, magicDIDToken })
          } catch (error) {
            showErrorToast(error)
          }
        }

        if (!isRegistered) {
          useLogEvent('sign_up_failed', { method: loginMethod, wallet: walletAddress })
          if (window.Intercom) {
            window.Intercom('showNewMessage', $t('intercom.registration_failed_message', {
              walletAddress
            }))
          }
          return
        }
      }

      const signature = await signMessageMemo(
        'authorize',
        SIGN_AUTHORIZATION_PERMISSIONS
      )

      if (!signature) {
        return
      }

      await authenticateBySignature(signature, { email: connectResult?.email })
    } catch (err) {
      useLogEvent('login_failed', { method: connectorId, error: (err as Error)?.message })
      clearSession()
      if (isConnected.value) {
        await disconnect()
      }
      // eslint-disable-next-line no-console
      console.error(err)
      showErrorToast(err)
    } finally {
      isAuthenticating.value = false
      loginStatus.value = ''
      clearPostAuthRedirect()
    }
  }

  return {
    isAuthenticating,
    authenticateBySignature,
    authenticateByConnectorId,
    loginStatus
  }
}
