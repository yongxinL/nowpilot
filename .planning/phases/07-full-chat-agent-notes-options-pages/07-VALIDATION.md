---
phase: 07
slug: full-chat-agent-notes-options-pages
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-13
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | CHAT-01, AGNT-01 | — | N/A — infrastructure task | unit | `npx tsc --noEmit && npx vitest run` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 0 | AGNT-04, AGNT-05 | T-07-01 | PermissionStore encrypts persisted permissions; dangerous tools always prompt | unit | `npx vitest run tests/core/permissions/PermissionStore.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 0 | CHAT-04, OPT-04, OPT-05 | T-07-03 | TemplateEngine substitutes registered variables only; unknown vars rendered as literal | unit | `npx vitest run tests/core/slash/SlashCommandRegistry.test.ts tests/core/prompts/TemplateEngine.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | CHAT-01, CHAT-08 | T-07-04 | AbortController cancels stream on unmount; no stale state updates | unit | `npx vitest run tests/hooks/useStreamingLLM.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | ALL-PAGES | — | N/A — helper hooks | unit | `npx vitest run tests/hooks/useWorkspace.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | CHAT-01..CHAT-09 | T-07-06 | Title gen falls back to truncated user message on failure; no blocking | unit | `npx vitest run tests/hooks/useChat.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 1 | CHAT-06, CHAT-07, CHAT-09 | T-07-07, T-07-08 | XMarkdown uses internal DOMPurify; error states render actionable guidance | component | `npx vitest run tests/components/ChatPage.test.tsx tests/components/patterns/ChatMessage.test.tsx` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | AGNT-04 | T-07-09 | PermissionResolver callback pauses pipeline, awaits user decision; dangerous tools always prompt | unit | `npx vitest run tests/hooks/useAgent.test.ts --testNamePattern="pipeline\|permission"` | ❌ W0 | ⬜ pending |
| 07-04-02 | 04 | 2 | AGNT-01..AGNT-06 | T-07-10 | ThoughtChain nodes expandable on demand; tool results sanitized | unit | `npx vitest run tests/hooks/useAgent.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-03 | 04 | 2 | AGNT-06, AGNT-07 | T-07-11, T-07-12 | ToolCard renders sanitized input preview; no raw tool output in DOM | component | `npx vitest run tests/components/AgentPage.test.tsx` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 1 | NOTE-02, NOTE-05 | T-07-14 | Wikilink titles validated against /^[\w\s-]+$/ before rendering as links | unit | `npx vitest run tests/core/notes/LinkParser.test.ts` | ❌ W0 | ⬜ pending |
| 07-05-02 | 05 | 1 | NOTE-04 | T-07-16 | Force simulation alpha decay prevents infinite loops; canvas uses rAF; stopped on unmount | unit + component | `npx vitest run tests/core/notes/` | ❌ W0 | ⬜ pending |
| 07-05-03 | 05 | 1 | NOTE-01, NOTE-03, NOTE-06, NOTE-07 | T-07-13, T-07-17 | XMarkdown DOMPurify sanitization; auto-versioning stores to trusted storage | component | `npx vitest run tests/components/NotesPage.test.tsx tests/core/notes/LinkParser.test.ts` | ❌ W0 | ⬜ pending |
| 07-05-04 | 05 | 1 | NOTE-02, NOTE-06 | — | SaveToNoteDialog writes to NotesDB — trusted source | component | `npx tsc --noEmit && npx vitest run tests/components/NotesPage.test.tsx tests/core/notes/LinkParser.test.ts` | ❌ W0 | ⬜ pending |
| 07-06-01 | 06 | 1 | OPT-02, OPT-03, OPT-06 | — | N/A — standard AntD Form sections | component | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-06-02 | 06 | 1 | OPT-09, OPT-10, OPT-11 | — | N/A — simple settings/info sections | component | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-06-03 | 06 | 1 | OPT-01, OPT-04, OPT-05, OPT-08 | T-07-18, T-07-19, T-07-20 | Providers: keys masked via Input.Password + EncryptedStorage. Import: JSON validated before writing to stores. Prompts: template variables rendered as literals | component | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-06-04 | 06 | 1 | OPT-07, OPT-11, CHAT-05 | T-07-21, T-07-22 | Deep link params are UUIDs, not secrets. Export uses TraceRedactor for sanitization | component + integration | `npx vitest run tests/components/OptionsPage.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/hooks/` — hook test infrastructure (useStreamingLLM, useChat, useAgent, useWorkspace)
- [x] `tests/components/` — component test infrastructure (ChatPage, AgentPage, NotesPage, OptionsPage)
- [x] `tests/core/` — core module test infrastructure (LinkParser, PermissionStore, SlashCommandRegistry, TemplateEngine)
- [x] Test framework: Vitest + jsdom + @testing-library/react already configured in vitest.config.ts

All test files are created by their respective plan tasks. Framework already installed and configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming UI visual correctness | CHAT-01 | Requires real LLM backend | Verify Bubble messages appear progressively, ChunkBuffer batches at ~60fps, abort stops stream within 200ms |
| d3-force graph interaction | NOTE-04 | Canvas-based visual interaction | Verify nodes draggable, edges directional, zoom/pan works, click navigates to note |
| Permission dialog UX | AGNT-04 | Modal interaction flow | Verify Allow once/Allow always/Deny each produce correct behavior, dangerous tools always prompt |
| Export/Import round-trip | OPT-08 | File system interaction | Export settings, clear storage, import, verify all settings restored |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
