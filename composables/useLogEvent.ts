import { setUser as setSentryUser } from '@sentry/nuxt'

interface EventParams {
  [key: string]: unknown
}

export function useLogEvent (eventName: string, eventParams: EventParams = {}) {
  try {
    useTrackEvent(eventName, eventParams)
  } catch {
    console.error(`Failed to track event to GA: ${eventName}`, eventParams)
  }

  if (window?.Intercom) {
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

export function useSetLogUser (
  wallet: string | null,
  options: { email?: string; displayName?: string; intercomToken?: string } = {}
) {
  const { email, displayName, intercomToken } = options

  // Set user in Sentry
  if (!wallet) {
    setSentryUser(null)
  } else {
    setSentryUser({
      id: wallet,
      email,
      username: displayName || wallet
    })
  }

  // Set user in Intercom
  if (window?.Intercom) {
    try {
      if (!wallet) {
        window.Intercom('shutdown')
      } else {
        const intercomData: Record<string, unknown> = {
          user_id: wallet,
          evm_wallet: wallet,
          email,
          name: displayName || wallet
        }
        if (intercomToken) {
          intercomData.intercom_user_jwt = intercomToken
          intercomData.session_duration = 2592000000 // 30d
        }
        window.Intercom('update', intercomData)
      }
    } catch (error) {
      console.error('Failed to set user data in Intercom', error)
    }
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
          name: displayName || wallet
        })
      }
    } catch (error) {
      console.error('Failed to set user data in PostHog', error)
    }
  }
}
