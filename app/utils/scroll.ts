import { unrefElement } from '@vueuse/core'
import type { MaybeComputedElementRef } from '@vueuse/core'

// The app scrolls inside the layout's overflow container, not the window, and
// scroll anchoring pins the clicked button in place, so content inserted above
// the fold stays invisible and the click reads as a no-op. Takes a ref or
// getter because the target usually renders only on the next tick.
export async function revealElement(
  target: MaybeComputedElementRef,
  { block = 'start', focus = true }: { block?: ScrollLogicalPosition, focus?: boolean } = {},
) {
  if (import.meta.server) { return }
  await nextTick()
  const el = unrefElement(target)
  if (!(el instanceof HTMLElement)) { return }
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block })
  // Focusing the container (needs tabindex="-1") rather than the first field
  // inside keeps mobile from opening the keyboard mid-scroll.
  if (focus) { el.focus({ preventScroll: true }) }
}
