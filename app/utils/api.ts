export interface FetchLikerInfoResult {
  user: string
  displayName: string
  avatar: string
  wallet: string
  cosmosWallet: string
  likeWallet: string
  evmWallet: string
  isSubscribedCivicLiker: boolean
  civicLikerSince: number
  description: string
}

export async function useFetchLikerInfoById(likerId: string) {
  const { LIKE_CO_API } = useRuntimeConfig().public
  const url = `${LIKE_CO_API}/users/id/${likerId}/min`
  const result = await $fetch<FetchLikerInfoResult>(url)
  return result
}

export async function useFetchLikerInfoByWallet(wallet: string, { nocache = false } = {}) {
  const { LIKE_CO_API } = useRuntimeConfig().public
  const timestamp = nocache ? `?ts=${Math.round(new Date().getTime() / 1000)}` : ''
  const url = `${LIKE_CO_API}/users/addr/${wallet}/min${timestamp}`
  const result = await $fetch<FetchLikerInfoResult>(url)
  return result
}

export async function postRegisterCheck({
  accountId,
  walletAddress,
  email,
  magicDIDToken,
}: {
  accountId?: string
  walletAddress?: string
  email?: string
  magicDIDToken?: string
}) {
  const { LIKE_CO_API } = useRuntimeConfig().public
  const url = `${LIKE_CO_API}/users/new/check`

  const result = await $fetch(url, {
    method: 'POST',
    body: {
      accountId,
      walletAddress,
      email,
      magicDIDToken,
    },
  })
  return result
}

export async function postNewUser({
  walletAddress,
  signature,
  message,
  accountId,
  email,
  magicUserId,
  magicDIDToken,
}: {
  walletAddress: string
  signature: string
  message: string
  accountId: string
  email: string
  magicUserId?: string
  magicDIDToken?: string
}) {
  const { LIKE_CO_API } = useRuntimeConfig().public
  const result = await $fetch(`${LIKE_CO_API}/users/new`, {
    method: 'POST',
    body: {
      from: walletAddress,
      sign: signature,
      payload: message,
      platform: 'evmWallet',
      user: accountId,
      email,
      magicUserId,
      magicDIDToken,
    },
  })
  return result
}

export interface OrderData {
  id: string
  email: string
  wallet: string
  classId: string
  price: number
  quantity?: number
  status: string
  timestamp: number
  message: string
}

export interface OrdersResponse {
  orders: OrderData[]
}

export async function fetchBookOrders(classId: string) {
  const apiFetch = useLikeCoApiFetch()
  const result = await apiFetch<OrdersResponse>(`/likernft/book/purchase/${classId}/orders`)
  return result
}

export interface AuthResponse {
  token: string
  intercomToken: string
}

export interface BookListingItem {
  classId: string
  name?: string
  pendingNFTCount?: number
  prices?: { price: number }[]
  sold?: number
}

export interface BookListingResponse {
  nextKey?: number
  list: BookListingItem[]
}

export interface BookListingSettingPayload {
  moderationData?: Record<string, unknown>
  [key: string]: unknown
}

export interface StripeRefreshResponse {
  isReady: boolean
}
