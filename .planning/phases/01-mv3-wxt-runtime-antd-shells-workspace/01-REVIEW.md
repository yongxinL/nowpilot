---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
reviewed: 2026-09-22T11:00:31Z
depth: standard
files_reviewed: 96
files_reviewed_list:
  - .gitignore
  - .output/.gitkeep
  - package.json
  - pnpm-lock.yaml
  - scripts/verify-no-tailwind.sh
  - src/components/common/CommandPalette.tsx
  - src/components/common/DeferredNotice.tsx
  - src/components/common/LegacyCredentialCleanupNotice.tsx
  - src/components/common/ThemeToggle.tsx
  - src/components/history/ChatHistoryModal.tsx
  - src/components/notes/NotesWorkspace.tsx
  - src/components/onboarding/OnboardingFlow.tsx
  - src/components/options/OptionsPage.tsx
  - src/components/options/PromptIcon.tsx
  - src/components/options/PromptsOptionsTab.tsx
  - src/components/pages/AgentPage.tsx
  - src/components/pages/ChatPage.tsx
  - src/components/sidepanel/SidePanelRouter.tsx
  - src/components/sidepanel/SidePanelShell.tsx
  - src/components/standalone/StandaloneRouter.tsx
  - src/components/standalone/StandaloneShell.tsx
  - src/components/standalone/StandaloneWritePage.tsx
  - src/components/standalone/ToolsGridPanel.tsx
  - src/components/standalone/WriteHistoryDrawer.tsx
  - src/components/standalone/WriteInputPanel.tsx
  - src/components/standalone/WriteOutputPanel.tsx
  - src/core/commands/CommandRegistry.ts
  - src/core/commands/registerWorkspaceCommands.ts
  - src/core/components/ErrorBoundary.tsx
  - src/core/i18n/strings.ts
  - src/core/input/KeymapRegistry.ts
  - src/core/messaging/BackgroundRouter.ts
  - src/core/messaging/MessageBus.ts
  - src/core/onboarding/onboardingStateStore.ts
  - src/core/onboarding/useOnboardingGate.ts
  - src/core/runtime/OperationId.ts
  - src/core/runtime/RuntimeEnvelope.ts
  - src/core/runtime/RuntimeEnvelopeValidation.ts
  - src/core/storage/legacyCredentialCleanup.ts
  - src/core/theme/ThemeConfig.ts
  - src/core/theme/ThemeStore.ts
  - src/core/theme/ThemeSync.ts
  - src/core/theme/antdConfig.ts
  - src/core/workspace/WorkspaceRouter.ts
  - src/core/workspace/WorkspaceState.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/core/workspace/handoff/protocol.ts
  - src/core/workspace/handoff/useWorkspaceHandoff.ts
  - src/core/workspace/legacyWorkspaceBlob.ts
  - src/entrypoints/background.ts
  - src/entrypoints/content/core.content.ts
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - src/services/fixtures/providerValidationFixtures.ts
  - src/services/ports/credentialStorePort.ts
  - src/services/ports/providerValidationPort.ts
  - src/store/useExtensionStore.ts
  - src/types/index.ts
  - tests/background/background-router.test.ts
  - tests/background/legacy-credential-cleanup-wiring.test.ts
  - tests/background/message-bus-cold-start.test.ts
  - tests/components/CommandPalette.test.tsx
  - tests/components/DeferredNotice.test.tsx
  - tests/components/LegacyCredentialCleanupNotice.test.tsx
  - tests/components/OnboardingFlow.test.tsx
  - tests/components/SidePanelShell.test.tsx
  - tests/components/StandaloneShell.test.tsx
  - tests/components/pages/agent-page.test.tsx
  - tests/components/pages/chat-page.test.tsx
  - tests/components/pages/history-modal.test.tsx
  - tests/components/pages/notes-page.test.tsx
  - tests/components/pages/options-page.test.tsx
  - tests/components/pages/tools-page.test.tsx
  - tests/components/pages/write-page.test.tsx
  - tests/core/commands/CommandRegistry.test.ts
  - tests/core/commands/registerWorkspaceCommands.test.ts
  - tests/core/i18n/strings.test.ts
  - tests/core/input/KeymapRegistry.test.ts
  - tests/core/onboarding/onboardingStateStore.test.ts
  - tests/core/runtime/RuntimeEnvelope.test.ts
  - tests/core/storage/legacyCredentialCleanup.test.ts
  - tests/core/store/useExtensionStore.test.ts
  - tests/core/strict/np-strict-ceiling.test.ts
  - tests/core/theme/ThemeStore.test.ts
  - tests/core/theme/ThemeSync.test.tsx
  - tests/core/theme/antdConfig.test.ts
  - tests/core/workspace/WorkspaceHandoff.test.ts
  - tests/core/workspace/WorkspaceRouter.test.ts
  - tests/core/workspace/WorkspaceState.test.ts
  - tests/core/workspace/WorkspaceStore.test.ts
  - tests/isolation/banned-imports.test.ts
  - tests/isolation/cross-entrypoint-imports.test.ts
  - tests/isolation/generated-manifest.test.ts
  - tests/services/providerValidationFixtures.test.ts
  - tsconfig.json
  - vitest.config.ts
  - wxt.config.ts
findings:
  critical: 3
  warning: 7
  info: 5
  total: 15
  blocker: 3
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-22T11:00:31Z
**Depth:** standard
**Files Reviewed:** 96
**Status:** issues_found

## Summary

Phase 1 (MV3/WXT runtime, AntD shells, workspace handoff, legacy-data cleanup) was reviewed at standard depth against the 96 files in scope, with targeted probes against the real modules for every high-severity claim. Baseline state: `tsc --noEmit` exits 0 and the full suite passes (40 files / 513 tests). Three critical defects were found; all three are invisible to the current suite, and each has a named test-gap that explains why (below).

What held up under adversarial reading (checked, not assumed): the `sender.id === chrome.runtime.id` guard on the message listener with fail-closed, no-response branches; the legacy credential cleanup's field-name-only report and logs (no value, length, prefix or digest is ever produced or logged) with an in-place, version-stamped, throw-free migration; the content-script exclusion (the built `.output/chrome-mv3/manifest.json` carries no `content_scripts` key and the declared match set equals the authorised host set); the onboarding credential held in component state only and cleared on every terminal path; and the hand-written manifest/CSP/permission assertions.

The critical findings are: (1) a prototype-chain key passed as an envelope `type` crashes `validateEnvelope` with an uncaught `TypeError` inside the service-worker message listener; (2) the workspace handoff protocol — the phase's central D-13 deliverable — can never complete, because `BroadcastBus.publish` decorates every payload with `_sender` and the new strict handoff schemas reject the extra field on the receiving side (proven with a probe against the real transport); (3) the Notes page crashes to the ErrorBoundary when the user deletes the last note. Seven warnings and five info items follow.

## Narrative Findings (AI reviewer)

All findings below are narrative findings from direct code review; no structural pre-pass was provided for this review.

## Critical Issues

### CR-01: A prototype-chain key as `type` throws inside envelope validation (uncaught in the message listener)

**File:** `src/core/runtime/RuntimeEnvelopeValidation.ts:177-187` (manifesting at `:230`)
**Issue:** `isKnownEnvelopeType` and `schemaForType` use the `in` operator against object literals:

```ts
function schemaForType(type: EnvelopeType): z.ZodType {
  if (type in payloadSchemas) return payloadSchemas[type as MessageTypeValue];   // :178
  return scaffoldPayloadSchemas[type as ScaffoldMessageTypeValue];
}
function isKnownEnvelopeType(type: unknown): type is EnvelopeType {
  return typeof type === 'string' &&
    (type in payloadSchemas || type in scaffoldPayloadSchemas);                   // :185
}
```

`in` walks the prototype chain, and `Object.prototype` contributes `toString`, `constructor`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, … So a message whose `type` is `'toString'` (or `'constructor'`, `'valueOf'`, …) passes `isKnownEnvelopeType`, and `schemaForType('toString')` returns `Object.prototype.toString` — then `:230` calls `.safeParse(...)` on a function and throws `TypeError: payloadSchemas.toString.safeParse is not a function`.

That throw escapes `validateEnvelope` and then escapes the `chrome.runtime.onMessage` listener in `MessageBus.init()` (`src/core/messaging/MessageBus.ts:86-114`), which has no try/catch around the guard/validation calls — so it surfaces as an uncaught error in the MV3 service worker (and rejects `MessageBus.dispatch()` for programmatic callers). Reachable from any same-extension context that can `sendMessage` (an extension page, or the content script relaying page-controlled data) — the `sender.id` guard admits those contexts; this is a validation defect, not an authorisation bypass.

Proven:

```
$ node -e "…payloadSchemas['toString'].safeParse({})…"
toString in payloadSchemas: true
typeof payloadSchemas['toString']: function
THROWS: TypeError payloadSchemas.toString.safeParse is not a function
```

Test gap: `tests/core/runtime/RuntimeEnvelope.test.ts:114-118` covers only `'NOT_A_TYPE'`, not a prototype key.

**Fix:** Use own-property checks (and make the lookup total):

```ts
const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function schemaForType(type: EnvelopeType): z.ZodType {
  if (hasOwn(payloadSchemas, type)) return payloadSchemas[type as MessageTypeValue];
  if (hasOwn(scaffoldPayloadSchemas, type)) return scaffoldPayloadSchemas[type as ScaffoldMessageTypeValue];
  throw new Error('ENVELOPE_UNKNOWN_TYPE'); // unreachable: callers check first
}
function isKnownEnvelopeType(type: unknown): type is EnvelopeType {
  return typeof type === 'string' &&
    (hasOwn(payloadSchemas, type) || hasOwn(scaffoldPayloadSchemas, type));
}
```

Add a regression case to `RuntimeEnvelope.test.ts` asserting `validateEnvelope({ type: 'toString', … })` returns `{ ok: false, error: 'ENVELOPE_UNKNOWN_TYPE' }` instead of throwing (same for `'constructor'`), and a `MessageBus` case asserting the listener does not throw for such a message.

### CR-02: The workspace handoff can never complete — `BroadcastBus` adds `_sender` and the strict handoff schemas reject it

**File:** `src/core/runtime/BroadcastBus.ts:55-62` (publish) with `src/core/workspace/handoff/protocol.ts:122-173` (strict schemas), `:225-232` (transport), `:509-538` and `:672-709` (listeners)
**Issue:** `BroadcastBus.publish` decorates every object payload with its own echo-suppression field, and the receiving side validates the decorated object:

```ts
// BroadcastBus.ts:57-61
const envelope = payload && typeof payload === 'object' ? { ...payload, _sender: INSTANCE_ID } : payload;
entry.bc.postMessage(envelope);
```

`handoffTransport.subscribe` hands the raw `event.data` to the protocol's listener (`protocol.ts:229-231`), and every handoff schema is `.strict()` (`readySchema`/`transferSchema`/`ackSchema`). `_sender` is an unrecognised key, so `validateHandoffEnvelope` returns `{ ok: false, code: 'invalid_shape' }` and the listener returns without acting (`protocol.ts:510-511`, `:673-674`).

Consequence in the real extension (source and target are separate documents, so the instance filter never suppresses a peer message): the target's `HANDOFF_READY` is discarded by the source, the source's 3 s ready wait expires, and every handoff resolves `WORKSPACE_HANDOFF_FAILED` — the Side Panel shows `standalone.openFailed` + Retry, and no projection is ever applied on the standalone side. The READY/ACK/transfer path is dead in production.

Proven against the real transport (not the test double):

```
received: [{"type":"HANDOFF_READY",…,"supportedSchemaVersion":1,"_sender":"dc6f93d3-…"}]
target-side validation: {"ok":false,"code":"invalid_shape"}
```

Test gap (this is why the phase is green): every inbound handoff message in `tests/core/workspace/WorkspaceHandoff.test.ts` and `tests/core/workspace/WorkspaceRouter.test.ts` is injected with the `__broadcast` helper (`tests/setup.ts`), which posts the payload *without* the `_sender` decoration. Nothing in the suite ever validates what `BroadcastBus.publish` actually emits, and the harness's `BroadcastChannel` mock never self-delivers, so an in-process source→target round trip through the real bus is impossible as written.

Note for the acceptance record: `01-VALIDATION.md`'s "Standalone handoff … the composer draft typed in the panel arrived in Standalone" is not reproducible from the code (see WR-07: the caller never passes a draft and the target's `apply` never consumes one), so that manual row should be re-observed after this fix rather than treated as evidence that the handshake completes.

**Fix:** Keep transport metadata out of the validated envelope, e.g. strip it in the handoff transport adapter:

```ts
export const handoffTransport: HandoffTransport = {
  publish(envelope) { publish(HANDOFF_CHANNEL, envelope); },
  subscribe(listener) {
    return subscribe(HANDOFF_CHANNEL, (payload) => {
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const { _sender: _transportField, ...envelope } = payload as Record<string, unknown>;
        listener(envelope);
        return;
      }
      listener(payload);
    });
  },
};
```

Longer term, move the echo suppression out of the payload (a `Symbol`-keyed field, a wrapper, or `bc.postMessage` plus an explicit sender id in a separate channel), so a payload the app owns is never mutated by the transport. Add a regression test that drives `handoffTransport.publish` (real implementation, no spy) into a second subscription and asserts the projection is applied and acknowledged.

### CR-03: The Notes page crashes when the last note is deleted

**File:** `src/components/notes/NotesWorkspace.tsx:230` (dereferenced at `:1515`, `:1517`, `:2077`, `:2346`, `:2411`, …; delete paths at `:207` / `:290-310` / `:1314-1318`)
**Issue:** The selected note is resolved with an unguarded array fallback:

```ts
const selectedNote = notes.find(n => n.id === selectedNoteId) || notes[0];   // :230
```

Both delete paths (`deleteNote` from the card hover `Popconfirm` and from the more-menu's `Delete Note`) can empty the five-note fixture list. When `notes` is `[]`, `selectedNote` is `undefined` and the main panel dereferences it during render (`selectedNote.title`, `selectedNote.isFavorite`, `selectedNote.content.sections.map`, `selectedNote.wordCount.toLocaleString()`), throwing a `TypeError` that unmounts the page to the `ErrorBoundary` fallback (`shell.errorTitle`) with no way back except a reload. The Notes route is reachable from the Standalone Sider, so this is user-reachable.

Test gap: `tests/components/pages/notes-page.test.tsx` never deletes a note (it only asserts the populated fixture state), so the empty-list branch is untested.

**Fix:** Make the selection nullable and render an explicit empty state:

```tsx
const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? notes[0] ?? null;
// …main panel:
{selectedNote === null ? (
  <div data-testid="np-page-notes-empty" style={{ padding: token.paddingLG }}>
    <Typography.Text type="secondary">No notes yet — create one to get started.</Typography.Text>
  </div>
) : (
  /* existing header / sub-meta / sections / inspector, all reading selectedNote */
)}
```

Keep the `moreMenuProps` handler guarded too (`if (!selectedNote) return;`), and add a test that deletes every note and asserts the empty state renders instead of the error fallback.

## Warnings

### WR-01: `verify-no-tailwind.sh` is blind to `className={variable}` and bare utilities; three live Tailwind class strings ship in `src/`

**File:** `scripts/verify-no-tailwind.sh:25-29`; leaks at `src/components/notes/NotesWorkspace.tsx:1030,1060,2214,2235` and `src/components/standalone/WriteHistoryDrawer.tsx:313`; Tailwind-shaped data at `src/core/theme/ThemeConfig.ts:30`
**Issue:** Both grep patterns require the utility token to appear *inside* the `className="…"` literal or immediately after `className={` on the same line. Class strings held in variables therefore pass, and the gate reports success while three Tailwind utility strings are rendered:

- `NotesWorkspace.tsx:1030` → `{ name: 'ServiceNow', color: 'text-emerald-500' }` rendered at `:1060` as `className={tag.color}` (also `text-blue-500`, `text-red-500`, `text-sky-500`, `text-indigo-500`, `text-cyan-500`)
- `NotesWorkspace.tsx:2214` → `color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'` rendered at `:2235` as `className={rel.color}`
- `WriteHistoryDrawer.tsx:313` → `className="group"` (bare utility, absent from the token list)
- `ThemeConfig.ts:30` → `previewGradient: 'from-[#cc6b49] to-[#da7756]'` (Tailwind-shaped value, currently unconsumed)

Spec §0.2 forbids Tailwind, and the phase's own gate claims total coverage. The classes are inert (no Tailwind CSS is loaded), so the visible effect is unstyled elements plus a false green gate. Reproduced: `bash scripts/verify-no-tailwind.sh` → `✓ verify-no-tailwind: 0 Tailwind className strings in src/`.

**Fix:** Either move these strings to AntD tokens (the surrounding code already has `token.colorSuccess` etc. available) and delete the `className` usage, or make the gate match values rather than attribute syntax — scan every string literal in `src/**/*.{ts,tsx}` for the utility vocabulary (`(^|\s)(text|bg|border|shadow|rounded|flex|grid|w|h|p|m|gap)-`, plus bare `group`/`peer`), with a self-test case that fails on `className={variable}` whose value is a Tailwind token.

### WR-02: A malformed `np_store` blob is silently discarded during hydration and then overwritten with defaults

**File:** `src/store/useExtensionStore.ts:543-552` (merge) and `:632-658` (`npStoreMigrate`)
**Issue:** `npStoreMigrate` copies the allowlisted fields *without type validation*, and `merge` then trusts their shapes:

```ts
const merged = { ...current, ...(persisted as Partial<ExtensionState>) };
merged.config = { ...current.config, ...merged.config };
merged.activeSession = computeActiveSession(merged.sessions, merged.activeSessionId);   // :548
```

With `sessions` not an array, `computeActiveSession` calls `sessions.find(...)` and throws; zustand's persist catches it inside `hydrate()` and reports it only through `onRehydrateStorage`, which this config does not define. The store therefore stays at module defaults and the failure is completely silent — and because `partialize` writes the state back on the next mutation, the corrupt-but-possibly-recoverable blob is replaced by defaults.

Proven (probe with `np_store = {state: {sessions: 5, prompts: 'nope', notes: {a: 1}, config: {providers: 'nope'}}, version: 2}`):

```
sessions after hydration => []
prompts  after hydration => [ …the default fixture prompt list… ]
console.error calls => []
console.warn  calls => []
```

This contradicts the module's documented property ("a malformed blob can never throw during hydration"). Trigger is a corrupt/older blob rather than an attacker (only the extension writes `chrome.storage.local`), hence Warning rather than Critical — but the outcome is silent loss of all persisted sessions/prompts/notes/settings.

**Fix:** Normalise types in the migration and report a failure:

```ts
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
// blob.sessions = asArray(blob.sessions); blob.prompts = asArray(blob.prompts);
// blob.writeHistory = asArray(blob.writeHistory); blob.notes = asArray(blob.notes);
// blob.activeSessionId = typeof blob.activeSessionId === 'string' ? blob.activeSessionId : '';
```
and add `onRehydrateStorage: () => (_state, error) => { if (error) debugLog('NP_STORE_REHYDRATE_FAILED', String(error)); }` so a future shape regression is at least visible.

### WR-03: `themeMigrate` does not validate `mode`/`pack`, so a corrupt `np_theme` blob injects a non-union mode

**File:** `src/core/theme/ThemeStore.ts:42-53` (compare `isThemeMode` at `src/core/theme/ThemeConfig.ts:50`; consumers at `src/core/theme/antdConfig.ts:89` and `src/components/options/OptionsPage.tsx:812-818`)
**Issue:** `themeMigrate` returns `{ ...defaults, ...(persisted as Partial<ThemePersisted>) }` — an unvalidated cast, in the module whose own guard function exists to prevent exactly that. A corrupt/legacy blob with `mode: 'purple'` (or a number, or `pack: 7`) rehydrates straight into the store: `getAntdConfig` treats any non-`'auto'` value as resolved and falls back to `light`, `applyThemeDom` never matches `'dark'`/`'auto'`, the Options "Display mode" select renders "Auto" while the store holds garbage, and `cycleThemeMode` (`:158-164`) jumps to `auto` because `indexOf` misses. The onChanged reader (`ThemeSync.readThemeValue`) does narrow correctly, so the rehydrate path is the only hole — and it is the path a prototype's blob takes.

**Fix:** Narrow inside the migration instead of casting:

```ts
const isMode = (v: unknown): v is ThemeMode => v === 'auto' || v === 'light' || v === 'dark';
const isString = (v: unknown): v is string => typeof v === 'string';
// …
return {
  mode: isMode(p.mode) ? p.mode : defaults.mode,
  colorTheme: isString(p.colorTheme) ? p.colorTheme : defaults.colorTheme,
  pack: isString(p.pack) ? p.pack : defaults.pack,
};
```

### WR-04: The Options page asserts a false credential-storage claim

**File:** `src/components/options/OptionsPage.tsx:647`
**Issue:** Under the Custom-API-Key branch the page renders `"Your API key is stored locally in your browser and is never sent elsewhere."` In Phase 1 there is no credential storage at all (D-08: component memory only) and D-07's cleanup destroys the prototype's plaintext keys — so the sentence is false, it contradicts the phase's own `provider.credentialsCleared` copy, and it fabricates a security property on a fixture page (marking convention hard rule 3). A user reading it would believe a key is stored and safe when the release explicitly stores nothing.

**Fix:** Replace it with the marked/neutral copy already pinned for this release (e.g. render the `deferred.reasonFixture` sentence, or `provider.credentialsCleared`), or delete the sentence until Phase 2 ships secure credential storage and can truthfully make a claim.

### WR-05: The Standalone top-bar Back button is enabled, inert and unmarked

**File:** `src/components/standalone/StandaloneShell.tsx:254-259`
**Issue:**

```tsx
<Button type="text" aria-label={t('common.back')} icon={<LeftOutlined />} style={{ color: token.colorTextSecondary }} />
```

No `onClick`, not `disabled`, no `data-np-backing` marker — an enabled control that does nothing, which the phase's own marking convention rule 1 forbids ("No present-but-inert control may appear enabled and functional"). `tests/components/StandaloneShell.test.tsx` asserts the rule for the add-on entries but never for this control, so it slipped through.

**Fix:** Remove the button, or render it `disabled` with `data-np-backing="deferred"` and a tooltip naming the owning phase; add the assertion to the shell suite.

### WR-06: `openOptions` dedupes with a query string inside a match pattern — the focus-existing branch cannot behave as intended

**File:** `src/core/workspace/WorkspaceRouter.ts:215` (compare the correct shape at `:105`)
**Issue:**

```ts
chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html?page=options*') }, (tabs) => {
```

`chrome.tabs.query` URL patterns are matched against the tab URL's *path*; a query string is not part of that comparison. Either the `?page=options*` suffix never matches a real tab URL (the focus branch is dead and every `Open Options` creates a duplicate tab — the exact duplication D-12 forbids), or the query is dropped and the pattern matches *every* Standalone tab, so `Open Options` would focus a Chat/Write tab instead of the Options route. Both outcomes are wrong; `openStandalone`'s `standalone.html*` pattern at `:105` is correctly written without a query.

**Fix:** Query by path and compare the route in the callback:

```ts
chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }, (tabs) => {
  if (chrome.runtime.lastError) { /* …unchanged… */ }
  const existing = tabs.find((tab) => {
    try { return new URL(tab.url ?? '').searchParams.get('page') === 'options'; }
    catch { return false; }
  });
  // focus `existing` when found, otherwise create
```

Then cover it in real Chrome during the acceptance re-run (this row was never manually observed for the Options route) and add a unit case whose stubbed tab URL carries `?page=options`.

### WR-07: The handoff's `composerDraft` is transported but never consumed, and the only caller never supplies it

**File:** `src/core/workspace/handoff/protocol.ts:79,129,577`; `src/core/workspace/WorkspaceRouter.ts:29,176,278-283`; caller `src/entrypoints/sidepanel/main.tsx:73`
**Issue:** `openStandalone` accepts `opts.composerDraft`, and the initiator copies it into the projection (`protocol.ts:577`), but the Side Panel caller passes only `{ onSettled }` — no draft — and the target's `apply` adapter writes only `workspaceId`, `conversationId` and `activeSurface`:

```ts
apply: (projection) => {
  const state = useWorkspaceStore.getState();
  state.setWorkspaceId(projection.workspaceId);
  state.setConversationId(projection.conversationId);
  state.setActiveSurface('standalone');
},   // WorkspaceRouter.ts:278-283 — projection.composerDraft is dropped
```

So the D-13 draft-carrying element is a validated-but-dead data path: even with CR-02 fixed, no draft could reach the Standalone surface, which also means the acceptance record's draft-arrival observation is not reproducible from the shipped code.

**Fix:** Decide the contract explicitly. Either wire it end to end (pass the shell's draft into `openStandalone`, and route `projection.composerDraft` into the Standalone composer state in `apply`, bounded by `HANDOFF_DRAFT_MAX_CHARS`), or remove `composerDraft` from `HandoffUrlInput`/`HandoffInitiatorRequest`/`Phase1HandoffProjection` and from the acceptance record, so no surface claims a transfer that does not happen.

## Info

### IN-01: Production `console.log` in the background entrypoint

**File:** `src/entrypoints/background.ts:12`
**Issue:** `console.log('NowPilot Background Service Worker initialized')` bypasses `debugLog` (the repository's structured, redaction-friendly logger used everywhere else) and ships in the production bundle.
**Fix:** Delete it, or `debugLog('BG_INITIALIZED', 'Background service worker initialized')`.

### IN-02: Fabricated success toasts on fixture pages

**File:** `src/components/options/OptionsPage.tsx:367` (`'Help Center opened'`), `:1095` (`'Opened browser settings'`), `src/components/standalone/StandaloneWritePage.tsx:456` (`'Feedback support channel opened'`)
**Issue:** Each reports that something happened while nothing does — the marking convention's hard rule 3 ("no fabricated signal") in its plainest form; the Sider tests enforce the rule for controls but these toasts are unasserted.
**Fix:** Replace with the deferred/fixture notice text, or mark the controls `disabled` + `data-np-backing="deferred"` and drop the toast.

### IN-03: Unused store bindings in the Options page

**File:** `src/components/options/OptionsPage.tsx:106`
**Issue:** `const { config, updateConfig, prompts, addPrompt, updatePrompt, deletePrompt } = useExtensionStore();` — `prompts` and `deletePrompt` are never used (the page keeps its own fixture list), and the whole-store destructure re-renders the page on every unrelated store change.
**Fix:** Destructure only `config` and `updateConfig` (or select them individually) and drop the dead bindings.

### IN-04: Fabricated / mismatched timestamps in the history surfaces

**File:** `src/components/history/ChatHistoryModal.tsx:83-87`, `src/components/standalone/WriteHistoryDrawer.tsx:356-361`
**Issue:** `formatSessionTime` returns a hardcoded `'11:20 AM'` when a session has no timestamp (a synthetic value presented as user data); the write-history drawer renders `createdAt: 0` fixtures through `toLocaleDateString(..., { hour, minute })` — `toLocaleDateString` ignores time options, so the intended time never renders.
**Fix:** Render an explicit unknown/relative label instead of a fabricated time, and use `toLocaleString` (or a fixed fixture date) where the hour/minute are intended.

### IN-05: Hardcoded user-visible strings outside `t()` on preserved pages

**File:** `src/components/standalone/StandaloneShell.tsx:37` (`SIDER_ADDONS_GROUP_LABEL = 'Add-ons'`); the same pattern is pervasive in `src/components/notes/NotesWorkspace.tsx` (`'New Note'`, `'Directory'`, `'Notes'`, `'Inspector'`, `'All Notes'`, …), `src/components/options/OptionsPage.tsx` and `src/components/history/ChatHistoryModal.tsx`
**Issue:** `src/core/i18n/strings.ts` states every user-visible Phase-1 string resolves through `t()`; these reachable surfaces (plus the add-on group label, which is asserted inside `t('…')`-based suites) bypass the map, so a copy change or a locale would miss them.
**Fix:** Move the strings that Phase 1 actually renders into `strings.ts` and resolve them through `t()`; for the preserved fixture pages, record the exception explicitly rather than leaving the contract partially enforced.

---

_Reviewed: 2026-09-22T11:00:31Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
