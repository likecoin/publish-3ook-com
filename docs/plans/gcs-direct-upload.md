# Plan — GCS-direct upload for new DRM books

- **Status:** In progress (2026-07-21)
- **Parent:** ADR 0001 (docs/adr/0001-drm-storage-architecture.md) — Phase 3 variant
- **Repos:** `likecoin-api-public` (endpoints), `publish-3ook-com` (upload path),
  `likecoin-cloud-functions/ebook-cors` (verified, no changes needed),
  Terraform (bucket CORS), backup task (GCP→AWS)

New DRM books upload plaintext straight to the private CMEK bucket. Arweave is
skipped entirely for them (no ciphertext, no key, no Irys fee). No escrow gate:
succession escrow stays decoupled (Phase 4); the durability prerequisite for
mainnet is the off-account cold backup instead.

## Prerequisites

| Item | Status | Blocks what |
|---|---|---|
| Succession escrow | ❌ deferred to Phase 4 | Nothing here — decoupled |
| Bucket versioning / multi-region / CMEK / staging lifecycle | ✅ in Terraform | — |
| Bucket CORS (browser POST/PUT from publish origin) | ⬜ must add | Browser→GCS upload |
| Off-account cold backup (GCP→AWS) | ⬜ parallel task | Mainnet flip only; not testnet |

CORS specifics: origins `https://publish.3ook.com` + `http://localhost:3000`,
methods `POST, PUT, OPTIONS`, request headers `Content-Type, x-goog-resumable`,
response header `Location` (resumable session URI), short max-age.

## Verification outcomes (2026-07-21)

Checked against all three repos before coding:

- ✅ ebook-cors serves plaintext-from-GCS with **no key** — confirmed, not
  assumed. `index.js` takes the protected branch on `encryptionKey || contentUri`,
  `readProtectedFirst` fails closed (throws, never serves ciphertext) when
  keyless, `nft/protected.js` reads the `gs://` URI directly. **No ebook-cors
  changes needed.**
- ✅ `gcs-<uuid>` doc ids are safe downstream: pass the param schema and the
  ingest object-name regex; book-cache pre-warm (`cache.ts
  resolveBookFileCacheURL`) skips docs without `arweaveId` gracefully.
- ✅ `fileSHA256` is already computed client-side in all three publish flows.
- ⚠️ Five gaps found — folded in as fixes 1–5 below.
- ℹ️ ebook-cors has **no Range support** today; it streams whole objects.
  Range/CDN delivery remains Phase 5. Don't promise byte-range serving here.
- ℹ️ No dedupe on the GCS path (legacy dedupes via estimate's
  `existingArweaveId`): re-publishing the same file mints a fresh `gcs-<uuid>`
  and duplicate object. Accepted; a `fileSHA256` lookup can dedupe later.

## API changes — likecoin-api-public

Two new endpoints under `/arweave/v2/gcs/` in `src/routes/arweave/index.ts`.
The DRM-book path stops calling `/register` and `ingestProtectedContent()`
entirely.

### 1. `POST /arweave/v2/gcs/upload_init` — `jwtAuth('write:iscn')` + validateBody

- Body: `{ fileSize, fileSHA256, contentType, fileName? }`; `contentType`
  restricted to `application/epub+zip` / `application/pdf` (protected tier is
  ebooks only).
- Guard `isEbookProtectedBucketEnabled()` (`gcloudStorage.ts`) — 501 when
  unset. Natural server-side kill-switch: the endpoint is inert until the
  bucket env is set, so it ships dark.
- **Fix 5 — quota + size cap.** GCS-direct bypasses the Arweave sponsorship
  economics, so it must not be unlimited free private storage: reject
  `fileSize > ARWEAVE_MAX_SIZE_V2` (200 MB), and reserve per-wallet daily
  quota via `checkAndReserveQuota(wallet, fileSize, '0')` (rollback on any
  failure after the reserve), mirroring the sponsored path.
- Mint id `gcs-<uuid>` (mirrors `sponsored-<uuid>`).
- Create the `iscnArweaveTxCollection` doc:
  `{ status: 'pending', source: 'gcs', fileSHA256, contentType, fileSize,
  fileName?, ownerWallet }`. No `key`/`encryptedKey` — GCS-direct books have no
  content key. No legacy `token` — the GCS flow is JWT-owner-gated end to end.
- New helper in `gcloudStorage.ts`: v4 **resumable** signed URL for
  `staging/gcs-<uuid>` (today only `action: 'read'` exists in
  `fileupload.ts`). Pin `contentType`, short TTL (covers session initiation
  only; the session URI GCS returns stays valid ~1 week). Client: `POST`
  signed URL with `x-goog-resumable: start` → `Location` session URI → `PUT`
  bytes (progress events, resumable).
- Return `{ id, uploadUrl }`.

### 2. `POST /arweave/v2/gcs/finalize/:txHash` — `jwtAuth('write:iscn')`, owner-gated

- Load doc; require `source === 'gcs'`, `status === 'pending'`, and
  `isArweaveTxOwner(req.user.wallet, doc.ownerWallet)`.
- **Fix 5 (finalize half).** Verify the staged object's actual size matches
  the declared `fileSize` before hashing — the signed URL alone doesn't bound
  what was PUT.
- Stream `staging/gcs-<uuid>` through SHA-256, verify == `doc.fileSHA256`.
  Mismatch → error, leave staging (the age=1 lifecycle rule sweeps it).
- Promote `staging/gcs-<uuid>` → final `gcs-<uuid>` via the shared
  `promoteStagedObject` helper (extracted from `ingestProtectedContent`'s
  copy-with-metadata + delete-staging back half; the legacy ingest calls the
  same helper — one promotion path, two front doors).
- **Fix 2 — full doc lifecycle, not just ingest markers.**
  `markArweaveTxIngested()` only writes
  `contentBucketPath`/`contentType`/`fileSHA256`; it does **not** set
  `status`, `isRequireAuth`, or `accessToken` (legacy docs get those from
  `updateArweaveTxStatus` at register, which this flow never calls). Without
  `isRequireAuth: true` the link endpoint serves the doc's JSON
  unauthenticated. Finalize therefore writes, in one update:
  `contentBucketPath`, `contentType`, `status: 'complete'`,
  `isRequireAuth: true`, and a minted `accessToken` (new `tx.ts` helper).
  The `accessToken` matters beyond symmetry: `store.ts` appends it to
  file-record URLs in the new-listing Slack/Airtable flow.
- **Fix 3 — status is `'complete'`, not `'ingested'`.** The only
  status-sensitive checks are register's `!== 'pending'` and
  `/v2/access_token`'s `=== 'complete'`; using `'complete'` keeps token
  rotation and any future completeness checks uniform across sources. The
  `source: 'gcs'` field is the discriminator, not a new status value.
- Return `{ id, link }`.

### 3. Fix 1 — `/arweave/v2/link/:txHash` must handle arweaveId-less docs (both branches)

Today `new URL(\`${ARWEAVE_GATEWAY}/${arweaveId}\`)` runs **before** the
JSON/HTML split; with `arweaveId` undefined it silently yields
`https://<gateway>/undefined` — the JSON branch returns it as `link` (ebook-cors
would adopt it via `if (data.link)`, giving every GCS book the same bogus
fallback URL, which also leaks into preview-cache keys), and the HTML branch
redirects to it.

- JSON branch: when the doc has no `arweaveId`, **omit `link`** (make `link`
  optional in `ArweaveLinkResponseSchema`; ebook-cors already tolerates an
  absent `link` and keeps the API URL as its internal identifier — unique per
  book). Keep `contentUri` + `contentType` advertisement.
- HTML branch: no `arweaveId` → 404 (no public copy exists to redirect to).

### Supporting changes

- Schemas (`src/util/api/arweave/schemas.ts`): init body/response, finalize
  response (params reuse `ArweaveTxHashParamsSchema`); `link` becomes optional
  in `ArweaveLinkResponseSchema`.
- Types (`src/types/transaction.d.ts`): add `source?: 'arweave' | 'gcs'` and
  `fileName?`. (`fileSize` and `status` already exist — smaller change than
  originally planned.)
- `resolveArweaveTxKey()` returning `''` for keyless docs is confirmed handled
  downstream (link endpoint `if (key)` guard; ebook-cors null key).

## Publisher web changes — publish-3ook-com

- `app/constant/api.ts`: add `API_POST_ARWEAVE_V2_GCS_UPLOAD_INIT` and
  `API_POST_ARWEAVE_V2_GCS_FINALIZE` (static base, id appended — matches the
  existing endpoint style).
- *(Built as a util, not a separate composable.)*
  `uploadEbookToGcsDirect()` in `app/utils/arweave.ts` beside
  `uploadSingleFileToBundlr`: `upload_init` → resumable session POST → `PUT`
  bytes → `finalize`; the record ends up with `arweaveLink` = the
  `/arweave/v2/link/gcs-<id>` URL and **no** `arweaveId`/`arweaveKey`.
- *(Dispatch lives inside `uploadFileRecordsToArweave`'s per-record loop, not
  a wrapper.)* A split-array wrapper would break callback index integrity
  (both `onRecordSkipped` paths would double-fire the call sites' progress
  counters). Routing inside the existing loop keeps indices, skip logic, and
  callback discipline intact — and the 3 call sites need **no changes**.
  `shouldUploadViaGcs(fileType, encryptEbook)` decides per record: ebook +
  DRM + flag → GCS; cover + DRM-free → Arweave (a DRM book still has a
  public Arweave cover). The resume guard now treats `arweaveLink` alone as
  "done" (GCS records never gain an `arweaveId`).
- Skip client AES on the GCS branch (`encryptDataWithAES` stays for Phase-4
  legacy re-ingest only).
- **Fix 4 — `app/utils/iscnLinks.ts` needs two changes, not one.** The
  `uploadedRecords` filter (`r.arweaveId || (r.arweaveKey && r.arweaveLink)`)
  drops a keyless, arweaveId-less GCS record entirely — it would vanish from
  `downloadableUrls` *and* `contentFingerprints`. Both the filter and
  `getRecordArweaveUrl` gain a GCS branch (record with `arweaveLink` but no
  `arweaveId`/`arweaveKey` → use `arweaveLink`). Keep the
  `hash://sha256/<...>` fingerprint — now the sole on-chain integrity anchor.
- Fee UX (`useArweaveFeeEstimation.ts`): GCS-routed records are filtered out
  of estimation entirely — no fee summed, no sponsorship quota counted
  (protected uploads become free to the author).
- Feature flag `IS_GCS_DIRECT_UPLOAD_ENABLED` (env `TRUE` to enable, default
  off) in `nuxt.config.ts` public runtime config, so the frontend flip is
  independently toggleable per env.
- CSP: no change needed — `nuxt.config.ts` sets no `connect-src`, and the
  existing upload flows already talk to external HTTPS hosts.

## End-to-end sequence (new DRM book)

1. Publish → ebook record: `upload_init` → `{ id: gcs-<uuid>, uploadUrl }`.
2. Browser starts resumable session, PUTs plaintext EPUB/PDF → `staging/gcs-<uuid>`.
3. `finalize` → server checks size, hashes staged object, verifies ==
   client `fileSHA256`, promotes, marks complete (+ `isRequireAuth`,
   `accessToken`).
4. Frontend builds ISCN: downloadable URL = `/arweave/v2/link/gcs-<uuid>`,
   fingerprint `hash://sha256/<...>`; cover → Arweave.
5. Register ISCN → mint NFT class → listing `hideDownload = true`.
6. Reader/ebook-cors → `/arweave/v2/link/gcs-<uuid>` (internal token) →
   `contentUri` → serves plaintext from the private bucket (whole-object
   streaming; Range/CDN is Phase 5).

## Build order

1. Backend endpoints (behind `isEbookProtectedBucketEnabled()` gate) + shared
   `promoteStagedObject` refactor + link-endpoint fix → deploy testnet
   (`likecoin-develop`, bucket `liker-land-ebook-protected-dev`).
2. Bucket CORS (Terraform, protected bucket) for the publish origins.
3. Frontend GCS path behind flag → enable on testnet.
4. E2E on testnet: publish a DRM book → object lands, doc marked complete,
   ISCN link resolves, ebook-cors serves it.
5. Cold backup (GCP→AWS) provisioned in parallel — before flipping mainnet.
6. Enable mainnet flag.
