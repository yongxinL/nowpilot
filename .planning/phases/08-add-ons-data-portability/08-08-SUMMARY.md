---
phase: 08-add-ons-data-portability
plan: 08
subsystem: addons
tags: [research-skill, mcp, search, global-addon, tdd, sdk]

# Dependency graph
requires:
  - phase: 08-01
    provides: AddonRegistry with registerSkill API
provides:
  - ResearchSkill — global add-on with MCP search detection via regex matching on tool names/descriptions
  - Graceful degradation — returns config instructions when no search MCP available (D-13)
  - registerGlobalAddons — registers ResearchSkill with AddonRegistry as a global skill (D-14)
  - @modelcontextprotocol/sdk@1.29.0 at exact pinned version
affects:
  - 08-09 (wires /research slash command handler to ResearchSkill)

# Tech tracking
tech-stack:
  added:
    - @modelcontextprotocol/sdk@1.29.0 (exact pinned version)
  patterns:
    - Class + singleton with interface-based config injection (no hard MCP SDK dependency)
    - Regex-based tool capability detection via SEARCH_TOOL_PATTERNS array
    - Graceful degradation with user-facing configuration instructions (D-13)
    - Global add-on registration via AddonRegistry (D-14)

key-files:
  created:
    - src/addons/global/ResearchSkill.ts — MCP search detection + execution with graceful degradation
    - src/addons/global/registerGlobalAddons.ts — Registration of ResearchSkill with AddonRegistry
    - tests/addons/global/ResearchSkill.test.ts — 13 tests for MCP detection, graceful degradation, execution
  modified:
    - package.json — Added @modelcontextprotocol/sdk@1.29.0
    - pnpm-lock.yaml — Updated with SDK dependencies

key-decisions:
  - "ResearchSkill does NOT import MCP SDK directly — uses interface-based config injection via configure() to avoid hard runtime dependency"
  - "SEARCH_TOOL_PATTERNS is a flexible regex array matching /search/i, /brave/i, /tavily/i, /web_search/i, /google/i — future-proof against unknown tool names"
  - "isAvailable() catches all errors returning false for graceful degradation per D-13"
  - "@modelcontextprotocol/sdk pinned at exact version 1.29.0 (no ^) per RESEARCH.md package legitimacy audit"

patterns-established:
  - "Pattern: Global add-ons (not domain-tied) live in src/addons/global/ with separate skill class + registration function"

requirements-completed:
  - ADDON-09

coverage:
  - id: D1
    description: "@modelcontextprotocol/sdk installed at exact pinned version 1.29.0"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "pnpm ls @modelcontextprotocol/sdk shows 1.29.0"
        status: pass
    human_judgment: false

  - id: D2
    description: "ResearchSkill.isAvailable() detects search-capable MCP tools via regex on tool name/description"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/addons/global/ResearchSkill.test.ts#isAvailable with brave_search tool returns true"
        status: pass
    human_judgment: false

  - id: D3
    description: "ResearchSkill.isAvailable() returns false when no search tools match (graceful)"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/addons/global/ResearchSkill.test.ts#isAvailable returns false without search tools"
        status: pass
    human_judgment: false

  - id: D4
    description: "ResearchSkill.isAvailable() returns false when listTools() throws (graceful degradation per D-13)"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/addons/global/ResearchSkill.test.ts#isAvailable returns false on listTools error"
        status: pass
    human_judgment: false

  - id: D5
    description: "ResearchSkill.execute() returns unavailable message with config instructions when no search MCP (D-13)"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/addons/global/ResearchSkill.test.ts#execute returns unavailable when no client"
        status: pass
    human_judgment: false

  - id: D6
    description: "ResearchSkill.execute() calls MCP tool with query and returns results when search tool available"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/addons/global/ResearchSkill.test.ts#execute calls MCP tool and returns results"
        status: pass
    human_judgment: false

  - id: D7
    description: "registerGlobalAddons registers ResearchSkill with AddonRegistry as a global skill (D-14)"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "src/addons/global/registerGlobalAddons.ts calls addonRegistry.registerSkill"
        status: pass
    human_judgment: false

  - id: D8
    description: "SEARCH_TOOL_PATTERNS includes all 5 required patterns case-insensitively"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/addons/global/ResearchSkill.test.ts#SEARCH_TOOL_PATTERNS includes all patterns"
        status: pass
    human_judgment: false

# Metrics
duration: ~2 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 8: ResearchSkill — MCP Search Detection Global Add-on Summary

**ResearchSkill global add-on with MCP search tool detection via regex, graceful degradation per D-13, @modelcontextprotocol/sdk@1.29.0 installed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-19T12:40:00Z
- **Completed:** 2026-07-19T12:42:10Z
- **Tasks:** 2 (1 standard auto, 1 TDD RED→GREEN)
- **Files modified:** 5

## Accomplishments

- **@modelcontextprotocol/sdk@1.29.0** installed at exact pinned version (no ^) per package legitimacy audit
- **ResearchSkill** class+singleton with `configure()`/`isAvailable()`/`execute()` — MCP search detection via flexible regex matching on tool names and descriptions
- **Graceful degradation** per D-13: returns configuration instructions ("Configure a web search tool in Options → MCP Servers") when no search MCP is available
- **SEARCH_TOOL_PATTERNS** regex array matching `/search/i`, `/brave/i`, `/tavily/i`, `/web_search/i`, `/google/i` — future-proof against unknown tool names
- **Interface-based config injection** — no direct MCP SDK dependency; the MCP client instance is wired by the consumer (ChatPage/AgentPage) in Plan 09
- **registerGlobalAddons** registers ResearchSkill with AddonRegistry as a global skill per D-14
- **13 passing tests** covering isAvailable() detection, graceful degradation (no client, listTools throws, no matching tools), execute() success/error paths, and SEARCH_TOOL_PATTERNS content

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @modelcontextprotocol/sdk and verify** - `9065af9` (feat)
2. **Task 2 (TDD RED): ResearchSkill failing test** - `5782790` (test)
3. **Task 2 (TDD GREEN): ResearchSkill implementation + registration** - `09450e7` (feat)

**Plan metadata:** Pending after SUMMARY

## Files Created/Modified

### Created (3 files)
- `src/addons/global/ResearchSkill.ts` (100 lines) — ResearchSkill class with configure/isAvailable/execute, SEARCH_TOOL_PATTERNS, ResearchSkillConfig/ResearchResult types, singleton export
- `src/addons/global/registerGlobalAddons.ts` (25 lines) — Registers ResearchSkill with AddonRegistry as 'global' addonId, 'research' skill
- `tests/addons/global/ResearchSkill.test.ts` (118 lines) — 13 tests covering all 7 required behaviors

### Modified (2 files)
- `package.json` — Added @modelcontextprotocol/sdk@1.29.0
- `pnpm-lock.yaml` — Updated lockfile with SDK dependencies (78 packages added)

## Decisions Made

- **Interface-based config injection** over direct MCP SDK import: ResearchSkill avoids a hard dependency on the SDK by accepting an mcpClient config object via `configure()`. The consumer (Plan 09) wires the actual MCP client instance. This makes the skill testable without the SDK and allows graceful behavior when no MCP is configured.
- **Flexible regex over hardcoded tool names:** SEARCH_TOOL_PATTERNS matches on both tool.name and tool.description case-insensitively, covering Brave Search, Tavily, Google, and any future search MCP servers without code changes.
- **catch-all error handling in isAvailable():** Any error from listTools() returns false, enabling graceful degradation when MCP connection fails, server is unreachable, or SDK throws (per D-13).
- **@modelcontextprotocol/sdk pinned at exact version 1.29.0** (no `^` prefix) per RESEARCH.md package legitimacy audit, preventing supply-chain window attacks from floating upgrades.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `test(08-08)` commit exists: 5782790
- **GREEN Gate:** Present — `feat(08-08)` commit exists: 9065af9, 09450e7
- **REFACTOR:** Not needed — implementation clean and minimal
- **Status:** All gates PASS

## Issues Encountered

None — both tasks executed cleanly.

## User Setup Required

None - no external service configuration required. ResearchSkill works with any user-configured MCP search server.

## Next Phase Readiness

- ResearchSkill operational: isAvailable() detects search MCP tools via regex on tool name/description; execute() runs search or returns config instructions per D-13
- Global add-on skill registered via AddonRegistry per D-14
- Ready for Plan 09 — wire /research slash command handler to ResearchSkill

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
