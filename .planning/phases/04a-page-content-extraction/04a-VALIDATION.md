---
phase: 04a
slug: page-content-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 04a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest v3.x (configured in vitest.config.ts) |
| **Config file** | vitest.config.ts (jsdom environment, chrome mocks in tests/setup.ts) |
| **Quick run command** | `pnpm run verify:phase-4a` |
| **Full suite command** | `pnpm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run verify:phase-4a`
- **After every plan wave:** Run `pnpm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | PAGE-01 | — | N/A | unit | `vitest run tests/core/extraction/DefuddleStrategy.test.ts -t "extracts markdown"` | ❌ W0 | ⬜ pending |
| {N}-01-02 | 01 | 1 | PAGE-01 | — | N/A | unit | `vitest run tests/core/extraction/DefuddleStrategy.test.ts -t "fallback on low confidence"` | ❌ W0 | ⬜ pending |
| {N}-01-03 | 01 | 1 | PAGE-01 | — | N/A | unit | `vitest run tests/core/extraction/ApcLiteStrategy.test.ts -t "builds APCLiteNode tree"` | ❌ W0 | ⬜ pending |
| {N}-01-04 | 01 | 1 | PAGE-01 | — | N/A | unit | `vitest run tests/core/extraction/PageIndexBuilder.test.ts -t "creates ephemeral index"` | ❌ W0 | ⬜ pending |
| {N}-01-05 | 01 | 1 | PAGE-01 | — | N/A | integration | `vitest run tests/core/extraction/PageContentService.test.ts -t "invalidates on SPA navigation"` | ❌ W0 | ⬜ pending |
| {N}-01-06 | 01 | 1 | PAGE-01 | — | N/A | integration | `vitest run tests/isolation/no-content-script-ui.test.ts` | ❌ W0 | ⬜ pending |
| {N}-01-07 | 01 | 1 | PAGE-01 | T-04a-01 | Password value redaction at capture time | unit | `vitest run tests/core/content/DomSerializer.test.ts -t "redacts password values"` | ❌ W0 | ⬜ pending |
| {N}-01-08 | 01 | 1 | PAGE-01 | T-04a-02 | Global timeout prevents indefinite hangs | unit | `vitest run tests/core/extraction/PageContentService.test.ts -t "respects global timeout"` | ❌ W0 | ⬜ pending |
| {N}-01-09 | 01 | 1 | PAGE-01 | T-04a-03 | Sensitive content redacted before indexing | unit | `vitest run tests/core/extraction/PageContentService.test.ts -t "redacts sensitive content"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/extraction/DefuddleStrategy.test.ts` — covers PAGE-01 Defuddle primary extraction + confidence fallback
- [ ] `tests/core/extraction/ApcLiteStrategy.test.ts` — covers PAGE-01 APC-lite DOM+ARIA tree construction
- [ ] `tests/core/extraction/PageIndexBuilder.test.ts` — covers PAGE-01 MiniSearch index with heading-aware chunks
- [ ] `tests/core/extraction/PageContentService.test.ts` — covers PAGE-01 full integration: cache, fallback, timeout, redaction, concurrency guard
- [ ] `tests/core/content/DomSerializer.test.ts` — covers PAGE-01 password redaction, size cap, truncated flag
- [ ] `tests/isolation/no-content-script-ui.test.ts` — covers PAGE-01 bundle isolation (< 50KB, no React/AntD/defuddle/yaml)
- [ ] `tests/core/content/PageContextBridge.test.ts` — covers PAGE-01 MessageBus EXTRACT_PAGE_CONTENT handler
- [ ] `tests/core/extraction/strategies/ReadabilityFallback.test.ts` — covers PAGE-01 Readability fallback path

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Content script bundle < 50KB in WXT production build | PAGE-01 | Build output requires WXT build system | Run `pnpm build`, inspect `dist/` content script bundle size |
| SPA navigation triggers re-extraction in real browser | PAGE-01 | Requires real browser with SPA page | Load a React/Vue SPA page, navigate between routes, verify cache invalidates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
