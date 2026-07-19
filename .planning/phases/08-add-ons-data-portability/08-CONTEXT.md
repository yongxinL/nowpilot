# Phase 8: Add-ons & Data Portability - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The add-on system becomes fully operational — Write, TeamGQM, and ServiceNow add-ons register pages and skills through the AddonRegistry. Data export/import reaches production-readiness with atomic exports, deterministic merge, and credential exclusion verification. Content scripts remain extraction-only.

**Infrastructure already in place:**
- Page registries (SidepanelPageRegistry, StandalonePageRegistry) from Phase 1
- Navigation system supports `group: 'addons'` with icons, separator, and routing
- workspaceStore has `activeAddonContext`, `addonId`/`addonFields` placeholders
- ImportExportSection (OPT-08) fully built — UI, scope selection, ZIP, import flow
- AddonSettingsSection stub in Options (renders "No add-ons installed" empty state)
- ADDON-10 (core-addon boundary) enforced by `tests/core/no-addon-imports.test.ts`
- `/write` and `/research` slash commands pre-registered in SlashCommandRegistry
- TraceRadactor handles JSESSIONID, sysparmCK, g_ck redaction
- WriteJournal handles all IndexedDB persistence with atomicity guarantees
- Content extraction pipeline (CONT-01..05) with ISOLATED world, no UI injection

**Requirements:** ADDON-01 through ADDON-09, DATA-01, DATA-02
</domain>

<decisions>
## Implementation Decisions

### AddonRegistry Contract (ADDON-01)
- **D-01 — Skills + Pages + Settings in AddonRegistry:** AddonRegistry manages three typed registrations: skills (MCP-style tools), UI pages (via existing SidepanelPageRegistry/StandalonePageRegistry), and settings schemas (rendered in Options → Add-ons). Prompts stay in PromptManager; keymaps stay in KeymapRegistry. The registry follows the existing class+singleton pattern (ToolRegistry, SlashCommandRegistry).
- **D-02 — Registered by default, execution disabled until user enables:** All add-ons are registered (visible in navigation and settings) on install. Individual add-ons are disabled for execution by default — pages don't appear in navigation and skills don't execute until the user enables the add-on in Options → Add-ons. Registration != execution permission. Separate enable/disable state persisted per add-on under `np_addon_enabled` namespace.
- **D-03 — Three-phase activation lifecycle:** (1) Registration — add-on code loads, types registered, visible in settings. (2) Enablement — user toggles add-on ON; pages appear in nav, skills activate, settings participate. (3) Permission — data access (extraction, cookies, MAIN-world) requires explicit per-add-on user consent. Enforced by the registry, not by individual add-ons.

### ServiceNow Session Extraction (ADDON-02)
- **D-04 — Hybrid acquisition: chrome.cookies for JSESSIONID, MAIN-world bridge for g_ck:** JSESSIONID is a standard cookie — acquired via `chrome.cookies` API (no content script needed). sysparmCK (exposed as `window.g_ck`) requires a minimal MAIN-world content script bridge (CONT-05 already allows MAIN world for domain globals). No user-provided credentials, no DevTools copy-paste.
- **D-05 — CookieSessionStore + ServiceNowSessionAdapter:** CookieSessionStore wraps `chrome.cookies` API with MV3-compatible access patterns. ServiceNowSessionAdapter composes JSESSIONID (from cookies) + sysparmCK (from MAIN-world bridge) into a unified session object consumed by the ServiceNow Table API client. All API calls route through PROXY_FETCH — no bare fetch().
- **D-06 — Session freshness handled by adapter:** ServiceNowSessionAdapter checks cookie expiry and MAIN-world token freshness on each access. Stale sessions trigger re-extraction. No polling — extraction is on-demand when a ServiceNow skill or page requests session data.

### Write Add-on Skills (ADDON-06, ADDON-07)
- **D-07 — Skills as prompt templates, not Agent tools:** Write skills (Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan) are structured PromptManager templates with pre-built system prompts. Each skill is a prompt-transformation workflow — the AI model does the work, the skill provides the structured prompt. No ToolRegistry registration needed. Keeps architecture lightweight.
- **D-08 — `/write` slash command routes to Write sidebar:** The existing `/write` slash command opens the Write add-on Side Panel page. Each skill is accessed as a quick-action button in the Write page, or invoked via skill-specific slash commands (e.g., `/rewrite`, `/summarize`). Selecting a skill populates the Sender with the corresponding prompt template.
- **D-09 — Full App not required for Write:** Write add-on primarily targets the Side Panel with quick actions. A Full App page is optional and deferred — the Side Panel compact layout with action buttons is the primary Write surface.

### TeamGQM Add-on (ADDON-08)
- **D-10 — Side Panel = read-only dashboard, Full App = editing workspace:** Side Panel shows a condensed GQM hierarchy (Goals → Questions → Metrics) with expand/collapse for quick consumption while working. Full App provides the full editing workspace for creating, organizing, and analysing GQM structures. Single data model, two rendering modes with distinct purposes.
- **D-11 — GQM data in IndexedDB via WriteJournal:** TeamGQM stores goals, questions, and metrics in a dedicated object store (or namespaced within NotesDB). All writes go through WriteJournal for atomicity. No chrome.storage.local for GQM data — it's structured and benefits from IndexedDB querying.

### ResearchSkill (ADDON-09)
- **D-12 — MCP-connected only, no built-in search:** ResearchSkill requires a configured MCP web-search server (Brave Search, Tavily, enterprise search, etc.). Does not ship with any built-in search provider. Preserves privacy-first architecture — search capabilities are fully user-controlled and user-configured.
- **D-13 — Graceful degradation when no search MCP:** When `/research` is invoked and no search-capable MCP server is connected, show a helpful prompt: "Configure a web search tool in Options → MCP Servers to enable research." The `/research` slash command remains registered and visible — discovery is preserved even when search isn't available.
- **D-14 — ResearchSkill as a global add-on:** ResearchSkill is a global add-on (not tied to any domain). Registered via AddonRegistry as a skill. Available from both Chat and Agent modes via the `/research` command.

### Data Portability (DATA-01, DATA-02)
- **D-15 — Extend existing ImportExportSection, don't rebuild:** ImportExportSection (OPT-08) already provides the UI, scope selection, ZIP generation, and import file upload/validation. DATA-01/02 adds production-readiness: atomic exports, deterministic merge, and credential exclusion verification.
- **D-16 — Atomic exports via WriteJournal:** Export operations wrap all IndexedDB reads in a WriteJournal transaction. Ensures a consistent snapshot across all stores (chat history, notes, memory, settings, telemetry). Export manifest includes operation IDs for auditability.
- **D-17 — Deterministic timestamp-based merge (latest-wins):** Import merge uses `updatedAt` timestamp comparison. Newer records overwrite older ones. Conflict-free by design — each record has a single source of truth (the latest update time). No interactive conflict resolution UI needed.
- **D-18 — Credential exclusion verified by test:** Export must never include API keys, encrypted payloads, session tokens, or any `EncryptedStorage`-backed data. A dedicated test verifies that raw API keys (`np_providers` encrypted blobs), JSESSIONID, sysparmCK, and g_ck are absent from export output. TraceRedactor patterns applied as a safety net before writing export file.

### the agent's Discretion
- AddonRegistry internal API — exact method signatures, TypeScript generics for typed skill/page/settings registration
- CookieSessionStore internal API — chrome.cookies query patterns, MV3 compatibility handling
- ServiceNowSessionAdapter internal session object shape and refresh logic
- Write add-on prompt template content — exact system prompts for each of the 6 skills
- TeamGQM data model — Goal/Question/Metric type definitions, IndexedDB store schema
- ResearchSkill MCP tool detection — how it discovers search-capable MCP servers from connected configs
- Export atomicity implementation — WriteJournal operation types, manifest schema
- Import merge implementation — per-store merge strategies, error recovery
- AddonSettingsSection wiring — how Options renders per-addon settings schemas from the registry
- ServiceNow Table API client — exact request shape, pagination, error handling
- Add-on nav registration — where in startup sequence addon pages register (main.tsx pattern)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 8 definition, requirements (ADDON-01..09, DATA-01..02), success criteria, dependency on Phase 7/7.1/7.2
- `.planning/REQUIREMENTS.md` — ADDON-01..10 (lines 155-167), DATA-01..03 (lines 182-186), traceability table
- `.planning/PROJECT.md` — Ant Design v6 + Ant Design X 2.x, two-surface architecture, core-vs-addon layering, constraints

### Product Specification
- `references/PRODUCT_SPEC_v0_1.md` §Phase 8 (lines 2249-2287) — Full Phase 8 spec with UI surface descriptions
- `references/PRODUCT_SPEC_v0_1.md` §Addon Contract (lines 1295-1321) — AddonRegistry interface contract, skill/prompt/page/settings types
- `references/PRODUCT_SPEC_v0_1.md` §ServiceNow (lines 1370-1395) — CookieSessionStore, ServiceNowSessionAdapter, Table API client
- `references/PRODUCT_SPEC_v0_1.md` §Research (lines 1397-1408) — ResearchSkill, MCP search integration
- `references/PRODUCT_SPEC_v0_1.md` §Data Export/Import (lines relevant) — Export scope, atomicity, merge strategy

### Prior Phase Context
- `.planning/phases/07.5-rich-design-polish/07.5-CONTEXT.md` — Latest RICH decisions, code context for integration points
- `.planning/phases/07.2-page-extraction-pin-tab/07.2-CONTEXT.md` — Content extraction pipeline, PageContext, ISOLATED/MAIN worlds
- `.planning/phases/07.1-llm-wiki-filesystem-sync/07.1-CONTEXT.md` — PromptManager (22 builtin templates), TemplateEngine
- `.planning/phases/07-full-chat-agent-notes-options-pages/07-CONTEXT.md` — Full UI architecture, Options sections, ChatPage

### Key Source Files (integration points)
- `src/core/registries/SidepanelPageRegistry.ts` — Side Panel page registration API
- `src/core/registries/StandalonePageRegistry.ts` — Full App page registration API
- `src/core/registries/registerCorePages.ts` — Blueprint pattern for page registration
- `src/core/registries/registerNowPilotCorePages.ts` — Chat + Notes registration; commented-out Write stub
- `src/core/navigation/navigationTypes.ts` — `NavGroup = 'core' | 'addons' | 'footer' | 'utility'`
- `src/core/navigation/navConfig.ts` — Navigation item config, `groupOverrides`, addon rendering rules
- `src/core/navigation/navigationSelectors.ts` — `selectNavItems({ surface, group: 'addons' })` already works
- `src/components/sider/SiderMenu.tsx` — Renders core items + separator + addon items
- `src/components/options/AddonSettingsSection.tsx` — Stub with "No add-ons installed" empty state (wire to registry)
- `src/components/options/ImportExportSection.tsx` — Full export/import UI (extend for atomicity + merge)
- `src/core/stores/workspaceStore.ts` — `activeAddonContext`, `setActiveAddonContext()`
- `src/core/content/PageContext.ts` — `addonId`, `addonFields` Phase 8 placeholders (lines 34-37)
- `src/core/messaging/pageMessages.ts` — `addonId` and `addonFields` in page context schemas
- `src/core/telemetry/TraceRedactor.ts` — JSESSIONID, sysparmCK, g_ck redaction patterns
- `src/core/storage/WriteJournal.ts` — Atomic multi-store operation coordinator
- `src/core/storage/WriteJournalEntry.ts` — `export-data` operation type already exists
- `src/core/slash/SlashCommandRegistry.ts` — `/write` and `/research` pre-registered
- `src/core/ai/tools/ToolRegistry.ts` — Registry pattern to follow for AddonRegistry
- `src/core/onboarding/OnboardingModal.tsx` — ServiceNow host permissions UI (Step 6, line 1042)
- `src/core/ai/quickActions/QuickActionService.ts` — ServiceNow hostname → quick action mapping
- `tests/core/no-addon-imports.test.ts` — Core-addon boundary enforcement (ADDON-10)
- `src/components/sider/icons.tsx` — `WriteIcon` already built, mapped as `write: WriteIcon`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Page registries** (`src/core/registries/SidepanelPageRegistry.ts`, `StandalonePageRegistry.ts`): Class+singleton pattern with `register(id, label, icon?, component, order?)`. Add-on pages register here — no new page routing infrastructure needed.
- **registerCorePages()** (`src/core/registries/registerCorePages.ts`): Blueprint function that registers to both registries from one call. Addons can follow `registerAddonPages()` with the same pattern.
- **Navigation system** (`src/core/navigation/`): Already supports `group: 'addons'` with icon-only items in Side Panel and full labels in Full App. SiderMenu renders core items + separator + addon items automatically. Just add nav item IDs.
- **WorkspaceStore** (`src/core/stores/workspaceStore.ts`): `activeAddonContext` field with setter — call from addon pages to notify context-aware systems (QuickActionService, GreetingService).
- **ImportExportSection** (`src/components/options/ImportExportSection.tsx`): Full UI with scope selection (chat/notes/memory/settings/all), ZIP download, file upload, JSON import preview. Extend with WriteJournal atomicity and merge strategy — don't replace.
- **WriteJournal** (`src/core/storage/WriteJournal.ts`): Existing `export-data` operation type. All IndexedDB writes already journaled. Export operations get atomic snapshots by participating in the journal lifecycle.
- **ToolRegistry** (`src/core/ai/tools/ToolRegistry.ts`): Map-based registry with `register()/unregister()/get()/has()/list()`. Class+singleton export. Primary pattern to follow for AddonRegistry.
- **SlashCommandRegistry** (`src/core/slash/SlashCommandRegistry.ts`): `/write` and `/research` pre-registered. Write skills and ResearchSkill handle execution when the command is dispatched.
- **PromptManager** (`src/core/prompts/PromptManager.ts`): 22 builtin templates with CRUD. Write add-on's 6 skills register as new prompt templates. TemplateBrowser already handles displayCategory grouping.
- **TraceRedactor** (`src/core/telemetry/TraceRedactor.ts`): Already redacts JSESSIONID, sysparmCK, g_ck, Bearer tokens, API keys. Applied as safety net before any export. DATA-01/02 reuse — no new redaction patterns needed.
- **BroadcastBus** (`src/core/messaging/broadcastBus.ts`): Cross-surface event bus. Add-ons can emit/receive events for cross-surface coordination. `emitMemoryWrite()` / `onMemoryWrite()` pattern established.
- **Content script pipeline** (`src/entrypoints/content.ts`, `src/core/content/`): ISOLATED world extraction with MAIN world allowance for domain globals (CONT-05). ServiceNow g_ck extraction uses MAIN world bridge following this pattern.

### Established Patterns
- **Class + singleton export:** Every core service follows this (ToolRegistry, SlashCommandRegistry, PermissionStore, PromptManager). AddonRegistry follows this pattern.
- **chrome.storage.local for add-on state:** `np_addon_enabled` and `np_addon_settings` keys. Follow workspaceStore's `np_` prefix convention.
- **WriteJournal for IndexedDB writes:** All IndexedDB mutations route through WriteJournal with idempotency keys. Add-on data stores follow the same pattern.
- **PROXY_FETCH for external API calls:** No bare `fetch()`. ServiceNow Table API calls use PROXY_FETCH. Established by the background SW message handler pattern.
- **Registration at startup in main.tsx:** Core pages register at module import time in `main.tsx`. Add-ons follow the same pattern — import + register at startup.
- **Component + service split:** WelcomeCards + WelcomeCardService, QuickActionChips + QuickActionService. Write add-on follows: WritePage + WriteService.

### Integration Points
- **`src/entrypoints/sidepanel/main.tsx`** — Import and call addon registration functions before React mount
- **`src/entrypoints/standalone/main.tsx`** — Same for Full App surface
- **`src/core/registries/`** — Add AddonRegistry.ts alongside existing registries
- **`src/core/navigation/navConfig.ts`** — Add addon page IDs with group: 'addons' for SiderMenu rendering
- **`src/components/options/AddonSettingsSection.tsx`** — Replace stub with registry-driven settings rendering
- **`src/components/options/OptionsRoot.tsx`** — Add-ons section already listed (id: `addons`, title: `Add-ons`)
- **`src/core/pages/OptionsPage.tsx`** — `case 'addons'` already dispatches to `<AddonSettingsSection />`
- **`src/core/slash/SlashCommandRegistry.ts`** — Wire `/write` dispatch to Write add-on, `/research` to ResearchSkill
- **`src/core/prompts/PromptManager.ts`** — Register Write skill prompt templates with displayCategory: 'Writing'
- **`src/addons/`** — Directory exists with `.gitkeep`. Add `servicenow/`, `write/`, `teamgqm/`, `global/` subdirectories
- **`src/core/content/PageContext.ts`** — Populate `addonId` and `addonFields` from add-on context extractors
- **Content script MAIN world** — `src/entrypoints/content.ts` already supports MAIN world via CONT-05. ServiceNow g_ck extraction adds a MAIN world injection.
</code_context>

<specifics>
## Specific Ideas

- AddonRegistry follows the exact same Map-based pattern as ToolRegistry — private `#registrations` Map, typed `register<T>()`, `unregister()`, `get()`, `list()`, `isEnabled()`.
- ServiceNow add-on uses the existing OnboardingModal Step 6 host permissions UI — those switches should persist and gate session extraction.
- Write add-on Side Panel page renders as a vertical stack of 6 action buttons, each populating the Sender with the corresponding prompt template.
- TeamGQM Full App page uses a tree view (AntD Tree) for the Goal → Question → Metric hierarchy, with inline editing.
- ResearchSkill checks MCP server capabilities list for search-related tool names. Falls back to the "configure a search tool" message.
- Export atomicity: begin a WriteJournal `export-data` operation, read all stores within the operation, write export file. If any read fails, mark operation as failed.
- Import merge: read existing IndexedDB records, compare `updatedAt` timestamps with incoming records, write latest-wins. New records (no `updatedAt` match) are inserted.
- Credential exclusion test: export full data, parse the ZIP, assert no `np_providers` key values, no `JSESSIONID=` strings, no `sysparm_ck=` strings, no `g_ck` values in the output.
</specifics>

<deferred>
## Deferred Ideas

| Feature | Reason |
|---------|--------|
| Write add-on Full App page | Side Panel is the primary Write surface; Full App page is optional and deferred |
| ServiceNow page injection (CaseInsightBox, floating widgets) | v0.2+ per Requirements; content scripts remain extraction-only |
| TeamGQM AI-powered metric suggestions | Out of scope — TeamGQM Phase 8 is the data model + CRUD UI, not AI features |
| ResearchSkill built-in search provider | Violates privacy-first; MCP-connected only preserves user control |
| Add-on marketplace / remote add-on loading | v0.2+; v0.1 add-ons are bundled with the extension |
| Add-on interop (Write calling ServiceNow data) | Add-ons are isolated in v0.1; cross-addon communication deferred |
| ServiceNow real-time notifications / polling | Deferred — session extraction is on-demand only |
| TeamGQM chart/visualization of metrics | Data model and tree editing first; visualization is a separate capability |
| Export scheduling / auto-export | Manual export only for v0.1 |

None of the above are in Phase 8 scope.
</deferred>

---

*Phase: 08-add-ons-data-portability*
*Context gathered: 2026-07-19*
