---
phase: 05
slug: knowledge-base-memory-minisearch-notes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (threads pool; jsdom-align custom env for component tests; node env for pure core) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts --bail=1` |
| **Full suite command** | `pnpm run verify:phase-5` (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run — §24 chain per D-05-19, spec line 3685) |
| **Estimated runtime** | ~40 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file> --bail=1`
- **After every plan wave:** Run `npx vitest run tests/core/memory tests/core/search tests/core/notes tests/components/notes --bail=1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-XX | 01 | 1 | KNW-04 | T-05-XX / — | MemoryScorer §3.4 weights in [0,1], injectable clock | unit | `vitest run tests/core/memory/MemoryScorer.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-XX | 02 | 1 | KNW-04 | T-05-XX / — | MemoryEngine budgets (top-5/top-3 tiny/≤1000), single-writer | unit | `vitest run tests/core/memory/MemoryEngine.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-XX | 03 | 1 | KNW-04 | T-05-XX / — | UserMemoryStore CRUD + working memory (O.10), write-never-throws (GR-9) | unit | `vitest run tests/core/memory/UserMemoryStore.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-XX | 04 | 1 | KNW-04 | T-05-XX / — | ConversationMemoryStore compactor + LRU 10/100 | unit | `vitest run tests/core/memory/ConversationMemoryStore.test.ts` | ❌ W0 | ⬜ pending |
| 05-05-XX | 05 | 1 | KNW-04/05 | T-05-XX / — | PreferenceMemoryStore np_persona writer + legacy compat | unit | `vitest run tests/core/memory/PreferenceMemoryStore.test.ts` | ❌ W0 | ⬜ pending |
| 05-06-XX | 06 | 1 | KNW-05 | T-05-XX / — | MemoryExtractor haiku via PersonaInjector + requestJson, non-blocking | unit | `vitest run tests/core/memory/MemoryExtractor.test.ts` | ❌ W0 | ⬜ pending |
| 05-07-XX | 07 | 2 | KNW-03 | T-05-XX / — | MiniSearchIndex fields + rebuild + <50ms/1000 + [0,1] | unit + perf | `vitest run tests/core/search/MiniSearchIndex.test.ts` | ❌ W0 | ⬜ pending |
| 05-08-XX | 08 | 2 | KNW-01 | T-05-XX / — | LinkParser tie-break + unresolved + reconciliation | unit | `vitest run tests/core/notes/LinkParser.test.ts` | ❌ W0 | ⬜ pending |
| 05-09-XX | 09 | 2 | KNW-02 | T-05-XX / — | NoteGraph edges + backlinks + dangling reconciliation | unit | `vitest run tests/core/notes/NoteGraph.test.ts` | ❌ W0 | ⬜ pending |
| 05-10-XX | 10 | 3 | KNW-01/02 | T-05-XX / — | Notes UI (NotesPage, NoteGraphView, BacklinksPanel, WikilinkAutocomplete) | component (jsdom-align) | `vitest run tests/components/notes/*.test.tsx` | ❌ W0 | ⬜ pending |
| 05-11-XX | 11 | 3 | KNW-05 | T-05-XX / — | ContextOptimizer threading memoryHints→memoryText + reduce-topk real | unit | `vitest run tests/core/context/ContextOptimizer.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/memory/MemoryEngine.test.ts` — stubs for KNW-04/05
- [ ] `tests/core/memory/MemoryScorer.test.ts` — stubs for KNW-04 (required by §18)
- [ ] `tests/core/memory/UserMemoryStore.test.ts` — stubs for KNW-04 (required by §18)
- [ ] `tests/core/memory/ConversationMemoryStore.test.ts` — stubs for KNW-04
- [ ] `tests/core/memory/PreferenceMemoryStore.test.ts` — stubs for KNW-04/05 + D-05-18 compat
- [ ] `tests/core/memory/MemoryExtractor.test.ts` — stubs for KNW-05 (GR-4)
- [ ] `tests/core/search/MiniSearchIndex.test.ts` — stubs for KNW-03 (required by §18)
- [ ] `tests/core/notes/LinkParser.test.ts` — stubs for KNW-01 (required by §18)
- [ ] `tests/core/notes/NoteGraph.test.ts` — stubs for KNW-02
- [ ] `d3-force@^3` install (approved stack, R-9 OK) — required by NoteGraphView

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MiniSearch over 1,000 notes < 50 ms real-world latency | KNW-03 | Perf target is representative-load, not unit-assertable | Load 1,000 seeded notes in Standalone, search, confirm < 50 ms in performance tooling |
| Note graph visual layout quality (d3-force) | KNW-02 | Visual judgment; reduced-motion correctness unit-tested | Open graph view, drag nodes, confirm legibility + reduced-motion honored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
