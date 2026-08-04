import { FetchError } from 'ofetch'

export const useToastComposable = () => {
  const toast = useToast()
  const { t } = useI18n()

  const showSuccessToast = (title: string, options: { description?: string, duration?: number } = {}) => {
    toast.add({
      icon: 'i-heroicons-check-circle',
      title,
      description: options.description,
      duration: options.duration ?? 2000,
      color: 'success',
    })
  }

  const showInfoToast = (title: string, options: { description?: string, duration?: number } = {}) => {
    toast.add({
      icon: 'i-heroicons-information-circle',
      title,
      description: options.description,
      duration: options.duration ?? 2000,
      color: 'info',
    })
  }

  const showErrorToast = (error: string | unknown, options: { description?: string, duration?: number } = {}) => {
    let title: string
    let description: string | undefined
    if (error instanceof FetchError) {
      title = error.message
      // One unwrapper for the whole app, so a caller never has to pass a
      // description just to surface the code the API actually returned.
      const code = getApiErrorCode(error)
      description = getApiErrorMessage(error, t)
      if (!code && error.data) {
        // .data is often raw text/plain, so stringifying it would escape the quotes.
        description = typeof error.data === 'string' ? error.data : JSON.stringify(error.data)
      }
    }
    else if (typeof error === 'string') {
      title = error
    }
    else {
      title = (error as Error)?.message || String(error)
    }
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title,
      description: options.description ?? description,
      duration: options.duration ?? 3000,
      color: 'error',
    })
  }

  return {
    showSuccessToast,
    showInfoToast,
    showErrorToast,
  }
}
