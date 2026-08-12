---
phase: 04a
slug: pagecontentservice-knowledge-acquisition
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 04a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing; config `tests/environments/jsdom-align.ts` default, `threads` pool, `tests/setup.ts`) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `pnpm vitest run tests/core/extraction tests/isolation` |
| **Full suite command** | `pnpm run verify:phase-4a` (new script: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && <isolation check>`) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/core/extraction tests/isolation`
- **After every plan wave:** Run `pnpm run verify:phase-4a`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | CAT-01 | T-4a-05 / — | Extraction stays panel-side; no network exfil (defuddle no useAsync) | unit | `pnpm vitest run tests/core/extraction/DefuddleStrategy.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CAT-01 | — | Fallback chain records `sourceUsed` + `fallbacksTried` | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CAT-01 | T-4a-05 / — | APC-lite doc schema-validated | unit | `pnpm vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | CAT-02 | — | SPA-nav invalidation fires on namespaced `wxt:locationchange` | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | CAT-02 | — | Bridge request/reply roundtrip with canonical MessageTypes | unit | `pnpm vitest run tests/core/content -x` | ✅ / ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | CAT-03 | T-4a-01 | Password value omitted at capture (isPassword ⇒ value undefined) | unit (isolation) | `pnpm vitest run tests/isolation/no-content-script-ui.test.ts -x` | partial | ⬜ pending |
| TBD | 02 | 2 | CAT-03 | T-4a-02 | TraceRedactor runs panel-side before any index/log | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | CAT-04 | T-4a-06 | Bundle has no React/AntD/defuddle/yaml/turndown/minisearch tokens | integration (build-gated) | `pnpm vitest run tests/isolation/no-content-script-ui.test.ts -x` | ✅ existing (extend) | ⬜ pending |
| TBD | 03 | 3 | CAT-05 | T-4a-06 | Content payload < 50 KB (sourcemap-stripped) | integration (build-gated) | `pnpm vitest run tests/isolation/no-content-script-ui.test.ts -x` | ❌ new | ⬜ pending |
| TBD | 03 | 3 | CAT-05 | — | Coalescing: concurrent extracts dedup; read-after-invalidate awaits in-flight | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | CAT-05 | — | LRU eviction cap + order deterministic; pinned/in-flight never evicted | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | D-4a-16 | — | PageIndexBuilder heading chunking + "(preamble)" + headingPath | unit | `pnpm vitest run tests/core/extraction/PageIndexBuilder.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm add defuddle@^0.6 @mozilla/readability@^0.5 turndown@^7 minisearch@^7 && pnpm add -D @types/turndown@^5` — the four approved-but-uninstalled libs (R-9); defuddle needs `checkpoint:human-verify` (SUS verdict, spec §7 pre-approves ^0.6)
- [ ] `tests/fixtures/pageContent.ts` — shared golden HTML fixtures (D-4a-24), one set reused by DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests
- [ ] `tests/core/extraction/PageContentService.test.ts` — orchestrator, coalescing, timeout, fallback chain, eviction, currentPageContext write
- [ ] `tests/core/extraction/DefuddleStrategy.test.ts` — golden fixture → clean HTML → markdown (turndown), base-URL stamp
- [ ] `tests/core/extraction/ApcLiteStrategy.test.ts` — RawNode → APCLiteDocument, stats, password invariant via FormControlSchema.refine
- [ ] `tests/core/extraction/PageIndexBuilder.test.ts` — heading chunking, "(preamble)", headingPath, sub-chunking over INDEX_CHUNK_MAX_TOKENS
- [ ] `tests/isolation/no-content-script-ui.test.ts` — extend: sourcemap-stripped < 50 KB assertion + password-omission invariant (D-4a-20) + retire `.mjs` (D-4a-23)
- [ ] `verify:phase-4a` script in package.json (§24 chain + isolation)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SPA-nav invalidation + re-extraction in a real browser | CAT-02 | wxt dev-mode runtime; automated tests dispatch the namespaced event | `pnpm wxt dev`, open a SPA site, navigate client-side, verify cache invalidation fires + re-extract on subscribed tab |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
