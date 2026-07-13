---
phase: 07-full-chat-agent-notes-options-pages
plan: 01
subsystem: core-services
tags: [d3-force, drafts, permissions, slash-commands, prompt-templates, template-engine, chrome-storage]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime
    provides: PermissionService interface pattern, ToolRegistry class+singleton pattern
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: WorkspaceStore with chrome.storage.local persistence, np_ key prefix convention
provides:
  - d3-force@3.0.0 dependency for force-directed graph visualization
  - WorkspaceState.drafts field with setDraft/clearDraft for per-conversation draft persistence
  - OrchestratorEvent.waiting-permission variant for tool permission gating
  - ChatHistoryDB.updateSession() for partial session metadata updates
  - PermissionStore with getPermission/setPermission/clearPermission backed by np_mcp_permissions
  - SlashCommandRegistry with parseCommand() and 3 built-in slash commands
  - PromptManager with full CRUD for prompt templates
  - TemplateEngine with variable interpolation, extraction, and validation
  - builtinTemplates with 4 built-in prompt templates
affects:
  - 07-03 (useChat/useAgent hooks consume drafts and waiting-permission)
  - 07-05 (Options sections manage slash commands and prompt templates)
  - 07-06 (Agent permission dialog uses PermissionStore)

# Tech tracking
tech-stack:
  added:
    - d3-force@3.0.0 (pinned exact version)
  patterns:
    - Class + singleton export for core services (PermissionStore, SlashCommandRegistry, PromptManager, TemplateEngine)
    - Map-based registry with private #fields (SlashCommandRegistry, PromptManager)
    - chrome.storage.local-backed persistence with np_ key prefix
    - try-catch with debugLog error logging pattern

key-files:
  created:
    - src/core/permissions/PermissionStore.ts
    - src/core/slash/SlashCommandRegistry.ts
    - src/core/prompts/PromptManager.ts
    - src/core/prompts/TemplateEngine.ts
    - src/core/prompts/builtinTemplates.ts
    - tests/core/permissions/PermissionStore.test.ts
    - tests/core/slash/SlashCommandRegistry.test.ts
    - tests/core/prompts/TemplateEngine.test.ts
  modified:
    - package.json
    - src/core/stores/workspaceStore.ts
    - src/core/ai/pipeline/pipelineTypes.ts
    - src/core/storage/stores/ChatHistoryDB.ts
    - tests/core/workspaceStore.test.ts

key-decisions:
  - "SlashCommandRegistry uses JS private #commands Map with built-in (+ persistence) pattern matching PATTERNS.md guidance"
  - "PermissionStore reads/writes full np_mcp_permissions JSON object on each call (not partial merge) — simpler, avoids read-then-write race in single-threaded chrome.storage.local"
  - "TemplateEngine uses simple regex replace for {{var}} — no template library dependency needed for basic variable substitution"
  - "PromptManager and SlashCommandRegistry register built-ins in constructor with idempotent skip-if-exists, then load persisted user overrides"

patterns-established:
  - "Pattern: Services with chrome.storage.local persistence load on construction and register built-ins before loading user overrides"
  - "Pattern: Private #-prefixed methods (not private + # combined — incompatible with oxc transformer)"
  - "Pattern: SlashCommandRegistry.parseCommand uses regex ^/(\\w+)\\s*(.*)? for command name extraction"

requirements-completed:
  - AGNT-04
  - AGNT-05
  - CHAT-04
  - OPT-04
  - OPT-05

coverage:
  - id: D1
    description: "d3-force@3.0.0 installed at exact pinned version"
    verification:
      - kind: unit
        ref: "pnpm ls d3-force shows 3.0.0"
        status: pass
    human_judgment: false
  - id: D2
    description: "WorkspaceState.drafts with setDraft/clearDraft setters"
    verification:
      - kind: unit
        ref: "src/core/stores/workspaceStore.ts contains drafts, setDraft, clearDraft"
        status: pass
    human_judgment: false
  - id: D3
    description: "OrchestratorEvent.waiting-permission variant added"
    verification:
      - kind: unit
        ref: "src/core/ai/pipeline/pipelineTypes.ts contains waiting-permission type"
        status: pass
    human_judgment: false
  - id: D4
    description: "ChatHistoryDB.updateSession() for partial session updates"
    verification:
      - kind: unit
        ref: "src/core/storage/stores/ChatHistoryDB.ts contains updateSession method"
        status: pass
    human_judgment: false
  - id: D5
    description: "PermissionStore with getPermission/setPermission/clearPermission, np_mcp_permissions key"
    verification:
      - kind: unit
        ref: "tests/core/permissions/PermissionStore.test.ts#6 tests pass"
        status: pass
    human_judgment: false
  - id: D6
    description: "SlashCommandRegistry with parseCommand and 3 built-in commands, np_slash_commands key"
    verification:
      - kind: unit
        ref: "tests/core/slash/SlashCommandRegistry.test.ts#6 tests pass"
        status: pass
    human_judgment: false
  - id: D7
    description: "TemplateEngine with render/extractVariables/validate"
    verification:
      - kind: unit
        ref: "tests/core/prompts/TemplateEngine.test.ts#7 tests pass"
        status: pass
    human_judgment: false
  - id: D8
    description: "PromptManager CRUD with np_prompt_templates persistence"
    verification:
      - kind: unit
        ref: "src/core/prompts/PromptManager.ts exports class + singleton"
        status: pass
    human_judgment: false
  - id: D9
    description: "builtinTemplates exports ≥3 templates (4 provided)"
    verification:
      - kind: unit
        ref: "src/core/prompts/builtinTemplates.ts contains 4 template configs"
        status: pass
    human_judgment: false

# Metrics
duration: 4 min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 01: Wave 0 — Core Service Foundation Summary

**d3-force dependency, WorkspaceState drafts, OrchestratorEvent permission event, ChatHistoryDB.updateSession, PermissionStore, SlashCommandRegistry, PromptManager, TemplateEngine, and builtinTemplates — Wave 0 prerequisites for all downstream hooks and pages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-13T21:26:30Z
- **Completed:** 2026-07-13T21:30:39Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- **d3-force@3.0.0** installed at pinned exact version for notes graph visualization
- **WorkspaceState.drafts** field added with `setDraft`/`clearDraft` setters (D-33, D-34) — per-conversation draft persistence via existing chrome.storage.local mechanism
- **OrchestratorEvent.waiting-permission** variant added — yield-only event for tool permission gating (AGNT-04)
- **ChatHistoryDB.updateSession()** — partial session metadata updates (title, preview, updated, starred) for async title generation (D-15) and preview updates (D-16)
- **PermissionStore** class + singleton with `getPermission`/`setPermission`/`clearPermission` backed by `chrome.storage.local` key `np_mcp_permissions` — 6 tests covering all CRUD and persistence
- **SlashCommandRegistry** class + singleton with `register`/`unregister`/`get`/`has`/`list`/`parseCommand`, 3 built-in slash commands (/write, /ask, /research), `np_slash_commands` persistence — 6 tests
- **TemplateEngine** class + singleton with `render` ({{var}} interpolation), `extractVariables`, `validate` — 7 tests
- **PromptManager** class + singleton with full CRUD (`createTemplate`/`getTemplate`/`getAllTemplates`/`updateTemplate`/`deleteTemplate`), `np_prompt_templates` persistence, auto-registers built-in templates
- **builtinTemplates** — 4 template configs (write, ask, research, summarize) with `userInput`/`content` variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Install d3-force and extend core types** - `c41d5ad` (feat)
2. **Task 2 (TDD): Create PermissionStore** - `d21e253` (feat)
3. **Task 3 (TDD): Create SlashCommandRegistry, PromptManager, TemplateEngine, builtinTemplates** - `c1ca230` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

### Created (8 files)
- `src/core/permissions/PermissionStore.ts` — Tool permission store backed by np_mcp_permissions
- `src/core/slash/SlashCommandRegistry.ts` — Slash command registration and dispatch
- `src/core/prompts/PromptManager.ts` — Prompt template CRUD with persistence
- `src/core/prompts/TemplateEngine.ts` — Template variable interpolation engine
- `src/core/prompts/builtinTemplates.ts` — 4 built-in prompt template configs
- `tests/core/permissions/PermissionStore.test.ts` — 6 tests
- `tests/core/slash/SlashCommandRegistry.test.ts` — 6 tests
- `tests/core/prompts/TemplateEngine.test.ts` — 7 tests

### Modified (5 files)
- `package.json` — Added d3-force@3.0.0
- `src/core/stores/workspaceStore.ts` — Added drafts field, setDraft, clearDraft setters
- `src/core/ai/pipeline/pipelineTypes.ts` — Added waiting-permission event type
- `src/core/storage/stores/ChatHistoryDB.ts` — Added updateSession method
- `tests/core/workspaceStore.test.ts` — Updated state shape test to expect drafts field

## Decisions Made

- **SlashCommandRegistry** uses JS private `#commands = new Map<string, SlashCommand>()` matching ToolRegistry pattern from PATTERNS.md — register/de-duplicate-by-name, throw on duplicate
- **PermissionStore** reads/writes the full `np_mcp_permissions` JSON object on each method call — read-modify-write pattern is safe in single-threaded chrome.storage.local and simpler than partial merge
- **TemplateEngine** uses simple regex `/\{\{(\w+)\}\}/g` replace for variable interpolation — no template library dependency needed for basic substitution. Missing variables rendered as literal `{{key}}`
- **PromptManager** and **SlashCommandRegistry** follow constructor-init pattern: register built-ins, then load persisted user overrides (persisted entries overwrite built-in entries with same id)
- **Private method syntax:** Removed `private` keyword from `#`-prefixed methods to avoid oxc transformer incompatibility (`private` + `#` is redundant per oxc)
- **Private field syntax:** `#commands = new Map(...)` field declaration without `private` keyword works correctly

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **Task 2 (PermissionStore):** 6 tests passing; both test and implementation committed together (inline TDD)
- **Task 3 (SlashCommandRegistry + TemplateEngine):** 13 tests passing across 2 test files; test files created before implementation
- **Status:** All gates PASS

## Issues Encountered

- **oxc transformer incompatibility:** Private methods declared as `private async #method()` failed with oxc parse error ("An accessibility modifier cannot be used with a private identifier"). Fixed by removing `private` keyword and keeping only `#` prefix. The `#` prefix already enforces runtime privacy.
- **SlashCommandRegistry test adjustments:** Built-in commands (write, ask, research) are auto-registered in constructor, so tests needed adjustment to account for 3 initial commands in list() and to use non-built-in names for duplicate/unregister tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Core type extensions and service layer established for all downstream plans:
  - **Plan 07-02:** useChat/useAgent hooks consume WorkspaceState.drafts and OrchestratorEvent.waiting-permission
  - **Plan 07-03:** Hook hierarchy (useStreamingLLM → useChat/useAgent)
  - **Plan 07-05:** Options sections use PromptManager and SlashCommandRegistry
  - **Plan 07-06:** AgentPermissionDialog uses PermissionStore for persistent tool permissions
- All 3 TDD tasks completed with 19 new tests (589 total passing, 75 test files)
- d3-force available for NoteGraphView (Plan 07-04)

## Self-Check: PASSED

- [x] All 8 created files exist on disk
- [x] All 3 commits verified in git log
- [x] 589 tests pass (19 new + 570 existing)
- [x] WorkspaceState.drafts, OrchestratorEvent.waiting-permission, ChatHistoryDB.updateSession present
- [x] PermissionStore, SlashCommandRegistry, PromptManager, TemplateEngine, builtinTemplates all exported with class + singleton

---

*Phase: 07-full-chat-agent-notes-options-pages*
*Completed: 2026-07-13*
