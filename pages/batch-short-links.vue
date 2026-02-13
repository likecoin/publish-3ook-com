<template>
  <PageContainer>
    <PageHeader :title="$t('batch_short_links.page_title')" />

    <PageBody>
      <UFormField
        :label="$t('batch_short_links.provider_label')"
        :required="true"
      >
        <USelect
          v-model="shortLinkProvider"
          :items="shortLinkProviders"
        />
      </UFormField>

      <UFormField
        :label="apiKeyLabel"
        :required="true"
      >
        <UInput
          v-model="apiKey"
          class="font-mono"
          autocomplete="off"
        />
      </UFormField>

      <UFormField
        v-if="shouldShowShortLinkDomain"
        :label="$t('batch_short_links.shortio_domain')"
        :required="true"
      >
        <UInput
          v-model="shortLinkDomain"
          class="font-mono"
          placeholder="link.liker.land"
          autocomplete="off"
        />
      </UFormField>

      <UFormField :label="$t('batch_short_links.title_prefix')">
        <UInput
          v-model="titlePrefix"
          :hint="$t('batch_short_links.optional')"
        />
      </UFormField>

      <UCard :ui="{ body: 'space-y-2' }">
        <UFormField :label="$t('batch_short_links.upload_csv')">
          <UInput type="file" accept="csv" @change="handleFileChange" />
        </UFormField>
        <USeparator class="print:hidden" :label="$t('batch_short_links.or_divider')" />
        <UFormField :label="$t('batch_short_links.input_csv')">
          <UTextarea
            v-model="csvInput"
            class="font-mono"
            :placeholder="csvInputPlaceholder"
            :resize="true"
          />
        </UFormField>
      </UCard>

      <div class="flex justify-center">
        <UButton
          :label="$t('batch_short_links.start')"
          size="lg"
          :disabled="!csvInput || !apiKey || (shouldShowShortLinkDomain && !shortLinkDomain)"
          @click="startShorteningURLs"
        />
      </div>

      <template v-if="shortenedURLItems.length">
        <UCard
          :ui="{
            header: 'flex justify-between items-center gap-2',
            body: 'p-0'
          }"
        >
          <template #header>
            <h3 class="font-bold font-mono">
              {{ $t('batch_short_links.results') }}
            </h3>

            <div class="flex items-center gap-2">
              <UButton
                :label="$t('batch_short_links.download_csv')"
                variant="outline"
                @click="downloadAllShortenedLinks"
              />
              <UButton
                :label="$t('batch_short_links.convert_to_qr')"
                variant="outline"
                @click="convertToQRCode"
              />
            </div>
          </template>

          <UTable
            :columns="[
              { accessorKey: 'key', header: $t('batch_short_links.key_column') },
              { accessorKey: 'url', header: $t('batch_short_links.url_column') },
              { accessorKey: 'destination', header: $t('batch_short_links.destination_column') },
            ]"
            :data="shortenedURLItems"
          >
            <template #url-cell="{ row }">
              <UButton
                class="font-mono"
                :to="row.original.url"
                target="_blank"
                rel="noopener"
                variant="link"
              >
                {{ row.original.url }}
              </UButton>
            </template>
            <template #destination-cell="{ row }">
              <UButton
                class="font-mono"
                :to="row.original.destination"
                target="_blank"
                rel="noopener"
                variant="link"
              >
                {{ row.original.destination }}
              </UButton>
            </template>
          </UTable>
        </UCard>
      </template>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
import { parse as csvParse } from 'csv-parse/sync'

import { convertArrayOfObjectsToCSV } from '~/utils'
const { t: $t } = useI18n()

const { showErrorToast } = useToastComposable()
const route = useRoute()
const localeRoute = useLocaleRoute()

const CSV_HEADER = 'key,url'

enum ShortLinkProvider {
  Bitly = 'bitly',
  ShortIO = 'shortio'
}
const shortLinkProviders = [
  {
    label: 'Bitly',
    value: ShortLinkProvider.Bitly
  },
  {
    label: 'Short.io',
    value: ShortLinkProvider.ShortIO
  }
]
const shortLinkProvider = ref<ShortLinkProvider>(route.query.provider as ShortLinkProvider || ShortLinkProvider.Bitly)
const shouldShowShortLinkDomain = computed(() => shortLinkProvider.value === ShortLinkProvider.ShortIO)
const shortLinkDomain = ref('')

const titlePrefix = ref(route.query.title_prefix as string || $t('batch_short_links.default_title_prefix'))
const csvInput = ref('')
const csvInputPlaceholder = `${CSV_HEADER}
example01,https://example01.com,
example02,https://example02.com,`
const apiKey = ref('')
const apiKeyLabel = computed(() => {
  switch (shortLinkProvider.value) {
    case ShortLinkProvider.Bitly:
      return $t('batch_short_links.bitly_token')
    case ShortLinkProvider.ShortIO:
      return $t('batch_short_links.shortio_api_key')
    default:
      return ''
  }
})
const shortenedURLItems = ref<{ key: string, url: string, destination: string }[]>([])

useSeoMeta({
  title: 'Batch Create Book Short Links',
  ogTitle: 'Batch Create Book Short Links'
})

onMounted(() => {
  try {
    const loadedInput = sessionStorage.getItem('nft_book_press_batch_shorten_url')
    if (loadedInput) {
      csvInput.value = loadedInput
      sessionStorage.removeItem('nft_book_press_batch_shorten_url')
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }
})

async function shortenURLWithBitly ({ url, key }: { url: string, key: string }) {
  try {
    const data = await $fetch<{ link: string }>('https://api-ssl.bitly.com/v4/bitlinks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.value}`
      },
      body: {
        long_url: url,
        domain: 'bit.ly',
        title: [titlePrefix.value, key].join(' - '),
        tags: [
          'nft-book-press'
        ]
      }
    })
    if (!data) {
      throw new Error($t('batch_short_links.bitly_no_data'))
    }
    return data.link
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast(error)
    return 'error'
  }
}

async function shortenURLWithShortIO ({ url, key }: { url: string, key: string }) {
  try {
    const data = await $fetch<{ shortURL: string }>('https://api.short.io/links/public', {
      method: 'POST',
      headers: {
        Authorization: apiKey.value
      },
      body: {
        allowDuplicates: true,
        domain: shortLinkDomain.value,
        originalURL: url,
        title: [titlePrefix.value, key].join(' - '),
        tags: [
          'nft-book-press'
        ]
      }
    })
    if (!data) {
      throw new Error($t('batch_short_links.shortio_no_data'))
    }
    return data.shortURL
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast(error)
    return 'error'
  }
}

async function startShorteningURLs () {
  let urlItems: { key: string, url: string }[] = []
  try {
    let input = csvInput.value
    if (!input.includes(CSV_HEADER)) {
      input = `${CSV_HEADER}\n${input}`
    }
    urlItems = csvParse(input, {
      columns: true,
      skip_empty_lines: true
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast(error)
    return
  }

  try {
    for (const { key, url } of urlItems) {
      let shortenedURL = ''
      switch (shortLinkProvider.value) {
        case ShortLinkProvider.Bitly:
          shortenedURL = await shortenURLWithBitly({ url, key })
          break
        case ShortLinkProvider.ShortIO:
          shortenedURL = await shortenURLWithShortIO({ url, key })
          break
        default:
          break
      }
      shortenedURLItems.value.push({
        key,
        url: shortenedURL,
        destination: url
      })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    showErrorToast(error)
  }
}

function downloadAllShortenedLinks () {
  downloadFile({
    data: shortenedURLItems.value,
    fileName: 'shortened_links.csv',
    fileType: 'csv'
  })
}

async function convertToQRCode () {
  sessionStorage.setItem('nft_book_press_batch_qrcode', convertArrayOfObjectsToCSV(shortenedURLItems.value))
  await navigateTo(localeRoute({ name: 'batch-qrcode' }))
}

function handleFileChange (event: Event) {
  const files = (event.target as HTMLInputElement)?.files
  if (!files?.length) { return }
  const file = files[0]
  if (!file) { return }
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result
    if (typeof text === 'string') {
      csvInput.value = text
    }
  }
  reader.readAsText(file)
}

</script>
