import * as Sentry from '@sentry/nuxt'

if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn: 'https://1d871749c61de13371f3acd1681073b4@o149940.ingest.us.sentry.io/4507887589523456',

    sendDefaultPii: true,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true
      }),
      Sentry.piniaIntegration(usePinia())
    ]
  })
}
