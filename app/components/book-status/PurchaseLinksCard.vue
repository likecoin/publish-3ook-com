<template>
  <UCard
    :ui="{ body: 'space-y-4' }"
  >
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('form.copy_purchase_link')"
      />
    </template>

    <UFormField :label="$t('form.edition')">
      <USelect
        v-model="priceIndex"
        :items="priceIndexOptions"
      />
    </UFormField>

    <UFormField :label="$t('form.sales_channel_for_links')">
      <UInput
        v-model="fromChannelInput"
        :placeholder="$t('status_page.channel_ids_placeholder')"
      />
    </UFormField>

    <UCard
      v-if="purchaseLinks.length > 1"
      :ui="{
        header: 'flex justify-between items-center',
        body: 'p-0 sm:p-0',
      }"
    >
      <template #header>
        <h4
          class="text-sm font-bold font-mono"
          v-text="$t('purchase_link.download_all_links')"
        />

        <UDropdownMenu
          :items="[
            [
              {
                label: $t('buttons.print_all_qr'),
                icon: 'i-heroicons-qr-code',
                onSelect: printAllQRCodes,
              },
              {
                label: $t('buttons.download_all_links'),
                icon: 'i-heroicons-arrow-down-on-square-stack',
                onSelect: downloadAllPurchaseLinks,
              },
              {
                label: $t('buttons.shorten_all_links'),
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

      <UTable
        :columns="[
          { accessorKey: 'index', header: '#' },
          { accessorKey: 'channel', header: $t('table.channel_id') },
          { accessorKey: 'link', header: $t('purchase_link.download_links') },
        ]"
        :data="purchaseLinks"
        :ui="{ thead: 'whitespace-nowrap' }"
      >
        <template #index-cell="{ row }">
          {{ row.index + 1 }}
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
              size="xs"
              variant="outline"
              :disabled="!row.original.url"
              @click="copyPurchaseLink(row.original.url)"
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
    <div
      v-else-if="purchaseLinks[0]"
      class="flex items-center gap-2"
    >
      <UButton
        icon="i-heroicons-qr-code"
        variant="outline"
        size="xs"
        @click="selectedPurchaseLink = purchaseLinks[0]"
      />
      <UButton
        icon="i-heroicons-document-duplicate"
        size="xs"
        variant="outline"
        :disabled="!purchaseLinks[0]?.url"
        @click="copyPurchaseLink(purchaseLinks[0]?.url || '')"
      />
      <UButton
        icon="i-heroicons-arrow-top-right-on-square"
        :to="purchaseLinks[0].url"
        target="_blank"
        size="xs"
        variant="outline"
      />
      <UInput
        class="grow font-mono"
        :model-value="purchaseLinks[0].url"
        :disabled="true"
        color="neutral"
        variant="outline"
        size="xs"
      />
    </div>

    <UModal
      v-if="selectedPurchaseLink"
      v-model:open="isOpenQRCodeModal"
      :title="$t('purchase_link.download_qr_modal')"
      :ui="{ body: '!p-0' }"
    >
      <template #body>
        <QRCodeGenerator
          :data="selectedPurchaseLink.url"
          :file-name="getQRCodeFilename(selectedPurchaseLink.channel)"
          :width="500"
          :height="500"
        />
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import { downloadFile, getPurchaseLink } from '~/utils'
import type { ClassListingPrice } from '~/types'

const { t: $t } = useI18n()

const { showErrorToast } = useToastComposable()
const { openBatchQRCodePopup, goToBatchShortLinks } = useBatchLinkHandoff()

const { classId, prices, bookName = '' } = defineProps<{
  classId: string
  prices: ClassListingPrice[]
  bookName?: string
}>()

const fromChannelInput = ref('')
const priceIndex = ref(0)
const useLikerLandPurchaseLink = ref(true)

const priceIndexOptions = computed(() => prices.map((p: ClassListingPrice, index: number) => ({
  label: `${typeof p.name === 'object' ? (p.name.en || '') : p.name} - $${p.price}`,
  value: index,
  disabled: index === priceIndex.value,
})) || [])

const purchaseLinks = computed(() =>
  fromChannelInput.value
    .split(',')
    .filter((c, index) => !!c || index === 0)
    .map(c => c.trim())
    .map(channel => ({
      channel,
      url: getPurchaseLink({
        classId,
        priceIndex: priceIndex.value,
        channel,
        isUseLikerLandLink: useLikerLandPurchaseLink.value,
      }),
    })),
)

const {
  selectedPurchaseLink,
  isOpenQRCodeModal,
  copyLink: copyPurchaseLink,
} = usePurchaseLinkActions<{ channel: string, url: string }>()

function getQRCodeFilename(channel = '') {
  const filenameParts = [`${bookName || classId}`, `price_${priceIndex.value}`]
  if (channel) {
    filenameParts.push(`channel_${channel}`)
  }
  return filenameParts.join('_')
}

function downloadAllPurchaseLinks() {
  downloadFile({
    data: purchaseLinks.value,
    fileName: `${classId}_purchase_links.csv`,
    fileType: 'csv',
  })
}

function printAllQRCodes() {
  try {
    openBatchQRCodePopup(purchaseLinks.value.map(({ channel, ...link }) => ({ key: channel, ...link })))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast($t('purchase_link.failed_print_qr'), { duration: 0 })
  }
}

async function shortenAllLinks() {
  try {
    await goToBatchShortLinks(purchaseLinks.value.map(({ channel, url }) => ({ key: channel, url })))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast($t('purchase_link.failed_shorten_links'), { duration: 0 })
  }
}
</script>
