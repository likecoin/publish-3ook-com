# AGENTS.md

This file is the canonical agent guide for this repository. It is consumed by AI coding assistants (Claude Code via the `CLAUDE.md` symlink, GitHub Copilot via `.github/copilot-instructions.md`, and any tool that follows the [AGENTS.md](https://agents.md) convention).

## Project Overview

**Liker Land NFT Book Press** (`publish.3ook.com`) — a Nuxt 3 web application for publishing and managing NFT books on the blockchain. Uses Vue 3 Composition API with TypeScript, Pinia for state management, @nuxt/ui (Tailwind CSS), and wagmi/viem for Web3 wallet integration on the Base network (L2 Ethereum).

## Build & Development Commands

**Critical**: Always set `NODE_OPTIONS=--max_old_space_size=8192` for build/generate commands or the build will hang.

```bash
yarn install                    # Install deps (runs nuxt prepare automatically)
yarn dev                        # Dev server at localhost:3000 (uses .env / testnet)
yarn dev:production             # Dev server with .env.production (mainnet)
yarn lint                       # ESLint with --fix (~15 console warnings are normal)
yarn typecheck                  # nuxt typecheck (vue-tsc under the hood, must pass with 0 errors)
NODE_OPTIONS=--max_old_space_size=8192 yarn generate   # Static site generation (what CI runs)
NODE_OPTIONS=--max_old_space_size=8192 yarn build      # SSR build
yarn preview                    # Preview production build
```

CI runs: `yarn lint` → `yarn typecheck` → `yarn generate` (all must pass).
CD: pushes to `master` deploy to GitHub Pages via `yarn generate:production`.

**No automated tests exist** — changes are verified manually via `yarn dev` in the browser.

## Architecture

### State Management (Pinia stores in `stores/`)
All stores use Composition API style (setup function pattern):
- **book-store-api.ts** — Bookstore API integration, authentication, book listings, moderation
- **wallet.ts** — Multi-wallet connections (Magic Link, WalletConnect, MetaMask, Coinbase)
- **user.ts** — User auth state, profile, LikerInfo
- **nft.ts** — NFT class metadata caching, listing info
- **orders.ts** / **stripe.ts** / **liker.ts** / **ui.ts** — Orders, payments, LikeCoin data, UI state

### Composables (`composables/`)
- Auth & session: `useAuth.ts`, `useMagicSession.ts`
- NFT contracts: `useNFTContractReader.ts`, `useNFTContractWriter.ts`, `useNFTClassCreator.ts`, `useNFTMinter.ts`, `useContractWrite.ts`, `useSponsoredTransaction.ts`
- ISCN: `useISCN.ts`
- Upload: `useFileUploadLocal.ts`, `useArweaveUpload.ts`, `useBulkUpload.ts`
- UI / utilities: `useToast.ts`, `useTimePopup.ts`, `useRouteQuery.ts`, `useReadersTable.ts`, `useMessageCharCount.ts`, `useMaintenanceMode.ts`, `useLogEvent.ts`

### Pages (`pages/`)
- **new-book.vue** — Multi-step wizard: Upload EPUB/PDF → Register ISCN → Mint NFT class → Create listing
- **bulk-upload.vue** — CSV-driven bulk import of books (uses `useBulkUpload.ts` and `utils/bulk-upload.ts`)
- **my-books/** — User's books management: `index.vue`, `send/[classId].vue` (send NFT to readers), `status/[classId].vue` (delivery status)
- **purchase-link.vue** — Sales & purchase link management (large)
- **affiliation-link.vue** — Affiliate link generation
- **batch-qrcode.vue** / **batch-short-links.vue** — Batch QR-code and shortlink generation
- **preview-book.vue** — Token-gated preview for an EPUB/PDF
- **latest-books.vue** — Public listing of latest books
- **sales-pos/** — Point-of-sale UI for in-person sales
- **sales-report/** — `index.vue` (sales report) and `payouts/` (payout management)
- **readers/** — Reader analytics
- **settings/** — `index.vue` and `connect/` (Stripe Connect onboarding)

### Web3 Integration
- Wallet plugin: `plugins/wagmi.ts` configures all wallet connectors
- Contract ABIs in `contracts/`
- Utility functions in `utils/wagmi/`
- Two environments: `.env` (Base Sepolia testnet) / `.env.production` (Base mainnet)

### API Layer
- Uses `$fetch` (Nuxt native) with JWT bearer tokens
- API endpoint builders in `constant/api.ts`
- API types in `utils/api.ts`
- Backend: `LIKE_CO_API` environment variable

### Analytics
- PostHog via `@nuxt/scripts` (`useScriptPostHog`)
- Google Analytics via `@nuxt/scripts` (`useScriptGoogleAnalytics`)

### i18n
- Default locale is **Traditional Chinese (zh-TW)**, not English
- Translation files: `i18n/locales/en.json` and `i18n/locales/zh-TW.json`
- Both files must be kept in sync when adding/modifying translations

## Code Conventions

- TypeScript for all new files, Vue 3 `<script setup>` syntax
- `defineModel` and props destructuring are enabled
- Tailwind CSS with custom `like-green` color theme; use @nuxt/ui components
- Commit messages use gitmoji convention (e.g., `✨ Add feature`, `🐛 Fix bug`, `♻️ Refactor`, `💄 Style`, `⬆️ Upgrade deps`)

## Feature Location Quick Reference

| Feature | Key files |
|---------|-----------|
| Authentication | `composables/useAuth.ts`, `stores/user.ts`, `components/LoginPanel.vue` |
| NFT operations | `stores/nft.ts`, `composables/useNFTContract*.ts`, `composables/useNFTClassCreator.ts`, `composables/useNFTMinter.ts`, `components/*NFT*.vue` |
| ISCN (IP registration) | `utils/iscn.ts`, `composables/useISCN.ts`, `components/ISCN*.vue` |
| File upload | `composables/useFileUploadLocal.ts`, `composables/useArweaveUpload.ts`, `composables/useBulkUpload.ts`, `utils/bulk-upload.ts`, `components/UploadForm.vue` |
| Web3 wallet | `stores/wallet.ts`, `plugins/wagmi.ts`, `utils/wagmi/` |
| Pricing/constants | `constant/index.ts`, `constant/api.ts` |

## Known Issues

- Build hangs without `NODE_OPTIONS=--max_old_space_size=8192`
- Sentry warnings about missing releases are expected locally (no SENTRY_AUTH_TOKEN)
- SVG QR code auto-resize has a HACK workaround in `batch-qrcode.vue`
- `nuxt-security` module is active — update CSP headers in `nuxt.config.ts` if adding new external script sources
