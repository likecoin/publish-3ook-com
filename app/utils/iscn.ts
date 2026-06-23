import type { ISCNRegisterPayload, ISCNTxPayload, ISCNValidationData } from '~/types/iscn'
import { MAX_DESCRIPTION_LENGTH, MAX_DESCRIPTION_FULL_LENGTH } from '~/constant'

function isValidImageUrl(urlString: string): boolean {
  if (!urlString) { return false }

  // Check that non-ASCII characters are percent-encoded
  // URL should only contain ASCII characters (0-127)
  if (!/^[\x20-\x7E]+$/.test(urlString)) {
    return false
  }

  try {
    const url = new URL(urlString)
    return ['http:', 'https:', 'ar:', 'ipfs:'].includes(url.protocol)
  }
  catch {
    return false
  }
}

export function formatISCNTxPayload(payload: ISCNRegisterPayload): ISCNTxPayload {
  const {
    tagsString = '',
    license,
    author,
    authorDescription,
    contentFingerprints: contentFingerprintsInput = [],
    publisher: publisherInput,
    publisherDescription,
    ...data
  } = payload

  const contentFingerprints = [...contentFingerprintsInput]

  const authorEntity = (author && authorDescription)
    ? {
        name: author,
        description: authorDescription,
      }
    : author

  const publisherEntity = (publisherInput && publisherDescription)
    ? {
        name: publisherInput,
        description: publisherDescription,
      }
    : publisherInput

  return {
    ...data,
    publisher: publisherEntity,
    author: authorEntity,
    keywords: tagsString.split(',').map(k => k.trim()).filter(Boolean),
    usageInfo: license,
    contentFingerprints: [...new Set(contentFingerprints)],
  }
}

export function validateISCNForm(data: ISCNValidationData, maxDescriptionLength = MAX_DESCRIPTION_LENGTH): string[] {
  const errors: string[] = []
  const desc = data.description || ''

  if (!data.title) {
    errors.push('Please fill in the title')
  }

  if (!desc) {
    errors.push('Please fill in the description')
  }
  else if (desc.length > maxDescriptionLength) {
    errors.push(`Description cannot exceed ${maxDescriptionLength} characters`)
  }

  if (!data.author?.name) {
    errors.push('Please fill in the author name')
  }

  if (!Array.isArray(data.contentFingerprints) || !data.contentFingerprints.some((f: { url: string }) => !!f.url)) {
    errors.push('Please provide at least one content URL')
  }

  if (data.descriptionFull && data.descriptionFull.length > MAX_DESCRIPTION_FULL_LENGTH) {
    errors.push(`Full description cannot exceed ${MAX_DESCRIPTION_FULL_LENGTH} characters`)
  }

  if (!data.coverUrl) {
    errors.push('Please provide a cover image URL')
  }
  else if (!isValidImageUrl(data.coverUrl)) {
    errors.push('Cover image URL must be a valid URL with http://, https://, ar://, or ipfs:// protocol')
  }

  return errors
}
