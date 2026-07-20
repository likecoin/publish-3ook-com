---
name: run-publish-3ook-com
description: Run, launch, build, screenshot, and drive the publish.3ook.com Nuxt app. Use when asked to start the dev server, take a screenshot of a page, click through the UI, verify a change works in the real running app, or run the lint/typecheck/test suite.
---

# Run publish.3ook.com

Nuxt 4 SPA (Vue 3 + @nuxt/ui + wagmi). Driven headlessly by
`.claude/skills/run-publish-3ook-com/driver.mjs` — a zero-dependency Chrome
DevTools Protocol client built on Node's native `WebSocket`. No Playwright or
Puppeteer install required; it drives the Chrome already on the machine.

All paths below are relative to the repo root.

## Prerequisites

Node >= 24 (`package.json` engines), Yarn 1, and a Chrome/Chromium binary. The
driver auto-detects `/Applications/Google Chrome.app/...` and the usual Linux
paths; override with `CHROME_BIN=/path/to/chrome`. Set `CDP_PORT` to run two
drivers at once — each launches its own Chrome against a throwaway profile.

```bash
yarn install
```

## Run the app

The dev server must be running before the driver can drive anything. It reads
`.env` (Base Sepolia testnet); `yarn dev:production` uses `.env.production`
(mainnet) instead.

```bash
NODE_OPTIONS=--max_old_space_size=8192 yarn dev
```

Wait for `➜ Local: http://localhost:3000/` in the output before continuing.

## Drive it (agent path)

Start here. With the dev server up:

```bash
node .claude/skills/run-publish-3ook-com/driver.mjs smoke
```

Loads `/`, `/about`, `/latest-books`, then clicks the login CTA and asserts the
wallet-selection dialog opens. Verified output:

```
PASS /  title="publish.3ook.com"  shot=.../shots/index.png
PASS /about  title="關於 publish.3ook.com - publish.3ook.com"  shot=.../shots/about.png
PASS /latest-books  title="publish.3ook.com"  shot=.../shots/latest-books.png
PASS interaction: login panel opened  shot=.../shots/login-panel.png
```

Exit code is non-zero if any step fails. A healthy run takes ~15s; if the dev
server is down every step burns its own 30s hydration timeout, so a total
failure takes ~2min to report. Screenshots land in
`.claude/skills/run-publish-3ook-com/shots/` (gitignored) — **open them and
look**; a route can "PASS" while rendering a blank shell.

One-shot commands:

```bash
node .claude/skills/run-publish-3ook-com/driver.mjs shot /about about.png
node .claude/skills/run-publish-3ook-com/driver.mjs eval /about 'document.title'
```

For a multi-step flow, pipe commands into the REPL:

```bash
printf 'goto /about\nclick 登入 / 註冊\ntext\nshot login-panel.png\nquit\n' \
  | node .claude/skills/run-publish-3ook-com/driver.mjs repl
```

Verbs: `goto <route>`, `click <selector-or-visible-text>`, `type <selector> <value>`,
`eval <js>`, `text`, `shot [file]`, `errors`, `quit`.

`click` takes a CSS selector, or falls back to matching visible text of a
button/link/label. It dispatches **real** CDP mouse events at the element
centre, not `el.click()` — see Gotchas.

## Checks

All three were run and pass on this branch:

```bash
yarn test        # node --test, 32 assertions on the preview-cut rules
yarn typecheck   # must report 0 errors
yarn lint
```

CI runs `yarn lint` → `yarn typecheck` → `yarn generate`.

## Gotchas

- **A welcome modal eats the first click.** `WelcomeModal.vue` opens on mount
  unless `localStorage['welcomePopup:v3']` is set. The driver seeds it via
  `Page.addScriptToEvaluateOnNewDocument` (the only hook early enough to beat
  the `onMounted` gate — seeding after `Page.navigate` loses the race). If you
  drive Chrome yourself, set that key or your first click hits the modal.
- **`el.click()` silently no-ops on @nuxt/ui buttons.** They are reka-ui based
  and react to pointer events. The driver dispatches
  `Input.dispatchMouseEvent` at the element's bounding-box centre instead.
- **The sidebar animates open ~0.5s after mount and shifts the layout right.**
  Measure coordinates *after* it settles or clicks land where the element used
  to be. `goto` waits 800ms past hydration for this.
- **Auth-gated routes do not redirect.** `/my-books` stays at `/my-books` and
  renders the unauthenticated landing content. Never assert on
  `location.pathname` to decide whether auth worked — check for the presence of
  the 登入 / 註冊 CTA instead.
- **Authenticated pages cannot be driven headlessly.** There is no persisted
  JWT to seed; the session comes from a live Magic Link / wagmi handshake
  needing email OTP or a real wallet. `/my-books`, `/new-book`,
  `/purchase-link`, `/sales-report`, `/settings` require the human path below.
- **Default locale is zh-TW**, so `click` targets are Chinese text
  (`登入 / 註冊`, not `Login`).
- **`Page.loadEventFired` is useless here.** It fires long before Vue mounts;
  `goto` polls `#__nuxt` for non-empty `innerText` instead.
- The Nuxt DevTools bar and Vue tracer overlay render over the page. `goto`
  hides `#nuxt-devtools-container` and `#vue-tracer-overlay` before screenshots.

## Human path

`yarn dev`, then open http://localhost:3000 in a real browser. This is the only
way to exercise wallet connection, EPUB/PDF upload, ISCN registration, and
minting. Ctrl-C to stop.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Chrome binary found. Set CHROME_BIN.` | Set `CHROME_BIN` to your Chrome/Chromium executable. |
| `Timed out waiting for Nuxt to hydrate` | Dev server isn't up, or Vite is mid re-optimize. Check the `yarn dev` log and retry. |
| `[exception] Failed to fetch dynamically imported module: .../entry.js` in smoke output | Transient — Vite re-optimized deps and forced a reload. Re-run `smoke`. |
| Build or generate hangs | Missing `NODE_OPTIONS=--max_old_space_size=8192`. |
| `click` reports `not found: <text>` | The locale is zh-TW; the visible label is Chinese. Dump candidates with `eval [...document.querySelectorAll('button')].map(b=>b.innerText)`. |
| Port 9222 already in use | A previous run left Chrome alive: `pkill -f remote-debugging-port=9222`, or set `CDP_PORT`. |
