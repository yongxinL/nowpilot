---
phase: 8
slug: knowledge-base-memory-minisearch-notes
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom; fake-indexeddb) |
| **Config file** | `vitest.config.ts` (aliases `@/*` → repo root; setup `tests/setup.ts`) |
| **Quick run command** | `pnpm test -- tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` |
| **Full suite command** | `pnpm run verify:phase-8` (post D-114 re-point) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`
- **After every plan wave:** Run `pnpm run verify:phase-8`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | RICH-R-05 (D-112) | T-8-01 / — | Persona config lives in np_persona, never the fact store (R2) | unit | `pnpm test -- tests/core/memory/PreferenceMemoryStore.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | RICH-R-05 (D-107/D-108) | — | Note.type declared, no reader/writer consumes it | unit | `pnpm run lint` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | §3.3/§3.4/§3.6 (D-104/D-106) | T-8-02 / — | Memory bodies in MemoryDB; metadata/local; TraceRedactor'd | unit | `pnpm test -- tests/core/memory/MemoryEngine.test.ts tests/core/memory/UserMemoryStore.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 3 | §3.4/§26.5 (D-109/D-110/D-113) | — | MiniSearch <50ms/1000; wikilink tie-break | unit + perf | `pnpm test -- tests/core/search/MiniSearchIndex.test.ts tests/core/notes/LinkParser.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 4 | §22.3 (D-111) | — | topKSimilar cosine + backlinks core | unit | `pnpm test -- tests/core/search tests/core/notes` | ❌ W0 | ⬜ pending |
| 08-05-01 | 05 | 5 | RICH-R-05 + §18 DONE | — | verify:phase-8 gate green; E2E Page→Note→MiniSearch | gate | `pnpm run verify:phase-8` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/memory/` — MemoryEngine.test.ts, MemoryScorer.test.ts, UserMemoryStore.test.ts (+ PreferenceMemoryStore.test.ts, ConversationMemoryStore.test.ts)
- [ ] `tests/core/search/MiniSearchIndex.test.ts`
- [ ] `tests/core/notes/LinkParser.test.ts`
- [ ] `tests/setup.ts` — fake-indexeddb already wired (Phase 2); no new infra

*Existing infrastructure covers most phase requirements; the five §18 test files are Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| np_persona round-trip in a real Chrome surface | RICH-R-05 | chrome.storage.local adapter is Map-backed in tests; real-browser persistence needs manual check | Open Options, set persona overrides, reload extension, confirm they persist |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
*Seeded 2026-09-01 from RESEARCH.md Validation Architecture.*