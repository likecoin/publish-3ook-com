// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizePdfTitle, sanitizePdfAuthor } from '../app/utils/pdf-metadata.ts'

// Every string below is invented, but each keeps the shape of an Info-dictionary
// value seen while evaluating this feature, so the filter stays tuned against
// what exporters actually write rather than against what the spec allows.

test('keeps titles that read as a book', () => {
  const kept = [
    'The Quiet Harbour Companion',
    'Violet Protocol Paper: a formal specification',
    'The Lantern Project: A Novel About IT, DevOps',
    'ACME Certified Solutions Architect - Associate',
    'Introduction to Q',
    '每天讀一頁哲學',
    '風的南方',
    '城市規劃導論',
    // Digits plus a caseless script: rejecting this would lose most Chinese
    // titles that carry a year.
    '2024年城市規劃考試資訊及通訊科技科第五級示例',
    'PROC 2274 - Threshold Signatures and Perfect Ballot Secrecy',
  ]
  for (const title of kept) {
    assert.equal(sanitizePdfTitle(title), title, title)
  }
})

// Exporters copy the filename into Title, but authors name the file after the
// book at least as often. Rejecting the overlap cost more real titles than it
// saved junk, and the junk it caught the identifier rule catches anyway.
test('keeps a title that happens to match its filename', () => {
  assert.equal(sanitizePdfTitle('風的南方'), '風的南方')
  assert.equal(sanitizePdfTitle('99Roads'), '99Roads')
  assert.equal(
    sanitizePdfTitle('ACME Certified Solutions Architect - Associate'),
    'ACME Certified Solutions Architect - Associate',
  )
})

test('drops export artefacts masquerading as titles', () => {
  const dropped = [
    '',
    '   ',
    'untitled',
    'UNTITLED',
    '未命名',
    'Slide 1',
    // Print job and part numbers.
    '100234-01',
    'AB-CD-00',
    'ABCDE123456',
    '2C-D',
    'ABCD1234 XYZ1',
    // Locale-suffixed build identifiers.
    'AB 1234-1_zh-HK',
    '[HK] AB 1018_zh-HK',
    'ABC 1234_5678_zh-HK',
    'XYZ 5678_HK-zh',
    'A 1234 B_en-version_2024-01-31',
    'CD 60_ABC52_42_32_22_AV_SE_zh-hk_en_90015950',
    'EFG 37232 iD, EFGH 37232 iD_XY5 zh-HK 117181',
    'AB_C1Handbook_D2_Slides_EF',
    // Source filenames.
    'Microsoft Word - AB1234_en-HK.docx',
    'Microsoft Word - CD5678_9012_HK-ZH.doc',
  ]
  for (const title of dropped) {
    assert.equal(sanitizePdfTitle(title), '', title)
  }
})

test('recovers a real title from behind a source-application prefix', () => {
  assert.equal(
    sanitizePdfTitle('Microsoft Word - The Harbour Institute of Design'),
    'The Harbour Institute of Design',
  )
})

test('collapses whitespace and enforces the length bounds', () => {
  assert.equal(sanitizePdfTitle('A   Tale   of  Two'), 'A Tale of Two')
  assert.equal(sanitizePdfTitle('A'), '')
  assert.equal(sanitizePdfTitle('x'.repeat(201)), '')
})

test('keeps author names that read as a byline', () => {
  const kept = ['Sinclair, Rowan', 'Dr. Mira Vance', '林知遠', 'ACME', '城市規劃學會']
  for (const author of kept) {
    assert.equal(sanitizePdfAuthor(author), author, author)
  }
})

test('drops the export account rather than publishing it on-chain', () => {
  const dropped = [
    '',
    'Administrator',
    'administrator',
    'CamScanner',
    'Windows User',
    'Default User',
    'Unknown',
    '系統管理員',
    // A personal address is the sharpest failure: the ISCN record is immutable.
    'jamie.doe1016@example.com',
    'someone@example.co.uk',
    'https://example.com/profile',
    '12345',
  ]
  for (const author of dropped) {
    assert.equal(sanitizePdfAuthor(author), '', author)
  }
})

test('enforces the author length bounds', () => {
  assert.equal(sanitizePdfAuthor('X'), '')
  assert.equal(sanitizePdfAuthor('x'.repeat(101)), '')
})
