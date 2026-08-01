---
phase: 05
slug: knowledge-base
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/core/notes src/core/memory` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/core/notes src/core/memory`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | NOTE-01 | T-05-01 / T-05-02 | Zod boundary validates all note input; LinkParser regex is read-only extraction | unit + TDD tracer | `npx vitest run tests/core/notes/LinkParser.test.ts tests/core/notes/MiniSearchNoteIndex.test.ts` | ⬜ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | NOTE-01 | T-05-04 | NoteGraph computes backlinks dynamically (never stored); similarity O(N) per query | unit + TDD | `npx vitest run tests/core/notes/NoteGraph.test.ts` | ⬜ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | NOTE-01 | — | NotesStore CRUD delegates to NotesDB; i18n strings resolve via t() | unit + TDD | `npx vitest run tests/core/storage/NotesStore.test.ts` | ⬜ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | MEM-01 | T-05-08 | Confidence immutable per D-07; useCount+lastUsedAt only fields mutated during retrieval | unit + TDD | `npx vitest run tests/core/memory/MemoryScorer.test.ts` | ⬜ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | MEM-01 | T-05-06 / T-05-07 | D-05 write boundary: LLM writes limited to conversation summaries; sensitivity inherits to ContextItem | unit + TDD | `npx vitest run tests/core/memory/UserMemoryStore.test.ts tests/core/memory/ConversationMemoryStore.test.ts` | ⬜ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | MEM-01, MEM-02 | T-05-05 / T-05-09 | BroadcastBus primary check before every write; WriteJournal wraps all mutations | unit + TDD | `npx vitest run tests/core/memory/MemoryEngine.test.ts` | ⬜ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | MEM-01 | T-05-10 | Summarization uses lowest-cost tier; empty/failed responses preserve messages; prompt template isolates untrusted text | unit + TDD | `npx vitest run tests/core/memory/ConversationMemoryStore.test.ts` | ⬜ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | NOTE-01, MEM-01, MEM-02 | T-05-11 / T-05-12 | PersonaInjector reads from MemoryEngine (not direct store); integration tests use fake-indexeddb (no real LLM) | integration + TDD | `pnpm run verify:phase-5` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files are created by the plans themselves via TDD — no separate Wave 0 plan needed.

- [x] `tests/core/notes/LinkParser.test.ts` — created by Plan 05-01 Task 1 (tdd)
- [x] `tests/core/notes/MiniSearchNoteIndex.test.ts` — created by Plan 05-01 Task 1 (tdd)
- [x] `tests/core/notes/NoteGraph.test.ts` — created by Plan 05-01 Task 2 (tdd)
- [x] `tests/core/storage/NotesStore.test.ts` — created by Plan 05-01 Task 3 (tdd)
- [x] `tests/core/memory/MemoryScorer.test.ts` — created by Plan 05-02 Task 1 (tdd)
- [x] `tests/core/memory/UserMemoryStore.test.ts` — created by Plan 05-02 Task 2 (tdd)
- [x] `tests/core/memory/ConversationMemoryStore.test.ts` — created by Plan 05-02 Task 2 (tdd)
- [x] `tests/core/memory/MemoryEngine.test.ts` — created by Plan 05-02 Task 3 (tdd)
- [x] `tests/core/integration/phase05.test.ts` — created by Plan 05-03 Task 2 (tdd)
- [x] `tests/setup.ts` — shared fixtures (fake-indexeddb, EventBus mock, LLM provider mock) already exist from Phase 2/3

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Summary quality assessment | MEM-01 | Subjective quality of LLM-generated summaries | Review sampled summaries for decisions+goals+facts format, 2-3 sentence conciseness |
| MiniSearch search quality <50ms @1000 notes | NOTE-01 | Performance benchmark requires real IndexedDB + 1000 note dataset | Run benchmark with timer; verify p99 < 50ms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
