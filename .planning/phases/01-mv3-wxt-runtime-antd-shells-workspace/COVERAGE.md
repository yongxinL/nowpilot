# API Coverage — Chrome Extension / WXT Platform (Phase 1)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 1 is a Chrome MV3 extension (WXT ^0.19.29 platform). The "external surface" is the
> Chrome extension API surface used by the shipped code, plus the WXT platform. Gap-closure
> plans 01-10/01-11 add mount wiring and messaging-layer hardening only — they introduce no
> new API capabilities; this matrix records the decisions for the whole phase surface.

| capability | decision | reason |
|---|---|---|
| chrome.sidePanel (setPanelBehavior, open) | INTEGRATE | §5.3 action-button → side panel path via LifecycleManager (01-09); gesture-safe sidePanel.open via WorkspaceRouter callback chain (Pitfall 1). Unchanged by gap plans |
| chrome.tabs (query/update/create) | INTEGRATE | Standalone update-or-create dedupe (WorkspaceRouter, 01-06, W-12). Unchanged |
| chrome.windows (update/focus) | INTEGRATE | Standalone tab focus in the dedupe path (WorkspaceRouter, 01-06). Unchanged |
| chrome.runtime (onMessage/sendMessage, connect, id) | INTEGRATE | MessageBus/BroadcastBus/MessageBusBridge transport + BackgroundRouter §16.2 validation; WR-09 hardening (01-11) adds a shape guard on this same surface |
| chrome.storage.local (get/set, onChanged) | INTEGRATE | np_theme / np_theme_pack / np_workspace / np_addon_settings persistence + cross-surface onChanged sync; 01-10 wires the np_workspace + np_addon_settings hydration at both entrypoint mounts |
| chrome.action (onClicked) | OPT-OUT | Side panel opens via LifecycleManager setPanelBehavior({openPanelOnActionClick:true}); no direct chrome.action.onClicked listener exists in Phase 1 scope — the §5.3 declarative path fully covers the action-button flow |
| chrome.storage.sync | OPT-OUT | D-13: chrome.storage.local is the canonical source of truth for all Phase 1 keys; the sync area adds no cross-surface value in Phase 1 |
| chrome.alarms | INTEGRATE | KeepAliveManager keepalive (01-09). Unchanged |
| chrome.contextMenus | INTEGRATE | ContextMenuHost skeleton (01-09). Unchanged |
| wxt platform (entrypoints globs, defineContentScript, WxtVitest, wxt.config.ts) | INTEGRATE | Build/entrypoint discovery + content-script ISOLATED world (D-16) + verify:phase-1 chain. Unchanged |
| External AI provider SDKs (openai/anthropic/gemini/ollama) | OPT-OUT | D-06 defers the provider flow to Phase 3; Phase 1 ships disabled provider buttons only — no SDK is installed or called |
| content-extraction libraries (defuddle, @mozilla/readability, turndown) | OPT-OUT | D-16: Phase 1 content script is an architecture skeleton (ISOLATED, PING/PONG + capabilities only); extraction begins Phase 4a |
| IndexedDB (idb) | OPT-OUT | Phase 2 owns IndexedDB stores (STORAGE-01); Phase 1 persists via chrome.storage.local only, and AI/IndexedDB stay out of the background SW (R-3) |

## Gap-closure scope note (01-10 / 01-11)

- 01-10 adds **no new API calls**: it calls store `init()`/`start()` and `WorkspaceSync.start()`
  at the two entrypoint mounts — all chrome.* usage lives inside the existing stores/bus
  (chrome.storage.local + chrome.runtime transport already integrated above).
- 01-11 touches the same integrated surfaces: chrome.runtime.onMessage (WR-01 log rewiring +
  WR-09 shape guard), chrome.storage.local validation (WR-04 inbound sanitize). No capability
  changes, no new permissions (manifest untouched).
