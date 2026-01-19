<template>
  <ul v-if="props.isLarge" class="space-y-10">
    <li v-for="item in items" :key="item.label">
      <UCard>
        <template #header>
          <h3 class="text-sm font-bold font-mono">
            {{ item.label }}
          </h3>
        </template>

        <ul class="flex flex-wrap gap-4">
          <li v-for="link in item.links" :key="link.label">
            <UButton
              :label="link.label"
              :leading-icon="link.icon"
              size="xl"
              :to="link.to"
              color="white"
              @click="link.click"
            />
          </li>
        </ul>
      </UCard>
    </li>
  </ul>

  <div v-else class="space-y-4">
    <div v-for="item in items" :key="item.label" class="space-y-3">
      <h3 class="text-sm font-mono text-gray-400 dark:text-gray-300 px-3">
        {{ item.label }}
      </h3>
      <UVerticalNavigation
        :links="item.links"
        :ui="{ label: 'font-bold', badge: { base: 'rounded-[10px] bg-[#50E3C2] font-bold' }}"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PUBLISH_GUIDE_URL } from '~/constant'
const { t: $t } = useI18n()

const localeRoute = useLocaleRoute()

const bookstoreApiStore = useBookstoreApiStore()
const { getTotalPendingNFTCount, isAuthenticated } = storeToRefs(bookstoreApiStore)

const props = defineProps({
  isLarge: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click-link'])

function handleLinkClick ({ label }: { label?: string }) {
  useTrackEvent(`click-link_${label}`)
  emit('click-link')
}

const items = computed(() => {
  if (!isAuthenticated.value) {
    return [
      {
        label: $t('menu.help'),
        links: [
          {
            label: $t('menu.publisher_guide'),
            icon: 'i-heroicons-arrow-top-right-on-square-20-solid',
            to: PUBLISH_GUIDE_URL,
            target: '_blank'
          },
          {
            label: $t('menu.listing_disclaimer'),
            icon: 'i-heroicons-shield-exclamation',
            to: $t('menu.listing_disclaimer_url'),
            target: '_blank'
          }
        ]
      }
    ].map(item => ({
      ...item,
      links: item.links.map(link => ({
        ...link,
        click: () => handleLinkClick({ label: link.label })
      }))
    }))
  }

  return [
    {
      label: $t('menu.bookstore_listing'),
      links: [
        {
          label: $t('menu.start_publishing'),
          icon: 'i-heroicons-sparkles',
          to: localeRoute({ name: 'new-book' })
        },
        {
          label: $t('menu.manage_book_listings'),
          icon: 'i-heroicons-rectangle-stack',
          to: localeRoute({ name: 'my-books' }),
          exact: true,
          badge: getTotalPendingNFTCount.value
        }
      ]
    },
    {
      label: $t('menu.bookstore_readers'),
      links: [
        {
          label: $t('menu.readers_list'),
          icon: 'i-heroicons-sparkles',
          to: localeRoute({ name: 'readers' })
        }
      ]
    },
    {
      label: $t('menu.authors_affiliates'),
      links: [
        {
          label: $t('menu.sales_report'),
          icon: 'i-heroicons-user-group',
          to: localeRoute({ name: 'sales-report' }),
          exact: true
        },
        {
          label: $t('menu.latest_books'),
          icon: 'i-heroicons-book-open',
          to: localeRoute({ name: 'latest-books' }),
          exact: true
        }
      ]
    },
    {
      label: $t('menu.help'),
      links: [
        {
          label: $t('menu.publisher_guide'),
          icon: 'i-heroicons-arrow-top-right-on-square-20-solid',
          to: PUBLISH_GUIDE_URL,
          target: '_blank'
        },
        {
          label: $t('menu.settings'),
          icon: 'i-heroicons-cog-8-tooth',
          to: localeRoute({ name: 'settings' }),
          exact: true
        }
      ]
    }
  ].map(item => ({
    ...item,
    links: item.links.map(link => ({
      ...link,
      click: () => handleLinkClick({ label: link.label })
    }))
  }))
})
</script>
