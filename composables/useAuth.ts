import { storeToRefs } from 'pinia'
import { useWalletStore } from '~/stores/wallet'
import { useBookstoreApiStore } from '~/stores/book-store-api'
import { SIGN_AUTHORIZATION_PERMISSIONS } from '~/utils/auth'

export function useAuth () {
  const bookstoreApiStore = useBookstoreApiStore()
  const store = useWalletStore()
  const { wallet, isConnected } = storeToRefs(store)
  const { connect, disconnect, signMessageMemo } = store
  const { authenticate, clearSession, fetchBookListing } = bookstoreApiStore
  const { intercomToken } = storeToRefs(bookstoreApiStore)
  const toast = useToast()
  const { t: $t } = useI18n()

  const isAuthenticating = ref(false)
  const loginStatus = ref<string | undefined>('')

  async function authenticateBySignature (signature: {
    signature: string,
    message: any,
    wallet: string,
    signMethod: string,
    expiresIn: string,
  }) {
    loginStatus.value = $t('auth_state.connecting')

    try {
      isAuthenticating.value = true

      await authenticate(signature.wallet, signature)
      if (window.Intercom && intercomToken.value) {
        window.Intercom('update', {
          intercom_user_jwt: intercomToken.value,
          session_duration: 2592000000, // 30d
          evm_wallet: signature.wallet
        })
      }
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
    let connectResult: any
    loginStatus.value = $t('auth_state.connecting')

    try {
      isAuthenticating.value = true
      setupPostAuthRedirect()

      if (!wallet.value) {
        connectResult = await connect(connectorId)
      }
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
        const maxRetries = 2

        for (let retryCount = 0; retryCount < maxRetries && !isRegistered; retryCount++) {
          try {
            isRegistered = await store.register({ walletAddress, email, loginMethod, magicUserId, magicDIDToken })
          } catch (error) {
            toast.add({
              icon: 'i-heroicons-exclamation-circle',
              title: (error as Error).toString(),
              timeout: 10000,
              color: 'red',
              ui: {
                title: 'text-red-400 dark:text-red-400'
              }
            })
          }
        }

        if (!isRegistered) {
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

      await authenticateBySignature(signature)
    } catch (err) {
      clearSession()
      if (isConnected.value) {
        await disconnect()
      }
      // eslint-disable-next-line no-console
      console.error(err)
      toast.add({
        icon: 'i-heroicons-exclamation-circle',
        title: (err as Error).toString(),
        timeout: 0,
        color: 'red',
        ui: {
          title: 'text-red-400 dark:text-red-400'
        }
      })
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
