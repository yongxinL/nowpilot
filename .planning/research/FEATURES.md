# Features Research — NowPilot v0.1

> Synthesized from `.planning/PRODUCT_SPEC_v0_1.md` §9 (Feature Specification) and §0.1. The spec is canonical.

## Product: Two UI Surfaces

- **Side Panel** (chat-only thin client) — always accessible, streaming chat, quick actions.
- **Standalone view** (full workspace) — chat, agent, notes (+LLM-Wiki + Filesystem Sync), options, diagnostics. Shares `WorkspaceStore` + conversation with side panel.

## Side Panel Features (§9.1)

| Feature | Priority |
|---|---|
| Chat (streaming, abort, slash commands, quick context) | P0 |
| Agent (AgentOrchestrator + tier caps + permission prompts) | P0 |
| Write add-on page | P0 |
| TeamGQM add-on page | P0 |
| Open Standalone view action (Flow 11 workspace handoff) | P0 |
| Provider/model selector (read-only here; edit in Options) | P0 |
| Quick save response as note | P1 |
| Slash commands (/write, /ask, /research…) | P1 |
| Tab pinning (max 10) | P1 |
| Selection → Ask AI (context menu) | P1 |
| Theme toggle (light/dark/auto) | P1 |
| Cmd+K palette | P1 |
| Error toast + "Open Diagnostics" link | P1 |

RICH additions: persona header, welcome cards, context-aware quick-action chips, clarification chips, follow-up chips, streaming stage indicators.

**Deliberately excluded from Side Panel:** Notes editor, DiagnosticsPanel, PromptManager, ProvidersEditor, MCP editor, feature-flag editor, Import/Export, LLM-Wiki management, Filesystem Sync config.

## Standalone View Features (§9.2)

Chat (full-screen), Agent (full-screen), Notes (list/editor/wikilinks/backlinks/graph/search + LLM-Wiki + FS Sync), TeamGQM full-page, Options (§9.3), first-run onboarding entry, Cmd+K palette, "Focus Side Panel" command.

## Options Page Sections (§9.3)

General (account, AI access, appearance/theme packs, display language, font size, side-panel position), Providers, Models, MCP Servers, Prompt Templates ({{variable}} editor), Slash Commands, Memory, Diagnostics, Import/Export, Feature Flags, Add-on Settings, Persona, Notes, About.

## Add-ons (§9.4–§9.7)

- **Add-on contract**: `Addon { id, name, scope: 'site'|'global', urlPatterns?, contextExtractor?, skills?, prompts?, sidePanelPages?, standalonePages?, addonSettings (Zod), keymap? }`. Registered in AddonRegistry at startup.
- **Content-script UI mount removed** — no UI rendered into host pages; extraction-only via contextExtractor + PageContextBridge.
- **Write** (global, `src/addons/write/`): SidePanelWritePage quick actions (rewrite/summarize/draft customer update/draft internal note/explain technical issue/action plan/status update). Skills: Draft/Rewrite/Summarize/CustomerUpdate.
- **TeamGQM** (global, `src/addons/teamgqm/`): Side panel compact view + Standalone full workspace. TeamGQMSummarySkill.
- **ServiceNow** (site, urlPatterns `*://*.service-now.com/*`, `*://support.servicenow.com/*`): JSESSIONID extraction P0 via CookieSessionStore + ServiceNowSessionAdapter.

## Out of Scope for v0.1 (§6.5, §25)

Page injection / host-page write-back, PDF chat, embedding search, bidirectional FS sync, TTS output, A2UI/computer-use, cross-session replay, drag-and-drop macro builder.
