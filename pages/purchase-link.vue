<template>
  <PageContainer>
    <PageHeader :title="pageTitle" />

    <PageBody class="flex flex-col items-stretch grow space-y-8">
      <div
        v-if="(!productDataList && isSharingMode) || isCreatingAffiliationLinks"
        class="flex flex-col items-center justify-center self-stretch gap-4 py-10"
      >
        <UIcon
          class="w-10 h-10 animate-spin"
          name="i-heroicons-arrow-path-20-solid"
        />
        <span
          class="text-gray-400 dark:text-gray-700 text-sm"
          v-text="creatingAffiliationLinkState || $t('purchase_link.failed_create_link')"
        />
      </div>

      <UCard
        v-else-if="!productDataList"
        :ui="{ body: 'space-y-4', footer: 'flex justify-end' }"
      >
        <UFormField :label="$t('purchase_link.destination')">
          <USelect v-model="destinationSetting" :items="destinationSettings" option-attribute="name" />
        </UFormField>

        <UFormField
          v-if="isUsingCustomDestination"
          :label="$t('purchase_link.custom_page_url')"
          :required="true"
        >
          <UInput
            v-model="customDestinationURLInput"
            class="font-mono"
            placeholder="https://3ook.com/store?tag=blockchain"
            name="custom_destination_url"
          />
        </UFormField>

        <UFormField
          v-else
          :label="$t('purchase_link.product_ids')"
          :error="productIdError"
          :required="true"
        >
          <UTextarea
            v-model="productIdInputModel"
            class="font-mono"
            placeholder="0x53c7243b94b3c4a4827816f00d72394ddfb974c4\n0x146736dd2ccb1dbdf266130a117609e00ad566b1"
            :autoresize="true"
            name="product_id"
          />
        </UFormField>

        <UFormField
          :label="$t('purchase_link.channel_ids')"
          :hint="$t('purchase_link.optional')"
          :error="customChannelInputError"
          :ui="{ help: 'flex items-center gap-2' }"
        >
          <div class="flex gap-2">
            <UInput
              v-model="customChannelInput"
              class="grow font-mono"
              :placeholder="$t('purchase_link.channel_ids_placeholder')"
              name="channel_ids"
            />
            <UButton
              v-show="!customChannelInput && userLikerInfo"
              class="relative"
              :label="$t('purchase_link.prefill_from_account')"
              color="neutral"
              variant="outline"
              size="xs"
              @click="prefillChannelIdIfPossible"
            />
          </div>

          <template #help>
            <USwitch v-model="isIncludeDefaultChannels" :disabled="!customChannelInput" />
            <span v-text="$t('purchase_link.include_default_channels')" />
          </template>
        </UFormField>

        <UAccordion
          color="neutral"
          variant="soft"
          size="md"
          :items="[{
            label: $t('purchase_link.query_string_optional'),
            defaultOpen: true,
            slot: 'body'
          }]"
          :ui="{ content: 'p-0' }"
        >
          <template #body>
            <UCard :ui="{ body: 'space-y-4' }">
              <div class="relative flex max-md:flex-col flex-wrap gap-4">
                <UFormField class="flex-1" :label="$t('purchase_link.utm_campaign')">
                  <UInput
                    v-model="utmCampaignInput"
                    class="font-mono"
                    name="utm_campaign"
                    :placeholder="`e.g. ${utmCampaignDefault}`"
                  />
                </UFormField>
                <UFormField class="flex-1" :label="$t('purchase_link.utm_source')">
                  <UInput
                    v-model="utmSourceInput"
                    class="font-mono"
                    name="utm_source"
                    :placeholder="`e.g. ${utmSourceDefault}`"
                  />
                </UFormField>
                <UFormField class="flex-1" :label="$t('purchase_link.utm_medium')">
                  <UInput
                    v-model="utmMediumInput"
                    class="font-mono"
                    name="utm_medium"
                    :placeholder="`e.g. ${utmMediumDefault}`"
                  />
                </UFormField>
              </div>

              <UFormField :label="$t('purchase_link.additional_query_string')">
                <UInput
                  v-model="additionalQueryStringInput"
                  class="font-mono"
                  :placeholder="additionalQueryStringInputPlaceholder"
                  name="query_params"
                />
              </UFormField>

              <div class="flex items-center gap-2">
                <USwitch v-model="shouldPrefixChannelIdForUTMCampaign" />
                <span v-text="$t('purchase_link.prefix_channel_id')" />
              </div>
            </UCard>
          </template>
        </UAccordion>

        <template #footer>
          <UButton
            :label="$t('purchase_link.generate')"
            size="lg"
            :disabled="!canCreateAffiliationLink"
            @click="createAffiliationLink"
          />
        </template>
      </UCard>

      <template v-else>
        <header v-if="!isSharingMode">
          <UButton
            icon="i-heroicons-arrow-uturn-left"
            :label="$t('purchase_link.back_to_config')"
            variant="soft"
            @click="productDataList = undefined"
          />
        </header>

        <UCard v-if="hasMoreThanOneChannel && productTableRows.length" :ui="{ body: 'p-0' }">
          <template #header>
            <h3 class="text-lg font-bold" v-text="$t('purchase_link.product_list')" />
          </template>

          <UTable
            :columns="[
              { accessorKey: 'name', header: $t('table.name') },
              { accessorKey: 'editionSelect', header: $t('table.selected_edition') }
            ]"
            :data="productTableRows"
          >
            <template #name-cell="{ row }">
              <span v-text="row.original.name" />
            </template>
            <template #editionSelect-cell="{ row }">
              <USelect
                v-if="row.original.editionOptions.length"
                class="min-w-[200px]"
                :model-value="productEditionSelectModelValue[row.original.id] || 0"
                :items="row.original.editionOptions"
                @update:model-value="productEditionSelectModelValue[row.original.id] = $event"
              />
            </template>
          </UTable>
        </UCard>

        <UCard
          v-if="!isSharingMode && commonQueryStringTableRows.length"
          :ui="{ body: 'p-0' }"
        >
          <template #header>
            <h3 class="text-lg font-bold" v-text="$t('purchase_link.common_query_string')" />
          </template>

          <UTable
            :columns="[
              { accessorKey: 'key', header: $t('table.key') },
              { accessorKey: 'value', header: $t('table.value') }
            ]"
            :data="commonQueryStringTableRows"
            :ui="{ td: 'font-mono' }"
          />
        </UCard>

        <UCard
          :ui="{
            header: 'flex justify-between items-center gap-4',
            body: hasMoreThanOneChannel ? 'space-y-8' : 'space-y-8 p-0'
          }"
        >
          <template v-if="hasMoreThanOneChannel" #header>
            <h2
              class="text-lg font-bold"
              v-text="$t('purchase_link.affiliation_links')"
            />

            <UDropdownMenu
              :items="[
                [
                  {
                    label: $t('purchase_link.print_all_qr'),
                    icon: 'i-heroicons-qr-code',
                    click: printAllQRCodes,
                  },
                  {
                    label: $t('purchase_link.download_qr_codes'),
                    icon: 'i-heroicons-arrow-down-on-square-stack',
                    click: downloadAllQRCodes,
                  },
                  {
                    label: $t('purchase_link.download_all_links'),
                    icon: 'i-heroicons-arrow-down-on-square-stack',
                    click: downloadAllPurchaseLinks,
                  },
                  {
                    label: $t('purchase_link.shorten_all_links'),
                    icon: 'i-heroicons-sparkles',
                    click: shortenAllLinks,
                  },
                ]
              ]"
              :popper="{ placement: 'top-end' }"
            >
              <UButton
                icon="i-heroicons-ellipsis-horizontal-20-solid"
                color="neutral"
                variant="soft"
              />
            </UDropdownMenu>
          </template>

          <UCard
            v-for="channel in allChannelTableRows"
            :key="channel.id"
            :class="['overflow-hidden', hasMoreThanOneChannel ? '' : 'ring-0 shadow-none']"
            :ui="{
              header: 'flex justify-between items-center gap-4',
              body: 'p-0'
            }"
          >
            <template #header>
              <h3 class="flex items-center gap-2 font-bold">
                <span
                  :class="hasMoreThanOneChannel ? 'text-md' : 'text-lg'"
                  v-text="channel.name"
                />
                <span
                  :class="[
                    hasMoreThanOneChannel ? 'text-xs' : 'text-sm',
                    'text-gray-400 dark:text-gray-700',
                    'font-mono',
                  ]"
                  v-text="channel.id"
                />
              </h3>

              <UDropdownMenu
                :items="[
                  [
                    {
                      label: $t('purchase_link.print_qr_codes'),
                      icon: 'i-heroicons-qr-code',
                      click: printQRCodesByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.download_qr_codes'),
                      icon: 'i-heroicons-arrow-down-on-square-stack',
                      click: downloadQRCodesByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.download_links'),
                      icon: 'i-heroicons-arrow-down-on-square-stack',
                      click: downloadPurchaseLinksByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.shorten_links'),
                      icon: 'i-heroicons-sparkles',
                      click: shortenLinksByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.share_table'),
                      icon: 'i-heroicons-document-duplicate',
                      click: shareTableLinkByChannelId(channel.id),
                    },
                  ]
                ]"
                :popper="{ placement: 'top-end' }"
              >
                <UButton
                  icon="i-heroicons-ellipsis-horizontal-20-solid"
                  color="neutral"
                  size="sm"
                  variant="soft"
                />
              </UDropdownMenu>
            </template>

            <UTable
              :columns="linkTableColumns"
              :data="linkTableRowsMapByChannel.get(channel.id)"
            >
              <template #productId-cell="{ row }">
                <div v-text="row.original.productName" />
              </template>
              <template v-if="!hasMoreThanOneChannel" #selectedEditionLabel-cell="{ row }">
                <USelect
                  v-if="productEditionOptionsMap?.[row.original.productId]?.length"
                  class="min-w-[200px]"
                  :model-value="productEditionSelectModelValue[row.original.productId] || 0"
                  :items="productEditionOptionsMap?.[row.original.productId] || []"
                  @update:model-value="productEditionSelectModelValue[row.original.productId] = $event"
                />
              </template>
              <template #utmCampaign-cell="{ row }">
                <UKbd class="font-mono" :value="row.original.utmCampaign" />
              </template>
              <template #link-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UButton
                    icon="i-heroicons-qr-code"
                    variant="outline"
                    size="xs"
                    @click="selectedPurchaseLink = row.original"
                  />
                  <UButton
                    icon="i-heroicons-document-duplicate"
                    variant="outline"
                    size="xs"
                    @click="copyLink(row.original.url || '')"
                  />
                  <UButton
                    class="font-mono break-all"
                    :label="row.original.url"
                    :to="row.original.url"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    target="_blank"
                  />
                </div>
              </template>
            </UTable>
          </UCard>
        </UCard>

        <UModal v-model:open="isOpenQRCodeModal">
          <template #content>
            <QRCodeGenerator
              v-if="selectedPurchaseLink"
              :data="selectedPurchaseLink.qrCodeUrl"
              :file-name="getQRCodeFilename(selectedPurchaseLink)"
              :width="500"
              :height="500"
            >
              <template #header>
                <h3 class="font-bold font-mono">
                  {{ $t('purchase_link.download_qr_modal') }}
                </h3>
                <UButton
                  icon="i-heroicons-x-mark"
                  color="neutral"
                  variant="ghost"
                  @click="isOpenQRCodeModal = false"
                />
              </template>
            </QRCodeGenerator>
          </template>
        </UModal>
      </template>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
import { AFFILIATION_CHANNEL_DEFAULT, AFFILIATION_CHANNELS } from '~/constant'
import type { ProductData } from '~/types'

const { LIKE_CO_API, SITE_URL } = useRuntimeConfig().public
const likerStore = useLikerStore()
const stripeStore = useStripeStore()
const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)
const route = useRoute()
const localeRoute = useLocaleRoute()
const toast = useToast()
const { t: $t } = useI18n()

const isSharingMode = computed({
  get: () => route.query.share === '1',
  set: (value) => {
    navigateTo(localeRoute({
      query: {
        ...route.query,
        share: value ? '1' : undefined
      }
    }), { replace: true })
  }
})

const pageTitle = computed(() => {
  return isSharingMode.value ? $t('purchase_link.sharing_mode_title') : $t('purchase_link.generator_mode_title')
})

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value
})

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
  }
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
  return productIdInputs.value.map((productIdInput: string) => {
    let input: string | undefined = productIdInput.trim()

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

function constructUTMQueryString (input: {
  utmCampaign?: string,
  utmSource?: string,
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
      utmMedium: utmMediumInput.value
    })
  },
  set: (value) => {
    linkQueryInputModel.value = value
  }
})

const additionalQueryStringInputPlaceholder = computed(() => {
  return constructUTMQueryString({
    utmCampaign: utmCampaignDefault,
    utmSource: utmSourceDefault.value,
    utmMedium: utmMediumDefault
  })
})

const linkQueryDefault = computed(() => {
  return {
    utm_medium: utmMediumDefault,
    utm_source: utmSourceDefault.value,
    utm_campaign: utmCampaignDefault
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
      value
    }))
})

const destinationSettings = computed(() => [
  {
    name: $t('purchase_link.liker_land_product'),
    value: 'liker_land'
  },
  {
    name: $t('purchase_link.stripe_checkout'),
    value: 'direct'
  },
  {
    name: $t('purchase_link.custom_page'),
    value: 'custom'
  }
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
  }
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
        name: channelInfo?.displayName || channelId
      }
    })
)
const shouldIncludeDefaultChannels = ref(false)
const isIncludeDefaultChannels = computed({
  get: () => !customChannels.value.length || shouldIncludeDefaultChannels.value,
  set: (value) => {
    shouldIncludeDefaultChannels.value = value
  }
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
          } else {
            name = price.name || ''
          }
          return {
            label: [name, `$${price.price}`].filter(Boolean).join(' - '),
            value: price.index || 0
          }
        })
      } else {
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
    editionOptions: productEditionOptionsMap.value[id] || []
  })) || []
})

const linkTableColumns = computed(() => {
  const cols: { accessorKey: string, header: string }[] = []
  if (!isUsingCustomDestination.value) {
    cols.push({
      accessorKey: 'productId',
      header: $t('common.title')
    },
    {
      accessorKey: 'selectedEditionLabel',
      header: $t('table.selected_edition')
    })
  }

  if (!isSharingMode.value) {
    cols.push({
      accessorKey: 'utmCampaign',
      header: $t('purchase_link.utm_campaign')
    })
  }
  cols.push({
    accessorKey: 'link',
    header: $t('common.link')
  })
  return cols
})

interface AffiliationLink {
  productId: string,
  productName: string,
  selectedEditionLabel: string,
  selectedEditionIndex: number,
  channelId: string,
  channelName: string,
  utmCampaign: string,
  utmMedium: string,
  utmSource: string,
  url: string,
  qrCodeUrl: string,
}

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
          ...mergedQueryStringObject.value
        }
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
          isForQRCode: mergedQueryStringObject.value.utm_source === linkQueryDefault.value.utm_source
        })
      })
    })
  })

  return map
})

const linkTableRows = computed(() =>
  allChannelTableRows.value.flatMap(channel => linkTableRowsMapByChannel.value.get(channel.id) || [])
)

const getLinkTableRowsMapByChannel = (channelId: string) => linkTableRowsMapByChannel.value.get(channelId) || []

const selectedPurchaseLink = ref<AffiliationLink | undefined>(undefined)
const isOpenQRCodeModal = computed({
  get: () => !!selectedPurchaseLink.value,
  set: (value) => {
    if (!value) {
      selectedPurchaseLink.value = undefined
    }
  }
})

async function fetchProductData (id: string) {
  const classData = await $fetch<ProductData>(`${LIKE_CO_API}/likernft/book/store/${id}`)
  return {
    id,
    data: classData
  }
}

async function createAffiliationLink () {
  productIdError.value = false
  productDataList.value = undefined
  productEditionSelectModelValue.value = {}
  customChannelInputError.value = false
  creatingAffiliationLinkState.value = ''

  if (!canCreateAffiliationLink.value) {
    return
  }

  try {
    // Validate custom channels
    if (customChannels.value.length) {
      creatingAffiliationLinkState.value = $t('purchase_link.validating_channels')
      const invalidChannel = customChannels.value.find(channel => !validateChannelId(channel.id))
      if (invalidChannel) {
        customChannelInputError.value = $t('purchase_link.invalid_channel') + ` "${invalidChannel.id}", please enter a valid channel ID starting with "@"`
        return
      }

      try {
        await Promise.all(customChannels.value.map(async (channel) => {
          const channelInfo = await likerStore.lazyFetchChannelInfoById(channel.id)
          if (!channelInfo) {
            throw new Error($t('purchase_link.channel_no_liker_id'))
          }

          const stripeConnectStatus = await stripeStore.fetchStripeConnectStatusByWallet(channelInfo.evmWallet)
          if (!stripeConnectStatus?.hasAccount) {
            throw new Error($t('purchase_link.channel_no_stripe'))
          }
          if (!stripeConnectStatus?.isReady) {
            throw new Error($t('purchase_link.channel_stripe_incomplete'))
          }
        }))
      } catch (error) {
        customChannelInputError.value = (error as Error).message
        isSharingMode.value = false
        return
      }
    }

    creatingAffiliationLinkState.value = $t('purchase_link.fetching_product_data')
    try {
      const dataList = await Promise.all(productIds.value.map(id => fetchProductData(id)))
      productDataList.value = dataList
    } catch (error) {
      productIdError.value = (error as Error).message
      isSharingMode.value = false
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('purchase_link.failed_create_link'),
      duration: 0,
      color: 'error'
    })
    isSharingMode.value = false
  } finally {
    creatingAffiliationLinkState.value = ''
  }
}

function getQRCodeFilename (link: AffiliationLink) {
  const filenameParts: string[] = []
  if (isUsingCustomDestination.value) {
    const url = new URL(customDestinationURLInput.value)
    filenameParts.push(url.hostname)
  } else {
    filenameParts.push(`${link.productName || link.productId}`)
  }
  if (link.channelId) {
    filenameParts.push(`channel-${link.channelId}`)
  }
  return filenameParts.join('_')
}

async function copyLink (text = '') {
  await navigator.clipboard.writeText(text)
  toast.add({
    icon: 'i-heroicons-check-circle',
    title: $t('purchase_link.copied_to_clipboard'),
    duration: 2000,
    color: 'success'
  })
}

function downloadPurchaseLinksByTableRows (rows: AffiliationLink[] = [], channelId?: string) {
  downloadFile({
    data: rows.map(({

      selectedEditionIndex,
      selectedEditionLabel, ...link
    }) => ({
      edition: `${selectedEditionIndex + 1}. ${selectedEditionLabel}`,
      ...link
    })),
    fileName: ['affiliation_links', channelId, Date.now()].filter(Boolean).join('_').concat('.csv'),
    fileType: 'csv'
  })
}

function downloadAllPurchaseLinks () {
  downloadPurchaseLinksByTableRows(linkTableRows.value)
}

function downloadPurchaseLinksByChannelId (channelId: string) {
  return () => downloadPurchaseLinksByTableRows(getLinkTableRowsMapByChannel(channelId))
}

function printQRCodesByTableRows (rows: AffiliationLink[] = []) {
  try {
    sessionStorage.setItem(
      'nft_book_press_batch_qrcode',
      convertArrayOfObjectsToCSV(rows.map(({ channelId, qrCodeUrl, ...link }) => ({ key: channelId, ...link, url: qrCodeUrl })))
    )
    window.open('/batch-qrcode?print=1', 'batch_qrcode', 'popup,menubar=no,location=no,status=no')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('purchase_link.failed_print_qr'),
      duration: 0,
      color: 'error'
    })
  }
}

function printAllQRCodes () {
  printQRCodesByTableRows(linkTableRows.value)
}

function printQRCodesByChannelId (channelId: string) {
  return () => printQRCodesByTableRows(getLinkTableRowsMapByChannel(channelId))
}

function shortenLinksByTableRows (rows: AffiliationLink[] = []) {
  try {
    sessionStorage.setItem(
      'nft_book_press_batch_shorten_url',
      convertArrayOfObjectsToCSV(rows.map(({ channelId, ...link }) => ({ key: channelId, ...link })))
    )
    navigateTo(localeRoute({ name: 'batch-short-links', query: { print: 1 } }))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('purchase_link.failed_shorten_links'),
      duration: 0,
      color: 'error'
    })
  }
}

function shortenAllLinks () {
  shortenLinksByTableRows(linkTableRows.value)
}

function shortenLinksByChannelId (channelId: string) {
  return () => shortenLinksByTableRows(getLinkTableRowsMapByChannel(channelId))
}

function shareTableLinkByChannelId (channelId: string) {
  return () => {
    const url = new URL(`${SITE_URL}/affiliation-link`)
    url.searchParams.set('from', channelId)
    url.searchParams.set('share', '1')
    url.searchParams.set('nav', '0')
    const tableRows = getLinkTableRowsMapByChannel(channelId)
    tableRows.forEach((row) => {
      url.searchParams.append('product_id', row.productId)
    })
    copyLink(url.toString())
  }
}

async function downloadQRCodesByTableRows (rows: AffiliationLink[] = [], channelId?: string) {
  const items = rows.map(link => ({
    url: link.qrCodeUrl,
    filename: getQRCodeFilename(link)
  }))
  await downloadQRCodes(items, {
    zipFilename: ['affiliation_links_qrcodes', channelId, Date.now()].filter(Boolean).join('_')
  })
}

async function downloadAllQRCodes () {
  await downloadQRCodesByTableRows(linkTableRows.value)
}

function downloadQRCodesByChannelId (channelId: string) {
  return () => downloadQRCodesByTableRows(getLinkTableRowsMapByChannel(channelId), channelId)
}

function prefillChannelIdIfPossible () {
  if (!customChannelInput.value && userLikerInfo.value) {
    customChannelInput.value = convertLikerIdToChannelId(userLikerInfo.value.user)
  }
}

onMounted(() => {
  if (isSharingMode.value) {
    nextTick(() => {
      createAffiliationLink()
    })
  }

  prefillChannelIdIfPossible()
})

watch(isSharingMode, (value) => {
  if (value) {
    createAffiliationLink()
  } else {
    productDataList.value = undefined
  }
})

watch(userLikerInfo, () => {
  if (userLikerInfo.value) {
    prefillChannelIdIfPossible()
  }
})
</script>
