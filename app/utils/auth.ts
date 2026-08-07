import { jwtDecode } from 'jwt-decode'

const AUTH_SESSION_KEY = 'likecoin_nft_book_press_token'
const POST_AUTH_REDIRECT_ROUTE_KEY = 'likecoin_nft_book_press_post_auth_redirect'

export function loadAuthSession() {
  try {
    if (window.localStorage) {
      const data = window.localStorage.getItem(AUTH_SESSION_KEY)
      if (data) {
        const { wallet, token, intercomToken } = JSON.parse(data)
        return {
          wallet,
          token,
          intercomToken,
        }
      }
    }
  }
  catch {}

  return null
}

export function saveAuthSession(session: { wallet: string, token: string, intercomToken?: string }) {
  try {
    if (!window.localStorage) { return }

    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  }
  catch {}
}

export function clearAuthSession() {
  try {
    if (!window.localStorage) { return }

    window.localStorage.removeItem(AUTH_SESSION_KEY)
  }
  catch {}
}

export function setupPostAuthRedirect() {
  try {
    if (!window.sessionStorage) { return }

    const route = useRoute()
    window.sessionStorage.setItem(POST_AUTH_REDIRECT_ROUTE_KEY, route.fullPath)
  }
  catch {}
}

export async function executePostAuthRedirect() {
  try {
    if (!window.sessionStorage) { return }

    const route = window.sessionStorage.getItem(POST_AUTH_REDIRECT_ROUTE_KEY)
    const localeRoute = useLocaleRoute()
    await navigateTo(localeRoute(route || '/'), { replace: true })
  }
  finally {
    clearPostAuthRedirect()
  }
}

export function clearPostAuthRedirect() {
  try {
    if (!window.sessionStorage) { return }

    window.sessionStorage.removeItem(POST_AUTH_REDIRECT_ROUTE_KEY)
  }
  catch {}
}

// The subset a session must carry to be usable at all. Kept narrower than
// what we request so older sessions and the signed hand-off from 3ook.com
// still restore; profile editing is gated separately on `write:profile`.
export const REQUIRED_SESSION_PERMISSIONS = [
  'read:nftbook',
  'write:nftbook',
  'write:iscn',
  'read:iscn',
] as const

export const PROFILE_WRITE_PERMISSION = 'write:profile'

export const SIGN_AUTHORIZATION_PERMISSIONS = [
  ...REQUIRED_SESSION_PERMISSIONS,
  'read:profile',
  PROFILE_WRITE_PERMISSION,
] as const

function decodeToken(token: string) {
  try {
    return jwtDecode(token) as { exp?: number, permissions?: string[] } | null
  }
  catch {
    return null
  }
}

export function checkJwtTokenPermission(token: string, permission: string) {
  return !!decodeToken(token)?.permissions?.includes(permission)
}

export function checkJwtTokenValidity(token: string) {
  const decoded = decodeToken(token)
  if (!decoded) {
    return false
  }
  const isExpired = decoded.exp && decoded.exp * 1000 < Date.now()
  const { permissions } = decoded
  const isMatchPermissions = Array.isArray(permissions)
    && REQUIRED_SESSION_PERMISSIONS.every(perm => permissions.includes(perm))
  return !isExpired && isMatchPermissions
}

export interface MigrateMagicEmailUserResponseData {
  isMigratedBookUser: boolean
  isMigratedBookOwner: boolean
  isMigratedLikerId: boolean
  isMigratedLikerLand: boolean
}

export async function migrateMagicEmailUser({
  wallet,
  signature,
  message,
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
      message,
    },
  })
  return result
}
