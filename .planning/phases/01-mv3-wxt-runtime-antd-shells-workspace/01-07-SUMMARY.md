---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 07
subsystem: registry, content, runtime, isolation
tags: [registry, wspc-04, addon, content-script, page-context, pagecontextbridge, isolated-world, bundle-isolation, zustand, wxt]

# Dependency graph
requires:
  - phase: 01-02
    provides: PageContext/TabContext types (src/core/content/PageContext.ts, canonical R-1 home), MessageType + D-17 values (PING/PONG/GET_CONTENT_CAPABILITIES/CONTENT_CAPABILITIES), RuntimeEnvelope + ResponseEnvelope
  - phase: 01-03
    provides: MessageBusBridge (7-method bridge, R-4 choke point) + MessageBus whitelist (Pitfall 5)
  - phase: 01-04
    provides: debugLog + ERROR_CODES canonical §C.2 codes (REGISTRY_INIT, CONTENT_CAPABILITIES)
  - phase: 01-06
    provides: chrome.storage.local adapter pattern (np_* keys, onChanged remove-then-add) reused by AddonSettingsStore
provides:
  - Full §18 registry set: Registry (generic WSPC-04 base, idempotent synchronous Map ops), AddonRegistry (AddonEntry §8.6 base shape, zero add-ons Phase 1), AddonSettingsStore (np_addon_settings zustand store, no storage middleware), SidePanelPageRegistry (Chat/Agent/Notes singleton), StandalonePageRegistry (Chat/Agent/Notes/Options singleton)
  - Content-side PageRegistry (tab-keyed Map<number, PageContext>) — W-7 reconciliation: phase-owned, NOT in §18 create list
  - ContentScriptHost + PageContextBridge (D-16/D-17): extraction-only content skeleton, single bridge message path, PONG ResponseEnvelope replies, capabilities handshake with 3s timeout
  - src/entrypoints/core.content.ts: ISOLATED-world all-URLs content entry (W-7 path reconciliation — wxt 0.19.29 globs only discover *.content.ts at the entrypoints root)
  - check-content-bundle.mjs upgraded to the W-16 token set — content bundle provably UI-lib-free (1 bundle, clean)
affects: [01-08 (shells consume the page registries for nav + ProviderRegistry D-07 gate), 01-09 (verify:phase-1 with content bundle now meaningful), Phase 8 (full addon manifest on AddonEntry), Phase 4a (real extraction on ContentScriptHost)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WSPC-04 registry: generic Registry<T extends {id: string}> base — idempotent register (replace atomically, REGISTRY_INIT silent:true), synchronous Map ops (concurrency-safe by construction), never throws (invalid entries logged + skipped)"
    - "Cross-surface durability for settings: plain zustand store + chrome.storage.local write-through adapter (np_addon_settings) + onChanged foreign-write merge — NEVER zustand storage middleware (Pitfall 7)"
    - "Content-bridge single message path: PageContextBridge wraps MessageBusBridge; content code never touches chrome APIs directly (D-16); replies are ResponseEnvelopes, never mutated request envelopes"
    - "Lazy component keys: PageRegistration.component is a string key resolved by the 01-08 shells — registries stay UI-free (no React imports, Pitfall 4)"
    - "Bounded capabilities handshake: single setTimeout (3s) always cleared on resolve (T-1-14); reply validated against ContentCapabilities shape (T-1-16)"

key-files:
  created:
    - src/core/registry/Registry.ts
    - src/core/registry/AddonRegistry.ts
    - src/core/registry/AddonSettingsStore.ts
    - src/core/registry/PageRegistry.ts
    - src/core/registry/SidePanelPageRegistry.ts
    - src/core/registry/StandalonePageRegistry.ts
    - src/core/content/PageContextBridge.ts
    - src/core/content/ContentScriptHost.ts
    - src/entrypoints/core.content.ts
    - tests/core/registry/AddonRegistry.test.ts
    - tests/core/registry/PageRegistry.test.ts
    - tests/core/content/ContentScriptHost.test.ts
  modified:
    - src/core/error/errorCodes.ts (ADDON_SETTINGS added)
    - tests/isolation/check-content-bundle.mjs (W-16 token set upgrade)
    - .planning/PRODUCT_SPEC_v0_1.md (ADDON_SETTINGS in §C.2 Phase-1 block)

key-decisions:
  - "Content entry path: src/entrypoints/core.content.ts instead of the §18 src/entrypoints/content/core.content.ts — wxt 0.19.29 globs (content.ts | content/index.ts | *.content.ts | *.content/index.ts) do NOT discover the content/ subdirectory spelling; empirically verified (build emits no content_scripts for it). Flat path resolves name 'core' + content-scripts/core.js output exactly as the plan's W-7 note promises. Rule 3."
  - "ADDON_SETTINGS canonical code added to errorCodes.ts + spec Appendix C.2 Phase-1 block — plan contract references it; the 01-02 canonical list lacked it (Rule 2, 01-06 WORKSPACE_SYNC precedent)"
  - "PageRegistry is a tab-keyed Map, NOT a Registry<T extends {id}> extension — PageContext has no stable string id (plan Task 2 explicit; W-7 phase-owned addition)"
  - "Nav page sets registered per the plan Task 2 parenthetical + the 01-08 consumer contract: side panel Chat/Agent/Notes, standalone Chat/Agent/Notes/Options (UI-SPEC §17.8 post-sync moved Agent to a Chat mode — plans were not re-synced; the 01-08 consumer plan still routes Chat/Agent/Notes/Options and builds AgentPage.tsx, so the registry set follows the plan text)"
  - "PONG replies are published PONG RuntimeEnvelopes whose payload is the canonical ResponseEnvelope ({id, ok, data:{pong:true}}) — MessageBus has no sendResponse path, and the plan mandates 'never a mutated request envelope'"

patterns-established:
  - "Registry pattern (WSPC-04): one generic base + typed subclasses + lazy singletons pre-registered with their canonical sets (01-05 ThemePackRegistry precedent)"
  - "Content skeleton contract: ContentScriptHost is the only content runtime; PageContextBridge is the only message path; content bundles import only dependency-free core (enforced by W-16 isolation check)"

requirements-completed: [RUNTIME-05, WSPC-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Registry base + AddonRegistry (WSPC-04) — idempotent register/replace, unregister/get/list/has/clear, invalid-entry skip without throwing; AddonEntry §8.6 base shape; zero add-ons Phase 1"
    requirement: WSPC-04
    verification:
      - kind: unit
        ref: "tests/core/registry/AddonRegistry.test.ts#re-registering the same id is idempotent"
        status: pass
      - kind: unit
        ref: "tests/core/registry/AddonRegistry.test.ts#registering an invalid entry (missing id) logs and skips without throwing"
        status: pass
      - kind: unit
        ref: "tests/core/registry/AddonRegistry.test.ts#starts empty (WSPC-04 — zero add-ons in Phase 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AddonSettingsStore — zustand over np_addon_settings with chrome.storage.local write-through + onChanged foreign-write merge; getSetting fallback; malformed storage never merged; no zustand storage middleware (Pitfall 7: grep persist == 0)"
    requirement: WSPC-04
    verification:
      - kind: unit
        ref: "tests/core/registry/AddonRegistry.test.ts#setSetting writes through to chrome.storage.local np_addon_settings"
        status: pass
      - kind: unit
        ref: "tests/core/registry/AddonRegistry.test.ts#chrome.storage.onChanged foreign write merges into state"
        status: pass
      - kind: unit
        ref: "tests/core/registry/AddonRegistry.test.ts#malformed stored values are never merged raw"
        status: pass
      - kind: other
        ref: "grep -c 'persist' src/core/registry/AddonSettingsStore.ts == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Page registries — PageRegistry tab-keyed Map (upsert/get/remove/list/clear, atomic replace) fed by content scripts; SidePanelPageRegistry (Chat/Agent/Notes) + StandalonePageRegistry (Chat/Agent/Notes/Options) singletons pre-registered, lazy component keys (UI-free)"
    requirement: WSPC-04
    verification:
      - kind: unit
        ref: "tests/core/registry/PageRegistry.test.ts#upserting the same tab replaces the page atomically"
        status: pass
      - kind: unit
        ref: "tests/core/registry/PageRegistry.test.ts#singleton is pre-registered with the UI-SPEC standalone nav set"
        status: pass
      - kind: unit
        ref: "tests/core/registry/PageRegistry.test.ts#invalid registration (empty id) is skipped without throwing"
        status: pass
      - kind: other
        ref: "grep -rn 'class PageRegistry|class SidePanelPageRegistry|class StandalonePageRegistry' src/core/registry/ | wc -l == 3"
        status: pass
    human_judgment: false
  - id: D4
    description: "PageContextBridge (D-16/D-17) — single content message path over MessageBusBridge: publishContext, sendPing, getCapabilities (3s timeout → CONTENT_CAPABILITIES log + default), onMessage, replyPong (ResponseEnvelope), replyCapabilities"
    requirement: RUNTIME-05
    verification:
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#PING replies a PONG ResponseEnvelope"
        status: pass
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#GET_CONTENT_CAPABILITIES roundtrip resolves capabilities"
        status: pass
      - kind: other
        ref: "grep -rn \"from 'react'|from 'antd'|from 'zustand'\" src/core/content/ | wc -l == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "ContentScriptHost — start() wires bridge listener → EXTRACT_PAGE_CONTENT upserts PageRegistry; live PageContext from document.title/URL; NO DOM mutation, NO UI mount (R-5); stop() detaches"
    requirement: RUNTIME-05
    verification:
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#an incoming EXTRACT_PAGE_CONTENT envelope upserts PageRegistry"
        status: pass
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#stop() removes the listener"
        status: pass
      - kind: unit
        ref: "tests/core/content/ContentScriptHost.test.ts#keeps a live PageContext from document title/URL without mutating the DOM"
        status: pass
    human_judgment: false
  - id: D6
    description: "wxt content entry — ISOLATED world, all-URLs, document_idle, starts ContentScriptHost; canonical §18 path reconciled (Rule 3: wxt 0.19.29 discovery), output lands in content-scripts/"
    requirement: RUNTIME-05
    verification:
      - kind: other
        ref: "pnpm wxt build → .output/chrome-mv3/content-scripts/core.js with world ISOLATED in manifest"
        status: pass
      - kind: other
        ref: "grep -c 'defineContentScript|world: ISOLATED' src/entrypoints/core.content.ts == 3 (>= 1)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Bundle isolation enforcement (Pitfall 4/W-16) — check-content-bundle.mjs walks content-scripts/** + content-named chunks, fails on @ant-design/x/@ant-design/x-markdown/antd/React/react/react-dom/defuddle/yaml; built content bundle provably clean"
    requirement: RUNTIME-05
    verification:
      - kind: other
        ref: "pnpm wxt build && node tests/isolation/check-content-bundle.mjs → '1 content bundle(s) clean' exit 0"
        status: pass
      - kind: other
        ref: "grep -c '@ant-design/x|antd|React|react-dom|defuddle|yaml' tests/isolation/check-content-bundle.mjs == 9 (>= 6)"
        status: pass
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#content-script bundle contains no UI/antd/React"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 7: Registry Layer + Content-Script Skeleton Summary

**Full §18 registry set (generic WSPC-04 Registry base + AddonRegistry + AddonSettingsStore + SidePanel/Standalone page registries) plus the tab-keyed content-side PageRegistry, and an extraction-only ISOLATED-world content skeleton (ContentScriptHost + PageContextBridge) with W-16 bundle-isolation enforcement proven against a real 159KB content bundle**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-08T10:44:11Z
- **Completed:** 2026-08-08T10:58:41Z
- **Tasks:** 4
- **Files modified:** 18 (12 created, 6 modified)

## Accomplishments

- **Full §18 registry set (WSPC-04):** `Registry<T extends { id: string }>` is the generic idempotent base (re-register replaces atomically with `REGISTRY_INIT` silent:true; synchronous Map ops — concurrency-safe by construction; invalid entries logged + skipped, never throws). `AddonRegistry extends Registry<AddonEntry>` ships the §8.6 base shape (full manifest lands Phase 8 — stub noted). `SidePanelPageRegistry` (Chat/Agent/Notes) and `StandalonePageRegistry` (Chat/Agent/Notes/Options) extend the same base with lazy singletons pre-registered; `component` is a lazy string key resolved by the 01-08 shells — registry files stay UI-free (no React imports, Pitfall 4).
- **AddonSettingsStore (Pitfall 7-safe):** zustand store over `np_addon_settings` with a 01-06-style `chrome.storage.local` write-through adapter and `chrome.storage.onChanged` foreign-write merge (remove-then-add, T-1-11). No zustand storage middleware anywhere (grep-verified). `ADDON_SETTINGS` added as a canonical §C.2 code (Rule 2 — the plan's contract referenced a code the 01-02 list lacked).
- **Content-side PageRegistry (W-7):** tab-keyed `Map<number, PageContext>` with idempotent `upsert`/`get`/`remove`/`list`/`clear` — a phase-owned addition NOT in the §18 create list (PageContext has no stable id, so it is not a `Registry<T>` extension), consumed by ContentScriptHost for per-tab page tracking.
- **Content skeleton (D-16/D-17):** `PageContextBridge` is the single content message path (wraps 01-03's MessageBusBridge; content code never touches chrome APIs directly). PING replies are published PONG envelopes carrying the canonical ResponseEnvelope `{id, ok, data:{pong:true}}` — never a mutated request envelope. `getCapabilities()` runs the GET_CONTENT_CAPABILITIES handshake with a 3s bounded timeout (T-1-14, always cleared; default `{extraction, domAccess:'isolated'}` on timeout). `ContentScriptHost.start()` wires the bridge listener → EXTRACT_PAGE_CONTENT upserts PageRegistry, keeps a live PageContext from `document.title`/URL — extraction-only, NO DOM mutation, NO UI mount (R-5, T-1-15).
- **ISOLATED-world content entry + meaningful isolation enforcement:** `src/entrypoints/core.content.ts` registers the all-URLs, document_idle, `world: 'ISOLATED'` content script (path reconciled per Rule 3 — see Decisions). `check-content-bundle.mjs` upgraded to the W-16 token set (@ant-design/x, @ant-design/x-markdown, antd, React, react, react-dom, defuddle, yaml) and walks the real `.output/<browser>/content-scripts/**` layout — the built `content-scripts/core.js` (159KB, includes wxt runtime) is provably clean, and the isolation check is now a blocking gate, not a vacuous pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Registry base + AddonRegistry + AddonSettingsStore (WSPC-04 infra)** - `7835668` (feat)
2. **Task 2: Page registries — PageRegistry + SidePanelPageRegistry + StandalonePageRegistry** - `7d2fb8a` (feat)
3. **Task 3: ContentScriptHost + PageContextBridge (D-16 content skeleton)** - `15037b7` (feat)
4. **Task 4: wxt content entry + isolation enforcement upgrade** - `52c5777` (feat)

**Follow-ups:** `757e794` (style: prettier + `document.location.origin` tsc fix), `9166eff` (docs: ADDON_SETTINGS spec §C.2)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `src/core/registry/Registry.ts` - generic WSPC-04 base: idempotent register/unregister/get/list/has/clear, synchronous Map ops, never throws
- `src/core/registry/AddonRegistry.ts` - `extends Registry<AddonEntry>` with §8.6 base shape (full manifest Phase 8); zero add-ons registered
- `src/core/registry/AddonSettingsStore.ts` - zustand over np_addon_settings; chrome.storage.local adapter + onChanged merge; no storage middleware
- `src/core/registry/PageRegistry.ts` - tab-keyed `Map<number, PageContext>` (upsert/get/remove/list/clear); imports PageContext from 01-02 home (R-1)
- `src/core/registry/SidePanelPageRegistry.ts` - Chat/Agent/Notes singleton; PageRegistration with lazy component key
- `src/core/registry/StandalonePageRegistry.ts` - Chat/Agent/Notes/Options singleton; same PageRegistration shape
- `src/core/content/PageContextBridge.ts` - single content message path: publishContext/sendPing/getCapabilities/onMessage/replyPong/replyCapabilities; ContentCapabilities shape
- `src/core/content/ContentScriptHost.ts` - start()/stop() bridge wiring, live PageContext (extraction-only), PING/capabilities handlers
- `src/entrypoints/core.content.ts` - ISOLATED-world all-URLs content entry starting ContentScriptHost
- `tests/core/registry/AddonRegistry.test.ts` - 15 tests (Registry base, AddonRegistry, AddonSettingsStore)
- `tests/core/registry/PageRegistry.test.ts` - 12 tests (PageRegistry contract + both nav singletons)
- `tests/core/content/ContentScriptHost.test.ts` - 6 tests (listener install, EXTRACT upsert, PONG reply, capabilities roundtrip, stop detach, live context)
- `src/core/error/errorCodes.ts` - ADDON_SETTINGS added (Rule 2)
- `tests/isolation/check-content-bundle.mjs` - W-16 token set upgrade + browser-subdirectory-aware bundle walk
- `.planning/PRODUCT_SPEC_v0_1.md` - ADDON_SETTINGS in §C.2 Phase-1 block

## Decisions Made

- **Content entry at `src/entrypoints/core.content.ts` (not the §18 `content/` subdirectory)** — wxt 0.19.29's entrypoint globs (`content.ts` | `content/index.ts` | `*.content.ts` | `*.content/index.ts`) do NOT match `content/core.content.ts`. Verified empirically: a file at the spec path builds with NO content_scripts in the manifest and NO content-scripts output dir; the flat path builds `content-scripts/core.js` with `world: ISOLATED`, exactly the plan's W-7 promise ("content entrypoint name resolves to 'core', output lands in .output content-scripts"). Rule 3 deviation.
- **`ADDON_SETTINGS` canonical code added** to errorCodes.ts + spec Appendix C.2 — the plan's Task 1 contract references it but the 01-02 canonical list lacked it (Rule 2; 01-06 WORKSPACE_SYNC precedent).
- **PageRegistry as tab-keyed Map** — plan Task 2 explicitly: PageContext has no stable string id, so the content-side registry does not extend `Registry<T>`; it is a phase-owned addition (W-7) consumed by ContentScriptHost.
- **Nav page sets follow the plan text + 01-08 consumer** — the UI-SPEC §17.8 post-sync (2026-08-07) moved Agent to a Chat mode and reorganized the standalone Sider, but the 01-07 plan Task 2 parenthetical and the 01-08 consumer plan (same wave) still register/route Chat/Agent/Notes/Options; registered per the plan to keep the consumer contract intact.
- **PONG via published ResponseEnvelope payload** — MessageBus has no sendResponse path; replies are new PONG RuntimeEnvelopes carrying `{id, ok:true, data:{pong:true}}`, satisfying "never a mutated request envelope".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Content entry path not discoverable by wxt 0.19.29**
- **Found during:** Task 4 (wxt build probe before implementation)
- **Issue:** The §18 canonical path `src/entrypoints/content/core.content.ts` is NOT matched by any wxt 0.19.29 entrypoint glob. Verified: a stub at that path built with NO `content_scripts` in the manifest and NO content-scripts output — the content script would silently never ship and the isolation check would stay vacuous.
- **Fix:** Created the entry at `src/entrypoints/core.content.ts` — the flat `*.content.ts` path wxt discovers, resolving name 'core' + `content-scripts/core.js` output exactly as the plan's W-7 reconciliation note describes.
- **Files modified:** src/entrypoints/core.content.ts (created); tests/isolation/check-content-bundle.mjs (walk updated for `.output/<browser>/` nesting)
- **Verification:** `pnpm wxt build` → manifest `content_scripts: [{matches:["<all_urls>"], run_at:"document_idle", js:["content-scripts/core.js"], world:"ISOLATED"}]`; isolation check exits 0 with "1 content bundle(s) clean"
- **Committed in:** 52c5777 (Task 4)

**2. [Rule 2 - Missing Critical] ADDON_SETTINGS error code absent from canonical registry**
- **Found during:** Task 1 (plan contract references it for AddonSettingsStore error paths)
- **Issue:** `errorCodes.ts` and spec Appendix C.2 Phase-1 block had no `ADDON_SETTINGS` code; Golden Rule 9 forbids free-form codes.
- **Fix:** Added `ADDON_SETTINGS: 'ADDON_SETTINGS'` to errorCodes.ts and the spec §C.2 Phase-1 block (01-06 WORKSPACE_SYNC precedent).
- **Files modified:** src/core/error/errorCodes.ts, .planning/PRODUCT_SPEC_v0_1.md
- **Verification:** grep finds the code in both files; all AddonSettingsStore tests green
- **Committed in:** 7835668 + 9166eff

**3. [Rule 3 - Blocking] `document.origin` not on the Document type**
- **Found during:** Task 3 verification (tsc)
- **Issue:** `document.origin` is not a Document property — tsc error TS2339 in ContentScriptHost.buildLiveContext.
- **Fix:** Use `document.location.origin` (same value, typed).
- **Files modified:** src/core/content/ContentScriptHost.ts
- **Verification:** `pnpm tsc --noEmit` exit 0
- **Committed in:** 757e794

**4. [Rule 3 - Blocking] Plan's Task 2 acceptance grep needs `-r` for directory traversal**
- **Found during:** Task 2 acceptance verification
- **Issue:** `grep -c "class PageRegistry|..." src/core/registry/ | wc -l` — GNU grep on a directory without `-r` prints an error and yields `wc -l = 1`, never 3.
- **Fix:** Verified the intent with the corrected command `grep -rn "class PageRegistry|class SidePanelPageRegistry|class StandalonePageRegistry" src/core/registry/ | wc -l` == 3 (one class declaration each).
- **Files modified:** none (verification command only)
- **Verification:** corrected command returns 3; all PageRegistry tests green
- **Committed in:** 7d2fb8a

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing-critical, 1 acceptance-command)
**Impact on plan:** All four fixes were necessary for a working content script, green tsc, canonical error codes, and honest acceptance verification. No scope creep.

## Issues Encountered

- **wxt 0.19.29 content-script discovery vs §18 spec path** — resolved via Rule 3 path reconciliation (deviation #1); the spec's `content/` subdirectory spelling is a §8.5/§18 diagram artifact the pinned wxt version cannot build.
- **UI-SPEC §17.8 sync (2026-08-07) not propagated to the 01-07/01-08 plans** — the synced spec moved Agent to a Chat mode and reorganized the Sider to Chat/Note/Write/Tools + TeamGQM, but both plans still register/build Chat/Agent/Notes/Options. This plan followed the plan text + consumer contract; the 01-08 executor should be aware the registry set may need to be reconciled with the synced UI-SPEC if the shells adopt the new nav.
- **jsdom `document.URL` is not overridable via defineProperty** — test asserts against `document.location.hostname` instead of hardcoding a fake host.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-08 (shells/routers):** `SidePanelPageRegistry`/`StandalonePageRegistry` singletons are ready to drive shell nav; `ProviderRegistry` (D-07 gate) follows the same Registry pattern; `PageRegistration.component` lazy keys are the shell resolution contract. Note the UI-SPEC §17.8 sync tension flagged above.
- **01-09 (verify:phase-1):** the isolation gate is now meaningful — `pnpm wxt build && node tests/isolation/check-content-bundle.mjs` verifies a real 159KB content bundle against the full W-16 token set.
- **Phase 4a (extraction):** ContentScriptHost's live-context skeleton + PageContextBridge message paths are the mount points for real DOM extraction; `ContentScriptHost` already accepts an injected tabId for registry upserts.
- **Phase 8 (add-ons):** `AddonEntry` carries the §8.6 base shape; the full manifest (scope/urlPatterns/contextExtractor/skills/...) extends it in place.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 12 created files exist on disk (9 source + 3 test)
- All 6 commits found in git log: 7835668, 7d2fb8a, 15037b7, 52c5777, 757e794, 9166eff
- `pnpm vitest run tests/core/registry tests/core/content` green (33/33)
- `pnpm wxt build && node tests/isolation/check-content-bundle.mjs` green ("1 content bundle(s) clean")
- `pnpm tsc --noEmit` exit 0; prettier + eslint clean on all new/modified files
- Pitfall 7 guard (`grep -c persist AddonSettingsStore.ts`) == 0; Pitfall 4 source guard (`grep -rn "from 'react'|from 'antd'|from 'zustand'" src/core/content/ | wc -l`) == 0
