# Copilot Instructions for likecoin/publish-3ook-com

## Repository Overview

**Liker Land NFT Book Press** is a Nuxt 3 web application for publishing NFT books on the blockchain. It's a production application serving users at `https://publish.3ook.com`. The repository is approximately 5.3MB (excluding node_modules) with 156 files, primarily using TypeScript, Vue 3, and Nuxt 3 framework.

### Tech Stack
- **Framework**: Nuxt 3.20.1 (Vue 3.5.24, Vite 7.2.2, Nitro 2.12.9)
- **Node Version**: >= 20 (verified with Node 20.19.6)
- **Package Manager**: Yarn 1.22.22
- **Languages**: TypeScript, Vue 3 (with Composition API and setup syntax)
- **UI Framework**: @nuxt/ui (Tailwind CSS-based)
- **State Management**: Pinia
- **Internationalization**: @nuxtjs/i18n (English and Traditional Chinese)
- **Blockchain**: Web3/Ethereum integration (wagmi, viem, WalletConnect)
- **Key Dependencies**: Arweave/IPFS for storage, Sentry for error tracking

## Build and Validation Commands

### Critical: Memory Requirements
**ALWAYS set NODE_OPTIONS for build/generate commands** to avoid out-of-memory errors:
```bash
NODE_OPTIONS=--max_old_space_size=8192
```

### Dependency Installation
```bash
yarn install
```
- Takes ~80 seconds on first install
- Runs `nuxt prepare` postinstall hook automatically
- Many peer dependency warnings are expected and can be ignored
- No license field warnings are expected and harmless

### Linting
```bash
yarn lint
```
- Uses ESLint with @nuxtjs/eslint-config-typescript
- Runs with `--fix` flag to auto-fix issues
- Console statement warnings (no-console) are expected in development (15 warnings is normal)
- Takes ~6 seconds
- Exit code 0 even with warnings

### Type Checking
```bash
yarn typecheck
```
- Uses Nuxt's built-in TypeScript checking (vue-tsc)
- Takes ~18 seconds
- Must pass with no errors

### Development Server
```bash
yarn dev                    # Development mode with .env
yarn dev:production         # Development mode with .env.production
```
- Runs on http://localhost:3000
- Hot module replacement enabled

### Production Build
```bash
# Standard build (requires NODE_OPTIONS)
NODE_OPTIONS=--max_old_space_size=8192 yarn build

# Production configuration build
NODE_OPTIONS=--max_old_space_size=8192 yarn build:production

# Static site generation
NODE_OPTIONS=--max_old_space_size=8192 yarn generate:production
```
- Build takes 2-3 minutes (~120-180 seconds)
- Without NODE_OPTIONS, build may hang or run out of memory
- Outputs to `.output/` directory
- Expected warnings:
  - Browserslist data outdated (can be ignored)
  - Sentry warnings about missing auth token (expected without SENTRY_AUTH_TOKEN)
  - Rollup annotation comments (can be ignored)
  - Use of eval warnings (from dependencies, can be ignored)
- Total build size: ~87 MB (~24.6 MB gzip)

### Preview Production Build
```bash
yarn preview
```
- Previews the built application locally

## CI/CD Pipeline

### CI Workflow (.github/workflows/ci.yml)
Runs on all pushes and pull requests:
1. Checkout code
2. Setup Node.js 20 with Yarn cache
3. `yarn` - Install dependencies
4. `yarn lint` - Run linter
5. `yarn typecheck` - Type check
6. `yarn build` - Build project with NODE_OPTIONS=--max_old_space_size=8192

**All four steps must pass for CI to succeed.**

### CD Workflow (.github/workflows/cd.yml)
Runs on push to master branch only:
1. Install dependencies
2. Generate static site with `NUXT_APP_BASE_URL=/ yarn generate:production`
3. Deploy to GitHub Pages (publish.3ook.com)
- Requires environment variables: GA_TRACKING_ID, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
- Uses NODE_OPTIONS=--max_old_space_size=8192

## Project Architecture

### Directory Structure
```
/
├── .github/
│   └── workflows/         # CI/CD pipelines (ci.yml, cd.yml)
├── assets/               # Static assets, styles (1.6MB)
│   ├── styles/           # Global CSS
│   └── css/              # Tailwind CSS
├── components/           # Vue components (208KB, 32 components)
│   ├── Auth*.vue         # Authentication UI
│   ├── *Form.vue         # Form components
│   ├── *Modal.vue        # Modal dialogs
│   ├── NFT*.vue          # NFT-related components
│   └── Site*.vue         # Layout components
├── composables/          # Vue composables (56KB, 11 files)
│   ├── useAuth.ts        # Authentication logic
│   ├── useISCN.ts        # ISCN blockchain operations
│   ├── useNFTContract*.ts # Smart contract interactions
│   └── use*.ts           # Other reusable logic
├── constant/             # Constants and configurations
├── contracts/            # Smart contract ABIs
├── i18n/                 # Internationalization
│   └── locales/
│       ├── en.json       # English translations (38KB)
│       └── zh-TW.json    # Traditional Chinese (37KB, default)
├── layouts/              # Nuxt layouts
│   ├── default.vue       # Main application layout
│   └── page.vue          # Page layout
├── middleware/           # Nuxt middleware
│   └── query.global.ts   # Global query parameter handling
├── pages/                # Nuxt pages (260KB, 19 pages)
│   ├── index.vue         # Home page
│   ├── new-book.vue      # Create new NFT book
│   ├── my-books/         # User's books management
│   ├── readers/          # Reader analytics
│   ├── sales-*/          # Sales management pages
│   └── settings/         # User settings
├── plugins/              # Nuxt plugins
│   ├── buffer.ts         # Buffer polyfill for browser
│   └── wagmi.ts          # Web3 wallet configuration
├── public/               # Public static files
├── stores/               # Pinia stores (56KB, 8 stores)
│   ├── wallet.ts         # Web3 wallet state
│   ├── user.ts           # User authentication state
│   ├── nft.ts            # NFT state management
│   ├── orders.ts         # Order management
│   └── *.ts              # Other state stores
├── utils/                # Utility functions (68KB)
│   ├── api.ts            # API client
│   ├── arweave.ts        # Arweave storage utilities
│   ├── iscn.ts           # ISCN utilities
│   ├── wagmi/            # Web3 utilities
│   └── *.ts              # Other utilities
├── app.vue               # Root Vue component
├── app.config.ts         # Nuxt UI app configuration
├── nuxt.config.ts        # Main Nuxt configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.cjs         # ESLint configuration
├── .env                  # Development environment (testnet)
├── .env.production       # Production environment (mainnet)
└── package.json          # Dependencies and scripts
```

### Key Configuration Files

**nuxt.config.ts**: Main application configuration
- Modules: Sentry, Pinia, ESLint, Nuxt UI, gtag, nuxt-security, i18n
- Custom Vite plugins for Node.js polyfills
- Security headers configuration
- Runtime config with environment variables

**tsconfig.json**: Extends .nuxt/tsconfig.json (auto-generated)

**.eslintrc.cjs**: ESLint with @nuxtjs/eslint-config-typescript preset

**tailwind.config.ts**: Custom "like-green" color theme

**.npmrc**: `shamefully-hoist=true`, `strict-peer-dependencies=false`

### Environment Variables
Two environment files exist:
- `.env` - Development/testnet configuration (IS_TESTNET=TRUE, Sepolia network)
- `.env.production` - Production/mainnet configuration (Base network)

Key variables: SITE_URL, CHAIN_EXPLORER_URL, LIKE_NFT_CONTRACT_ADDRESS, WALLET_CONNECT_PROJECT_ID, CUSTOM_RPC_URL, etc.

### State Management
Pinia stores handle:
- `wallet` - Web3 wallet connection and blockchain interactions
- `user` - User authentication and profile
- `nft` - NFT class and token management
- `orders` - Purchase order tracking
- `liker` - LikeCoin user data
- `stripe` - Payment processing
- `book-store-api` - Bookstore API integration
- `ui` - UI state (mobile menu, etc.)

### Authentication Flow
Authentication uses Web3 wallets:
1. User connects wallet (WalletConnect, MetaMask, Coinbase, etc.)
2. Wallet connection managed by @wagmi/vue
3. JWT tokens stored in cookies
4. Auth state tracked in user.ts store

## Known Issues and Workarounds

### Build Memory Issues
**Problem**: Build process may hang or fail with out-of-memory errors without sufficient heap space.
**Solution**: Always use `NODE_OPTIONS=--max_old_space_size=8192` for build and generate commands.

### SVG Auto-Resize Issue
**Known Issue**: QR code SVG generation in batch QR code functionality requires manual viewBox attribute fix.
**Location**: Found in batch QR code page with HACK comment: `// HACK: Add viewBox attribute to fix the auto resize of SVG`
**Workaround**: The codebase includes a workaround that manually adds viewBox attributes to fix SVG auto-resize behavior.

### Sentry Warnings
**Expected Behavior**: When building without SENTRY_AUTH_TOKEN environment variable, warnings appear about not creating releases or uploading source maps. This is expected in local development.

## Making Code Changes

### File Locations by Feature
- **Authentication**: composables/useAuth.ts, stores/user.ts, components/Login*.vue
- **NFT Operations**: stores/nft.ts, composables/useNFTContract*.ts, components/*NFT*.vue
- **ISCN (Blockchain Content)**: utils/iscn.ts, composables/useISCN.ts, components/ISCN*.vue
- **File Upload**: composables/useFileUpload.ts, components/UploadForm.vue, utils/uploadFile.ts
- **Web3 Wallet**: stores/wallet.ts, plugins/wagmi.ts, utils/wagmi/
- **Internationalization**: i18n/locales/ (en.json, zh-TW.json - default locale is zh-TW)
- **Styling**: Use Tailwind classes, custom "like-green" color variants, @nuxt/ui components

### Code Style
- Use TypeScript for all new files
- Use Vue 3 Composition API with `<script setup>` syntax
- Use `defineModel` and props destructuring (enabled in Vite config)
- Console statements generate warnings but don't break builds
- Follow existing ESLint rules

### Testing Changes Locally
1. Make code changes
2. Run `yarn lint` to check for linting issues
3. Run `yarn typecheck` to check for type errors
4. For development testing: `yarn dev` (or `yarn dev:production`)
5. For production testing: `NODE_OPTIONS=--max_old_space_size=8192 yarn build && yarn preview`
6. Verify changes work in browser at http://localhost:3000

## Important Notes

- **No test files**: This repository does not have automated tests. Manual testing is required.
- **Default locale**: Traditional Chinese (zh-TW) is the default locale, not English
- **Build artifacts**: .nuxt/, .output/, .nitro/, dist/ are gitignored
- **Node modules**: shamefully-hoist is enabled in .npmrc for dependency resolution
- **Browser polyfills**: Buffer and other Node.js polyfills are configured for browser compatibility
- **Security**: nuxt-security module is configured with custom CSP and CORS headers

## Quick Reference

**Start development**: `yarn dev`
**Lint code**: `yarn lint`
**Type check**: `yarn typecheck`
**Build for production**: `NODE_OPTIONS=--max_old_space_size=8192 yarn build`
**Preview build**: `yarn preview`

**Trust these instructions** - they are verified and comprehensive. Only search for additional information if something here is incomplete or produces unexpected results.
