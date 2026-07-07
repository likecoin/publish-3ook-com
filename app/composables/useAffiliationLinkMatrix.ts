import { AFFILIATION_CHANNEL_DEFAULT } from '~/constant'
import type { AffiliationLink, ProductData } from '~/types'

// Derives the product × channel affiliation-link matrix (edition options,
// product rows, per-channel link rows) from the fetched product data and the
// generator form's channel/UTM/destination state.
export function useAffiliationLinkMatrix(form: ReturnType<typeof useAffiliationLinkForm>) {
  const {
    allChannelTableRows,
    isUsingCustomDestination,
    customDestinationURLInput,
    destinationSetting,
    mergedQueryStringObject,
    linkQueryDefault,
    shouldPrefixChannelIdForUTMCampaign,
  } = form

  const productDataList = ref<{ id: string, data: ProductData }[] | undefined>(undefined)

  const productEditionOptionsMap = computed(() => {
    const optionsMap: Record<string, { label: string, value: number }[]> = {}
    if (productDataList.value) {
      for (const { id, data } of productDataList.value) {
        if (data.prices) {
          optionsMap[id] = data.prices.map((price) => {
            let name = ''
            if (typeof price.name === 'object') {
              name = price.name?.zh || price.name?.en || ''
            }
            else {
              name = price.name || ''
            }
            return {
              label: [name, `$${price.price}`].filter(Boolean).join(' - '),
              value: price.index || 0,
            }
          })
        }
        else {
          optionsMap[id] = []
        }
      }
    }
    return optionsMap
  })
  const productEditionSelectModelValue = ref<Record<string, number>>({})

  const productTableRows = computed(() => {
    return productDataList.value?.map(({ id, data }) => ({
      id,
      name: typeof data.name === 'object' ? (data.name?.zh || data.name?.en) : data.name,
      editionOptions: productEditionOptionsMap.value[id] || [],
    })) || []
  })

  const linkTableRowsMapByChannel = computed(() => {
    const map = new Map<string, AffiliationLink[]>()

    const channels = [...new Map(allChannelTableRows.value.map(c => [c.id, c])).values()]

    const items = isUsingCustomDestination.value
      ? [{ id: 'custom', data: { name: 'Custom' } }]
      : productDataList.value || []

    items.forEach(({ id, data }) => {
      channels.forEach((channel) => {
        if (!map.has(channel.id)) {
          map.set(channel.id, [])
        }
        const utmCampaignInput = mergedQueryStringObject.value.utm_campaign
        let utmCampaign = utmCampaignInput || linkQueryDefault.value.utm_campaign || ''
        if (shouldPrefixChannelIdForUTMCampaign.value && channel.id !== AFFILIATION_CHANNEL_DEFAULT) {
          utmCampaign = `${convertChannelIdToLikerId(channel.id)}_${utmCampaign}`
        }

        const priceIndex = productEditionSelectModelValue.value[id] || 0
        const urlConfig: {
          classId: string
          channel: string
          priceIndex: number
          customLink?: string
          isUseLikerLandLink: boolean
          query: Record<string, string>
          isForQRCode?: boolean
        } = {
          classId: id || '',
          channel: channel.id,
          priceIndex,
          customLink: isUsingCustomDestination.value ? customDestinationURLInput.value : undefined,
          isUseLikerLandLink: destinationSetting.value === 'liker_land',
          query: {
            utm_campaign: utmCampaign,
            ...mergedQueryStringObject.value,
          },
        }

        map.get(channel.id)?.push({
          productId: id,
          productName: (typeof data.name === 'object' ? (data.name?.zh || data.name?.en) : data.name) || '',
          selectedEditionIndex: priceIndex,
          selectedEditionLabel: productEditionOptionsMap.value?.[id]?.[priceIndex]?.label || '',
          channelId: channel.id,
          channelName: channel.name,
          utmCampaign,
          utmMedium: mergedQueryStringObject.value.utm_medium || '',
          utmSource: mergedQueryStringObject.value.utm_source || '',
          url: getPurchaseLink(urlConfig),
          qrCodeUrl: getPurchaseLink({
            ...urlConfig,
            isForQRCode: mergedQueryStringObject.value.utm_source === linkQueryDefault.value.utm_source,
          }),
        })
      })
    })

    return map
  })

  const linkTableRows = computed(() =>
    allChannelTableRows.value.flatMap(channel => linkTableRowsMapByChannel.value.get(channel.id) || []),
  )

  const getLinkTableRowsMapByChannel = (channelId: string) => linkTableRowsMapByChannel.value.get(channelId) || []

  return {
    productDataList,
    productEditionOptionsMap,
    productEditionSelectModelValue,
    productTableRows,
    linkTableRowsMapByChannel,
    linkTableRows,
    getLinkTableRowsMapByChannel,
  }
}
