import type { ISCNPrefillableField } from '~/types/iscn'

// Shared by the ISCN field groups so a value carried over from the uploaded
// file reads the same wherever it lands. Four of the groups need it, so the
// alternative was the same four lines copied four times.
export function useIscnPrefilledHint(fields: MaybeRefOrGetter<ISCNPrefillableField[]>) {
  const { t: $t } = useI18n()
  return (field: ISCNPrefillableField): string | undefined =>
    toValue(fields).includes(field) ? $t('iscn_form.prefilled_from_file') : undefined
}
