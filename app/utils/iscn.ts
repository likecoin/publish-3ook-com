import type { ISCNRegisterPayload, ISCNTxPayload, ISCNValidationData, ISCNFormData } from '~/types/iscn'
import type { NFTTokenMetadata } from '~/composables/useNFTMinter'
import { MAX_DESCRIPTION_LENGTH } from '~/constant'
import { getApiEndpoints } from '~/constant/api'

// Per-copy token metadata; shared by the single-publish and bulk-upload
// mint pipelines, which differ only in where the fields come from.
export function createBookTokenMetadataBuilder(input: {
  image: string
  title: string
  authorName: string
  publisherName: string
  classId: string
  book3Url: string
}): (index: number, fromTokenId: bigint) => NFTTokenMetadata {
  return (index, fromTokenId) => ({
    image: input.image,
    external_url: `${input.book3Url}/store/${input.classId}/${Number(fromTokenId) + index}`,
    description: `Copy #${Number(fromTokenId) + index} of ${input.title}`,
    name: `${input.title} #${Number(fromTokenId) + index}`,
    attributes: [
      { trait_type: 'Author', value: input.authorName },
      { trait_type: 'Publisher', value: input.publisherName },
    ],
  })
}

// Class-level metadata envelope shared by NFT class creation and update.
export function buildBookClassMetadata(contentMetadata: ISCNTxPayload) {
  return {
    ...contentMetadata,
    symbol: 'BOOK',
    image: contentMetadata?.thumbnailUrl || '',
    external_link: contentMetadata?.url || '',
    nft_meta_collection_id: 'nft_book',
    nft_meta_collection_name: 'NFT Book',
    nft_meta_collection_description: 'NFT Book by Liker Land',
    recordTimestamp: new Date().toISOString(),
  }
}

// Single source for a blank Book form; callers override only the fields that
// differ (e.g. an edit form seeds one empty URL row instead of an empty array).
export function createEmptyISCNFormData(overrides: Partial<ISCNFormData> = {}): ISCNFormData {
  return {
    type: 'Book',
    title: '',
    description: '',
    alternativeHeadline: '',
    isbn: '',
    publisher: { name: '', description: '' },
    publicationDate: '',
    author: { name: '', description: '' },
    license: 'All Rights Reserved',
    customLicense: '',
    contentFingerprints: [],
    downloadableUrls: [],
    language: '',
    bookInfoUrl: '',
    tags: [],
    coverUrl: '',
    genre: '',
    ...overrides,
  }
}

// Encrypted content is fingerprinted by its keyed download link instead of a
// plain ar:// id; detect that to decide download availability.
export function isContentFingerprintEncrypted(contentFingerprints: string[]): boolean {
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK
  return contentFingerprints.some((fingerprint) => {
    return !!fingerprint.startsWith(arweaveLinkEndpoint) || fingerprint.includes('?key=')
  })
}

export function isValidImageUrl(urlString: string): boolean {
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

interface ValidateISCNFormOptions {
  // The collect-only wizard validates before any upload exists; file-derived
  // URLs (fingerprints, cover) are injected later by the publish pipeline.
  requireFileUrls?: boolean
  maxDescriptionLength?: number
}

export function validateISCNForm(
  data: ISCNValidationData,
  options: ValidateISCNFormOptions = {},
): string[] {
  const { requireFileUrls = true, maxDescriptionLength = MAX_DESCRIPTION_LENGTH } = options
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

  if (requireFileUrls
    && (!Array.isArray(data.contentFingerprints) || !data.contentFingerprints.some((f: { url: string }) => !!f.url))) {
    errors.push('Please provide at least one content URL')
  }

  if (!data.coverUrl) {
    if (requireFileUrls) {
      errors.push('Please provide a cover image URL')
    }
  }
  else if (!isValidImageUrl(data.coverUrl)) {
    errors.push('Cover image URL must be a valid URL with http://, https://, ar://, or ipfs:// protocol')
  }

  return errors
}
