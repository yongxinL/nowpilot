# COVERAGE — Phase 01 External API Surface Matrix

Enumerates every external (non-first-party) API capability touched by Phase 01.
Each capability is INTEGRATEd or explicitly OPT-OUT with a reason. Full coverage
is the default: any capability used in code must appear here.

Scope note: NowPilot is a Chrome MV3 extension — its external API surface is the
`chrome.*` namespace plus browser platform APIs. No third-party HTTP APIs are
called in Phase 01 (user-configured AI providers are deferred to Phase 4+).

| capability | decision | reason |
|---|---|---|
| chrome.storage.local | INTEGRATE | Canonical non-secret persistence per §8 state model |
| chrome.storage.sync | INTEGRATE | Theme authoritative cross-device per §15.1/APPR-03 |
| chrome.storage.onChanged | INTEGRATE | Storage-driven sync surface → storage → surfaces |
| chrome.storage.session | OPT-OUT | Election/secrets land in Phase 2; interface stubbed only this phase |
| chrome.runtime.onMessage | INTEGRATE | Single typed message entry for background SW (D-13) |
| chrome.runtime.sendMessage | INTEGRATE | RuntimeEnvelope one-shot dispatch (CONTENT_SCRIPT_READY, SPA_NAVIGATION) |
| chrome.sidePanel.setPanelBehavior | INTEGRATE | Side Panel is a primary surface |
| chrome.sidePanel.open | INTEGRATE | Side Panel is a primary surface |
| chrome.tabs.query | INTEGRATE | Tab dedup + workspace handoff requirement |
| chrome.tabs.update | INTEGRATE | Tab dedup + workspace handoff requirement |
| chrome.windows.update | INTEGRATE | Standalone ↔ side panel handoff focus |
| chrome.permissions.request | INTEGRATE | Optional-permission scaffolding; requested only when first used |
| chrome.runtime.getURL | INTEGRATE | Asset URLs required by WXT entrypoints |
| chrome.runtime.id | INTEGRATE | Context identity plumbing |
| chrome.runtime.lastError | INTEGRATE | Platform error checks |
| chrome.runtime.reload | INTEGRATE | Dev reload plumbing |

## Explicit opt-outs (project-wide, not Phase 01)

| capability | decision | reason |
|---|---|---|
| chrome.cookies | OPT-OUT | Permission minimalism; deferred until Phase 17 |
| chrome.scripting | OPT-OUT | Content script declared statically in manifest; deferred to Phase 17 |
| chrome.contextMenus | OPT-OUT | ContextMenuHost is Phase 17 |
| chrome.alarms | OPT-OUT | No background timers in Phase 1 (MV3 constraint); when KeepAliveManager ships |
| chrome.notifications | OPT-OUT | Nothing notifies yet; added when first used |
| unlimitedStorage | OPT-OUT | Not needed until Phase 2 (ADR-STACK-02) |
| declarativeNetRequest | OPT-OUT | Spec §16.4 forbids it in v0.1 |
| host permission all_urls | OPT-OUT | Only *://*.service-now.com/* + support host allowed |
| External AI provider APIs (OpenAI/Anthropic/Gemini/Ollama) | OPT-OUT | Deferred to Phase 4+; aiProvider service runs UI-context only; rows added when that phase lands |
