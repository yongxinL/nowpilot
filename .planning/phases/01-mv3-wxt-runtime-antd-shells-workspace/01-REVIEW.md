---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
reviewed: 2026-08-08T22:45:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - src/core/events/EventBus.ts
  - src/core/messaging/MessageBus.ts
  - src/core/runtime/BroadcastBus.ts
  - src/core/ai/ProviderRegistry.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/core/workspace/WorkspaceSync.ts
  - src/core/background/BackgroundRouter.ts
  - tests/entrypoints/sidepanel.test.tsx
  - tests/entrypoints/standalone.test.tsx
  - tests/core/workspace/WorkspaceSync.test.ts
findings:
  critical: 0
  warning: 7
  info: 8
  total: 15
resolved: [WR-10, WR-11, WR-12, WR-13]
deferred: [WR-05, WR-06, WR-07]
status: issues_found
---

# Phase 01: Code Review Report (Gap-Closure 01-10/01-11 Update)

**Reviewed:** 2026-08-08T22:45:00Z
**Depth:** standard
**Files Reviewed:** 12 (all files changed by gap-closure commits `05af3da`..`80e254a`; the prior 60-file baseline review is superseded by this update)
**Status:** issues_found

## Summary

This is an updated review of the 01-10 (mount wiring) and 01-11 (messaging/workspace-sync hardening) gap-closure plans. The four prior warnings targeted for closure were verified **in source** (not just by the SUMMARIES):

- **WR-01 (dead ambient debugLog) — FIXED.** `declare const debugLog` and the `typeof debugLog === 'function'` guards are gone from `src/core/events/`, `src/core/messaging/`, `src/core/runtime/` (grep returns 0). EventBus/MessageBus/BroadcastBus now import the real `debugLog` + `ERROR_CODES` and call `EVT_HANDLER`/`MSG_SERIALIZE` directly with the `err instanceof Error ? err : undefined` narrowing.
- **WR-04 (WorkspaceSync verbatim adoption) — FIXED (broadcast path).** `handleRemoteUpdate` now runs shape-check → shared `sanitizeStored` → workspaceId scope gate → version-LWW → field-preserving merge. See **WR-10** for a residual gap on the storage path.
- **WR-08 (ProviderRegistry empty catch) — FIXED.** `notify()` catch logs `EVT_HANDLER` with the `module: 'ProviderRegistry'` tag.
- **WR-09 (BackgroundRouter cast without guard) — FIXED.** `isRuntimeEnvelopeShape` guard precedes the whitelist TYPE check; malformed messages from valid senders get a `MSG_DESERIALIZE` fail-envelope reply + `return true`; the manual `as` cast is gone.

Also verified: the 01-10 wiring does activate the previously-dead lifecycle (WR-02/WR-03 closures) — both entrypoints fire addon-settings hydration and the `init().then(start; sync.start())` chain, with behavioral tests that genuinely exercise the fresh-module path. **No CRITICAL (security/data-loss) defects found** in the new code: no new packages, no content-script imports in entrypoints, AI/IndexedDB stay out of the background SW, and the message-inbound guards are consistent with `MessageBus.dispatchInbound`.

However, four new WARNING-level issues surfaced from the gap-closure changes themselves (WR-10…WR-13): the M.3 workspace scope gate is missing from the store's own `onChanged` adoption path (the primary cross-surface channel), the mount's fire-and-forget init chain has no rejection handling, the module-scope `WorkspaceSync` ref is held but `stop()` is unreachable (HMR leak), and the LWW-rejection test branch became vacuous after the scope gate was added.

**All four (WR-10…WR-13) were resolved in the follow-up fix pass (2026-08-08)** — see the per-finding `Status: RESOLVED` blocks below. Remaining open items are the deferred WR-05/WR-06/WR-07 and the carried Info findings.

## Verified Fixes (prior findings closed by 01-10/01-11)

### WR-01: Ambient debugLog — FIXED

**File:** `src/core/events/EventBus.ts:29-30` · `src/core/messaging/MessageBus.ts:16-17` · `src/core/runtime/BroadcastBus.ts:15-16`

Verified: `grep -rn "declare const debugLog|typeof debugLog" src/core/events/ src/core/messaging/ src/core/runtime/` → 0. All three modules import the real `debugLog` and call canonical codes directly (`EVT_HANDLER` in both EventBus catch bodies; `MSG_SERIALIZE` in publish/emit catches). Golden Rule 9 restored.

### WR-04: WorkspaceSync inbound adoption — FIXED (broadcast path)

**File:** `src/core/workspace/WorkspaceSync.ts:207-247`

Verified: `handleRemoteUpdate` routes the payload through the exported `sanitizeStored` (WorkspaceStore.ts:64), gates on `sanitized.workspaceId !== local.workspaceId`, gates on version-LWW, and adopts via `{ ...local, ...sanitized }` (inert fields preserved, T-1-05). Negative tests for foreign-id and malformed-state payloads are present and passing (verified via `pnpm vitest run tests/core/workspace/WorkspaceSync.test.ts` → 7/7). **Residual gap on the storage path → see WR-10.**

### WR-08: ProviderRegistry empty catch — FIXED

**File:** `src/core/ai/ProviderRegistry.ts:35-42`

Verified: catch now calls `debugLog(ERROR_CODES.EVT_HANDLER, 'ProviderRegistry listener error', { error: ..., module: 'ProviderRegistry' })`. The comment's intent ("a broken listener must never break the registry") is preserved with observability.

### WR-09: BackgroundRouter shape guard — FIXED

**File:** `src/core/background/BackgroundRouter.ts:59-64`

Verified: `isRuntimeEnvelopeShape` (exported once from MessageBus, reused — no duplication) is applied immediately after the `sender.id` guard and before any property access; a malformed message gets `workerState.fail(ERROR_CODES.MSG_DESERIALIZE, 'malformed envelope')` + `return true`; the manual `as RuntimeEnvelope<unknown>` cast was removed (the type predicate narrows).

### WR-02 / WR-03: Mount wiring — FIXED (now LIVE)

**File:** `src/entrypoints/sidepanel/main.tsx:93-110` · `src/entrypoints/standalone/main.tsx:88-105`

Verified: both mounts now hydrate `np_addon_settings` (`void useAddonSettingsStore.getState().init()`), construct the module-scope `WorkspaceSync`, and run `init().then(() => { start('<surface>'); workspaceSync.start(); })` — `start()` cannot run before hydration. The fresh-module-load behavioral tests seed storage, `vi.resetModules()`, and dynamically import the entrypoint so the module-scope `init()` genuinely fires against the seeded storage (this was the correct fix for the initially-asserted-on-unhydrated-store deviation). `pnpm vitest run tests/entrypoints` → 11/11 green.

## Warnings

### WR-10: M.3 workspaceId scope gate missing from the store's onChanged adoption path — cross-window contamination remains reachable via the primary channel — RESOLVED

**File:** `src/core/workspace/WorkspaceStore.ts:150-175`

**Issue:** WR-04's scope gate was applied only to `WorkspaceSync.handleRemoteUpdate` (the broadcast path). But the store's own `chrome.storage.onChanged` handler (`handleChanged`) — which is the **primary** cross-surface propagation channel, because every `start()`/`update()` writes `np_workspace` and chrome.storage.local is shared across all extension contexts and all windows — still adopts **any** higher-version snapshot with **no workspaceId check**:

```ts
const incoming = sanitizeStored(change.newValue);
if (incoming === null) return; // T-1-13 only — no M.3 scope gate
const local = get().workspace;
if (incoming.version !== undefined && incoming.version > local.version) {
  set({ workspace: { ...local, ...incoming } }); // adopts foreign workspaceId wholesale
```

The exact threat WR-04 described ("a snapshot from a different window's workspace with a higher version is adopted wholesale — cross-workspace state contamination") remains reachable through the storage path, and the two inbound paths now disagree on the same data: `WorkspaceSync` rejects a foreign-workspaceId snapshot while the store's onChanged adopts it. This is not merely theoretical — the mount wiring makes both paths live simultaneously; whichever fires first decides whether a foreign snapshot is absorbed or ignored.

**Fix:** Apply the same scope gate in `handleChanged` (and log `STORE_SYNC` for the ignored case), keeping the T-1-13 sanitizer:

```ts
const local = get().workspace;
if (incoming.workspaceId !== undefined && incoming.workspaceId !== local.workspaceId) {
  debugLog(ERROR_CODES.STORE_SYNC, 'np_workspace change ignored (foreign workspace)', { silent: true, module: 'WorkspaceStore' });
  return;
}
if (incoming.version !== undefined && incoming.version > local.version) {
  set({ workspace: { ...local, ...incoming } });
  ...
```

Note the plan's T-1-11-05 explicitly accepts first-boot id divergence as an edge; the gate above would *prevent* the current storage-path convergence in that edge, so the correct resolution is to make the two paths consistent and re-validate the first-boot edge (either both gate, or the broadcast gate is documented as intentionally stricter).

**Status: RESOLVED** (2026-08-08, fix commit `84509ba`). `handleChanged` now runs the identical inbound ordering as `WorkspaceSync.handleRemoteUpdate` — shape-check → shared `sanitizeStored` → workspaceId gate (foreign snapshot ignored with a `STORE_SYNC` log) → version-LWW adoption. The two inbound paths agree: a different window's workspaceId is rejected by both, and same-workspace cross-surface LWW propagation still works. Test updates in `tests/core/workspace/WorkspaceStore.test.ts` (same commit): the adoption test now writes the local workspaceId (proving same-workspace foreign-surface adoption), a new negative test asserts a foreign workspaceId with a higher version is rejected BEFORE the LWW check, and the equal-version LWW test uses the local workspaceId so that branch is actually exercised. `verify:phase-1` and `tests/core/workspace` + `tests/entrypoints` all green.

### WR-11: Mount wiring chain has no `.catch()` and drops the `start()` promise — silent failure with no debugLog on any rejection — RESOLVED

**File:** `src/entrypoints/sidepanel/main.tsx:102-106` · `src/entrypoints/standalone/main.tsx:97-101`

**Issue:**

```ts
const workspaceInit = useWorkspaceStore.getState().init();
void workspaceInit.then(() => {
  useWorkspaceStore.getState().start('sidepanel'); // promise dropped, not awaited
  workspaceSync.start();
});
```

Today `init()` and `start()` cannot reject (both swallow storage errors internally), so nothing is broken *today* — but the chain has no `.catch()`, and the inner `start()` promise is neither awaited nor `.catch()`-ed. A future regression that makes either reject (e.g., a thrown `set()` or an unguarded storage call) would produce: (1) an unhandled promise rejection, (2) a workspace that never activates, (3) **no debugLog entry** — violating Golden Rule 9 ("every catch calls debugLog; no error without evidence") exactly on the code path that makes the workspace feature live.

**Fix:**

```ts
void workspaceInit
  .then(() => {
    void useWorkspaceStore.getState().start('sidepanel').catch((err: unknown) => {
      debugLog(ERROR_CODES.WORKSPACE_START, 'workspace start failed at mount', {
        error: err instanceof Error ? err : undefined,
        module: 'WorkspaceStore',
      });
    });
    workspaceSync.start();
  })
  .catch((err: unknown) => {
    debugLog(ERROR_CODES.WORKSPACE_INIT, 'workspace init failed at mount', {
      error: err instanceof Error ? err : undefined,
      module: 'WorkspaceStore',
    });
  });
```

**Status: RESOLVED** (2026-08-08, fix commit `fa9c781`). Both entrypoints now wrap the mount chain exactly as above: the inner `start()` promise is `void`-ed with its own `.catch` (canonical `WORKSPACE_START`, `error: err instanceof Error ? err : undefined`, `module: 'WorkspaceStore'`) and the outer chain has a `.catch` for init rejection (canonical `WORKSPACE_INIT`, same extra shape) — Golden Rule 9 restored on the path that makes the workspace feature live. `debugLog`/`ERROR_CODES` imported in both entrypoints. `tsc --noEmit` clean; `tests/entrypoints` 11/11 green.

### WR-12: Module-scope `workspaceSync` ref is never stopped — `stop()` unreachable; HMR re-evaluation double-instantiates and leaks subscriptions — RESOLVED

**File:** `src/entrypoints/sidepanel/main.tsx:99` · `src/entrypoints/standalone/main.tsx:94`

**Issue:** The header comments and the plan say the ref is "held for stop()", but (a) the `const workspaceSync` is declared **inside** the `if (typeof document !== 'undefined')` block, so no other code can reach it to call `stop()` — the ref is held in the sense of being scoped, not in the sense of being *available* for teardown; (b) nothing anywhere calls `WorkspaceSync.stop()`, `useWorkspaceStore.getState().stop()`, or `broadcastBus.stopHeartbeat()` — there is no `pagehide`/`beforeunload`/unmount hook; (c) on WXT dev HMR, a module re-evaluation re-runs the block: a **second** `WorkspaceSync` is constructed and `.start()`ed while the first instance's `broadcastBus.on(WORKSPACE_UPDATED)`, store `subscribe`, and bridge `subscribe` registrations remain active (only the heartbeat timer is safe, because `startHeartbeat` is stop-first). Each HMR cycle stacks duplicate snapshot publishers and duplicate WORKSPACE_UPDATED handlers. Production page loads are unaffected (each load is a fresh context), but the "held for stop()" claim in the source is currently false.

**Fix:** Hoist the ref to true module scope (outside the `if` block) and register a teardown hook, e.g.:

```ts
let workspaceSync: WorkspaceSync | null = null;
if (typeof document !== 'undefined') {
  ...
  workspaceSync = new WorkspaceSync('sidepanel');
  void workspaceInit.then(() => { ...; workspaceSync?.start(); });
}
window.addEventListener('pagehide', () => {
  workspaceSync?.stop();
  workspaceSync = null;
  useWorkspaceStore.getState().stop();
});
```

**Status: RESOLVED** (2026-08-08, fix commit `ff952b7`). Both entrypoints hoist the ref to true module scope (`let workspaceSync: WorkspaceSync | null = null` outside the `typeof document !== 'undefined'` guard), assign it inside the guard, start via `workspaceSync?.start()`, and register a `pagehide` listener that calls `workspaceSync.stop()` (which itself stops the heartbeat via `broadcastBus.stopHeartbeat()` and unsubscribes bus/store/bridge), nulls the ref, and calls `useWorkspaceStore.getState().stop()` to detach the store's onChanged listener — no second instance survives an HMR re-evaluation. The "held for stop()" claim in the source is now true. `tsc --noEmit` clean; `tests/entrypoints` 11/11 green.

### WR-13: LWW lower/equal rejection branch is now untested — stale fixture is rejected by the scope gate first — RESOLVED

**File:** `tests/core/workspace/WorkspaceSync.test.ts:146-161`

**Issue:** The retained "a lower/equal remote version is ignored (LWW)" test sends `freshWorkspace({ workspaceId: 'ws-stale', version: 0, updatedAt: 100 })` while the local store (set in `beforeEach`) has `workspaceId: 'ws-local'`. Under the new scope gate, this payload is rejected **before** the LWW check (`sanitized.workspaceId !== local.workspaceId`), so the test passes for the wrong reason — it exercises the foreign-workspace gate, not the `version <= local.version` branch. The LWW-rejection branch in `handleRemoteUpdate` (WorkspaceSync.ts:232-238) now has **no test with a matching workspaceId**, so a regression that made equal-or-lower same-workspace versions adopt would go undetected.

**Fix:** Use the local workspaceId with an equal/lower version so the LWW branch is actually reached:

```ts
const stale = freshWorkspace({ workspaceId: 'ws-local', version: 0, updatedAt: 100 });
```

(Assertions unchanged — the point is the fixture must pass the scope gate to test what the test name claims.)

**Status: RESOLVED** (2026-08-08, fix commit `5881dce`). The fixture now uses the local `workspaceId: 'ws-local'` (matching the store set in `beforeEach`), so the payload passes the M.3 scope gate and the `version <= local.version` LWW branch is what rejects it — a regression that made equal-or-lower same-workspace versions adopt would now be caught. `tests/core/workspace/WorkspaceSync.test.ts` 9/9 green.

### WR-05: Deep-link to Standalone Options lands on Chat — STILL OPEN (deferred)

**File:** `src/components/OnboardingModal.tsx:32-37` · `src/components/cmdk/CmdKPicker.tsx:58-65` · `src/components/standalone/standaloneNav.ts:23-25` · `src/core/workspace/WorkspaceRouter.ts:71-110`

Carried from the baseline review. The 01-11 plan explicitly defers this to the standalone-nav persistence work. Not addressed by 01-10/01-11.

### WR-06: OptionsPage theme-save error toast is unreachable dead code — STILL OPEN (deferred)

**File:** `src/components/pages/OptionsPage.tsx:26-33` · `src/core/theme/ThemeStore.ts:126-136`

Carried from the baseline review; deferred to the ThemeStore write-path change. Not touched by the gap closure.

### WR-07: `debugLog` writes `options.extra` to console without redaction — STILL OPEN (deferred)

**File:** `src/core/error/debugLog.ts:34`

Carried from the baseline review; explicitly deferred to the security phase that implements real TraceRedactor. The 01-11 rewire added **new** callers that pass `extra` (e.g., ProviderRegistry passes `extra: { providerId }`; BackgroundRouter passes `extra: { type }`), so the deferred redaction gap now has a slightly larger exposure surface — still non-secret data today, but the deferral note should be kept on the security-phase backlog.

## Info

### IN-01: ContentScriptHost registers under `tabId: 0` in production

**File:** `src/entrypoints/core.content.ts:20-22` · `src/core/content/ContentScriptHost.ts:28-32`

Carried from baseline — unchanged by the gap closure; impact nil until Phase 4a extraction lands.

### IN-02: `createStandaloneApp()` export unused at module scope

**File:** `src/entrypoints/standalone/main.tsx:104`

Carried from baseline — the module-scope mount still renders `<StandaloneRoot />` directly (line 104), unlike the side-panel entrypoint which uses `createSidePanelApp()`. Unchanged by 01-10 (the diff only added the wiring above the mount).

### IN-03: `setHighlighted` can transiently reach `-1` when the filter is empty

**File:** `src/components/cmdk/CmdKPicker.tsx:125`

Carried from baseline — unchanged. No crash (Enter is guarded), but clamp to `Math.max(0, …)` for correctness.

### IN-04: Send-failure logged with `MSG_SERIALIZE` code

**File:** `src/core/messaging/MessageBus.ts:54` · `src/core/runtime/BroadcastBus.ts:75`

Carried from baseline. The 01-11 plan explicitly deferred this (error-code registry churn without a spec C.2 update). `CONNECT_FAILED` is the semantically accurate code for a runtime-send rejection.

### IN-05: `ErrorBoundary` uses a raw string error code

**File:** `src/core/components/ErrorBoundary.tsx:30`

Carried from baseline — `debugLog('COMPONENT_RENDER', …)` should reference `ERROR_CODES.COMPONENT_RENDER`. Unchanged.

### IN-06: Silent early return in `handleRemoteUpdate` shape pre-check — no debugLog

**File:** `src/core/workspace/WorkspaceSync.ts:209`

```ts
if (typeof incoming?.state !== 'object' || incoming.state === null) return;
```

This early return logs nothing, while the other two ignore paths (malformed state, foreign workspace) both log `WORKSPACE_SYNC`. Golden Rule 9 formally covers catches, not returns, but the observability contract is inconsistent for the same class of inbound rejection. Suggest logging `WORKSPACE_SYNC` with a `'remote update ignored (bad payload)'` message for consistency.

### IN-07: `BroadcastBus` keeps a private `isEnvelopeShape` duplicate of the shared guard

**File:** `src/core/runtime/BroadcastBus.ts:130-138` vs `src/core/messaging/MessageBus.ts:130-138`

The 01-11 plan's stated goal was "single shared guard predicate … never duplicate this predicate," but only `BackgroundRouter` was migrated to the exported `isRuntimeEnvelopeShape`; `BroadcastBus.dispatchInbound` still uses its own byte-identical private copy. Functionally harmless (same body), but the export-once goal is only half-met. Suggest importing `isRuntimeEnvelopeShape` from MessageBus and deleting the private copy.

### IN-08: Dead `typeof sanitized.version !== 'number'` check in the LWW gate

**File:** `src/core/workspace/WorkspaceSync.ts:232`

`sanitizeStored` (WorkspaceStore.ts:70) already guarantees `version` is a finite number ≥ 0, so `typeof sanitized.version !== 'number'` in the LWW gate is unreachable dead code. Harmless, but it obscures the actual invariant — drop the typeof half of the condition.

---

_Reviewed: 2026-08-08T22:45:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
_Notes: 01-10/01-11 gap-closure review; prior baseline review superseded. WR-01/WR-02/WR-03/WR-04/WR-08/WR-09 verified fixed in source; new findings WR-10…WR-13 and IN-06…IN-08 added; WR-05/WR-06/WR-07 and IN-01…IN-05 carried. Follow-up fix pass (2026-08-08, commits `84509ba`, `fa9c781`, `ff952b7`, `5881dce`) resolved WR-10…WR-13 — see per-finding status blocks; WR-05/WR-06/WR-07 remain deferred and IN-01…IN-08 remain as carried._
