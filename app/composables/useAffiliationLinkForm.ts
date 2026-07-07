import { AFFILIATION_CHANNELS } from '~/constant'

function constructUTMQueryString(input: {
  utmCampaign?: string
  utmSource?: string
  utmMedium?: string
} = {}) {
  const searchParams = new URLSearchParams()
  if (input.utmCampaign) {
    searchParams.set('utm_campaign', input.utmCampaign)
  }
  if (input.utmSource) {
    searchParams.set('utm_source', input.utmSource)
  }
  if (input.utmMedium) {
    searchParams.set('utm_medium', input.utmMedium)
  }
  return searchParams.toString().replace('?', '')
}

// Owns the affiliation-link generator form: product-id/channel inputs (with
// route-query prefill), destination selection, UTM inputs and their derived
// merged query string, and validation error state.
export function useAffiliationLinkForm() {
  const route = useRoute()
  const likerStore = useLikerStore()
  const { t: $t } = useI18n()

  const productIdInputModelValue = ref('')
  const productIdInputModel = computed<string>({
    get: () => {
      if (productIdInputModelValue.value) {
        return productIdInputModelValue.value
      }
      const productIdQs = route.query.product_id
      if (productIdQs) {
        if (Array.isArray(productIdQs)) {
          return productIdQs.join('\n')
        }
        return productIdQs
      }
      return ''
    },
    set: (value: string) => {
      productIdInputModelValue.value = value
    },
  })

  const productIdInputs = computed(() => {
    return productIdInputModel.value.split('\n')
      .map(input => input.trim())
      .filter(Boolean)
  })
  const productIdInput = computed(() => {
    return productIdInputs.value[0] || ''
  })

  const productIds = computed(() => {
    return productIdInputs.value.map((idInput: string) => {
      let input: string | undefined = idInput.trim()

      if (input.startsWith('http')) {
        const url = new URL(input)
        input = url.pathname.split('/').pop()
      }

      if (input?.startsWith('0x')) {
        return input
      }

      return ''
    }).filter(Boolean)
  })
  const productId = computed(() => {
    return productIds.value[0] || ''
  })

  const utmCampaignInput = ref('')
  const utmCampaignDefault = 'bookpress'
  const shouldPrefixChannelIdForUTMCampaign = ref(true)

  const utmMediumInput = ref('')
  const utmMediumDefault = 'affiliate'

  const utmSourceInput = ref('')
  const utmSourceDefault = computed(() => {
    const isUseLikerLandLink = destinationSetting.value === 'liker_land'
    if (isUsingCustomDestination.value) {
      return 'custom-link'
    }
    return isUseLikerLandLink ? 'likerland' : 'stripe'
  })

  const linkQueryInputModel = ref('')
  const additionalQueryStringInput = computed({
    get: () => {
      if (linkQueryInputModel.value) {
        return linkQueryInputModel.value
      }
      return constructUTMQueryString({
        utmCampaign: utmCampaignInput.value,
        utmSource: utmSourceInput.value,
        utmMedium: utmMediumInput.value,
      })
    },
    set: (value) => {
      linkQueryInputModel.value = value
    },
  })

  const additionalQueryStringInputPlaceholder = computed(() => {
    return constructUTMQueryString({
      utmCampaign: utmCampaignDefault,
      utmSource: utmSourceDefault.value,
      utmMedium: utmMediumDefault,
    })
  })

  const linkQueryDefault = computed(() => {
    return {
      utm_medium: utmMediumDefault,
      utm_source: utmSourceDefault.value,
      utm_campaign: utmCampaignDefault,
    }
  })
  const mergedQueryStringObject = computed<Record<string, string>>(() => {
    const mergedObject = { ...linkQueryDefault.value }

    const input = productIdInput.value?.trim() || ''
    if (input.startsWith('http')) {
      const { searchParams } = new URL(input)
      searchParams.delete('from')
      Object.assign(mergedObject, Object.fromEntries(searchParams))
    }

    if (additionalQueryStringInput.value) {
      Object.assign(mergedObject, Object.fromEntries(new URLSearchParams(additionalQueryStringInput.value)))
    }

    return mergedObject
  })
  const commonQueryStringTableRows = computed(() => {
    return Object.entries(mergedQueryStringObject.value)
      .filter(([key]) => !(key === 'utm_campaign' && shouldPrefixChannelIdForUTMCampaign.value))
      .map(([key, value]) => ({
        key,
        value,
      }))
  })

  const destinationSettings = computed(() => [
    {
      name: $t('purchase_link.liker_land_product'),
      value: 'liker_land',
    },
    {
      name: $t('purchase_link.stripe_checkout'),
      value: 'direct',
    },
    {
      name: $t('purchase_link.custom_page'),
      value: 'custom',
    },
  ])
  const destinationSetting = ref(destinationSettings.value[0]?.value || 'liker_land')
  const isUsingCustomDestination = computed(() => destinationSetting.value === 'custom')
  const customDestinationURLInput = ref(route.query.custom_link as string || '')

  const customChannelInputValue = ref('')
  const customChannelInput = computed<string>({
    get: () => {
      if (customChannelInputValue.value) {
        return customChannelInputValue.value
      }
      const channelIdQs = route.query.from
      if (channelIdQs) {
        if (Array.isArray(channelIdQs)) {
          return channelIdQs.join(',')
        }
        return channelIdQs
      }
      return ''
    },
    set: (value: string) => {
      customChannelInputValue.value = value
    },
  })
  const customChannels = computed(
    () => customChannelInput.value
      .split(',')
      .map(channelId => channelId.trim())
      .filter(Boolean)
      .map((channelId) => {
        const channelInfo = likerStore.getChannelInfoById(channelId)
        return {
          id: channelId,
          name: channelInfo?.displayName || channelId,
        }
      }),
  )
  const shouldIncludeDefaultChannels = ref(false)
  const isIncludeDefaultChannels = computed({
    get: () => !customChannels.value.length || shouldIncludeDefaultChannels.value,
    set: (value) => {
      shouldIncludeDefaultChannels.value = value
    },
  })
  const allChannelTableRows = computed(() => {
    return customChannels.value.concat(isIncludeDefaultChannels.value ? AFFILIATION_CHANNELS : [])
  })
  const hasMoreThanOneChannel = computed(() => allChannelTableRows.value.length > 1)

  const productIdError = ref<string | false>(false)
  watch(productId, () => {
    productIdError.value = false
  })
  const customChannelInputError = ref<string | false>(false)
  watch(customChannelInput, () => {
    customChannelInputError.value = false
  })

  const creatingAffiliationLinkState = ref('')
  const isCreatingAffiliationLinks = computed(() => !!creatingAffiliationLinkState.value)
  const canCreateAffiliationLink = computed(() => {
    if (isUsingCustomDestination.value) {
      return !!customDestinationURLInput.value
    }
    return !!productId.value && !isCreatingAffiliationLinks.value
  })

  return {
    productIdInputModel,
    productIdInput,
    productIds,
    productId,
    utmCampaignInput,
    utmCampaignDefault,
    shouldPrefixChannelIdForUTMCampaign,
    utmMediumInput,
    utmMediumDefault,
    utmSourceInput,
    utmSourceDefault,
    additionalQueryStringInput,
    additionalQueryStringInputPlaceholder,
    linkQueryDefault,
    mergedQueryStringObject,
    commonQueryStringTableRows,
    destinationSettings,
    destinationSetting,
    isUsingCustomDestination,
    customDestinationURLInput,
    customChannelInput,
    customChannels,
    isIncludeDefaultChannels,
    allChannelTableRows,
    hasMoreThanOneChannel,
    productIdError,
    customChannelInputError,
    creatingAffiliationLinkState,
    isCreatingAffiliationLinks,
    canCreateAffiliationLink,
  }
}
