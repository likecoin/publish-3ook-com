export interface ISCNRegisterPayload {
  name: string;
  description: string;
  tagsString: string;
  url: string;
  license: string;
  '@type': string;
  author: string;
  fileSHA256?: string | string[];
  publisher?: string;
  authorDescription?: string;
  contentFingerprints?: string[];
  recordNotes?: string;
  memo?: string;
  inLanguage?: string;
  datePublished?: string;
  thumbnailUrl?: string;
  isbn?: string;
}

export interface ISCNFormData {
  type: string
  title: string
  description: string
  descriptionFull?: string
  alternativeHeadline?: string
  isbn: string
  publisher: string
  publicationDate: string
  author: {
    name: string
    description: string
    url?: string
  }
  license: string
  customLicense: string
  contentFingerprints: Array<{ url: string }>
  downloadableUrls: Array<{
    url: string
    type: string
    fileName: string
  }>
  language: string
  bookInfoUrl: string
  tags: string[]
  coverUrl: string
}
