// Warnings alone never block. Errors do until the author ticks them off, and
// the tick lives on the record, so replacing or removing the file clears it.
export function needsValidationErrorAck(
  record: { validationErrors?: string, hasAcknowledgedValidationErrors?: boolean },
): boolean {
  return !!record.validationErrors && !record.hasAcknowledgedValidationErrors
}

// Unacknowledged errors hold every route past the files step: 下一步, the
// stepper, a ?step= URL and a resumed draft alike.
export function getReachableStepIndex(
  maxVisitedStepIndex: number,
  records: { validationErrors?: string, hasAcknowledgedValidationErrors?: boolean }[],
): number {
  return records.some(needsValidationErrorAck) ? 0 : maxVisitedStepIndex
}
