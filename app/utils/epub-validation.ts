// Warnings alone never block. Errors do until the author ticks them off, and
// the tick lives on the record, so replacing or removing the file clears it.
export function needsValidationErrorAck(
  record: { validationErrors?: string, hasAcknowledgedValidationErrors?: boolean },
): boolean {
  return !!record.validationErrors && !record.hasAcknowledgedValidationErrors
}
