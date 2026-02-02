export const useUIStore = defineStore('ui', () => {
  const isSiteMenuOpen = ref(false)

  function setSiteMenuOpen (value: boolean) {
    isSiteMenuOpen.value = value
  }

  function toggleSiteMenuOpen () {
    isSiteMenuOpen.value = !isSiteMenuOpen.value
  }

  return {
    isSiteMenuOpen,
    setSiteMenuOpen,
    toggleSiteMenuOpen
  }
})
