---
phase: 05a
slug: llm-wiki-filesystem-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 05a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (threads pool, jsdom-align env default, node env for core AI tests via `@vitest-environment node`) |
| **Config file** | `vitest.config.ts` + `tests/setup.ts` (fake-indexeddb/auto, fakeBrowser, RTL cleanup) |
| **Quick run command** | `npx vitest run tests/core/notes tests/core/storage/migrations --bail=1` (use `--bail=1`; `-x` is unknown in vitest 4) |
| **Full suite command** | `pnpm run verify:phase-5a` → `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run` (the §24 chain; spec line 3686 defines the minimum) |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/notes tests/core/storage/migrations --bail=1`
- **After every plan wave:** Run `pnpm run verify:phase-5a`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05a-01-01 | 01 | 1 | LLM-WIKI-01 | T-05a-01 / — | non-blocking, never throws | unit | `vitest run tests/core/notes/NoteTagger.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| 05a-02-01 | 02 | 1 | LLM-WIKI-02 | T-05a-02 / — | zero-hit no call; tiny fallback | unit | `vitest run tests/core/notes/NoteQA.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| 05a-03-01 | 03 | 1 | LLM-WIKI-03 | T-05a-03 / — | user-gated draft | unit | `vitest run tests/core/notes/NoteChatConverter.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| 05a-04-01 | 04 | 2 | SYNC-01 | T-05a-04 / — | .md write safe | unit | `vitest run tests/core/notes/NoteFileSync.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| 05a-04-02 | 04 | 2 | SYNC-02 | T-05a-05 / — | additive restore | unit | `vitest run tests/core/notes/NoteFileSync.test.ts --bail=1` (restore) | ❌ W0 | ⬜ pending |
| 05a-05-01 | 05 | 2 | LLM-WIKI-01..03 | — | staleness/orphan pure | unit | `vitest run tests/core/notes/NoteMaintenance.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| 05a-06-01 | 06 | 3 | — | T-05a-06 / — | v4 idempotent | unit | `vitest run tests/core/storage/migrations/v4.test.ts --bail=1` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/notes/NoteTagger.test.ts` — LLM-WIKI-01 (MemoryExtractor.test.ts template)
- [ ] `tests/core/notes/NoteQA.test.ts` — LLM-WIKI-02
- [ ] `tests/core/notes/NoteChatConverter.test.ts` — LLM-WIKI-03
- [ ] `tests/core/notes/NoteFileSync.test.ts` — SYNC-01/02 (+ `tests/core/notes/fixtures/mockFsHandle.ts`)
- [ ] `tests/core/notes/NoteMaintenance.test.ts` — staleness/orphan
- [ ] `tests/core/storage/migrations/v4.test.ts` — v4 idempotency + fresh-install
- [ ] Packages install: `pnpm add yaml@^2.9.0 && pnpm add -D @types/wicg-file-system-access@^2023.10.7`
- [ ] `verify:phase-5a` script added to package.json (full §24 chain)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `showDirectoryPicker()` in the Standalone tab | SYNC-01 | Chrome API only works in a real extension tab (crbug 40240444); no jsdom/fakeBrowser path | Load unpacked extension → Standalone → Notes → Configure backup → pick folder |
| `queryPermission`/`requestPermission` granted state | SYNC-02 | Real Chrome permission model | Verify banner appears after permission loss; Re-select works |
| External-change detection on disk | SYNC-06 | Real filesystem writes with mtime | Edit the .md on disk → save note → confirm overwrite prompt default Skip |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
