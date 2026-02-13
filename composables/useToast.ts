import { FetchError } from 'ofetch'

export const useToastComposable = () => {
  const toast = useToast()

  const showErrorToast = (error: string | unknown) => {
    let title: string
    let description: string | undefined
    if (error instanceof FetchError) {
      title = error.message
      const data = error.data
      if (typeof data === 'string') {
        description = data
      } else if (data) {
        description = data.message || data.error || JSON.stringify(data)
      }
    } else if (typeof error === 'string') {
      title = error
    } else {
      title = (error as Error)?.message || String(error)
    }
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title,
      description,
      duration: 3000,
      color: 'error'
    })
  }

  return {
    showErrorToast
  }
}
