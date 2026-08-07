// Pure Info-dictionary sanitizers, dependency-free so test/pdf-metadata.test.mjs
// can import them without pulling in pdfjs.
//
// A PDF's Info dictionary is optional and almost never authored: over a sample
// of 80 real PDFs, 61% carried a Title but only about a fifth of those read as
// a book title. The author name reaches the on-chain ISCN record and the NFT
// class, neither editable afterwards, so every rule below prefers an empty
// field over a plausible-looking wrong one.

const MAX_TITLE_LENGTH = 200
const MAX_AUTHOR_LENGTH = 100

// Word and PowerPoint stamp the source document's name into Title.
const SOURCE_APP_PREFIX = /^Microsoft\s+(?:Word|PowerPoint|Excel|Publisher)\s+-\s+/i
const SOURCE_EXTENSION = /\.(?:docx?|pptx?|xlsx?|indd|pages|tex|rtf|odt|pdf)$/i

const TITLE_PLACEHOLDERS = new Set([
  'untitled', 'unknown', 'document', 'documents', 'no title', 'title',
  'presentation', 'slide 1', 'print', 'new document', 'microsoft word',
  'powerpoint presentation', '未命名', '無標題', '文件',
])

const AUTHOR_PLACEHOLDERS = new Set([
  'administrator', 'admin', 'user', 'users', 'owner', 'guest', 'default',
  'unknown', 'author', 'me', 'pc', 'computer', 'hp', 'dell', 'toshiba', 'sony',
  'lenovo', 'acer', 'asus', 'samsung', 'canon', 'epson', 'camscanner',
  'scanner', 'adobe', 'acrobat', 'microsoft', 'office', 'word', 'apple',
  '系統管理員', '管理員', '使用者', '作者',
])

// A personal address or a profile URL is the export account, never the byline.
// Adjacent \S+ can backtrack superlinearly, so only ever run it after the
// length bound below has capped the input.
const EMAIL_OR_URL = /\S+@\S+\.\S+|https?:\/\//i
// "Windows User", "Office User", "Default User".
const GENERIC_USER_SUFFIX = /\susers?$/

// Latin lowercase or any CJK script. An all-caps Latin string carrying digits
// reads as a part number, but Han/Kana/Hangul have no case at all, so without
// the CJK arm the test would reject every Chinese title containing a year.
const HAS_CASE_OR_CJK
  = /\p{Ll}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u
const HAS_DIGIT = /\d/

function normalizeValue(raw?: string): string {
  return (raw || '').replace(/\s+/g, ' ').trim()
}

/**
 * The Info dictionary's Title, or '' when it reads as an export artefact
 * rather than a book title.
 *
 * Deliberately not rejected: a Title equal to the PDF's own filename. Authors
 * name the file after the book at least as often as exporters copy the filename
 * in, and the identifier rule below already catches what that would have.
 */
export function sanitizePdfTitle(raw?: string): string {
  const normalized = normalizeValue(raw)
  if (!normalized) { return '' }

  // Stripped rather than rejected: "Microsoft Word - The Harbour Institute" has
  // a real title behind the prefix, and the rules below still judge it.
  const title = normalized
    .replace(SOURCE_APP_PREFIX, '')
    .replace(SOURCE_EXTENSION, '')
    .trim()

  if (title.length < 2 || title.length > MAX_TITLE_LENGTH) { return '' }
  if (TITLE_PLACEHOLDERS.has(title.toLowerCase())) { return '' }

  // Build and version identifiers: "ABC 1234_5678_zh-HK", "AB-CD-00",
  // "100234-01" (a shape even widely-sold books put in their Title).
  // Digits beside an underscore give it away, as does digits with no lowercase.
  if (HAS_DIGIT.test(title) && (title.includes('_') || !HAS_CASE_OR_CJK.test(title))) {
    return ''
  }

  return title
}

/**
 * The Info dictionary's Author, or '' when it reads as the account that ran
 * the export. A real name belonging to the wrong person cannot be detected
 * from the file — the prefilled-from-file hint is what catches those.
 */
export function sanitizePdfAuthor(raw?: string): string {
  const author = normalizeValue(raw)
  if (!author) { return '' }
  if (author.length < 2 || author.length > MAX_AUTHOR_LENGTH) { return '' }
  if (EMAIL_OR_URL.test(author)) { return '' }
  if (!/\p{L}/u.test(author)) { return '' }

  const key = author.toLowerCase()
  if (AUTHOR_PLACEHOLDERS.has(key)) { return '' }
  if (GENERIC_USER_SUFFIX.test(key)) { return '' }

  return author
}
