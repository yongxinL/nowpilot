---
phase: 05
slug: knowledge-base
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
updated: 2026-08-02
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 |
| **Config file** | vitest.config.ts (environment: jsdom, globals: true, setupFiles: [./tests/setup.ts]) |
| **Quick run command** | `npm run verify:phase-5` (tsc --noEmit + 10 explicit suites) |
| **Perf/UAT run command** | `npm run test:perf` (tests/perf) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (gate) + ~2 seconds (perf) |

---

## Sampling Rate

- **After every task commit:** Run `npm run verify:phase-5`
- **After every plan wave:** Run `npm run verify:phase-5`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | NOTE-01 | T-05-01 / T-05-02 | Zod boundary validates all note input; LinkParser regex is read-only extraction | unit + TDD tracer | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-01-02 | 01 | 1 | NOTE-01 | T-05-04 | NoteGraph computes backlinks dynamically (never stored); similarity O(N) per query | unit + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-01-03 | 01 | 1 | NOTE-01 | — | NotesStore CRUD delegates to NotesDB; i18n strings resolve via t() | unit + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-02-01 | 02 | 1 | MEM-01 | T-05-08 | Confidence immutable per D-07; useCount+lastUsedAt only fields mutated during retrieval | unit + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-02-02 | 02 | 1 | MEM-01 | T-05-06 / T-05-07 | D-05 write boundary: LLM writes limited to working/episodic; sensitivity inherits to ContextItem | unit + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-02-03 | 02 | 1 | MEM-01, MEM-02 | T-05-05 / T-05-09 | BroadcastBus primary check before every write; WriteJournal wraps all mutations | unit + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-03-01 | 03 | 2 | MEM-01 | T-05-10 | Summarization uses haiku-class tier; empty/failed responses preserve messages; prompt template isolates untrusted text (sanitizeExcerpt + DELIMITER_ERROR) | unit + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-03-02 | 03 | 2 | NOTE-01, MEM-01, MEM-02 | T-05-11 / T-05-12 | PersonaInjector reads from MemoryEngine (not direct store); integration tests use fake-indexeddb (no real LLM) | integration + TDD | `npm run verify:phase-5` | ✅ | ✅ green |
| 05-UAT-01 | 03 | 2 | NOTE-01 (SC2) | — | Search latency <50ms across 1,000 indexed notes (was manual-only → automated) | perf/benchmark | `npm run test:perf` | ✅ | ✅ green |
| 05-UAT-02 | 03 | 2 | MEM-01 (SC3) | — | Full summarization loop: 12 appends → shouldCompact=true → compactConversation (FAST tier) → ≤500-char summary stored, all 12 messages preserved (was manual-only → automated) | perf/integration | `npm run test:perf` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files were created by the plans themselves via TDD — no separate Wave 0 plan was needed.

- [x] `tests/core/notes/LinkParser.test.ts` — created by Plan 05-01 Task 1 (tdd)
- [x] `tests/core/notes/MiniSearchNoteIndex.test.ts` — created by Plan 05-01 Task 1 (tdd)
- [x] `tests/core/notes/NoteGraph.test.ts` — created by Plan 05-01 Task 2 (tdd)
- [x] `tests/core/notes/NotesDB.test.ts` — created by Plan 05-01 Task 1 (tdd; WR-01 additions in fix commit 26ab6c2)
- [x] `tests/core/storage/NotesStore.test.ts` — created by Plan 05-01 Task 3 (tdd; WR-02 additions in 7e45b2e)
- [x] `tests/core/memory/MemoryScorer.test.ts` — created by Plan 05-02 Task 1 (tdd)
- [x] `tests/core/memory/UserMemoryStore.test.ts` — created by Plan 05-02 Task 2 (tdd)
- [x] `tests/core/memory/ConversationMemoryStore.test.ts` — created by Plan 05-02 Task 2 (tdd; WR-06/09 additions)
- [x] `tests/core/memory/MemoryEngine.test.ts` — created by Plan 05-02 Task 3 (tdd; CR-01/WR-03 additions)
- [x] `tests/core/integration/phase05.test.ts` — created by Plan 05-03 Task 2 (tdd; WR-05/08 additions)
- [x] `tests/core/runtime/BroadcastBus.test.ts` — created by WR-04 fix commit 91f4ad1 (election semantics + remote application)
- [x] `tests/perf/uat-phase05-search-latency.test.ts` — UAT item 1 (SC2 benchmark, 1,000 notes)
- [x] `tests/perf/uat-phase05-summarization-loop.test.ts` — UAT item 2 (SC3 summarization loop)
- [x] `tests/setup.ts` — shared fixtures (fake-indexeddb, EventBus mock, LLM provider mock) already exist from Phase 2/3

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Summary quality assessment | MEM-01 | Subjective quality of LLM-generated summaries (format/content judgment, not mechanism) | Review sampled summaries for decisions+goals+facts format, 2-3 sentence conciseness — mechanism (12-boundary trigger, ≤500-char trim, tier, preservation) is automated by 05-UAT-02 |

*Formerly manual, now automated: MiniSearch <50ms @1,000 notes (→ `tests/perf/uat-phase05-search-latency.test.ts`, measured avg 0.6ms / p95 1.3ms / max 2.1ms) and the end-to-end summarization trigger loop (→ `tests/perf/uat-phase05-summarization-loop.test.ts`). The production turn-loop caller remains Phase 7 UI scope by design — the mechanism is fully exercised without it.*

---

## Validation Audit 2026-08-02

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

- **G1** `tests/perf/uat-phase05-search-latency.test.ts` — TS2352 note-shape error (`body`/`schemaVersion` vs `content`/`categoryPath`/`provenance`/`links`/`unresolvedLinks`) broke `tsc --noEmit` (gate stage 1) and indexed `undefined` content at runtime. Fixed: canonical Note factory (UUID ids, full shape). Gate green, benchmark now genuine.
- **G2** `tests/perf/uat-phase05-summarization-loop.test.ts` — TS2345 `role: string` not assignable to `'user'\|'assistant'\|'tool'`. Fixed: typed `MemoryMessageInput`. Gate green.
- **G3** Draft VALIDATION.md (all tasks ⬜ pending, status: draft) never finalized. Reconstructed with real per-task statuses; the two VERIFICATION.md human-verification items converted to automated perf tests (05-UAT-01/02).

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-02
