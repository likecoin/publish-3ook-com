import type { EpubSpineItem } from '~/types'
import type { PreviewPlan } from '~/utils/preview-cut'
import { planEpubPreviewCut } from '~/utils/preview-cut'

// `isPartial` marks the one document the server cuts down inside the file, so
// the readout never promises a whole chapter the reader only gets the start of.
export type PreviewCutItem = EpubSpineItem & { isPartial: boolean }

export type PreviewCutResult
  = | Extract<PreviewPlan, { ok: false }>
    | { ok: true, includedItems: PreviewCutItem[], effectivePercentage: number }

// Never re-derive the cut rules here: they must stay in ~/utils/preview-cut, or
// the readout drifts from what the ebook-cors server actually ships.
export function computePreviewCut(
  spineTable: EpubSpineItem[],
  percentage: number,
): PreviewCutResult {
  const plan = planEpubPreviewCut(spineTable.map(item => item.sizeBytes), percentage)
  if (!plan.ok) { return plan }
  const includedItems: PreviewCutItem[] = spineTable
    .slice(0, plan.includedCount)
    .map(item => ({ ...item, isPartial: false }))
  // Always sits at `includedCount`, so it extends the prefix by exactly one.
  const partialItem = plan.partial ? spineTable[plan.partial.index] : undefined
  if (partialItem) { includedItems.push({ ...partialItem, isPartial: true }) }
  return {
    ok: true,
    includedItems,
    effectivePercentage: plan.effectivePercentage,
  }
}
