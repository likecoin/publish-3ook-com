import type { NavigationMenuItem } from '@nuxt/ui'
import { PUBLISH_GUIDE_URL, AFFILIATION_GUIDE_URL } from '~/constant'

export interface SiteMenuGroup {
  label: string
  links: NavigationMenuItem[]
}

export function useSiteMenuItems() {
  const { t: $t } = useI18n()
  const localeRoute = useLocaleRoute()

  const bookstoreApiStore = useBookstoreApiStore()
  const { getTotalPendingNFTCount, isAuthenticated } = storeToRefs(bookstoreApiStore)

  function withLogging(groups: SiteMenuGroup[]): SiteMenuGroup[] {
    return groups.map(group => ({
      ...group,
      links: group.links.map(link => ({
        ...link,
        onSelect: () => useLogEvent('site_menu_click_link', { label: link.label }),
      })),
    }))
  }

  const helpGroup = computed<SiteMenuGroup>(() => ({
    label: $t('menu.help'),
    links: [
      {
        label: $t('menu.about'),
        icon: 'i-heroicons-information-circle',
        to: localeRoute({ name: 'about' }),
      },
      {
        label: $t('menu.publisher_guide'),
        icon: 'i-heroicons-academic-cap',
        to: PUBLISH_GUIDE_URL,
        target: '_blank',
      },
      {
        label: $t('menu.affiliation_guide'),
        icon: 'i-heroicons-megaphone',
        to: AFFILIATION_GUIDE_URL,
        target: '_blank',
      },
    ],
  }))

  const groups = computed<SiteMenuGroup[]>(() => {
    if (!isAuthenticated.value) {
      return withLogging([
        {
          ...helpGroup.value,
          links: [
            ...helpGroup.value.links,
            {
              label: $t('menu.listing_disclaimer'),
              icon: 'i-heroicons-shield-exclamation',
              to: $t('menu.listing_disclaimer_url'),
              target: '_blank',
            },
          ],
        },
      ])
    }

    return withLogging([
      {
        label: $t('menu.bookstore_listing'),
        links: [
          {
            label: $t('menu.start_publishing'),
            icon: 'i-heroicons-sparkles',
            to: localeRoute({ name: 'new-book' }),
          },
          {
            label: $t('menu.manage_book_listings'),
            icon: 'i-heroicons-rectangle-stack',
            to: localeRoute({ name: 'my-books' }),
            exact: true,
            badge: getTotalPendingNFTCount.value,
          },
          {
            label: $t('menu.bulk_upload'),
            icon: 'i-heroicons-arrow-up-tray',
            to: localeRoute({ name: 'bulk-upload' }),
            exact: true,
          },
        ],
      },
      {
        label: $t('menu.bookstore_readers'),
        links: [
          {
            label: $t('menu.readers_list'),
            icon: 'i-heroicons-user-group',
            to: localeRoute({ name: 'readers' }),
          },
        ],
      },
      {
        label: $t('menu.authors_affiliates'),
        links: [
          {
            label: $t('menu.sales_report'),
            icon: 'i-heroicons-document-currency-dollar',
            to: localeRoute({ name: 'sales-report' }),
            exact: true,
          },
          {
            label: $t('menu.latest_books'),
            icon: 'i-heroicons-book-open',
            to: localeRoute({ name: 'latest-books' }),
            exact: true,
          },
        ],
      },
      {
        ...helpGroup.value,
        links: [
          ...helpGroup.value.links,
          {
            label: $t('menu.preview_book'),
            icon: 'i-heroicons-eye',
            to: localeRoute({ name: 'preview-book' }),
          },
          {
            label: $t('menu.settings'),
            icon: 'i-heroicons-cog-8-tooth',
            to: localeRoute({ name: 'settings' }),
            exact: true,
          },
        ],
      },
    ])
  })

  // UNavigationMenu group shape: each group is its own array,
  // prefixed by a label item that the component hides automatically when collapsed.
  const navigationItems = computed<NavigationMenuItem[][]>(() =>
    groups.value.map(group => [
      { label: group.label, type: 'label' as const },
      ...group.links,
    ]),
  )

  return { groups, navigationItems }
}
