---
phase: 05a
slug: llm-wiki-filesystem-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 05a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/core/notes/ --no-coverage` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/notes/ --no-coverage`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05a-W0-01 | 00 | 0 | NOTE-02 | — | N/A | unit | `vitest run tests/core/ai/LlmService.test.ts` | ❌ W0 | ⬜ pending |
| 05a-W0-02 | 00 | 0 | NOTE-02 | — | N/A | unit | `vitest run tests/core/notes/NoteTagger.test.ts` | ❌ W0 | ⬜ pending |
| 05a-W0-03 | 00 | 0 | NOTE-02 | — | N/A | unit | `vitest run tests/core/notes/NoteQA.test.ts` | ❌ W0 | ⬜ pending |
| 05a-W0-04 | 00 | 0 | NOTE-02 | — | N/A | unit | `vitest run tests/core/notes/NoteChatConverter.test.ts` | ❌ W0 | ⬜ pending |
| 05a-W0-05 | 00 | 0 | NOTE-03 | — | N/A | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ W0 | ⬜ pending |
| 05a-W0-06 | 00 | 0 | NOTE-02 | — | N/A | unit | `vitest run tests/core/notes/NoteMaintenance.test.ts` | ❌ W0 | ⬜ pending |
| 05a-01-01 | 01 | 1 | NOTE-02 | T-01 | NoteTagger enrichment + memoryFacts from single haiku call; stale-suggestion discard | unit | `vitest run tests/core/notes/NoteTagger.test.ts` | ❌ W0 | ⬜ pending |
| 05a-02-01 | 02 | 1 | NOTE-02 | T-02 | NoteQA RAG synthesis with numbered citations; search mode rerank | unit | `vitest run tests/core/notes/NoteQA.test.ts` | ❌ W0 | ⬜ pending |
| 05a-03-01 | 03 | 1 | NOTE-02 | T-03 | NoteChatConverter draft generation with provenance | unit | `vitest run tests/core/notes/NoteChatConverter.test.ts` | ❌ W0 | ⬜ pending |
| 05a-04-01 | 04 | 1 | NOTE-03 | T-04 | NoteFileSync .md write with YAML frontmatter, check permission before sync | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ W0 | ⬜ pending |
| 05a-04-02 | 04 | 1 | NOTE-03 | T-05 | Restore: additive upsert, preview count, collision suffixing | unit | `vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ W0 | ⬜ pending |
| 05a-05-01 | 05 | 1 | NOTE-02 | — | NoteMaintenance staleness + orphan queries | unit | `vitest run tests/core/notes/NoteMaintenance.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/ai/LlmService.test.ts` — LlmService unit tests (Zod validation, provider resolution, abort propagation)
- [ ] `tests/core/notes/NoteTagger.test.ts` — NoteTagger unit tests (enrichment, memoryFacts, staleness, toggles)
- [ ] `tests/core/notes/NoteQA.test.ts` — NoteQA unit tests (RAG synthesis, search mode, tiny mode, citation parsing)
- [ ] `tests/core/notes/NoteChatConverter.test.ts` — NoteChatConverter unit tests (draft generation, provenance)
- [ ] `tests/core/notes/NoteFileSync.test.ts` — NoteFileSync unit tests (frontmatter, sanitization, collision, permission, external-change, restore)
- [ ] `tests/core/notes/NoteMaintenance.test.ts` — NoteMaintenance unit tests (staleness, orphan detection, reanalyzeAll)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File System Access API showDirectoryPicker flow | NOTE-03 | Requires user gesture + browser interaction | Open Full App, click "Set backup folder", select directory, verify .md written on save |
| Backup folder permission revoked recovery | NOTE-03 | Requires manual browser permission revocation | Revoke permission in Chrome settings, verify "Backup: Error" tag, re-select folder |
| Note enrichment accept/reject UI rendering | NOTE-02 | Requires visual inspection | Save note, verify suggestions render with accept/reject, verify accepted updates trigger re-sync |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
