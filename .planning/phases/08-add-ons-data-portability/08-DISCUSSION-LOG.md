# Phase 8: Add-ons & Data Portability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 08-add-ons-data-portability
**Areas discussed:** AddonRegistry Contract, ServiceNow Session Extraction, Write Add-on Skills, TeamGQM Scope, ResearchSkill Implementation, Data Portability

---

## AddonRegistry Contract (ADDON-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Skills + Pages + Settings | Add-ons register skills, UI pages, and settings schemas. Keymaps/prompts stay in existing registries. Balanced scope. | ✓ |
| Pages + Settings only | Skills register through existing ToolRegistry. Simpler. | |
| Everything | Single-entry-point for all add-on contributions. Maximal centralization. | |

**User's choice:** Skills + Pages + Settings (Recommended)
**Notes:** Prompts and keymaps stay in their existing registries. AddonRegistry manages skills (MCP-style tools), UI pages (via existing page registries), and settings schemas (per-addon Options configuration).

### Add-on Activation

| Option | Description | Selected |
|--------|-------------|----------|
| Installed by default, capability-gated | Registered and visible by default; execution disabled until user enables. Separate permissions for extraction, execution, data access. | ✓ |
| All active by default, user disables | Add-ons active on install, user disables in Options. | |
| All disabled by default, user enables | Add-ons ship 'off', user must explicitly enable. | |
| Contextual auto-activation | Dormant until matching domain visited. | |

**User's choice:** Installed by default, capability-gated by enablement. Registration = visible/discoverable. Enablement = pages/skills/settings participate. Separate permissions for extraction, execution, data access.

---

## ServiceNow Session Extraction (ADDON-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: chrome.cookies + MAIN-world bridge | JSESSIONID via chrome.cookies API; sysparmCK (g_ck) via MAIN-world content script bridge. | ✓ |
| Cookie-based only via chrome.cookies | JSESSIONID and sysparmCK both via cookies. | |
| MAIN world content script injection | Inject script into MAIN world to read all tokens. | |
| User manually provides via Options | User copies tokens from DevTools into Options. | |

**User's choice:** Hybrid acquisition. JSESSIONID from chrome.cookies (authoritative source for cookies). sysparmCK (g_ck) from MAIN-world bridge (exposed as page runtime variable, not a cookie). No manual credential management. Preserves extraction-only philosophy.

---

## Write Add-on Skills (ADDON-06, ADDON-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Skills as prompts + slash commands | Each Write skill is a PromptManager template. `/write` routes to Write sidebar. No ToolRegistry. | ✓ |
| Skills as Agent tools via ToolRegistry | Each Write skill registers as a tool. Agent mode can invoke them. | |
| Both: prompts for Chat, tools for Agent | Dual registration — maximum flexibility. | |

**User's choice:** Skills as prompts + slash commands. Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, and Action Plan are all prompt-transformation workflows — the AI model does the work. Treating them as prompts keeps architecture lightweight and avoids unnecessary ToolRegistry complexity.

---

## TeamGQM Scope (ADDON-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Side Panel = dashboard, Full App = workspace editor | Read-only condensed view in Side Panel; full editing/analysis in Full App. Clear read/manage split. | ✓ |
| Same data, different layout density | Both surfaces show same GQM hierarchy with different rendering modes. | |
| Side Panel: AI digest, Full App: structured data | AI-generated summary in Side Panel, full structured model in Full App. | |

**User's choice:** Side Panel = read-only dashboard, Full App = workspace editor. Side Panel focuses on quick consumption while working. Full App is the primary workspace for creating, editing, organizing, and analysing GQM structures. Each surface has a distinct purpose.

---

## ResearchSkill Implementation (ADDON-09)

| Option | Description | Selected |
|--------|-------------|----------|
| MCP-connected only, graceful degradation | Requires configured MCP search server. Shows "Configure a search tool" prompt when no search MCP. Privacy-first. | ✓ |
| Built-in fallback plus MCP priority | Basic built-in search with MCP override when available. | |
| Built-in only, no MCP | Always uses built-in search API. | |

**User's choice:** MCP-connected only with graceful degradation. ResearchSkill does not ship with a built-in search provider. Relies on user-configured MCP search tool (Brave Search, Tavily, enterprise search). Preserves privacy-first architecture, avoids coupling to a specific cloud search provider.

---

## Data Portability (DATA-01, DATA-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing ImportExportSection | Add atomic exports (WriteJournal), timestamp-based merge, credential exclusion verification to existing OPT-08 UI. | ✓ |
| Rebuild export/import from scratch | Replace existing ImportExportSection with new implementation. | |
| DATA-01/02 already covered by OPT-08 | Scope OPT-08 as complete. No additional work. | |

**User's choice:** Extend existing pipeline. ImportExportSection already provides the UI. DATA-01/02 adds production-readiness: atomic exports via WriteJournal, deterministic timestamp-based latest-wins merge, and verification that sensitive credentials stay excluded from exported data.

---

## the agent's Discretion

- AddonRegistry internal API — method signatures, TypeScript generics, enable/disable state management
- CookieSessionStore internal API — chrome.cookies query patterns, MV3 compatibility
- ServiceNowSessionAdapter session object shape and refresh logic
- Write add-on prompt template content for each of the 6 skills
- TeamGQM Goal/Question/Metric data model and IndexedDB store schema
- ResearchSkill MCP tool capability detection
- Export atomicity implementation and manifest schema
- Import merge per-store strategy and error recovery
- AddonSettingsSection registry wiring
- ServiceNow Table API client request shapes and pagination
- Add-on nav registration sequence in main.tsx

## Deferred Ideas

| Feature | Reason |
|---------|--------|
| Write add-on Full App page | Side Panel is primary Write surface; Full App page optional |
| ServiceNow page injection (CaseInsightBox, floating widgets) | v0.2+; content scripts extraction-only |
| TeamGQM AI-powered metric suggestions | Out of scope — data model + CRUD only |
| ResearchSkill built-in search provider | Violates privacy-first; MCP-connected only |
| Add-on marketplace / remote add-on loading | v0.2+; v0.1 add-ons are bundled |
| Add-on interop (Write calling ServiceNow data) | Add-ons isolated in v0.1 |
| ServiceNow real-time notifications / polling | Session extraction on-demand only |
| TeamGQM chart/visualization of metrics | Visualization is separate capability |
| Export scheduling / auto-export | Manual export only for v0.1 |
