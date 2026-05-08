# Copilot Instructions for likecoin/publish-3ook-com

The canonical agent guide for this repo is **[AGENTS.md](../AGENTS.md)** (also symlinked as `CLAUDE.md`). It covers project overview, architecture, stores, composables, pages, code conventions, and feature locations — read it first.

This file adds Copilot-specific notes: build timings, expected warnings, and CI/CD detail.

## Build and Validation

### Critical: Memory Requirements
**ALWAYS set `NODE_OPTIONS=--max_old_space_size=8192`** for build/generate commands or builds may hang silently rather than fail loudly.

### Expected timings
- `yarn install` — ~80s on cold install; runs `nuxt prepare` postinstall
- `yarn lint` — ~6s; exits 0 even with the ~15 expected `no-console` warnings
- `yarn typecheck` — ~18s; must pass with 0 errors
- `yarn build` / `yarn generate` — 2–3 min (~120–180s); output in `.output/`

### Expected warnings (safe to ignore)
- Many peer-dependency and "no license field" warnings during install
- Browserslist data outdated
- Sentry warnings about missing `SENTRY_AUTH_TOKEN` (expected locally)
- Rollup annotation comments and "use of eval" warnings from dependencies

## CI/CD

**CI** (`.github/workflows/ci.yml`, runs on every push and PR):
1. `yarn` — install
2. `yarn lint`
3. `yarn typecheck`
4. `yarn generate` with `NODE_OPTIONS=--max_old_space_size=8192`

All four steps must pass.

**CD** (`.github/workflows/cd.yml`, runs on push to `master`):
1. Install
2. `NUXT_APP_BASE_URL=/ yarn generate:production`
3. Deploy to GitHub Pages (`publish.3ook.com`)

Required environment variables: `GA_TRACKING_ID`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

## Environment files

- `.env` — development/testnet (Base Sepolia, `IS_TESTNET=TRUE`)
- `.env.production` — production/mainnet (Base)

Key variables: `SITE_URL`, `CHAIN_EXPLORER_URL`, `LIKE_NFT_CONTRACT_ADDRESS`, `WALLET_CONNECT_PROJECT_ID`, `CUSTOM_RPC_URL`, `LIKE_CO_API`.

## Tooling notes

- `.npmrc` has `shamefully-hoist=true` and `strict-peer-dependencies=false`
- Buffer and other Node polyfills are configured in Vite for browser compatibility

For build/dev commands, architecture, conventions, and feature locations, see **[AGENTS.md](../AGENTS.md)**.
