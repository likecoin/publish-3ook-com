import type { FormError } from '#ui/types'

// Shared submit-time feedback for UForm-wrapped forms: silent validate, then
// toast the messages and scroll the first invalid field into view (it may be
// far off screen), on top of UForm's inline per-field errors.
export function useFormValidateFeedback() {
  const { showErrorToast } = useToastComposable()

  async function validateWithFeedback(form: {
    validate: (opts: { silent: boolean }) => Promise<unknown>
    getErrors: () => FormError[]
    $el?: HTMLElement
  } | null | undefined): Promise<boolean> {
    if (!form) { return false }
    const result = await form.validate({ silent: true })
    if (result !== false) { return true }
    const errors = form.getErrors() || []
    if (errors.length) {
      showErrorToast([...new Set(errors.map(e => e.message))].join('\n'))
    }
    await nextTick()
    form.$el?.querySelector('[aria-invalid="true"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return false
  }

  return { validateWithFeedback }
}
