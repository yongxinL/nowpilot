---
phase: 08-add-ons-data-portability
verified: 2026-07-19T22:59:00Z
status: passed
score: 14/14 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred: []
behavior_unverified_items: []
human_verification: []
---

# Phase 8: Add-ons & Data Portability Verification Report

**Phase Goal:** Build the add-on system with four add-ons (Write, ServiceNow, TeamGQM, Research) and harden data portability. Create a typed AddonRegistry with enable/disable gating to chrome.storage.local. Deliver 3 prompt-template skills per add-on for Write and ServiceNow, and a GQM tree for TeamGQM. Harden ImportExportSection with atomic export via WriteJournal and deterministic timestamp-based import. All external API calls route through FETCH_PROXY. No bare fetch().

**Verified:** 2026-07-19T22:59:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AddonRegistry class+singleton manages three typed registrations (skills, pages, settings schemas) with enable/disable gating to chrome.storage.local | ✓ VERIFIED | `src/core/registries/AddonRegistry.ts` (183 lines). `#skills`, `#pages`, `#settingsSchemas` Maps with composite keying. `#enabled` Map with `np_addon_enabled` persistence via chrome.storage.local. `getEnabledSkills()`/`getEnabledPages()` filter by enable state. Singleton exported as `addonRegistry`. |
| 2 | Six Write skills registered as PromptManager templates with displayCategory: 'Writing' | ✓ VERIFIED | `src/addons/write/skills/writeSkills.ts` (81 lines) exports 6 PromptTemplate configs: Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan. All with `category: 'Writing'`, `isBuiltin: false`, `scopes: ['writing']`. Tests verify array length, fields, and registration. |
| 3 | WritePage renders 6 quick-action buttons in Side Panel | ✓ VERIFIED | `src/addons/write/components/WritePage.tsx` (41 lines). Vertical Card layout with 6 block Buttons from writeSkillTemplates. Uses workspaceStore.setDraft('write', template) to populate Sender. Registered via sidepanelPageRegistry at order 10. |
| 4 | CookieSessionStore wraps chrome.cookies.get() for JSESSIONID | ✓ VERIFIED | `src/addons/servicenow/services/CookieSessionStore.ts` (35 lines). `getSession(instanceUrl)` calls `chrome.cookies.get({url, name: 'JSESSIONID'})`. Error handling returns null. Singleton exported. |
| 5 | ServiceNowSessionAdapter composes JSESSIONID + sysparmCK with freshness checking | ✓ VERIFIED | `src/addons/servicenow/services/ServiceNowSessionAdapter.ts` (86 lines). `acquireSession()` composes JSESSIONID (CookieSessionStore) + sysparmCK (MAIN-world bridge). `#isSessionFresh()` checks cookie.expiresAt or acquiredAt+30min TTL. Caching via `#cache` Map. |
| 6 | ServiceNowTableClient routes all API calls through FETCH_PROXY — no bare fetch() | ✓ VERIFIED | `src/addons/servicenow/services/ServiceNowTableClient.ts` (72 lines). All calls via `chrome.runtime.sendMessage({ type: 'FETCH_PROXY', url, options })`. Sends JSESSIONID as Cookie header, sysparmCK as X-UserToken. No `fetch()` calls found in `src/addons/`. |
| 7 | Three ServiceNow skills registered as PromptManager templates: CaseAnalyzer, CatchUp, Sentiment | ✓ VERIFIED | `src/addons/servicenow/skills/serviceNowSkills.ts` (51 lines). 3 PromptTemplate configs with category 'ServiceNow', idempotent registration. Tests verify template shape and registration. |
| 8 | ServiceNowSidepanelPage shows case-context + skill launcher; ServiceNowStandalonePage shows case Table + Drawer | ✓ VERIFIED | `ServiceNowSidepanelPage.tsx` (158 lines): session-aware UI with loading/empty/error states, case context Card, 3 skill launcher buttons. `ServiceNowStandalonePage.tsx` (272 lines): Ant Design Table with columns (number, description, priority, state, assigned, updated), row-click Drawer with Comments/Work Notes tabs. |
| 9 | GQM data model defines Goal, Question, Metric with discriminated type discriminator | ✓ VERIFIED | `src/addons/teamgqm/data/gqmTypes.ts` (47 lines). Goal/Question/Metric interfaces with `type: 'goal'|'question'|'metric'` discriminator. GQMNode union type. Pure type-only exports. |
| 10 | GQMDataService wraps all IndexedDB writes through WriteJournal with operation 'save-gqm-data' | ✓ VERIFIED | `src/addons/teamgqm/services/GQMDataService.ts` (227 lines). Full CRUD (createGoal, createQuestion, createMetric, getChildren, updateNode, deleteNode, getTree). All writes via `writeJournal.begin('save-gqm-data', ...)` with markStepComplete/markStepFailed patterns. WriteJournalEntry extended with 'save-gqm-data' operation. |
| 11 | TeamGQMSidepanelPage renders read-only GQM tree; TeamGQMStandalonePage renders editable tree | ✓ VERIFIED | `TeamGQMSidepanelPage.tsx` (81 lines): Ant Design Tree with showLine, blockNode, defaultExpandAll, selectable=false. Loading/empty/data states. `TeamGQMStandalonePage.tsx` (247 lines): Editable tree with double-click inline editing, context menu for Add Question/Add Metric, Add Goal button. Registered at order 12. |
| 12 | ResearchSkill detects search-capable MCP servers via regex; graceful degradation when unavailable | ✓ VERIFIED | `src/addons/global/ResearchSkill.ts` (102 lines). SEARCH_TOOL_PATTERNS regex array. `isAvailable()` returns false gracefully on errors. `execute()` returns config instructions when unavailable. Interface-based config injection — no hard MCP SDK dependency. 13 tests passing. |
| 13 | Export wraps IndexedDB reads in WriteJournal export-data with TraceRedactor safety net; Import uses deterministic timestamp-based merge | ✓ VERIFIED | `src/components/options/ImportExportSection.tsx` modified +98/-18. Export: `writeJournal.begin('export-data', ...)` wrapping storage reads, `traceRedactor.redactValue(data)` safety net, operationId in manifest. Import: `mergeRecords()` utility (`src/core/data/mergeRecords.ts`, 67 lines) with latest-wins semantics, merge summary alert. 13 data portability tests pass. |
| 14 | All add-on registration functions called from main.tsx startup; add-on nav items appear in SiderMenu; AddonSettingsSection shows enable/disable toggles | ✓ VERIFIED | Both `sidepanel/main.tsx` and `standalone/main.tsx` import and call registerWriteAddon, registerServiceNowAddon, registerTeamGQMAddon, registerGlobalAddons before React mount. `navConfig.ts` extends buildNavConfig with addon page items from SidepanelPageRegistry (group: 'addons'). `AddonSettingsSection.tsx` renders per-addon enable/disable Switches via addonRegistry. `SlashCommandRegistry.ts` has /write and /research handlers wired. |

**Score:** 14/14 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/registries/AddonRegistry.ts` | Typed add-on registration, enable/disable, chrome.storage.local persistence | ✓ VERIFIED | 183 lines, exports AddonRegistry, addonRegistry, AddonSkill, AddonPage, AddonSettingsSchema |
| `src/addons/write/skills/writeSkills.ts` | 6 PromptTemplate configs + registerWriteTemplates | ✓ VERIFIED | 81 lines, 6 templates with category 'Writing' |
| `src/addons/write/components/WritePage.tsx` | Side Panel page with 6 action buttons | ✓ VERIFIED | 41 lines, vertical Card layout, setDraft integration |
| `src/addons/write/registerWriteAddon.ts` | Registration function for Write add-on | ✓ VERIFIED | 20 lines, registers page + templates |
| `src/addons/servicenow/services/CookieSessionStore.ts` | chrome.cookies.get wrapper for JSESSIONID | ✓ VERIFIED | 35 lines, class+singleton |
| `src/addons/servicenow/services/ServiceNowSessionAdapter.ts` | Session composition + freshness check | ✓ VERIFIED | 86 lines, cache, TTL, MAIN-world bridge |
| `src/addons/servicenow/services/ServiceNowTableClient.ts` | Table API via FETCH_PROXY | ✓ VERIFIED | 72 lines, no bare fetch() |
| `src/addons/servicenow/skills/serviceNowSkills.ts` | 3 PromptTemplate configs | ✓ VERIFIED | 51 lines, CaseAnalyzer, CatchUp, Sentiment |
| `src/addons/servicenow/components/ServiceNowSidepanelPage.tsx` | Side Panel case-context + skill launcher | ✓ VERIFIED | 158 lines, session-aware (loading/empty/error/data states) |
| `src/addons/servicenow/components/ServiceNowStandalonePage.tsx` | Full App case table + detail Drawer | ✓ VERIFIED | 272 lines, Table + Drawer + Comments/Work Notes tabs |
| `src/addons/servicenow/registerServiceNowAddon.ts` | Registration function for ServiceNow | ✓ VERIFIED | 38 lines, both surfaces + settings schema |
| `src/addons/teamgqm/data/gqmTypes.ts` | Goal, Question, Metric discriminated types | ✓ VERIFIED | 47 lines, type-only exports |
| `src/addons/teamgqm/services/GQMDataService.ts` | WriteJournal-backed GQM CRUD | ✓ VERIFIED | 227 lines, 7 methods all through WriteJournal |
| `src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx` | Read-only GQM tree | ✓ VERIFIED | 81 lines, Ant Design Tree, loading/empty/data states |
| `src/addons/teamgqm/components/TeamGQMStandalonePage.tsx` | Editable GQM tree with inline editing | ✓ VERIFIED | 247 lines, double-click edit, context menus, Add Goal |
| `src/addons/teamgqm/registerTeamGQMAddon.ts` | Registration function for TeamGQM | ✓ VERIFIED | 29 lines, both surfaces + settings schema |
| `src/addons/global/ResearchSkill.ts` | MCP search detection + graceful degradation | ✓ VERIFIED | 102 lines, SEARCH_TOOL_PATTERNS, isAvailable/execute |
| `src/addons/global/registerGlobalAddons.ts` | Registration of ResearchSkill with AddonRegistry | ✓ VERIFIED | 25 lines, global add-on skill |
| `src/core/data/mergeRecords.ts` | Deterministic timestamp-based merge utility | ✓ VERIFIED | 67 lines, MergeableRecord/MergeSummary types |
| `src/components/options/ImportExportSection.tsx` | Enhanced export/import with WriteJournal + TraceRedactor + mergeRecords | ✓ VERIFIED | Modified +98/-18, atomic export, sanitization, deterministic merge |
| `src/core/storage/WriteJournalEntry.ts` | Extended with 'import-data' and 'save-gqm-data' | ✓ VERIFIED | Union type and zod schema extended |
| `src/entrypoints/sidepanel/main.tsx` | Add-on registration imports | ✓ VERIFIED | 4 import + call pairs before React mount |
| `src/entrypoints/standalone/main.tsx` | Add-on registration imports | ✓ VERIFIED | Same 4 import + call pairs |
| `src/core/navigation/navConfig.ts` | Add-on nav items from page registries | ✓ VERIFIED | CORE_PAGE_IDS filter, group:'addons' entries |
| `src/components/options/AddonSettingsSection.tsx` | Registry-driven enable/disable toggles | ✓ VERIFIED | Reads schemas from addonRegistry, Switches call enable/disable |
| `src/core/slash/SlashCommandRegistry.ts` | /write and /research handlers wired | ✓ VERIFIED | /write navigates to Side Panel, /research uses dynamic import of ResearchSkill |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| AddonRegistry | chrome.storage.local | `np_addon_enabled` key | ✓ VERIFIED | `ENABLED_KEY = 'np_addon_enabled'`. `#loadEnabled()` reads on construct. `#persistEnabled()` writes on enable/disable. |
| CookieSessionStore | chrome.cookies API | `chrome.cookies.get({ url, name: 'JSESSIONID' })` | ✓ VERIFIED | Line 108 of CookieSessionStore.ts |
| ServiceNowSessionAdapter | MAIN-world content script bridge | `chrome.tabs.sendMessage(tabId, { type: 'GET_MAIN_WORLD_VALUE', key: 'g_ck' })` | ✓ VERIFIED | `#requestMainWorldValue()` in SessionAdapter.ts |
| ServiceNowTableClient | FETCH_PROXY (background SW) | `chrome.runtime.sendMessage({ type: 'FETCH_PROXY', ... })` | ✓ VERIFIED | Line 33 of ServiceNowTableClient.ts |
| ImportExportSection handleExport | WriteJournal | `writeJournal.begin('export-data', ...)` | ✓ VERIFIED | Line 70 of ImportExportSection.tsx |
| ImportExportSection handleExport | TraceRedactor | `traceRedactor.redactValue(data)` | ✓ VERIFIED | Line 117 of ImportExportSection.tsx |
| ImportExportSection handleMerge | mergeRecords | `mergeRecords(existingMcp, incomingMcp)` | ✓ VERIFIED | Lines 246, 256 of ImportExportSection.tsx |
| GQMDataService | WriteJournal | `writeJournal.begin('save-gqm-data', ...)` | ✓ VERIFIED | All create/update/delete operations in GQMDataService.ts |
| main.tsx (both) | addon registration functions | Import + call before React mount | ✓ VERIFIED | 4 registration functions imported and called |
| navConfig | SidepanelPageRegistry | `sidepanelPageRegistry.getAll()` filtered by CORE_PAGE_IDS | ✓ VERIFIED | navConfig.ts lines 59-60 |
| AddonSettingsSection | AddonRegistry | `addonRegistry.listSettingsSchemas()`, `enable()`, `disable()` | ✓ VERIFIED | AddonSettingsSection.tsx lines 15, 31, 34 |
| SlashCommandRegistry | ResearchSkill | Dynamic import: `await import('../../addons/global/ResearchSkill')` | ✓ VERIFIED | SlashCommandRegistry.ts line 100 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| AddonRegistry enable state | `#enabled` Map | chrome.storage.local via `#loadEnabled()` | ✓ FLOWING | Loaded from stored NP_ADDON_ENABLED on construct. Mutations persist. |
| ServiceNowTableClient.queryTable() | response.body | FETCH_PROXY → ServiceNow REST API | ✓ FLOWING (runtime) | Routes via chrome.runtime.sendMessage to background SW FETCH_PROXY handler. |
| GQMDataService CRUD | GQM entities | IndexedDB gqm store via WriteJournal | ✓ FLOWING | Read/write via getDB() → transaction('gqm', 'readwrite'). WriteJournal atomicity. |
| ImportExportSection export | Exported data | IndexedDB stores via WriteJournal | ✓ FLOWING | 3-step journal: read-stores → redact-credentials → write-zip. |
| ImportExportSection import | Merged records | mergeRecords(existing, incoming) | ✓ FLOWING | Latest-wins deterministic merge via mergeRecords(). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 8 test files pass | `pnpm vitest run tests/core/addons/AddonRegistry.test.ts tests/addons/write/writeSkills.test.ts tests/core/data/exportSanitization.test.tsx tests/core/data/importMerge.test.ts tests/addons/servicenow/CookieSessionStore.test.ts tests/addons/servicenow/SessionAdapter.test.ts tests/addons/teamgqm/GQMDataService.test.ts tests/addons/servicenow/ServiceNowSkills.test.ts tests/addons/global/ResearchSkill.test.ts --run` | 67 passed, 0 failed | ✓ PASS |

### Probe Execution

No explicit probes defined for this phase (not a migration or CLI-tooling phase). Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ADDON-01 | 08-01, 08-09 | AddonRegistry with typed registration | ✓ VERIFIED | AddonRegistry.ts exists with registerSkill/Page/SettingsSchema, enable/disable, listEnabled. Registered in main.tsx. |
| ADDON-02 | 08-04 | ServiceNow JSESSIONID/sysparmCK extraction, Table API | ✓ VERIFIED | CookieSessionStore, ServiceNowSessionAdapter, ServiceNowTableClient all exist with tests. FETCH_PROXY routing. |
| ADDON-03 | 08-06 | ServiceNow CaseAnalyzer, CatchUp, Sentiment skills | ✓ VERIFIED | 3 PromptTemplate configs in serviceNowSkills.ts. Tests pass. |
| ADDON-04 | 08-06 | ServiceNow Side Panel page | ✓ VERIFIED | ServiceNowSidepanelPage.tsx with case-context + skill launcher. Session-aware. |
| ADDON-05 | 08-06 | ServiceNow Full App page (case table, comments, work notes) | ✓ VERIFIED | ServiceNowStandalonePage.tsx with Table + Drawer + tabs. |
| ADDON-06 | 08-02, 08-09 | Write add-on 6 skills | ✓ VERIFIED | 6 PromptTemplate configs in writeSkills.ts. Registered. |
| ADDON-07 | 08-02 | Write Side Panel quick actions | ✓ VERIFIED | WritePage.tsx with 6 buttons. Registered via sidepanelPageRegistry. |
| ADDON-08 | 08-05, 08-07 | TeamGQM side panel + full app | ✓ VERIFIED | gqmTypes.ts, GQMDataService.ts, TeamGQMSidepanelPage.tsx, TeamGQMStandalonePage.tsx all exist. |
| ADDON-09 | 08-08, 08-09 | ResearchSkill global add-on | ✓ VERIFIED | ResearchSkill.ts with MCP detection + graceful degradation. Registered with AddonRegistry. @modelcontextprotocol/sdk@1.29.0 installed. |
| DATA-01 | 08-03 | Data export — sanitized JSON/ZIP | ✓ VERIFIED | ImportExportSection.tsx: WriteJournal + TraceRedactor + operationId. Credential exclusion tests pass (6 tests). |
| DATA-02 | 08-03 | Data import — merge with conflict resolution | ✓ VERIFIED | mergeRecords.ts + ImportExportSection.tsx handleMerge. Deterministic merge tests pass (7 tests). |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | No anti-patterns found in Phase 8 files |

**Debt markers (TBD/FIXME/XXX):** None found.
**Placeholder comments:** None found in addon files.
**Bare fetch() calls in addons:** None found — all use FETCH_PROXY.
**Return null / empty fragments:** None found.

### Human Verification Required

None. All truths are verified through code presence, wiring checks, data-flow traces, and passing automated tests.

### Gaps Summary

No gaps found. All 14 must-have truths verified. All 11 requirements completed. All 67 tests pass. All artifacts exist, are substantive, and are wired.

---

_Verified: 2026-07-19T22:59:00Z_
_Verifier: the agent (gsd-verifier)_
