# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Liker Land NFT Book Press** (`publish.3ook.com`) — a Nuxt 3 web application for publishing and managing NFT books on the blockchain. Uses Vue 3 Composition API with TypeScript, Pinia for state management, @nuxt/ui (Tailwind CSS), and wagmi/viem for Web3 wallet integration on the Base network (L2 Ethereum).

## Build & Development Commands

**Critical**: Always set `NODE_OPTIONS=--max_old_space_size=8192` for build/generate commands or the build will hang.

```bash
yarn install                    # Install deps (runs nuxt prepare automatically)
yarn dev                        # Dev server at localhost:3000 (uses .env / testnet)
yarn dev:production             # Dev server with .env.production (mainnet)
yarn lint                       # ESLint with --fix (~15 console warnings are normal)
yarn typecheck                  # vue-tsc type checking (must pass with 0 errors)
NODE_OPTIONS=--max_old_space_size=8192 yarn build   # Production build
yarn preview                    # Preview production build
```

CI runs: `yarn lint` → `yarn typecheck` → `yarn build` (all must pass).

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
- **useAuth.ts** — Auth orchestration, wallet connection, signature-based login
- **useISCN.ts** — ISCN (intellectual property) registration on blockchain
- **useNFTContractReader.ts** / **useNFTContractWriter.ts** — Smart contract read/write operations
- **useArweaveUpload.ts** — Permanent file storage on Arweave

### Key Pages
- **new-book.vue** — 4-step wizard: Upload EPUB/PDF → Register ISCN → Mint NFT → Create listing
- **my-books/** — User's books management with detail/edit views
- **purchase-link.vue** — Sales & affiliate link management (large, 33KB)
- **sales-report/** / **readers/** — Analytics and order reporting

### Web3 Integration
- Wallet plugin: `plugins/wagmi.ts` configures all wallet connectors
- Contract ABIs in `contracts/`
- Utility functions in `utils/wagmi/`
- Two environments: `.env` (Base Sepolia testnet) / `.env.production` (Base mainnet)

### API Layer
- Uses `$fetch` (Nuxt native) with JWT bearer tokens
- API endpoint builders in `constant/api.ts`
- API types in `utils/api.ts`
- Backend: LIKE_CO_API environment variable

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
| NFT operations | `stores/nft.ts`, `composables/useNFTContract*.ts`, `components/*NFT*.vue` |
| ISCN (IP registration) | `utils/iscn.ts`, `composables/useISCN.ts`, `components/ISCN*.vue` |
| File upload | `composables/useFileUploadLocal.ts`, `composables/useArweaveUpload.ts`, `components/UploadForm.vue` |
| Web3 wallet | `stores/wallet.ts`, `plugins/wagmi.ts`, `utils/wagmi/` |
| Pricing/constants | `constant/index.ts` |

## Known Issues

- Build hangs without `NODE_OPTIONS=--max_old_space_size=8192`
- Sentry warnings about missing releases are expected locally (no SENTRY_AUTH_TOKEN)
- SVG QR code auto-resize has a HACK workaround in `batch-qrcode.vue`
- `nuxt-security` module is active — update CSP headers in `nuxt.config.ts` if adding new external script sources
