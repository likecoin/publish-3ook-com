import type { StoreMetadataDriftField } from '~/utils/store-metadata-drift'

// The bookstore-listing counterpart of useIscnPrefilledHint, shared so a value
// filled in from the store reads the same in every field group.
export function useIscnStoreHint(fields: MaybeRefOrGetter<StoreMetadataDriftField[]>) {
  const { t: $t } = useI18n()
  return (field: StoreMetadataDriftField): string | undefined =>
    toValue(fields).includes(field) ? $t('iscn_form.from_store_data') : undefined
}
