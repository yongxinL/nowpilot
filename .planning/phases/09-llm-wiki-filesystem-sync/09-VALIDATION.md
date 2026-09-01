---
phase: 9
slug: llm-wiki-filesystem-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/core/notes/` |
| **Full suite command** | `pnpm run verify:phase-9` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/notes/`
- **After every plan wave:** Run `pnpm run verify:phase-9`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | LLM-WIKI-01 | — | N/A | unit | `npx vitest run tests/core/notes/NoteTagger.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | SYNC-01 | — | N/A | unit | `npx vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | LLM-WIKI-06 | — | N/A | unit | `npx vitest run tests/core/notes/NoteQA.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | LLM-WIKI-07 | — | N/A | unit | `npx vitest run tests/core/notes/NoteChatConverter.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | SYNC-09 | — | N/A | unit | `npx vitest run tests/core/notes/NoteFileSync.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 3 | NMEM-02 | — | N/A | unit | `npx vitest run tests/core/notes/NoteTagger.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/notes/NoteTagger.test.ts` — stubs for LLM-WIKI-01/LLM-WIKI-11
- [ ] `tests/core/notes/NoteFileSync.test.ts` — stubs for SYNC-01/SYNC-04
- [ ] `yaml` ^2.9.0 + `@types/wicg-file-system-access` install

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| showDirectoryPicker() permission prompt | SYNC-01/SYNC-02 | Browser File System Access API requires user gesture + cannot be automated in jsdom | In Standalone view, click "Set backup folder", verify picker appears; verify banner on deny |
| OKF frontmatter round-trip on real filesystem | SYNC-04/SYNC-09 | Real filesystem write/restore needs a live directory handle | Set backup folder, create a note, verify `.md` file appears with correct YAML frontmatter; delete + restore |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
