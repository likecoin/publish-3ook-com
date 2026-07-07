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
          <USelect
            v-model="destinationSetting"
            :items="destinationSettings"
            option-attribute="name"
          />
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
            <USwitch
              v-model="isIncludeDefaultChannels"
              :disabled="!customChannelInput"
            />
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
            slot: 'body',
          }]"
          :ui="{ content: 'p-0' }"
        >
          <template #body>
            <UCard :ui="{ body: 'space-y-4' }">
              <div class="relative flex max-md:flex-col flex-wrap gap-4">
                <UFormField
                  class="flex-1"
                  :label="$t('purchase_link.utm_campaign')"
                >
                  <UInput
                    v-model="utmCampaignInput"
                    class="font-mono"
                    name="utm_campaign"
                    :placeholder="`e.g. ${utmCampaignDefault}`"
                  />
                </UFormField>
                <UFormField
                  class="flex-1"
                  :label="$t('purchase_link.utm_source')"
                >
                  <UInput
                    v-model="utmSourceInput"
                    class="font-mono"
                    name="utm_source"
                    :placeholder="`e.g. ${utmSourceDefault}`"
                  />
                </UFormField>
                <UFormField
                  class="flex-1"
                  :label="$t('purchase_link.utm_medium')"
                >
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

        <UCard
          v-if="hasMoreThanOneChannel && productTableRows.length"
          :ui="{ body: 'p-0' }"
        >
          <template #header>
            <h3
              class="text-lg font-bold"
              v-text="$t('purchase_link.product_list')"
            />
          </template>

          <UTable
            :columns="[
              { accessorKey: 'name', header: $t('table.name') },
              { accessorKey: 'editionSelect', header: $t('table.selected_edition') },
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
            <h3
              class="text-lg font-bold"
              v-text="$t('purchase_link.common_query_string')"
            />
          </template>

          <UTable
            :columns="[
              { accessorKey: 'key', header: $t('table.key') },
              { accessorKey: 'value', header: $t('table.value') },
            ]"
            :data="commonQueryStringTableRows"
            :ui="{ td: 'font-mono' }"
          />
        </UCard>

        <UCard
          :ui="{
            header: 'flex justify-between items-center gap-4',
            body: hasMoreThanOneChannel ? 'space-y-8' : 'space-y-8 p-0',
          }"
        >
          <template
            v-if="hasMoreThanOneChannel"
            #header
          >
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
                    onSelect: printAllQRCodes,
                  },
                  {
                    label: $t('purchase_link.download_qr_codes'),
                    icon: 'i-heroicons-arrow-down-on-square-stack',
                    onSelect: downloadAllQRCodes,
                  },
                  {
                    label: $t('purchase_link.download_all_links'),
                    icon: 'i-heroicons-arrow-down-on-square-stack',
                    onSelect: downloadAllPurchaseLinks,
                  },
                  {
                    label: $t('purchase_link.shorten_all_links'),
                    icon: 'i-heroicons-sparkles',
                    onSelect: shortenAllLinks,
                  },
                ],
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
              body: 'p-0',
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
                      onSelect: printQRCodesByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.download_qr_codes'),
                      icon: 'i-heroicons-arrow-down-on-square-stack',
                      onSelect: downloadQRCodesByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.download_links'),
                      icon: 'i-heroicons-arrow-down-on-square-stack',
                      onSelect: downloadPurchaseLinksByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.shorten_links'),
                      icon: 'i-heroicons-sparkles',
                      onSelect: shortenLinksByChannelId(channel.id),
                    },
                    {
                      label: $t('purchase_link.share_table'),
                      icon: 'i-heroicons-document-duplicate',
                      onSelect: shareTableLinkByChannelId(channel.id),
                    },
                  ],
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
              <template
                v-if="!hasMoreThanOneChannel"
                #selectedEditionLabel-cell="{ row }"
              >
                <USelect
                  v-if="productEditionOptionsMap?.[row.original.productId]?.length"
                  class="min-w-[200px]"
                  :model-value="productEditionSelectModelValue[row.original.productId] || 0"
                  :items="productEditionOptionsMap?.[row.original.productId] || []"
                  @update:model-value="productEditionSelectModelValue[row.original.productId] = $event"
                />
              </template>
              <template #utmCampaign-cell="{ row }">
                <UKbd
                  class="font-mono"
                  :value="row.original.utmCampaign"
                />
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

        <UModal
          v-if="selectedPurchaseLink"
          v-model:open="isOpenQRCodeModal"
          :title="$t('purchase_link.download_qr_modal')"
          :ui="{ body: '!p-0' }"
        >
          <template #body>
            <QRCodeGenerator
              :data="selectedPurchaseLink.qrCodeUrl"
              :file-name="getQRCodeFilename(selectedPurchaseLink)"
              :width="500"
              :height="500"
            />
          </template>
        </UModal>
      </template>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
import type { AffiliationLink, ProductData } from '~/types'

const { LIKE_CO_API, SITE_URL } = useRuntimeConfig().public
const likerStore = useLikerStore()
const stripeStore = useStripeStore()
const userStore = useUserStore()
const { userLikerInfo } = storeToRefs(userStore)
const route = useRoute()
const localeRoute = useLocaleRoute()
const { showErrorToast } = useToastComposable()
const { t: $t } = useI18n()
const { openBatchQRCodePopup, goToBatchShortLinks } = useBatchLinkHandoff()

const isSharingMode = computed({
  get: () => route.query.share === '1',
  set: (value) => {
    navigateTo(localeRoute({
      query: {
        ...route.query,
        share: value ? '1' : undefined,
      },
    }), { replace: true })
  },
})

const pageTitle = computed(() => {
  return isSharingMode.value ? $t('purchase_link.sharing_mode_title') : $t('purchase_link.generator_mode_title')
})

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
})

const affiliationLinkForm = useAffiliationLinkForm()
const {
  productIdInputModel,
  productIds,
  utmCampaignInput,
  utmCampaignDefault,
  shouldPrefixChannelIdForUTMCampaign,
  utmMediumInput,
  utmMediumDefault,
  utmSourceInput,
  utmSourceDefault,
  additionalQueryStringInput,
  additionalQueryStringInputPlaceholder,
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
} = affiliationLinkForm

const {
  productDataList,
  productEditionOptionsMap,
  productEditionSelectModelValue,
  productTableRows,
  linkTableRowsMapByChannel,
  linkTableRows,
  getLinkTableRowsMapByChannel,
} = useAffiliationLinkMatrix(affiliationLinkForm)

const linkTableColumns = computed(() => {
  const cols: { accessorKey: string, header: string }[] = []
  if (!isUsingCustomDestination.value) {
    cols.push({
      accessorKey: 'productId',
      header: $t('common.title'),
    },
    {
      accessorKey: 'selectedEditionLabel',
      header: $t('table.selected_edition'),
    })
  }

  if (!isSharingMode.value) {
    cols.push({
      accessorKey: 'utmCampaign',
      header: $t('purchase_link.utm_campaign'),
    })
  }
  cols.push({
    accessorKey: 'link',
    header: $t('common.link'),
  })
  return cols
})

const {
  selectedPurchaseLink,
  isOpenQRCodeModal,
  copyLink,
} = usePurchaseLinkActions<AffiliationLink>({ copyEventName: 'purchase_link_copy' })

async function fetchProductData(id: string) {
  const classData = await $fetch<ProductData>(`${LIKE_CO_API}/likernft/book/store/${id}`)
  return {
    id,
    data: classData,
  }
}

async function createAffiliationLink() {
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
      }
      catch (error) {
        customChannelInputError.value = (error as Error).message
        isSharingMode.value = false
        return
      }
    }

    useLogEvent('purchase_link_create_started', { product_count: productIds.value.length })
    creatingAffiliationLinkState.value = $t('purchase_link.fetching_product_data')
    try {
      const dataList = await Promise.all(productIds.value.map(id => fetchProductData(id)))
      productDataList.value = dataList
      useLogEvent('purchase_link_created', { product_count: dataList.length })
    }
    catch (error) {
      productIdError.value = (error as Error).message
      isSharingMode.value = false
    }
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast($t('purchase_link.failed_create_link'), { duration: 0 })
    isSharingMode.value = false
  }
  finally {
    creatingAffiliationLinkState.value = ''
  }
}

function getQRCodeFilename(link: AffiliationLink) {
  const filenameParts: string[] = []
  if (isUsingCustomDestination.value) {
    const url = new URL(customDestinationURLInput.value)
    filenameParts.push(url.hostname)
  }
  else {
    filenameParts.push(`${link.productName || link.productId}`)
  }
  if (link.channelId) {
    filenameParts.push(`channel-${link.channelId}`)
  }
  return filenameParts.join('_')
}

function downloadPurchaseLinksByTableRows(rows: AffiliationLink[] = [], channelId?: string) {
  useLogEvent('purchase_link_download_csv', { count: rows.length, channel_id: channelId })
  downloadFile({
    data: rows.map(({

      selectedEditionIndex,
      selectedEditionLabel, ...link
    }) => ({
      edition: `${selectedEditionIndex + 1}. ${selectedEditionLabel}`,
      ...link,
    })),
    fileName: ['affiliation_links', channelId, Date.now()].filter(Boolean).join('_').concat('.csv'),
    fileType: 'csv',
  })
}

function downloadAllPurchaseLinks() {
  downloadPurchaseLinksByTableRows(linkTableRows.value)
}

function downloadPurchaseLinksByChannelId(channelId: string) {
  return () => downloadPurchaseLinksByTableRows(getLinkTableRowsMapByChannel(channelId))
}

function printQRCodesByTableRows(rows: AffiliationLink[] = []) {
  useLogEvent('purchase_link_print_qr', { count: rows.length })
  try {
    openBatchQRCodePopup(rows.map(({ channelId, qrCodeUrl, ...link }) => ({ key: channelId, ...link, url: qrCodeUrl })))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast($t('purchase_link.failed_print_qr'), { duration: 0 })
  }
}

function printAllQRCodes() {
  printQRCodesByTableRows(linkTableRows.value)
}

function printQRCodesByChannelId(channelId: string) {
  return () => printQRCodesByTableRows(getLinkTableRowsMapByChannel(channelId))
}

function shortenLinksByTableRows(rows: AffiliationLink[] = []) {
  try {
    goToBatchShortLinks(rows.map(({ channelId, ...link }) => ({ key: channelId, ...link })))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast($t('purchase_link.failed_shorten_links'), { duration: 0 })
  }
}

function shortenAllLinks() {
  shortenLinksByTableRows(linkTableRows.value)
}

function shortenLinksByChannelId(channelId: string) {
  return () => shortenLinksByTableRows(getLinkTableRowsMapByChannel(channelId))
}

function shareTableLinkByChannelId(channelId: string) {
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

async function downloadQRCodesByTableRows(rows: AffiliationLink[] = [], channelId?: string) {
  useLogEvent('purchase_link_download_qr', { count: rows.length, channel_id: channelId })
  const items = rows.map(link => ({
    url: link.qrCodeUrl,
    filename: getQRCodeFilename(link),
  }))
  await downloadQRCodes(items, {
    zipFilename: ['affiliation_links_qrcodes', channelId, Date.now()].filter(Boolean).join('_'),
  })
}

async function downloadAllQRCodes() {
  await downloadQRCodesByTableRows(linkTableRows.value)
}

function downloadQRCodesByChannelId(channelId: string) {
  return () => downloadQRCodesByTableRows(getLinkTableRowsMapByChannel(channelId), channelId)
}

function prefillChannelIdIfPossible() {
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
  }
  else {
    productDataList.value = undefined
  }
})

watch(userLikerInfo, () => {
  if (userLikerInfo.value) {
    prefillChannelIdIfPossible()
  }
})
</script>
