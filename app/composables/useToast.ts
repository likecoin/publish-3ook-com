import { FetchError } from 'ofetch'

export const useToastComposable = () => {
  const toast = useToast()

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
      const data = error.data
      if (typeof data === 'string') {
        description = data
      }
      else if (data) {
        description = data.message || data.error || JSON.stringify(data)
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
