import test from 'node:test'
import assert from 'node:assert/strict'

import { computed, nextTick, ref, watch } from 'vue'
import { createPinia, defineStore, setActivePinia, storeToRefs } from 'pinia'

// The store leans on Nuxt auto-imports, so provide them before loading it.
const likerFetchCalls = []
let cachedLikerInfo = null

Object.assign(globalThis, {
  ref,
  computed,
  watch,
  defineStore,
  storeToRefs,
  getApiErrorCode: () => undefined,
  useLikeCoApiFetch: () => async () => ({}),
  useBookstoreApiStore: defineStore('bookstore-api', () => ({
    isAuthenticated: ref(false),
    wallet: ref('0xabc'),
  })),
  useLikerStore: () => ({
    getLikerInfoByWallet: () => cachedLikerInfo,
    fetchLikerInfoByWallet: async (wallet, options) => {
      likerFetchCalls.push({ wallet, options })
      return { user: 'alice', displayName: 'New name' }
    },
  }),
})

const { useUserStore } = await import('../app/stores/user.ts')

test('refetches the profile uncached on sign-in, even when one is already stored', async () => {
  setActivePinia(createPinia())
  likerFetchCalls.length = 0
  cachedLikerInfo = { user: 'alice', displayName: 'Old name' }

  useUserStore()
  const bookstoreApiStore = globalThis.useBookstoreApiStore()
  bookstoreApiStore.isAuthenticated = true
  await nextTick()

  assert.deepEqual(likerFetchCalls, [{ wallet: '0xabc', options: { nocache: true } }])
})
