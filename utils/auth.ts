import { jwtDecode } from 'jwt-decode'

const AUTH_SESSION_KEY = 'likecoin_nft_book_press_token'
const POST_AUTH_REDIRECT_ROUTE_KEY = 'likecoin_nft_book_press_post_auth_redirect'
const SHARED_COOKIE_DOMAIN = '.3ook.com'

function getCookie (name: string): string | null {
  try {
    const cookies = document.cookie.split(';')
    const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
    if (cookie) {
      return decodeURIComponent(cookie.split('=')[1])
    }
  } catch {}
  return null
}

function setCookie (name: string, value: string, maxAge: number = 30 * 24 * 60 * 60) {
  try {
    const isProduction = window.location.hostname.includes('3ook.com')
    const domain = isProduction ? SHARED_COOKIE_DOMAIN : ''
    const domainAttr = domain ? `; domain=${domain}` : ''
    const secureAttr = window.location.protocol === 'https:' ? '; secure' : ''

    document.cookie = `${name}=${encodeURIComponent(value)}${domainAttr}; path=/; max-age=${maxAge}; samesite=lax${secureAttr}`
  } catch (error) {
    console.error('Failed to set cookie', error)
  }
}

function deleteCookie (name: string) {
  try {
    const isProduction = window.location.hostname.includes('3ook.com')
    const domain = isProduction ? SHARED_COOKIE_DOMAIN : ''
    const domainAttr = domain ? `; domain=${domain}` : ''

    document.cookie = `${name}=; path=/; max-age=0${domainAttr}`
  } catch (error) {
    console.error('Failed to delete cookie', error)
  }
}

export function loadAuthSession () {
  try {
    const cookieData = getCookie(AUTH_SESSION_KEY)
    if (cookieData) {
      const { wallet, token, intercomToken } = JSON.parse(cookieData)
      if (token && wallet) {
        if (window.localStorage) {
          window.localStorage.setItem(AUTH_SESSION_KEY, cookieData)
        }
        return { wallet, token, intercomToken }
      }
    }

    if (window.localStorage) {
      const data = window.localStorage.getItem(AUTH_SESSION_KEY)
      if (data) {
        const { wallet, token, intercomToken } = JSON.parse(data)
        if (token && wallet) {
          setCookie(AUTH_SESSION_KEY, data)
          return { wallet, token, intercomToken }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load auth session', error)
  }

  return null
}

export function saveAuthSession (session: { wallet: string, token: string, intercomToken?: string }) {
  try {
    const data = JSON.stringify(session)
    setCookie(AUTH_SESSION_KEY, data)

    if (window.localStorage) {
      window.localStorage.setItem(AUTH_SESSION_KEY, data)
    }
  } catch (error) {
    console.error('Failed to save auth session', error)
  }
}

export function clearAuthSession () {
  try {
    deleteCookie(AUTH_SESSION_KEY)

    if (window.localStorage) {
      window.localStorage.removeItem(AUTH_SESSION_KEY)
    }
  } catch (error) {
    console.error('Failed to clear auth session', error)
  }
}

export function setupPostAuthRedirect () {
  try {
    if (!window.sessionStorage) { return }

    const route = useRoute()
    window.sessionStorage.setItem(POST_AUTH_REDIRECT_ROUTE_KEY, route.fullPath)
  } catch {}
}

export async function executePostAuthRedirect () {
  try {
    if (!window.sessionStorage) { return }

    const route = window.sessionStorage.getItem(POST_AUTH_REDIRECT_ROUTE_KEY)
    const localeRoute = useLocaleRoute()
    await navigateTo(localeRoute(route || '/'), { replace: true })
  } finally {
    clearPostAuthRedirect()
  }
}

export function clearPostAuthRedirect () {
  try {
    if (!window.sessionStorage) { return }

    window.sessionStorage.removeItem(POST_AUTH_REDIRECT_ROUTE_KEY)
  } catch {}
}

export const SIGN_AUTHORIZATION_PERMISSIONS = [
  'read:nftbook',
  'write:nftbook',
  'write:iscn',
  'read:iscn'
] as const

export function checkJwtTokenValidity (token: string) {
  const decoded = jwtDecode(token)
  if (!decoded) {
    return false
  }
  const isExpired = decoded.exp && decoded.exp * 1000 < Date.now()
  const isMatchPermissions =
      Array.isArray((decoded as any).permissions) &&
      (decoded as any).permissions.length === SIGN_AUTHORIZATION_PERMISSIONS.length &&
      (decoded as any).permissions.every((perm: typeof SIGN_AUTHORIZATION_PERMISSIONS[number]) =>
        SIGN_AUTHORIZATION_PERMISSIONS.includes(perm)
      )
  return !isExpired && isMatchPermissions
}

export interface MigrateMagicEmailUserResponseData {
  isMigratedBookUser: boolean
  isMigratedBookOwner: boolean
  isMigratedLikerId: boolean
  isMigratedLikerLand: boolean
}

export async function migrateMagicEmailUser ({
  wallet,
  signature,
  message
}: {
    wallet: string
    signature: string
    message: string
  }) {
  const { LIKE_CO_API } = useRuntimeConfig().public

  const url = `${LIKE_CO_API}/users/new/migrate`
  const result = await $fetch<MigrateMagicEmailUserResponseData>(url, {
    method: 'POST',
    body: {
      wallet,
      signature,
      message
    }
  })
  return result
}
