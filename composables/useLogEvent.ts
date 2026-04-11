import { setUser as setSentryUser } from '@sentry/nuxt'

// Intercom caps event *names* at 120 per workspace. New names beyond that are
// silently dropped, so we allowlist only events a CS agent would want to see
// in the user's recent-activity strip when a conversation opens. The bar for
// adding new entries is "does this give CS context during a live chat?" —
// funnel milestones, failure states, and concrete user actions qualify;
// intermediate wiring events and high-volume nav clicks do not. GA and
// PostHog still receive every event regardless of this set.
export const INTERCOM_TRACKED_EVENTS: ReadonlySet<string> = new Set([
  // Auth
  'login',
  'login_failed',
  'sign_up_started',
  'sign_up_failed',
  // Publish funnel
  'book_publish_started',
  'book_publish_upload_completed',
  'iscn_registration_success',
  'nft_mint_success',
  'book_listing_created',
  'iscn_metadata_updated',
  // Book management
  'my_books_view_detail',
  // Affiliation intent
  'latest_books_click_affiliation_setup',
  // Bulk upload
  'bulk_upload_book_completed',
  'bulk_upload_book_failed',
  // Purchase links
  'purchase_link_create_started',
  'purchase_link_created',
  'purchase_link_copy',
  'purchase_link_download_csv',
  'purchase_link_print_qr',
  'purchase_link_download_qr',
  // Exports
  'readers_export_csv',
  'sales_report_export_commission',
  'sales_report_export_payout',
  // Stripe payout setup
  'stripe_setup_started',
  'stripe_login'
])
const INTERCOM_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

interface EventParams {
  [key: string]: unknown
}

export function useLogEvent (eventName: string, eventParams: EventParams = {}) {
  try {
    useTrackEvent(eventName, eventParams)
  } catch {
    console.error(`Failed to track event to GA: ${eventName}`, eventParams)
  }

  if (window?.Intercom && INTERCOM_TRACKED_EVENTS.has(eventName)) {
    try {
      const { items, ...params } = eventParams
      if (items) {
        params.items = JSON.stringify(items)
      }
      window.Intercom('trackEvent', eventName, params)
    } catch (error) {
      console.error(`Failed to log event to Intercom: ${eventName}`, error)
    }
  }

  const { $posthog } = useNuxtApp()
  if ($posthog) {
    try {
      const posthog = $posthog()
      let posthogParams: EventParams = eventParams
      if (Array.isArray(eventParams.items)) {
        posthogParams = { ...eventParams }
        const classIds = (posthogParams.items as { id?: string }[])
          .map(item => item.id?.split('-')[0])
          .filter((id): id is string => !!id && id.startsWith('0x'))
        if (classIds.length) {
          posthogParams.nft_class_ids = classIds.join(',')
        }
      }
      posthog.capture(eventName, { app: 'book-press', ...posthogParams })
    } catch (error) {
      console.error(`Failed to log event to PostHog: ${eventName}`, error)
    }
  }
}

export function useSetIntercomUser (
  wallet: string | null,
  options: {
    email?: string
    displayName?: string
    likerId?: string
    likeWallet?: string
    avatar?: string
    locale?: string
    intercomToken?: string
  } = {}
) {
  // The identity-verification JWT is signed with the LikeCoin user id as
  // `user_id`, so the client-supplied `user_id` must equal `likerId` or
  // Intercom rejects with UserIdMismatchException. Callers should only
  // invoke this once both `likerId` and `intercomToken` are known.
  if (!window?.Intercom) { return }
  try {
    if (!wallet) {
      window.Intercom('shutdown')
      return
    }
    const { email, displayName, likerId, likeWallet, avatar, locale, intercomToken } = options
    if (!likerId || !intercomToken) { return }
    window.Intercom('update', {
      intercom_user_jwt: intercomToken,
      session_duration: INTERCOM_SESSION_DURATION_MS,
      user_id: likerId,
      email,
      name: displayName || wallet || likeWallet,
      avatar: avatar
        ? {
            type: 'avatar',
            image_url: avatar
          }
        : undefined,
      evm_wallet: wallet,
      like_wallet: likeWallet,
      locale
    })
  } catch (error) {
    console.error('Failed to set user data in Intercom', error)
  }
}

export function useSetLogUser (
  wallet: string | null,
  options: {
    email?: string
    displayName?: string
    likeWallet?: string
    locale?: string
  } = {}
) {
  const { email, displayName, likeWallet, locale } = options
  const nameFallback = displayName || wallet || likeWallet

  // Set user in Sentry
  if (!wallet) {
    setSentryUser(null)
  } else {
    setSentryUser({
      id: wallet,
      email,
      username: nameFallback
    })
  }

  // Intercom identify is deferred to `useSetIntercomUser` (needs likerId
  // + JWT), but logout can shut it down here so callers don't have to
  // coordinate both functions on reset.
  if (!wallet) {
    useSetIntercomUser(null)
  }

  // Set user in PostHog
  const { $posthog } = useNuxtApp()
  if ($posthog) {
    try {
      const posthog = $posthog()
      if (!wallet) {
        posthog.reset()
      } else {
        posthog.identify(wallet, {
          email: email || undefined,
          name: nameFallback,
          locale
        })
      }
    } catch (error) {
      console.error('Failed to set user data in PostHog', error)
    }
  }
}
