// Module-level memo: the app is client-only (SSG), so a single instance
// is safe; the token is read per request inside onRequest, surviving
// login/logout without re-creating the instance.
let apiFetch: typeof $fetch | undefined

export function useLikeCoApiFetch(): typeof $fetch {
  if (!apiFetch) {
    const { LIKE_CO_API } = useRuntimeConfig().public
    apiFetch = $fetch.create({
      baseURL: LIKE_CO_API as string,
      onRequest({ options }) {
        const { token } = useBookstoreApiStore()
        if (token) {
          options.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    })
  }
  return apiFetch
}
