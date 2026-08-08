---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
reviewed: 2026-08-08T00:00:00Z
depth: standard
files_reviewed: 60
files_reviewed_list:
  - package.json
  - src/components/OnboardingModal.tsx
  - src/components/cmdk/CmdKPicker.tsx
  - src/components/pages/AgentPage.tsx
  - src/components/pages/ChatPage.tsx
  - src/components/pages/NotesPage.tsx
  - src/components/pages/OptionsPage.tsx
  - src/components/pages/sidepanel/ChatPageSkeleton.tsx
  - src/components/pages/standalone/WorkspacePageSkeleton.tsx
  - src/components/sidepanel/SidePanelRouter.tsx
  - src/components/sidepanel/SidePanelShell.tsx
  - src/components/standalone/StandaloneRouter.tsx
  - src/components/standalone/StandaloneShell.tsx
  - src/components/standalone/standaloneNav.ts
  - src/core/ai/ProviderRegistry.ts
  - src/core/background/BackgroundRouter.ts
  - src/core/background/ContextMenuHost.ts
  - src/core/background/KeepAliveManager.ts
  - src/core/background/LifecycleManager.ts
  - src/core/components/ErrorBoundary.tsx
  - src/core/components/FocusTrap.tsx
  - src/core/components/PortableMarkdown.tsx
  - src/core/content/ContentScriptHost.ts
  - src/core/content/PageContext.ts
  - src/core/content/PageContextBridge.ts
  - src/core/error/debugLog.ts
  - src/core/error/errorCodes.ts
  - src/core/events/EventBus.ts
  - src/core/events/EventBusManager.ts
  - src/core/i18n/index.ts
  - src/core/i18n/strings.ts
  - src/core/input/KeymapRegistry.ts
  - src/core/messaging/MessageBus.ts
  - src/core/messaging/MessageBusBridge.ts
  - src/core/prompts/index.ts
  - src/core/registry/AddonRegistry.ts
  - src/core/registry/AddonSettingsStore.ts
  - src/core/registry/PageRegistry.ts
  - src/core/registry/Registry.ts
  - src/core/registry/SidePanelPageRegistry.ts
  - src/core/registry/StandalonePageRegistry.ts
  - src/core/registry/ThemePackRegistry.ts
  - src/core/runtime/BroadcastBus.ts
  - src/core/runtime/MessageType.ts
  - src/core/runtime/OperationId.ts
  - src/core/runtime/RuntimeEnvelope.ts
  - src/core/runtime/workerState.ts
  - src/core/security/TraceRedactor.ts
  - src/core/theme/ThemeStore.ts
  - src/core/theme/antdConfig.ts
  - src/core/theme/themePacks.ts
  - src/core/workspace/WorkspaceRouter.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/core/workspace/WorkspaceSync.ts
  - src/entrypoints/background.ts
  - src/entrypoints/core.content.ts
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - src/types/harness.ts
  - src/types/workspace.ts
findings:
  critical: 0
  warning: 9
  info: 5
  total: 14
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 60
**Status:** issues_found

## Summary

All 60 phase source files were reviewed at standard depth. The codebase is generally well-structured: security posture is sound at the surface level (no banned packages, no `innerHTML`/`eval`, DOMPurify + `escapeRawHtml` in PortableMarkdown, ISOLATED-world extraction-only content scripts, sender-id validation in BackgroundRouter, MessageType whitelist enforcement, background SW free of AI/IndexedDB logic, callback-style `tabs.query` → `sidePanel.open` for gesture preservation). No CRITICAL (security/data-loss) defects were found.

However, the review surfaced a systemic **wiring gap**: several phase deliverables are implemented but never started in production. `useWorkspaceStore.init()`, `useAddonSettingsStore.init()`, and `WorkspaceSync.start()` have **zero callers** in the entrypoints/shells — the cross-surface workspace sync (heartbeats, LWW adoption, handoff state machine) and onboarding-done persistence only run in unit tests, not in the shipped extension. Additionally, the "deferred debugLog" ambient declaration pattern in EventBus/MessageBus/BroadcastBus means those modules' error logging is dead code — Golden Rule 9 is violated in effect. Details in the warnings below.

## Warnings

### WR-01: Ambient `declare const debugLog` is never bound at runtime — error logging silently dead

**File:** `src/core/events/EventBus.ts:35,79-97` · `src/core/messaging/MessageBus.ts:29,62-67` · `src/core/runtime/BroadcastBus.ts:29,83-88`

**Issue:** All three modules declare `declare const debugLog: DebugLogFn | undefined;` and guard with `if (typeof debugLog === 'function')`. This is a *type-only* ambient declaration — no real binding is ever created, and no global named `debugLog` exists. The module comments claim "01-04 wires the real import" but 01-04 landed (`src/core/error/debugLog.ts` exports a real `debugLog`) and these three files were never rewired. At runtime `typeof debugLog === 'function'` is always `false`, so:

- EventBus handler exceptions are swallowed (catch body never executes),
- `MessageBus.publish` send failures are swallowed,
- `BroadcastBus.emit` send failures are swallowed.

These are effectively empty catches, violating Golden Rule 9 ("every catch calls debugLog … no empty catches") and removing error observability exactly where the project's R-10 contract depends on it.

**Fix:** Replace the ambient declaration with a real import in all three modules:

```ts
// EventBus.ts / MessageBus.ts / BroadcastBus.ts
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
// …then use directly, e.g.:
//   debugLog(ERROR_CODES.EVT_HANDLER, `EventBus handler error for event "${event}"`, { error: err, context: 'EventBus.emit' });
// and drop the `if (typeof debugLog === 'function')` guards.
```

### WR-02: `useAddonSettingsStore.init()` never called — "Configure later" does not persist across sessions

**File:** `src/components/OnboardingModal.tsx:39-52` · `src/components/sidepanel/SidePanelRouter.tsx:34` · `src/core/registry/AddonSettingsStore.ts:63-87` · `src/entrypoints/sidepanel/main.tsx` · `src/entrypoints/standalone/main.tsx`

**Issue:** `handleConfigureLater` writes `np_addon_settings` via `setSetting`, but nothing in production ever calls `useAddonSettingsStore.init()` to hydrate that storage value back into state. Every fresh extension page load (each side-panel open / standalone tab / SW restart) boots with `settings: {}`, so `SidePanelRouter`'s `settings.onboarding?.done === true` is false → the OnboardingModal reappears despite the user having clicked "Configure later". The D-06 "escape hatch" is effectively non-persistent. (Tests exercise `init()` directly, which is why the gap is invisible to the suite.)

**Fix:** Fire `init()` at mount like ThemeStore, e.g. in both entrypoints' module scope alongside the existing theme hydrate:

```ts
// src/entrypoints/sidepanel/main.tsx (and standalone)
if (typeof document !== 'undefined') {
  void useThemeStore.getState().init();
  void useAddonSettingsStore.getState().init();
  // ...
}
```

### WR-03: WorkspaceStore/WorkspaceSync never started — cross-surface workspace sync is dead code in production

**File:** `src/core/workspace/WorkspaceStore.ts:126-172` · `src/core/workspace/WorkspaceSync.ts:64-84` · `src/entrypoints/sidepanel/main.tsx` · `src/entrypoints/standalone/main.tsx` · `src/components/sidepanel/SidePanelShell.tsx:49`

**Issue:** `useWorkspaceStore.init()` / `.start()` and `WorkspaceSync.start()` have no callers anywhere in `src/` (verified by grep — only tests invoke them). Consequences in the shipped extension:

- `np_workspace` is never hydrated: `workspaceId`/`conversationId` regenerate on every load, `activeSurface` is permanently `'sidepanel'` (displayed in the shell header), and the D-18 durable fields never round-trip.
- `WorkspaceSync` is never instantiated: the 3000 ms heartbeat, WORKSPACE_UPDATED LWW adoption, WORKSPACE_HANDOFF state machine, and mirroring flow never run — the entire Appendix M.3/Flow-11 deliverable of this phase is inert outside unit tests.

The 01-06 plan's purpose statement says "01-08 shells and 01-09 mounts consume it," but no task wired the store/sync into the mounts. Either the wiring belongs in this phase (fix below) or it must be explicitly deferred to the phase that consumes handoff — as shipped, the phase's cross-surface workspace feature does not function.

**Fix:** Wire the workspace lifecycle at mount (both entrypoints, alongside the theme hydrate):

```ts
void useWorkspaceStore.getState().init().then(() => {
  useWorkspaceStore.getState().start('sidepanel'); // or 'standalone'
  sync = new WorkspaceSync('sidepanel'); // keep a module-level ref for stop()
  sync.start();
});
```

### WR-04: `WorkspaceSync.handleRemoteUpdate` adopts remote state verbatim — no T-1-13 validation, no workspaceId check

**File:** `src/core/workspace/WorkspaceSync.ts:198-217`

**Issue:** `handleRemoteUpdate` casts `payload as InboundPayload` and, when `remoteVersion > local.version`, executes `useWorkspaceStore.setState({ workspace: incoming.state })` with **no schema validation and no workspaceId match check**. This contradicts the store's own T-1-13 rule ("stored values are schema-validated before merge; unknown keys are never spread raw" — enforced in `sanitizeStored`, WorkspaceStore.ts:60-79) and M.3's workspace-scoping. Two concrete failure modes once sync is wired (WR-03):

1. A malformed/hostile `WORKSPACE_UPDATED` payload (any extension context can `sendMessage`, and the envelope guard checks only shape, not payload) replaces the workspace with an incomplete object — `pinnedTabs`/`selectedNotes` become `undefined` and any consumer touching them crashes.
2. The side panel is per-window and each store instance generates a fresh `workspaceId`; `BroadcastBus` delivers to **all** extension contexts. A snapshot from a different window's workspace (different `workspaceId`) with a higher version is adopted wholesale — cross-workspace state contamination.

**Fix:** Route the inbound state through the same sanitizer and add a workspaceId gate:

```ts
// reuse/export sanitizeStored from WorkspaceStore, or validate here
const local = useWorkspaceStore.getState().workspace;
const incoming = sanitizeInboundState(payload.state); // T-1-13 shape guard
if (incoming === null) return;
if (incoming.workspaceId !== undefined && incoming.workspaceId !== local.workspaceId) return; // M.3 scope
if (typeof incoming.version !== 'number' || incoming.version <= local.version) return;
useWorkspaceStore.setState({ workspace: incoming });
```

### WR-05: Deep-link to Standalone Options lands on Chat — `navigateToPage` sets state on the wrong surface

**File:** `src/components/OnboardingModal.tsx:32-37` · `src/components/cmdk/CmdKPicker.tsx:58-65` · `src/components/standalone/standaloneNav.ts:23-25` · `src/core/workspace/WorkspaceRouter.ts:71-110`

**Issue:** Both "Configure provider" (D-09) and the Cmd+K "Open Options" command do:

```ts
void WorkspaceRouter.openStandalone();
navigateToPage('options');
```

`navigateToPage` mutates the *current* surface's in-memory zustand store (`useStandaloneNav`). If the standalone tab does not exist yet, `openStandalone` creates it asynchronously — the new tab boots a **fresh** `useStandaloneNav` store whose default is `'chat'`. The `'options'` navigation is lost; the user lands on the Chat page, not Options. Even when a standalone tab already exists, `tabs.query` matches `tabs[0]` without verifying which window it belongs to. The D-09 "deep-link to Options" intent is not achievable with this implementation.

**Fix:** Persist the requested page id in storage (`chrome.storage.local`, e.g. `np_standalone_nav_page`) before opening, and have StandaloneRouter hydrate `useStandaloneNav` from it on mount (then clear it). Alternatively, pass the page via the `WORKSPACE_HANDOFF`-style envelope when the tab is created.

### WR-06: OptionsPage theme-save error toast is unreachable dead code

**File:** `src/components/pages/OptionsPage.tsx:26-33` · `src/core/theme/ThemeStore.ts:126-136`

**Issue:** `handleModeChange` awaits `setMode(next)` then checks `useThemeStore.getState().mode !== next` to decide whether to show `STR.theme.saveFailed`. But `ThemeStore.setMode` *always* adopts the mode into state — the `catch` logs `THEME_WRITE` and then falls through to `set({ mode, resolved: resolveScheme(mode) })` regardless of storage failure. The comparison is therefore always `false` and the notification (the E5 persistence-toast contract) can never fire. The error path is either missing (store should reject/un-adopt on write failure) or the check is wrong (should compare against a persisted/write-ok flag).

**Fix:** Make the store surface the failure, e.g. return a boolean or expose a last-write-error:

```ts
// ThemeStore.setMode
setMode: async (mode) => {
  try {
    await chrome.storage.local.set({ np_theme: mode });
    set({ mode, resolved: resolveScheme(mode) });
    return true;
  } catch (err) {
    debugLog(ERROR_CODES.THEME_WRITE, 'failed to write np_theme', { error: err instanceof Error ? err : undefined, module: 'ThemeStore' });
    return false; // do NOT adopt — state stays at previous mode
  }
},
// OptionsPage
const ok = await useThemeStore.getState().setMode(next);
if (!ok) notification.error({ message: STR.theme.saveFailed, duration: 0 });
```

### WR-07: `debugLog` writes `options.extra` to console without redaction (R-10 gap)

**File:** `src/core/error/debugLog.ts:34`

**Issue:** R-10 requires "everything through TraceRedactor before persist/UI/export" — debugLog is the single observability sink and claims to be redaction-safe. But `console.error(parts.join(' '), errorDetail ?? '', options.extra ?? {})` passes `extra` straight to the console with no `TraceRedactor.redact` pass (unlike `message`, `context`, `module`, `addonId`, `error.message`). Today `redact` is a pass-through stub, so nothing leaks — but once the security phase implements real redaction, `extra` values (callers pass `{ type: envelope.type }`, `{ menuItemId }`, `{ message: lastError.message }` today; later phases will pass prompt/tool bodies per the documented contract) will bypass it.

**Fix:** Redact extra before emitting:

```ts
const redactedExtra: Record<string, unknown> = {};
for (const [k, v] of Object.entries(options.extra ?? {})) {
  redactedExtra[k] = typeof v === 'string' ? TraceRedactor.redact(v) : v;
}
console.error(parts.join(' '), errorDetail ?? '', redactedExtra);
```

### WR-08: Empty catch in `ProviderRegistry.notify` without debugLog (Golden Rule 9)

**File:** `src/core/ai/ProviderRegistry.ts:35-38`

**Issue:**

```ts
} catch {
  // A broken listener must never break the registry (Golden Rule 9).
}
```

The comment cites Golden Rule 9, but the rule's requirement is *"Every catch calls `debugLog(code, …)`"* — this catch logs nothing, making it an empty catch by the project's own definition. The registry already imports `debugLog`/`ERROR_CODES`, so the fix is one line.

**Fix:**

```ts
} catch (err) {
  debugLog(ERROR_CODES.EVT_HANDLER, 'ProviderRegistry listener error', {
    error: err instanceof Error ? err : undefined,
    module: 'ProviderRegistry',
  });
}
```

### WR-09: BackgroundRouter casts inbound message without a structural guard — sync throw on malformed message

**File:** `src/core/background/BackgroundRouter.ts:47-60`

**Issue:** The listener does `const envelope = message as RuntimeEnvelope<unknown>` then immediately accesses `envelope.type` in `MessageTypeValues.includes(envelope.type)`. The `sender.id` guard passes for any message from the extension's own contexts — including a `null`/primitive/malformed message (e.g. a buggy content script or a future internal sender). A `null` message makes `envelope.type` throw a TypeError **synchronously inside the listener**, which Chrome reports as an unhandled event-handler error and which leaves the sender's `sendMessage` promise hanging (no `sendResponse`). This is inconsistent with `MessageBus.dispatchInbound` (MessageBus.ts:135-144), which guards with `isRuntimeEnvelopeShape` before touching `.type`.

**Fix:** Apply the same structural guard before any property access:

```ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (!isRuntimeEnvelopeShape(message)) {
    // reply a fail envelope rather than throwing
    sendResponse(workerState.fail(ERROR_CODES.MSG_DESERIALIZE, 'malformed envelope', undefined));
    return true;
  }
  const envelope = message;
  // ...rest unchanged
});
```

(Export/reuse `isRuntimeEnvelopeShape` from MessageBus.ts rather than duplicating it.)

## Info

### IN-01: ContentScriptHost registers under `tabId: 0` in production

**File:** `src/entrypoints/core.content.ts:20-22` · `src/core/content/ContentScriptHost.ts:28-32`

`new ContentScriptHost()` is constructed with no `tabId`, so `options.tabId ?? 0` keys every page in the tab-keyed `PageRegistry` under `0`. Nothing reads the content-side registry this phase, so impact is nil today, but the registry data is wrong by construction the moment extraction lands (Phase 4a). Either plumb the real tab id (via a background round-trip) or document that the registry is test-only until Phase 4a.

### IN-02: `createStandaloneApp()` export unused at module scope

**File:** `src/entrypoints/standalone/main.tsx:70-81`

The module-scope mount renders `<StandaloneRoot />` directly (line 81) instead of `createStandaloneApp()`, unlike the side-panel entrypoint which uses its exported `createSidePanelApp()` (main.tsx:86). Harmless, but inconsistent with the documented testability pattern.

### IN-03: `setHighlighted` can transiently reach `-1` when the filter is empty

**File:** `src/components/cmdk/CmdKPicker.tsx:125`

With `filtered.length === 0`, ArrowDown computes `Math.min(h + 1, -1) = -1`. `Enter` is guarded (`filtered[highlighted]` undefined check) and the next query change resets to 0, so no crash — but clamp to `Math.max(0, …)` for correctness:

```ts
setHighlighted((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
```

### IN-04: Send-failure logged with `MSG_SERIALIZE` code

**File:** `src/core/messaging/MessageBus.ts:63` · `src/core/runtime/BroadcastBus.ts:84`

A `runtime.sendMessage` rejection is a transport/connect failure, not a serialization failure; `CONNECT_FAILED` (or a new canonical code) is semantically more accurate. Minor, but error-code hygiene matters to the §C.2 registry contract.

### IN-05: `ErrorBoundary` uses a raw string error code

**File:** `src/core/components/ErrorBoundary.tsx:30`

`debugLog('COMPONENT_RENDER', …)` uses a string literal instead of `ERROR_CODES.COMPONENT_RENDER`. The value is identical today, but the codebase pattern is to reference the registry (Golden Rule 9 "canonical §C.2 code"); a future rename would silently break the ErrorBoundary.

---

_Reviewed: 2026-08-08T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
