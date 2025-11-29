import { defineStore } from 'pinia'
import { FetchError } from 'ofetch'
import { useConnection, useConnect, useDisconnect, useSignMessage } from '@wagmi/vue'
import { base, baseSepolia } from '@wagmi/vue/chains'
import { checksumAddress, UserRejectedRequestError } from 'viem'
import type { Magic } from 'magic-sdk'
import { clearUploadFileData } from '~/utils/uploadFile'
import { RegistrationModal } from '#components'

export const useWalletStore = defineStore('wallet', () => {
  const { connectors, connectAsync: wagmiConnect, status } = useConnect()
  const { disconnectAsync: wagmiDisconnect } = useDisconnect()
  const { address, isConnected, chain } = useConnection()
  const { signMessageAsync } = useSignMessage()
  const bookstoreApiStore = useBookstoreApiStore()
  const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
  const { LIKECOIN_V3_BOOK_MIGRATION_SITE_URL } = useRuntimeConfig().public
  const { $wagmiConfig } = useNuxtApp()

  const toast = useToast()
  const modal = useModal()
  const { t: $t } = useI18n()

  const isLoginLoading = ref(false)

  const wallet = computed(() => address.value ? checksumAddress(address.value) : undefined)

  const getLikeCoinV3BookMigrationSiteURL = computed(() => ({ utmSource }: { utmSource?: string } = {}) => {
    const { locale } = useI18n()

    let baseUrl = LIKECOIN_V3_BOOK_MIGRATION_SITE_URL
    if (locale.value === 'en') {
      baseUrl = `${baseUrl}/en`
    }

    const migrationURL = appendUTMParamsToURL({
      url: baseUrl,
      source: `publish_${utmSource}`,
      medium: 'publish'
    })

    return migrationURL.toString()
  })

  async function initIfNecessary () {
    if (!isConnected.value) {
      await connect()
    }
  }

  async function validateWalletConsistency () {
    await initIfNecessary()

    if (wallet.value && sessionWallet.value && wallet.value !== sessionWallet.value) {
      toast.add({
        icon: 'i-heroicons-exclamation-triangle',
        title: $t('wallet_changed_warning', {
          current: wallet.value.slice(0, 6) + '...',
          session: sessionWallet.value.slice(0, 6) + '...'
        }),
        timeout: 3000,
        color: 'amber',
        ui: {
          title: 'text-amber-600 dark:text-amber-400'
        }
      })

      bookstoreApiStore.clearSession()
      await disconnect()

      throw new Error('WALLET_NOT_MATCH')
    }

    return true
  }

  async function connect (connectorId = 'magic') {
    try {
      // Disconnect any existing connection
      await wagmiDisconnect()

      const { IS_TESTNET } = useRuntimeConfig().public
      const chainId = IS_TESTNET ? baseSepolia.id : base.id
      const connector = connectors.find(
        (c: { id: string }) => c.id === connectorId
      )
      if (!connector) { return }
      await wagmiConnect({ connector, chainId })

      isLoginLoading.value = true

      const walletAddress = address.value
      if (status.value !== 'success' || !walletAddress) {
        throw createError({
          statusCode: 400,
          message: $t('error_connect_wallet_failed'),
          fatal: true
        })
      }

      // Get email from Magic SDK if using Magic Link
      let email: string | undefined
      let magicUserId: string | undefined
      let magicDIDToken: string | undefined
      const loginMethod = connector.id
      if (loginMethod === 'magic' && 'magic' in connector) {
        const magic = connector.magic as Magic
        try {
          const userInfo = await magic.user.getInfo()
          if (userInfo.email) {
            email = userInfo.email
          }
          if (userInfo.issuer) {
            magicUserId = userInfo.issuer
          }
          magicDIDToken = await magic.user.getIdToken()
        } catch (error) {
          console.warn('Failed to fetch user info from Magic SDK', error)
        }
      }

      // Return connection info for registration handling in useAuth
      return { walletAddress, email, loginMethod, magicUserId, magicDIDToken }
    } catch (error) {
      await wagmiDisconnect().catch(() => {
      })

      if (error instanceof UserRejectedRequestError) {
        return
      }
      if (error instanceof FetchError && error.data?.message === 'EMAIL_ALREADY_USED') {
        return
      }
      console.error('Failed to connect wallet', error)
      return false
    }
  }

  async function signMessageMemo (action: string, permissions?: readonly string[]) {
    if (!wallet.value) {
      await connect()
    }
    if (!wallet.value) {
      throw new Error('WALLET_NOT_INITED')
    }
    const ts = Date.now()
    const payload = JSON.stringify({
      action,
      permissions,
      evmWallet: wallet.value,
      ts
    })
    const signed = await signMessageAsync({ message: payload })
    return {
      signature: signed,
      message: payload,
      wallet: wallet.value,
      signMethod: 'personal_sign',
      expiresIn: '7d'
    }
  }

  function disconnect () {
    clearUploadFileData()
    return wagmiDisconnect()
  }

  // Validate chain ID on reconnect
  watch([chain, isConnected], async ([currentChain, connected]) => {
    if (connected && currentChain) {
      const validChainIds = $wagmiConfig.chains.map(c => c.id)
      const hasValidConnection = validChainIds.includes(currentChain.id)

      if (!hasValidConnection) {
        await disconnect()
      }
    }
  })

  async function checkIsRegistered ({
    walletAddress,
    email,
    magicDIDToken,
    loginMethod
  }: {
    walletAddress: string
    email?: string
    magicDIDToken?: string
    loginMethod: string
  }) {
    try {
      const userInfoRes = await useFetchLikerInfoByWallet(walletAddress, { nocache: true })
      if (userInfoRes?.user) {
        // If user info is fetched successfully, it means the wallet address is registered
        return true
      }
    } catch (error) {
      if (!(error instanceof FetchError && error.statusCode === 404)) {
        console.warn(`Failed to fetch user info for wallet ${walletAddress} in account refresh`, error)
      }
    }
    try {
      await postRegisterCheck({ walletAddress, email, magicDIDToken })
      // If the request succeeds, it means there is no account associated with the wallet address and email
      return false
    } catch (error) {
      if (error instanceof FetchError) {
        switch (error.data?.error) {
          case 'EMAIL_ALREADY_USED':
            if (!error.data?.evmWallet && error.data?.likeWallet) {
              try {
                const message = JSON.stringify({
                  action: 'migrate',
                  evmWallet: walletAddress,
                  email,
                  magicDIDToken,
                  ts: Date.now()
                }, null, 2)
                const signature = await signMessageAsync({ message })
                const res = await migrateMagicEmailUser({
                  wallet: walletAddress,
                  signature,
                  message
                })
                if (res.isMigratedLikerId) {
                  return true
                }
              } catch (e) {
                if (!(e instanceof UserRejectedRequestError)) {
                  // eslint-disable-next-line no-console
                  console.error('Failed to migrate email user', e)
                }
              }
            }
            throw new Error(getEmailAlreadyUsedErrorData({
              email: email as string,
              walletAddress,
              boundEVMWallet: error.data?.evmWallet,
              boundLikeWallet: error.data?.likeWallet,
              loginMethod
            })?.data.description || error.data?.message)
          case 'EVM_WALLET_ALREADY_EXIST':
            // Already registered
            return true

          default:
        }
      }
      throw error
    }
  }

  function getEmailAlreadyUsedErrorData ({
    email,
    walletAddress,
    boundEVMWallet,
    boundLikeWallet,
    loginMethod
  }: {
    email: string
    walletAddress: string
    boundEVMWallet?: string
    boundLikeWallet?: string
    loginMethod: string
  }) {
    const shouldMigrate = !boundEVMWallet && !!boundLikeWallet
    return {
      statusCode: 401,
      data: {
        level: 'warning',
        title: shouldMigrate
          ? $t('account_register_error_email_already_used_migrate_title')
          : $t('account_register_error_email_already_used_by_wallet_title'),
        description: getEmailAlreadyUsedErrorMessage({
          email,
          evmWallet: boundEVMWallet,
          likeWallet: boundLikeWallet
        }),
        tags: [
          { label: loginMethod, icon: 'i-material-symbols-login-rounded', class: 'font-mono' },
          { label: walletAddress, icon: 'i-material-symbols-key-outline-rounded', class: 'font-mono' }
        ],
        actions: shouldMigrate
          ? [{
              label: $t('account_register_error_contact_support'),
              color: 'secondary',
              variant: 'subtle',
              onClick: async () => {
                await navigateTo(getLikeCoinV3BookMigrationSiteURL.value({ utmSource: 'login_email_already_used' }), {
                  external: true,
                  open: { target: '_blank' }
                })
              }
            }]
          : []
      }
    }
  }

  function getEmailAlreadyUsedErrorMessage ({
    email,
    evmWallet,
    likeWallet
  }: {
    email: string
    evmWallet?: string
    likeWallet?: string
  }) {
    if (evmWallet) {
      return $t('account_register_error_email_already_used_with_evm_wallet', { email, evmWallet })
    }
    if (likeWallet) {
      return $t('account_register_error_email_already_used_with_like_wallet', { email, likeWallet })
    }
    return $t('account_register_error_email_already_used', { email })
  }

  async function register ({
    walletAddress,
    email: prefilledEmail,
    loginMethod,
    magicUserId,
    magicDIDToken
  }: {
    walletAddress: string
    email?: string
    loginMethod: string
    magicUserId?: string
    magicDIDToken?: string
  }) {
    let tempAccountId = generateAccountIdFromWalletAddress(walletAddress)
    try {
      await postRegisterCheck({ accountId: tempAccountId })
    } catch (error) {
      if (error instanceof FetchError && error.data?.error === 'USER_ALREADY_EXIST') {
        tempAccountId = error.data.alternative as string
      } else {
        throw error
      }
    }

    const payload = {
      accountId: tempAccountId,
      email: prefilledEmail
    }

    if (!payload.email) {
      type ModalResult = { accountId: string; email: string; displayName?: string }
      let modalResult: ModalResult | null = null
      // Close login panel first to avoid focus trap
      bookstoreApiStore.closeLoginPanel()
      await nextTick()
      await new Promise<void>((resolve) => {
        modal.open(RegistrationModal, {
          email: payload?.email,
          accountId: payload?.accountId,
          isAccountIdHidden: true,
          isDisplayNameHidden: true,
          onSubmit: (data: ModalResult) => {
            modalResult = data
            modal.close()
            resolve()
          },
          onClose: () => {
            modal.close()
            resolve()
          }
        })
      })
      if (!modalResult) {
        // User canceled the registration
        return false
      }
      const result = modalResult as ModalResult
      payload.accountId = result.accountId
      payload.email = result.email
    }

    const message = JSON.stringify(
      {
        action: 'register',
        evmWallet: walletAddress,
        email: payload.email,
        ts: Date.now()
      },
      null,
      2
    )

    const signature = await signMessageAsync({ message })

    try {
      await postNewUser({
        walletAddress,
        signature,
        message,
        accountId: payload.accountId,
        email: payload.email,
        magicUserId,
        magicDIDToken
      })
    } catch (error) {
      if (error instanceof FetchError) {
        switch (error.data) {
          case 'INVALID_USER_ID': {
            throw new Error($t('account_register_error_invalid_account_id', { id: payload?.accountId }))
          }
          case 'EMAIL_ALREADY_USED': {
            throw new Error(getEmailAlreadyUsedErrorData({
              email: payload?.email as string,
              walletAddress,
              boundEVMWallet: error.data?.evmWallet,
              boundLikeWallet: error.data?.likeWallet,
              loginMethod
            })?.data.description || error.data?.message)
          }
          default:
        }
      }
      throw error
    }

    return true
  }

  return {
    wallet,
    signer: ref({}),
    isConnected,
    isLoginLoading,
    initIfNecessary,
    validateWalletConsistency,
    connect,
    disconnect,
    signMessageMemo,
    checkIsRegistered,
    register
  }
})
