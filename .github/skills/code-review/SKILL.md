---
name: code-review
description: Repository-specific review rules for likecoin/publish-3ook-com — the cross-repo preview-cut contract, i18n locale rules (zh-TW is the default locale), test fixture rules, and comment/commit conventions. Use when reviewing pull requests that touch app/utils/preview-cut.ts, test/fixtures/, i18n/locales/, or that add user-facing strings.
---

# Review rules for publish-3ook-com

Architecture, stores, composables, pages, and build commands live in
[AGENTS.md](../../../AGENTS.md) — read that for context rather than restating it here.

This file covers only the invariants that are **not visible from reading this
repository alone**, and that CI does not already enforce. CI runs `yarn lint`,
`yarn typecheck`, `yarn test` and `yarn generate` on every PR, so do not spend
review comments predicting lint, type or build failures.

## `app/utils/preview-cut.ts` is a copy of another repository

The free-preview cut rules in `app/utils/preview-cut.ts` are a **verbatim copy**
of the ebook-cors server's `preview/plan.js`. Both repositories check their copy
against a byte-identical `preview-cut.golden.json` fixture.

This repo only tells the author what the preview *will* contain; the server
decides what readers *actually* get. Changing the rules here alone does not
change reader behaviour — it silently makes the author-facing readout lie.

When a PR changes `app/utils/preview-cut.ts` or
`test/fixtures/preview-cut.golden.json`, flag it unless the PR says the server
changed first. The required order is:

1. change the rules in the ebook-cors server,
2. copy the regenerated fixture across to `test/fixtures/`,
3. mirror the rule change here.

`EXPECTED_FIXTURE_VERSION` in `test/preview-cut.test.mjs` must move with the
fixture's `version`, otherwise this copy goes stale silently.

## i18n

- The default locale is **Traditional Chinese (`zh-TW`)**, not English. When
  wording is being decided, `zh-TW` is the authoritative string and `en.json` is
  the translation — not the other way round.
- `test/i18n-parity.test.mjs` already enforces key parity, placeholder parity
  (`{count}`), plural-branch counts, and non-empty values across both locale
  files. Do not review for those by hand.
- What the test cannot catch, and is worth a comment: **user-facing strings
  hardcoded in `.vue` or `.ts` files** instead of going through `$t()`. New UI
  copy should land in both `i18n/locales/en.json` and `i18n/locales/zh-TW.json`.

## Test fixtures

This is a public repository. Fixtures under `test/fixtures/` must be invented
data that preserves the *shape* of the real input. Flag any fixture that looks
like it was pasted from a real book, a real reader, a real order, or a local
file — real titles, wallet addresses, email addresses, or order IDs.

## Conventions

- Commit messages use **gitmoji** (`✨ Add feature`, `🐛 Fix bug`,
  `♻️ Refactor`, `💄 Style`, `⬆️ Upgrade deps`).
- Code comments stay short — at most 3 lines, broken at punctuation rather than
  mid-sentence. Flag comments that restate what the code plainly does.
