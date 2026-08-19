# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff - Research

**Researched:** 2026-08-19
**Domain:** Chrome MV3 extension runtime (WXT), cross-surface messaging/persistence, AntD v6 shells
**Confidence:** HIGH (in-repo facts verified this session); MEDIUM (external docs via context7 CLI / official docs); LOW (websearch-derived API details)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Onboarding (Flow 9)

- **D-01 (OnboardingWizard → OnboardingModal):** Migrate `src/components/common/OnboardingWizard.tsx` (1006 lines, 7 steps, Step 4 auto-advances on a 10 s timer, Steps 6/7 mutate local state only) to a **thin 4-step `src/components/OnboardingModal.tsx`** matching spec §18's create list. Step 4 sequence: **Meet-NowPilot placeholder → pick provider → enter key → validate**. The persona card (RICH-R-03) ships as a placeholder Step 1 in Phase 1; the real "Meet NowPilot" character-introduction card lands in Phase 15.3. — **Reversibility:** `costly` — rationale: spec file path + Flow-9 step sequence is the public API surface; renaming `OnboardingWizard` callers (14 references in `src/components/chat/SidepanelChat.tsx` etc.) is a one-sweep move but the wizard component lives in many UAT scripts and integration sites downstream phases will inherit.
- **D-02 (Drop Step-4 10 s auto-advance + Steps 6/7):** Onboarding must advance only on explicit "Next" or successful connection test. The 10 s timer in `OnboardingWizard.tsx:99-108` is removed; MCP-tool / ServiceNow-permission switches (Steps 6/7, mutate local state only) are dropped entirely from Phase 1 scope (they need permissions that don't ship until Phase 17). — **Reversibility:** `reversible` — rationale: local component refactor; no external contract.
- **D-03 (Real connection test):** Replace the 1 s `setTimeout` always-success test (`OnboardingWizard.tsx:112-119` + `OptionsPage.tsx:240-257`) with a real `fetchProviderModels` call. The test reports `resp.ok` / HTTP error; a failed connection must show the spec §12 string `Connection failed: [error]` and keep the wizard open. — **Reversibility:** `reversible` — rationale: pure function replacement inside the validation path.

#### Workspace handoff (Flow 11) + cross-surface messaging

- **D-04 (Wire full Flow 11 — no stub):** Phase 1 ships end-to-end workspace handoff, not a UI mirror against a stubbed handoff. This is a Phase-1 v1 requirement (REQ-F05, REQ-F19, REQ-F20, REQ-F12). Implementation: `WorkspaceRouter.openStandalone(workspaceId, conversationId?, page?)` (currently `openFullApp` and points at non-existent `app.html`) is renamed and fixed to open `standalone.html?workspaceId=…&conversationId=…&page=…`. Standalone view boots → calls `WorkspaceStore.hydrateFromURL(searchParams)` → fires `WORKSPACE_HANDOFF` over `np_workspace` `BroadcastChannel`. Side Panel demotes to read-only mirror until refocused (per Flow 11) instead of `window.close()`'ing. — **Reversibility:** `costly` — rationale: touches every entry point and the BroadcastBus typed-message contract; Phase-2 authoritativeness builds on it.
- **D-05 (Side Panel post-handoff behavior):** Flow 11 says "side panel demotes to read-only mirror until refocused." Phase 1 implements the mirror, not a close. The mirror means: in Side Panel, the composer is disabled, the message list is read-only, and a thin status banner reads "Switched to Standalone. [Refocus here]". On user click, the banner clears and the composer re-enables. The current `handleOpenStandalone → window.close()` (entrypoints/sidepanel/main.tsx:36) is replaced. — **Reversibility:** `reversible` — rationale: pure UI-side behavior.
- **D-06 (Standalone → Side Panel refocus):** Symmetric "Focus Side Panel" command (REQ-F21, Phase 15 full polish — but Phase 1 ships the framework; the actual command ships as a Flow 10 entry `focus-side-panel` that calls `chrome.sidePanel.open({ tabId })`). Phase 15 will swap the empty handler for the full UI merge. — **Reversibility:** `reversible` — rationale: command-stub; Phase 15 replaces.
- **D-07 (Canonicalize Standalone naming):** Spec split: §5.1/§5.4/§18 use `standalone`; §8.1/§8.5 use `app`. Spec §0.4 says "single source of truth" — Phase 1 picks `standalone`. Rename in lockstep: `openFullApp → openStandalone`, `app.html → standalone.html` (reference paths only; the file at `entrypoints/standalone/index.html` already exists), `FullAppPageRegistry → StandalonePageRegistry`, `appPageId → standalonePageId` (consumers: `WorkspaceRouter.ts:12,21`, `entrypoints/standalone/main.tsx`, `src/core/registry/Registry.ts`, anything that mentions `app.html`). Fixes CONCERNS "Stale Architecture References". — **Reversibility:** `costly` — rationale: the names appear in CHANGELOG, type imports, and downstream references the planner will discover; one-time rename that must be exhaustive.
- **D-07a (Entrypoint LOCATION — LOCKED to repo root 2026-08-19):** D-07 fixes the _name_ (app→standalone); this fixes the _location_. **Decision: KEEP entrypoints at the project ROOT `entrypoints/`** — the WXT default, which the built scaffold already uses. Do NOT migrate to src/entrypoints/ (that file move is costly and delivers no benefit). Set wxt.config.ts `srcDir` to the repo root, and reconcile the spec's §5.1/§8.5 `src/entrypoints/` wording DOWN to root `entrypoints/`. Only the content-script PATH SHAPE is normalized: rename `entrypoints/content.core.ts` → `entrypoints/content/core.content.ts` (directory form, ISOLATED world), and point the D-17 isolation-grep at that path. The MAIN-world servicenow-main.content.ts (§5.1) is **Phase 17**, not Phase 1. (Consistent with PHASE-1-PLANNING-ADDENDUM §3 and STATE.md decision 16.) — **Reversibility:** reversible — rationale: no file move; only a single content-script rename + a `srcDir` setting in wxt.config.ts.

#### Cross-surface Cmd+K palette (Flow 10)

- **D-08 (Flow 10 base set on both surfaces):** `src/components/common/CommandPalette.tsx` (existing) is the renderer. Phase 1 registers the Flow 10 base command set on both surfaces (`open-standalone-view`, `open-options`, `focus-side-panel` [per §9.2 "Focus Side Panel" / REQ-F21], plus the Phase-1 conveniences `toggle-theme` and `reload-extension`, which are beyond Flow 10's named set — keep or drop at planner discretion). Standalone view also gets `open-standalone-view` removed since the user is already there, plus a stubbed `focus-side-panel` (D-06). Side Panel mirrors are: `open-standalone-view` (REQ-F05), `open-options`. Phase 15 will register the full RICH catalog (suggestion templates, slash commands, etc.) on top of this base. — **Reversibility:** `reversible` — rationale: commands are registered in `useEffect` cleanup blocks; reversible via registry.
- **D-09 (Existing local Cmd+K handler kept in entrypoints):** The local `(Meta|Ctrl)+K → toggle palette` listeners (`sidepanel/main.tsx:109-118`, `standalone/main.tsx:78-87`) are reused. KeymapRegistry is the future home (per Flow 8) but Phase 1 does not wire it (that's a Phase 18 / Tool Governance job). — **Reversibility:** `reversible` — rationale: per-entrypoint local handlers; Phase 18 swap.

#### Cross-surface theme propagation

- **D-10 (ThemeStore is the single source of truth):** `useThemeStore.mode` lives in both `useExtensionStore.config.themeMode` and `ThemeStore.mode` today (CONCERNS "Duplicate theme state with drift risk"). Phase 1 makes `ThemeStore` authoritative — `themeMode` is read-only and removed from `useExtensionStore` writes; the bridging in `updateConfig` (`useExtensionStore.ts:578-588`) is deleted; `useThemeSync` owns the `BroadcastBus` `np_theme` propagation. The authoritative key is chrome.storage.sync.np_theme (spec §15.1 / §17.1a APPR-03) — NOT np_theme_mode (which does not exist in the spec) and NOT the scaffold's chrome.storage.local np_theme_store. Phase 1 migrates ThemeStore persistence to chrome.storage.sync.np_theme and drives cross-surface propagation via chrome.storage.onChanged (the scaffold's np_theme BroadcastChannel MAY be retained additionally, but sync + onChanged is the source of truth per APPR-03). Phase-1 ThemeStore also declares the pack field (Appendix F ThemeState), default 'default'; the pack SELECTOR UI (APPR-06) is Phase 15, but the store field is declared now to avoid a Phase-15 store-shape change (mirrors the isPrimaryWriter()/Note.type declare-now-populate-later pattern). — **Reversibility:** `costly` — rationale: per-store persistence keys (`np_theme_store` vs. `np_store`) and a manual mirror; one-time plus a migration if persisted user data still has the old field.

#### Demo / simulated-AI purge (REQ-R20)

- **D-11 (Empty fresh-install state):** Phase 1 ships an empty first-run experience. All three `INITIAL_*` arrays are emptied (`INITIAL_SESSIONS` at `useExtensionStore.ts:84-318`, `INITIAL_WRITE_HISTORY` `:320-375`, `INITIAL_NOTES` `:377-515`). The hardcoded "critical thinking" / "Good morning to you too!" responses, fake INC001234 incident, and Unsplash image thumbnails are removed. Fresh install is a clean workspace. — **Reversibility:** `costly` — rationale: changes the default `np_store` JSON shape; any user upgrading from the scaffold's current state loses the demo content (acceptable — the prior data was fake anyway).
- **D-12 (simulateStreamResponse gated):** `simulateStreamResponse` (`src/services/aiProvider.ts:101-217`) is gated behind an explicit `DEMO_MODE` config key (default `false`) **AND** `import.meta.env.DEV`. Real fetch failures surface via `onError` (no canned fallback). The scaffold's `http://localhost:12380/v1` proxyUrl (`useExtensionStore.ts:31,70`) is NOT treated as a canonical default — §10.6 ENDPOINTS are authoritative. Phase 1 leaves provider endpoint defaults to Phase 3 (§10.6); it neither pre-fills nor blesses `localhost:12380` (including in the D-01 onboarding proxy field). `simulateStreamResponse` is never the default code path. — **Reversibility:** `reversible` — rationale: gated feature flag; restore by re-enabling DEMO_MODE.

#### Scaffold cleanup (REQ-R01, R02, R19, R21)

- **D-13 (Single messaging layer — REQ-R01):** `entrypoints/background.ts` calls `MessageBus.init()` on startup and registers handlers for the typed envelope types (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION` migrated to envelopes). The raw `chrome.runtime.onMessage` listener at `background.ts:28-34` is removed. Every handler returns `true` synchronously and calls `sendResponse` once (Pitfall 4). **Phase-1 background.ts registers exactly:** (1) BackgroundRouter.register() as the single message entry symbol per §5.1 / Appendix E (internally it calls MessageBus.init()); (2) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); (3) the onboardingComplete flag init. It does NOT call LifecycleManager / KeepAliveManager / ContextMenuHost — those ship in later phases (ContextMenuHost → Phase 17; KeepAlive/Lifecycle when needed). Leave Phase-N TODO comments so §5.1's final background shape is reachable additively. Cold-start test added: `tests/background/message-bus-cold-start.test.ts`. — **Reversibility:** `costly` — rationale: changes the public messaging contract; future phases add handlers against the typed envelope.
- **D-14 (BackgroundRouter as the typed wrapper):** ROADMAP.md Phase 1 goal reads "dual messaging paths converge onto `BackgroundRouter`". Phase 1 introduces `src/core/messaging/BackgroundRouter.ts` as the thin typed wrapper that calls `MessageBus.init()` and exposes a single registration API for background-side handlers. Content-script migration to typed envelopes happens at the same time so extraction envelope types are frozen (per Flag A). — **Reversibility:** `costly` — rationale: new public type, all background handlers route through it.
- **D-15 (Frozen extraction envelope types — REQ-R04 / Flag A):** Phase 1 declares `PAGE_LIVE_CONTEXT` (always-on), `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD` (with `baseUrl` + `truncated` reserved) in `src/core/runtime/RuntimeEnvelope.ts`. Implementation is type-only; the strategies (Defuddle → Readability, AX → DOM) ship in Phase 6. Phase 17's ServiceNow strategy + ordering reserve their `strategyId` here. — **Reversibility:** `costly` — rationale: cross-phase type contract; downstream phases import these symbols by name.
- **D-16 (isPrimaryWriter() predicate — REQ-R05 / Flag B):** Phase 1 declares `WorkspaceStore.isPrimaryWriter(): boolean`. In Phase 1 the predicate returns `true` for any caller (Phase 1 owns the *signature* and *interface*; Phase 2 owns the *election semantics* and gates MemoryEngine write paths). The predicate interface stays stable. — **Reversibility:** `reversible` — rationale: additive interface; Phase 2 layers enforcement.
- **D-17 (Real isolation tests — REQ-R02):** The current isolation test (`tests/isolation/cross-entrypoint-imports.test.ts`) greps for non-existent `components/app/` / `components/sidepanel/` paths and is vacuous. Phase 1 repoints the greps at the real directories (`src/components/chat/`, `src/components/standalone/`, `src/components/options/`) and asserts no cross-imports in either direction. Also adds: `grep -r 'fetch(' entrypoints/content.core.ts entrypoints/content/** → zero` (no `fetch` in content scripts, per PITFALLS P3). — **Reversibility:** `reversible` — rationale: test refactor; no production code touched.
- **D-18 (Remove Tailwind scaffold leftover — REQ-R19):** Spec §0.2 forbids `tailwind` / `shadcn` / `@radix-ui` / `framer-motion`. Phase 1 removes the `@tailwindcss/vite` plugin from `wxt.config.ts:8`, the `@import "tailwindcss"` from `src/index.css:1`, and any `tailwind.config.*` files. The `motion` package (^12 — successor of framer-motion, kept per STACK.md §35) is the only animation library. Verification gates: `grep 'tailwind|shadcn|@radix-ui|framer-motion' package.json → zero`. CSS that was authored with `bg-` / `flex-` / `text-` utility classes is rewritten to AntD-native equivalents + inline styles where unavoidable. — **Reversibility:** `costly` — rationale: every CSS-bearing file changes; visual regression risk.
- **D-19 (Least-privilege manifest — REQ-R21):** Drop the 6 unused permissions from `wxt.config.ts:31-45` (declarativeNetRequest is dropped unconditionally — spec §16.4 forbids it in v0.1; the other 5 are deferred to their owning phases per D-19a). Verified per VAI-08: only `sidePanel`, `storage`, `tabs` are exercised today. Drop: `cookies`, `alarms`, `scripting`, `contextMenus`, `notifications`, `declarativeNetRequest`. Phase 17 will re-add `cookies`, `scripting`, `contextMenus` via `chrome.permissions.request()` when ServiceNow / Selection → Ask AI ship; `alarms`, `notifications`, `declarativeNetRequest` stay out. CSP `connect-src` widens per-provider as users configure endpoints. — **Reversibility:** `reversible` — rationale: declarative permission; add back in Phase 17 via `optional_permissions`.
- **D-19-note (Verification gate before scope change):** Per VAI-08, `CONCERNS.md` (refreshed 2026-08-18) was not part of the research set — **Phase 1 must verify each defect against `src/` before treating as fact.** The list above reflects what VAI-08 verification confirmed: 5 unused permissions confirmed; dual messaging paths confirmed (raw `background.ts` + never-initialized `MessageBus`); Tailwind plugin confirmed; `localhost:12380` confirmed as default; `WorkspaceRouter.openFullApp → app.html` confirmed (file does not exist; real surface is `entrypoints/standalone/`).
- **D-19a (Appendix-G permissions deviation — explicit):** Phase 1's wxt.config.ts DEVIATES from Appendix G on the `permissions` array **only**. The Phase-1 Create-list instruction "wxt.config.ts # Appendix G" is overridden for this one array. **Authoritative Phase-1 permission set = `['sidePanel','storage','tabs']`** (REQ-R21 least-privilege). Appendix G's `cookies` / `scripting` / `contextMenus` re-add at **Phase 17** (via static-manifest edit or `chrome.permissions.request()`); `alarms` re-adds when KeepAliveManager ships; `notifications` re-adds when first used; `unlimitedStorage` re-adds at **Phase 2** (ADR-STACK-02); `declarativeNetRequest` is **never** in v0.1 (§16.4). Every OTHER field in wxt.config.ts (CSP, host_permissions, optional_host_permissions, side_panel, action, web_accessible_resources, manualChunks) follows Appendix G verbatim. This deviation is intentional and is the single source of truth for the Phase-1 permission set. — **Reversibility:** reversible — rationale: declarative permission array; each entry re-added at its owning phase.

#### Stack + strictness drift (spec §7)

- **D-20 (Bump Immer 10 → 11, Zod 3 → 4):** Spec §7.3 / §7.4 mandate Immer 11 and Zod 4. Scaffold ships Immer 10.2.0 and Zod 3.24.0. Bump both in `package.json`; verify against the verified-version table in `RESEARCH-RECONCILIATION.md`. — **Reversibility:** `reversible` — rationale: dependency bumps; rollback is a revert + reinstall.
- **D-21 (strict: true in Phase 1):** Enable `tsconfig.json:8 → strict: true` per spec §7.8. (Do NOT rely on noEmitOnError — verify:phase-1 is `tsc --noEmit` per §24, under which noEmitOnError is a no-op; the gate goes green because expected-errors are suppressed via the @ts-expect-error NP-STRICT sweep below, per the locked strict-mode decision.) Sweep every trivial cast (`as any` / `@ts-ignore` / `@ts-expect-error`) fixable in ≤1 line (e.g., `BroadcastBus event.data as any` → `MessageEvent<ThemeSyncMessage>`; store action payloads; runtime-envelope type assertions). For the residue that is genuinely structural (the `wxt.config.ts:15` tailwind-plugin cast `as any`, WXT-generated `.wxt` shims, third-party typing gaps), suppress with `// @ts-expect-error NP-STRICT-<n>: <reason>` — chosen over `@ts-ignore` because a suppressed error self-destructs once the underlying type is fixed (no silent rot). Add `verify:phase-1` assertion that greps `src/` + `entrypoints/` for `NP-STRICT-` markers and fails if the count exceeds a declared ceiling (the count remaining after the cheap-fix sweep). Phase 2–3 task: reduce the NP-STRICT ceiling to 0 (recorded in `.planning/STATE.md` watch-list, not implicit). — **Reversibility:** `costly` — rationale: touches every TypeScript file in the repo; the strict-mode enable is one-way until typed.

#### Persistence granularity (REQ-R03)

- **D-22 (Coalesce + version/migrate — Phase 1 scope):** Add a `verify:phase-1` write-rate assertion test. Implement a 250–500 ms trailing-debounce + `beforeunload`/`visibilitychange` flush in the `chromeStorageAdapter` for `useExtensionStore` (the god-store, the canonical silent-data-loss victim per PITFALLS P2). Add `version: 1` + `migrate` to the zustand `persist` config; current users get no-op migrate because v1 _is_ the schema. NOTE: the zustand-persist store `version` is a SEPARATE axis from the IndexedDB `DB_VERSION` (§20.4), which reaches v4 by Phase 9 — do not conflate the two counters when numbering later migrations. `WorkspaceStore` and `ThemeStore` get the same debounce. The full god-store → slice-store split is deferred to Phase 2 (per ROADMAP.md Phase 2 success criteria). — **Reversibility:** `costly` — rationale: touches the persistence-adapter contract and every persisted store; Phase 2 schema migrations assume v1 baseline.

#### Git baseline first

- **D-23 (Commit scaffold as-is before any Phase-1 remediation):** `git ls-files` reports 13 tracked files; `src/`, `entrypoints/`, `tests/`, configs are untracked. Phase 1's first task is **a single "chore: scaffold import" commit** covering the implementation (excluding `.output/`, `dist/`, `.wxt/`), plus committing `pnpm-lock.yaml` and `pnpm-workspace.yaml` (currently untracked — see D-23-note). Every subsequent Phase-1 cleanup is then a diffable, revertable commit. — **Reversibility:** `reversible` — rationale: it's a commit, not a code change.
- **D-23-note (Single lockfile + package-manager canonicalization):** Both `package-lock.json` (committed) and `pnpm-lock.yaml` + `pnpm-workspace.yaml` (untracked) exist. Phase 1 picks pnpm as canonical (spec §7; `pnpm-workspace.yaml` is the intended pin), removes `package-lock.json`, commits `pnpm-lock.yaml`. Scripts continue to work via `pnpm run`; npm users get a warning pointing at the chosen manager. Record in `package.json` `packageManager: "pnpm@11.22.0"` field. — **Reversibility:** `reversible` — rationale: file deletion + lockfile track; revert by re-adding `package-lock.json`.

### the agent's Discretion

- **`isPrimaryWriter()` election semantics in Phase 1:** Phase 1 returns `true` for any caller (predicate exists but is not yet enforced). The election algorithm (background-SW authoritative vs. tabs.query highest-id vs. BroadcastBus subscriber) is the planner's call — it only matters in Phase 2 when MemoryEngine writes start calling it. Document the Phase-2 swap point in a code comment.
- **OnboardingModal step labels:** exact copy is the planner's call (spec §12 gives the *state strings*, not the *step labels*). Follow AntD conversational patterns.
- **Demoware-failover for the simulator refactor:** the agent may keep a minimal dev-only `src/dev/simulator.ts` if it makes `simulateStreamResponse` testable; placement is up to the planner.
- **Phase 1 plan split into 2 or 3 plans:** ROADMAP.md Progress Table lists `Phase 1: 0/3`. The planner decides whether 3 plans is appropriate or whether 2 wave-grouped plans is enough given the deliverables.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope. Defer-list candidates captured implicitly:
- Persona card art / "Meet NowPilot" character → Phase 15.3 (RICH-R-03).
- Real `unlimitedStorage` permission → Phase 2 (ADR-STACK-02).
- ServiceNow `cookies` / `scripting` / `contextMenus` permissions → Phase 17 (D-19).
- Dual-LLM quarantine (REQ-R11 layer 3) → v0.2+ (ADR-SEC-01).
- Note / memory / MiniSearch / Filesystem Sync / trust-aware context / multimodal / evolution — all in their own phases per ROADMAP.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-F05 | Open Standalone view action (P0) — opens standalone.html with workspace handoff (Flow 11) | D-04/D-05/D-07: `WorkspaceRouter.openStandalone` + mirror demotion. `chrome.tabs.query` URL-pattern dedup verified (match patterns ignore query strings → base-URL dedup works). `chrome.sidePanel.open` gesture rules for the reverse path (D-06). |
| REQ-F12 | Side Panel Cmd+K palette (Flow 10 command set) | D-08/D-09: existing `CommandPalette.tsx` (antd Modal) + `CommandRegistry` singleton; per-entrypoint `(Meta\|Ctrl)+K` listeners at `sidepanel/main.tsx:109-118` reused. |
| REQ-F19 | First-run onboarding entry point (Flow 9) | D-01/D-02/D-03: OnboardingModal 4-step (placeholder → provider → key → validate); spec §12 strings (`Testing connection...` / `Connection failed: [error]` / `Connected`); `onboardingComplete` flag init in background.ts `onInstalled` (INSTALL=false, UPDATE=true). |
| REQ-F20 | Standalone view Cmd+K palette | D-08/D-09: symmetric registration in `standalone/main.tsx:78-87`; `open-standalone-view` omitted there; stubbed `focus-side-panel`. |
| REQ-R01 | Single messaging layer: one typed envelope path, every handler returns `true` sync + `sendResponse` once, idempotent `ensureInitialized()` | D-13/D-14: `MessageBus.init()` exists at `src/core/messaging/MessageBus.ts:49` but is never called (verified); raw listener at `background.ts:28-34` to be removed; `BackgroundRouter` introduced. MessageBus handler contract verified. |
| REQ-R02 | Real isolation tests: no `fetch(` in content-script entrypoints; no React/AntD/Defuddle/yaml in content bundle | D-17: current `tests/isolation/cross-entrypoint-imports.test.ts` greps non-existent paths (vacuous — verified); repoint at real dirs + add fetch-grep. Appendix G content-bundle rule verified. |
| REQ-R04 | Freeze content-script envelope types (PAGE_LIVE_CONTEXT always-on; PAGE_EXTRACTION_REQUESTED / PAGE_HTML_PAYLOAD with baseUrl/truncated reserved) | D-15: `RuntimeEnvelope.ts` `MessageTypeValues` verified (8 values); new extraction types are type-only additions. |
| REQ-R05 | `isPrimaryWriter()` predicate on WorkspaceStore | D-16: additive `boolean` predicate on `WorkspaceStore.ts` (121 lines, zustand+immer+persist); returns true in Phase 1. |
| REQ-R19 | Remove Tailwind scaffold leftover (plugin + `src/index.css`) | D-18: **verified — `tailwindcss` ^4.3.3 AND `@tailwindcss/vite` ^4.3.3 are in package.json devDependencies; the Phase-1 grep gate currently FAILS.** Plugin at `wxt.config.ts:15`, `@import "tailwindcss"` at `src/index.css:1`. |
| REQ-R21 | Least-privilege manifest: drop unused permissions; optional_host_permissions + `chrome.permissions.request()`; widen connect-src per-provider | D-19/D-19a: 9 permissions currently declared (`wxt.config.ts:31-45`); only sidePanel/storage/tabs exercised (verified via source grep); authoritative Phase-1 set = `['sidePanel','storage','tabs']`. |
</phase_requirements>
## Summary

Phase 1 converges the existing WXT/MV3 scaffold onto one typed messaging + persistence layer and wires the three observable behaviors: first-run OnboardingModal (Flow 9), cross-surface Cmd+K palette (Flow 10), and workspace handoff between Side Panel and Standalone view (Flow 11), plus cross-surface theme propagation. The scaffold is NOT rebuilt — this session verified the full inventory it ships: dual messaging paths (raw `background.ts:28-34` listener vs. a `MessageBus.init()` that is never called anywhere), `WorkspaceRouter.openFullApp` pointing at a non-existent `app.html`, 9 manifest permissions of which only 3 are exercised, a Tailwind scaffold leftover that **fails the Phase-1 grep gate today** (`tailwindcss` + `@tailwindcss/vite` are in package.json devDependencies), `strict: false` in tsconfig, demo data baked into store defaults, and a vacuous isolation test that greps non-existent directories.

The external research resolved the framework questions the phase depends on: WXT 0.20 entrypoint conventions (side panel/options are HTML entrypoints configured via `<meta name="manifest.*">` tags; `defineBackground` main() cannot be async; `defineContentScript` `world: 'MAIN'` is Chromium-only), `chrome.sidePanel.open()` (Chrome 116+, user-gesture-scoped with a ~1 ms gesture window — never `await` before calling), zustand v5 persist (`version`/`migrate`/`createJSONStorage` verified; debounce must live in the storage adapter — zustand has none), AntD v6 theming (runtime algorithm switching by updating `ConfigProvider.theme`; `open`/`destroyOnHidden`/`mask.closable` are the v6 Modal props), and `chrome.storage.onChanged` cross-surface sync with its one caveat: a hidden side panel may not process events until visible again — which is exactly why Flow 11's handoff must flush via BroadcastBus + storage *before* opening the tab.

**Primary recommendation:** Plan the phase as the CONTEXT.md decision set D-01…D-23 in wave order: (1) git baseline + entrypoint path-shape normalization (entrypoints kept at repo root) + dependency alignment (D-23/D-07a/D-20 + strict sweep D-21), (2) messaging convergence + frozen envelope types + isolation tests (D-13/D-14/D-15/D-16/D-17), (3) handoff + palette + onboarding + theme + manifest + storage coalescing (D-04…D-10, D-18/D-19/D-19a, D-22). Every task must keep `pnpm run verify:phase-1` (tsc --noEmit && vitest run tests — the whole tests/ tree, which MUST include tests/core, tests/background, tests/components, tests/isolation, and the NP-STRICT grep test) green and the two grep gates at zero. NOTE: the scaffold's verify:phase-1 script only globs tests/core/{runtime,events,workspace,theme} — widen it in package.json so every Wave-0 dir is gated, otherwise the new DONE-when tests (background/components/storage/isolation/NP-STRICT) pass locally but the phase gate never runs them.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Typed message dispatch (envelopes) | Background SW (`BackgroundRouter`/`MessageBus`) | Content script (sender) | MV3: SW is the single message entry symbol per spec §5.1/App. E; content scripts must never hold surface logic |
| Workspace handoff (Flow 11) | API/Backend-equivalent: `WorkspaceRouter` + `chrome.tabs` | Browser storage (persist flush) | Tab creation/dedup is a browser API concern; state handoff rides BroadcastBus + persisted store |
| Command palette (Flow 10) | Browser/Client (each surface) | — | Registry is per-context module singleton; palette is a UI concern on both surfaces |
| Theme propagation | Browser storage (`chrome.storage.sync` + `onChanged`) | Client (ThemeStore + ConfigProvider) | APPR-03: storage is the single source of truth; both surfaces derive config from it |
| Onboarding gating | Background SW (`onInstalled` flag) | Client (OnboardingModal) | Fresh-install detection is SW-side; modal rendering is per-surface |
| Persistence coalescing | Storage adapter (`chromeStorageAdapter`) | Zustand persist middleware | Write throttling must sit between zustand and chrome.storage (no built-in debounce) |
| Manifest/permissions | Build config (wxt.config.ts) | — | Least-privilege set `['sidePanel','storage','tabs']` per D-19a |
| Content-script readiness | Content script | SW (envelope handler) | CONTENT_SCRIPT_READY/SPA_NAVIGATION migrate to typed envelopes (D-13) |

## Standard Stack

### Core
| Library | Version (verified npm 2026-08-19) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | ^0.20.27 (latest 0.20.x; **held per ADR-STACK-01**; 0.21.4 exists) | MV3 extension framework, entrypoints, manifest | WXT 0.21 flips generated tsconfig to `strict: true` mid-milestone — hold for v0.1 [CITED: RESEARCH-RECONCILIATION.md A-1 / ADR-STACK-01] |
| antd | ^6.5.2 → 6.6.1 installed | Component library (Modal, Steps, Input, List, ConfigProvider) | v6 is the spec §7 pin; CSS-variable theming; `open`/`destroyOnHidden` props verified |
| @ant-design/x | ^2.8.0 → 2.9.0 | AI chat/markdown components | Spec §17/Flow surfaces; consumed by both shells |
| zustand | ^5.0.0 → 5.0.15 | Client state + persistence | persist middleware with version/migrate/custom storage (verified v5 docs) |
| immer | **^11 (bump from ^10.1.1 — D-20)** | Immutable state updates | Spec §7.3 mandates ^11 (prototype-pollution hardening) |
| zod | **^4 (bump from ^3.24.0 — D-20)** | Runtime validation of envelopes/config | Spec §7.4 mandates ^4; MCP SDK + AI SDK 5 target zod/v4 |
| react | ^19.0.1 → 19.2.8 | UI runtime | Spec pin; antd v6 requires React ≥18 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion | ^12.23.24 (kept; latest 13.1.0) | Onboarding modal animation | `motion/react` import in OnboardingWizard.tsx:17 survives the D-01 migration; grep gate excludes only the literal `framer-motion` |
| @ant-design/icons | ^6.3.2 | Icons (palette, buttons) | Any surface icon |
| lucide-react | ^1.31.0 | Secondary icon set | When antd icons don't cover |
| @ant-design/x-markdown | ^2.8.0 | Markdown rendering | Chat message rendering |
| vitest | 3.x (3.2.7 per STACK.md; VAI-04 notes 4.1.11 latest-known) | Test runner | verify:phase-1 script |
| @testing-library/react | ^16.0.0 | Component testing | OnboardingModal/CommandPalette tests |
| jsdom | ^25.0.0 | DOM environment | vitest.config.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| wxt 0.20.27 (held) | wxt ^0.21.4 | 0.21 flips strict:true mid-milestone; ADR-STACK-01 locks the hold — post-v0.1 target |
| zustand persist + custom adapter | redux-persist | Redux-persist has no chrome.storage adapter; zustand is the scaffold's established pattern |
| BroadcastBus np_theme channel only | chrome.storage.sync + onChanged only | D-10 allows retaining the channel, but sync+onChanged is APPR-03's source of truth — don't invert |
| Tailwind (current scaffold) | AntD tokens + inline styles | Spec §0.2 forbids tailwind; REQ-R19 removal is mandatory |

**Installation:**
```bash
pnpm add immer@^11 zod@^4          # D-20 dependency alignment (only deltas)
pnpm remove tailwindcss @tailwindcss/vite   # REQ-R19
```

**Version verification:** All versions above confirmed via `npm view <pkg> version` on 2026-08-19 (antd 6.6.1, @ant-design/x 2.9.0, zustand 5.0.15, immer 11.1.18, zod 4.4.3, motion 13.1.0, react 19.2.8, wxt 0.21.4/0.20.27). `@types/chrome` ^0.2.2, `@types/node` ^22.14.0 per package.json.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| antd 6.6.1 | npm | 10 yrs (patch 2026-08-17) | 3.05M/wk | github.com/ant-design/ant-design | SUS* | Approved — recency artifact only; already pinned in package.json |
| @ant-design/x 2.9.0 | npm | 2 yrs | high | github.com/ant-design/ant-design | SUS* | Approved — recency artifact only; already pinned |
| zustand 5.0.15 | npm | 6 yrs (patch 2026-08-13) | 44.4M/wk | github.com/pmndrs/zustand | SUS* | Approved — recency artifact only; already pinned |
| immer (→^11) | npm | 8 yrs | 30M+/wk | github.com/immerjs/immer | SUS* | Approved — recency artifact only; bump per D-20 |
| zod (→^4) | npm | 6 yrs | 35M+/wk | github.com/colinhacks/zod | OK | Approved |
| motion ^12.23.24 | npm | 3 yrs (patch 2026-08-10) | 12.5M/wk | github.com/motiondivision/motion | SUS* | Approved — recency artifact only; grep gate excludes only `framer-motion` |
| react 19.2.8 | npm | 12 yrs | 60M+/wk | github.com/facebook/react | SUS* | Approved — recency artifact only |
| @ant-design/icons 6.3.2 | npm | 8 yrs | 8M+/wk | github.com/ant-design/ant-design | OK | Approved |
| lucide-react | npm | 4 yrs | 6M+/wk | github.com/lucide-icons/lucide | SUS* | Approved — recency artifact only |
| wxt ^0.20.27 | npm | 2 yrs | 390K/wk | github.com/wxt-dev/wxt | SUS* | Approved — recency artifact only; held per ADR-STACK-01 |
| vitest | npm | 4 yrs | 9M+/wk | github.com/vitest-dev/vitest | SUS* | Approved — recency artifact only |
| @testing-library/react | npm | 9 yrs | 20M+/wk | github.com/testing-library/react-testing-library | OK | Approved |
| tailwindcss ^4.3.3 | npm | 7 yrs | 20M+/wk | github.com/tailwindlabs/tailwindcss | OK | **REMOVED from Phase-1 stack** (REQ-R19 — spec §0.2 forbids) |

*\*All SUS verdicts share one signal: `too-new` — the seam's recency heuristic triggered by recent *patch* publishes. Every package was cross-verified: canonical source repo, >300K weekly downloads, `postinstall: null` on all audited packages (no network-executing install scripts), not deprecated. None is slopsquatted; all are already pinned in package.json/lockfile — no new untrusted installs enter Phase 1. The D-20 bump (immer ^11, zod ^4) installs from the same canonical publishers.*

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none *genuinely* — all SUS verdicts are recency-heuristic artifacts with full positive cross-verification above; the planner may add a single `checkpoint:human-verify` on the D-20 install step at discretion, but no package here warrants blocking.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────── Chrome MV3 ───────────────────────┐
                    │                                                          │
 User gesture       │   ┌──────────────────────────────────────────────────┐   │
 ──► Side Panel ────┼──►│ Background SW (BackgroundRouter.register()       │   │
     (sidepanel.html)│  │  → MessageBus.init() → typed envelope handlers)  │   │
                    │   │  onInstalled → onboardingComplete flag            │   │
                    │   │  setPanelBehavior({openPanelOnActionClick:true})  │   │
                    │   └───────────────▲──────────────────┬────────────────┘   │
                    │                   │ runtime.onMessage│ (envelopes only)   │
                    │   CONTENT_SCRIPT_READY / SPA_NAVIGATION                  │
                    │   (typed envelopes, D-13)                                │
                    │                   │                                      │
                    │   ┌───────────────┴───────────────┐                      │
                    │   │ Content script (ISOLATED)     │                      │
                    │   │ entrypoints/content/      │                      │
                    │   │ core.content.ts               │                      │
                    │   └───────────────────────────────┘                      │
                    │                                                          │
  Flow 11 handoff:  │   Side Panel ──openStandalone()──► chrome.tabs.query(     │
  Side Panel        │       │  flush persist + WORKSPACE_HANDOFF               │
  ──► Standalone    │       │  via BroadcastBus('np_workspace')                │
  tab (mirror demote)│     ─▼─                    ┌───► match? ──► tabs.update  │
                    │   Standalone tab            │      (focus existing)      │
                    │   standalone.html?ws=…      └─► no ─► tabs.create         │
                    │   → hydrateFromURL() → WORKSPACE_HANDOFF → mirror banner │
                    │                                                          │
  Theme propagation:│   ThemeStore.setMode ─► chrome.storage.sync.np_theme      │
                    │   ─► onChanged ─► both surfaces ─► ConfigProvider.theme   │
                    │   (np_theme BroadcastChannel MAY remain auxiliary)        │
  Palette (Flow 10):│   (Meta|Ctrl)+K ─► CommandPalette (antd Modal)            │
                    │   ─► CommandRegistry (per-context singleton)              │
                    └──────────────────────────────────────────────────────────┘
```

Trace the primary use case (Flow 11): Side Panel "Switch to Full chat" click → `WorkspaceRouter.openStandalone(wsId, convId?, page?)` → persist-flush via coalesced adapter → `tabs.query({url: getURL('standalone.html')})` (match patterns ignore query strings, so `?workspaceId=…` tabs still match — dedup works) → focus existing or `tabs.create` with `standalone.html?workspaceId=…&conversationId=…&page=…` → Standalone boots → `WorkspaceStore.hydrateFromURL(searchParams)` → fires `WORKSPACE_HANDOFF` on `np_workspace` → Side Panel demotes to read-only mirror with "Switched to Standalone. [Refocus here]" banner (no `window.close()`).

### Recommended Project Structure (post D-07a — entrypoints KEPT at repo ROOT, NOT under src/)

```
src/
├── entrypoints/            D-07a LOCKED: entrypoints KEPT at repo ROOT — read these as entrypoints/*, NOT src/entrypoints/* (the src/ header above applies to components/core/store only)
│   ├── background.ts       # BackgroundRouter.register() only (D-13/D-14)
│   ├── content/
│   │   └── core.content.ts # renamed from content.core.ts; ISOLATED world
│   ├── sidepanel/
│   │   ├── index.html      # <meta name="manifest.open_at_install"> per WXT convention
│   │   └── main.tsx
│   ├── standalone/
│   │   ├── index.html
│   │   └── main.tsx
│   └── options/
│       ├── index.html
│       └── main.tsx
├── components/
│   ├── chat/SidepanelChat.tsx       # mirror demotion UI (D-05)
│   ├── standalone/StandaloneWorkspace.tsx
│   ├── common/CommandPalette.tsx    # Flow 10 renderer (existing, kept)
│   ├── common/OnboardingModal.tsx   # NEW (D-01) — spec path, 4 steps
│   └── ThemeProvider.tsx            # ConfigProvider + XProvider
├── core/
│   ├── messaging/MessageBus.ts      # init() now called; handler contract
│   ├── messaging/BackgroundRouter.ts# NEW (D-14) typed wrapper
│   ├── runtime/RuntimeEnvelope.ts   # + frozen extraction types (D-15)
│   ├── runtime/BroadcastBus.ts      # np_workspace / np_theme channels
│   ├── workspace/WorkspaceStore.ts  # + isPrimaryWriter() (D-16), hydrateFromURL
│   ├── workspace/WorkspaceRouter.ts # openStandalone (renamed), standalone.html
│   ├── workspace/WorkspaceSync.ts   # WORKSPACE_HANDOFF wiring
│   ├── theme/ThemeStore.ts          # sync.np_theme + pack field (D-10)
│   ├── theme/ThemeSync.ts           # useThemeSync owns np_theme propagation
│   ├── theme/chromeStorageAdapter.ts# + trailing-debounce + flush (D-22)
│   └── commands/CommandRegistry.ts  # Flow 10 base set (D-08)
├── store/useExtensionStore.ts       # demo purge (D-11), themeMode read-only (D-10)
├── services/aiProvider.ts           # simulateStreamResponse gated (D-12)
└── index.css                        # tailwind import removed (D-18)
tests/
├── core/{runtime,events,workspace,theme}/   # existing + updated (verify:phase-1 scope)
├── background/message-bus-cold-start.test.ts # NEW (D-13)
├── isolation/                               # repointed greps (D-17)
└── setup.ts                                 # chrome mocks (existing, 152 lines)
```

### Pattern 1: Single typed messaging layer (D-13/D-14)
**What:** One `MessageBus`/`BackgroundRouter` path for all `chrome.runtime.sendMessage` traffic; every handler returns `true` synchronously and calls `sendResponse` exactly once; `init()` is idempotent.
**When to use:** All background-bound traffic in Phase 1 and beyond.
**Example** (contract per MessageBus.ts:49 verified in-repo; shape per WXT 0.20 docs):
```typescript
// Source: in-repo src/core/messaging/MessageBus.ts:49 + wxt.dev/guide/essentials/entrypoints [CITED]
export default defineBackground({
  main() {
    BackgroundRouter.register(); // internally: MessageBus.init() — idempotent
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  },
});
// handler contract: (message, sender) => { …; sendResponse({ ok: true }); return true; }
```

### Pattern 2: Gesture-safe `chrome.sidePanel.open` (D-06)
**What:** Call `sidePanel.open` synchronously inside the user-gesture call stack; never `await` first.
**When to use:** "Focus Side Panel" command and any programmatic panel open.
**Example** [CITED: developer.chrome.com/docs/extensions/reference/api/sidePanel + crbug.com/1478648]:
```typescript
// In the SW message handler — gesture flag survives ~1 ms only (crbug 1478648)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FOCUS_SIDE_PANEL') {
    const tabId = sender.tab?.id;            // resolve sync, no await before open
    chrome.sidePanel.open({ tabId }).catch(() => {/* user-gesture error fallback */});
    sendResponse({ ok: true });
  }
  return true;
});
```

### Pattern 3: Coalesced chrome.storage persistence (D-22)
**What:** Trailing-debounce (250–500 ms) in the `StateStorage.setItem` adapter + flush on `beforeunload`/`visibilitychange`; zustand `version: 1` + `migrate` for schema evolution.
**When to use:** Every persisted store (useExtensionStore, WorkspaceStore, ThemeStore).
**Example** (zustand v5 persist verified via context7 docs; adapter pattern in-repo):
```typescript
// Source: zustand persist docs — version/migrate [CITED: pmndrs/zustand persisting-store-data.md]
persist(immer((set) => ({ … })), {
  name: 'np_store',
  version: 1,
  migrate: (persisted) => persisted, // v1 is the schema — no-op
  storage: createJSONStorage(() => chromeStorageAdapter), // debounce lives in setItem
});
```

### Pattern 4: Runtime theme switching without remount
**What:** `ThemeProvider` re-renders `ConfigProvider` with a new `theme` prop; antd derives all tokens from the algorithm array.
**When to use:** Theme toggle on either surface.
**Example** [CITED: ant-design customize-theme docs (algorithm array + dynamic switching)]:
```tsx
// Source: antd docs — theme.algorithm accepts an array; switching is a prop update
<ConfigProvider locale={enUS} theme={{ algorithm: [dark ? theme.darkAlgorithm : theme.defaultAlgorithm, ...(compact ? [theme.compactAlgorithm] : [])], token: { colorPrimary: '#3B82F6' } }}>
```

### Anti-Patterns to Avoid
- **Raw `chrome.runtime.onMessage` in background.ts:** bypasses the typed envelope path and makes content-script traffic untyped (D-13 removes `background.ts:28-34`).
- **`await` before `chrome.sidePanel.open()`:** the user-gesture flag expires in ~1 ms (crbug 1478648) — resolve tabId synchronously first.
- **`window.close()` after handoff:** Flow 11 mandates a read-only mirror, not closing the panel (D-05).
- **Old antd v4/v5 props:** `visible`, `destroyOnClose`, `maskClosable` are deprecated in v6 — use `open`, `destroyOnHidden`, `mask.closable` (verified v6 Modal API).
- **`@ts-ignore` in the strict sweep:** use `// @ts-expect-error NP-STRICT-<n>: <reason>` so suppressed errors self-destruct when types improve (D-21).
- **Per-write `storage.sync.set` from zustand:** storage.sync throttles at 120 writes/min (1,800/hour sustained) — the coalesced adapter is mandatory (REQ-R03/D-22).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message dispatch | Another raw onMessage listener | MessageBus + RuntimeEnvelope + BackgroundRouter (D-13/D-14) | Typed envelope path is the cross-phase contract; raw listeners fork the path |
| Tab dedup / open | Custom tab registry | `chrome.tabs.query({url})` + update/create (WorkspaceRouter) | Match patterns ignore query strings → base-URL dedup handles `?workspaceId=…`; tabs API owns focus semantics |
| Persistence versioning | Manual JSON migration code | zustand `version` + `migrate` | Built-in, tested, runs at hydration; separate axis from IndexedDB DB_VERSION (D-22) |
| Storage write coalescing | Debounce inside each store action | One debounced `chromeStorageAdapter.setItem` | Single choke point for all persisted stores; testable write-rate assertion |
| Theme derivation | Hand-written dark-mode CSS | antd `theme.algorithm` + ConfigProvider | Token system covers all components; cssVar/zeroRuntime available in v6 |
| Command palette UI | New palette component | Existing `CommandPalette.tsx` + `CommandRegistry` | Already modal-based with keyboard nav; Phase 1 only registers commands (D-08) |
| Onboarding steps | Custom step machine | antd Modal/Steps + zustand store | Spec §12 state strings; wizard is being *shrunk*, not re-platformed (D-01) |
| Extension page open (Options) | Manual chrome.tabs.create everywhere | `open-options` command via registry | Single command path; Flow 10 set |

**Key insight:** Every "don't hand-roll" item here is an *existing scaffold abstraction* (MessageBus, BroadcastBus, RuntimeEnvelope, CommandRegistry, chromeStorageAdapter) that Phase 1 must **wire, not replace**. The phase's difficulty is convergence and deletion, not invention — the traps are leaving dead paths behind (dual messaging, `app.html` refs, tailwind plugin) and letting the grep gates silently pass with vacuous tests.

## Runtime State Inventory

> Phase 1 includes renames (D-07), a storage-key migration (D-10), and schema versioning (D-22) — inventory applies. Note: the extension is pre-release (scaffold only, never published), so runtime state exists only on the developer's machine.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | chrome.storage.local `np_store` holding demo content (INITIAL_SESSIONS/INITIAL_WRITE_HISTORY/INITIAL_NOTES at useExtensionStore.ts:84-515); scaffold key `np_theme_store` in local; `onboardingComplete` in storage | **Code edit** (D-11 empties INITIAL_* for new installs) + **data migration** for any existing dev profile (D-10 migrates np_theme_store → sync.np_theme; D-22 adds version:1 + no-op migrate — existing persisted JSON without version hydrates as v1). Non-production data; manual chrome.storage.local.clear() on dev profiles is an acceptable fallback |
| Live service config | None — no external services configured (AI provider config is local state only; proxyUrl default `http://localhost:12380/v1` at useExtensionStore.ts:31,70 is scaffold-only and NOT canonical per D-12) | None (Phase 1 leaves provider endpoints to Phase 3) |
| OS-registered state | None — no task schedulers, launchd, or system registrations | None — verified: Phase 1 touches only the repo + chrome.storage |
| Secrets/env vars | None — no API keys persisted yet (onboarding key entry lands this phase; keys will live in np_store config → chrome.storage.local per existing pattern) | None for Phase 1; note for Security Domain: storage.local is unencrypted — standard practice for MV3, flag for Phase 3 provider-key handling |
| Build artifacts | `package-lock.json` (tracked, to be removed per D-23-note); `pnpm-lock.yaml` + `pnpm-workspace.yaml` (untracked, to be committed); `.output/`, `dist/`, `.wxt/` (untracked, excluded from scaffold-import commit per D-23); global `ctx7` CLI installed this session (research tooling, not project state) | Reinstall/regenerate: `pnpm install` after D-20 bumps; lockfile canonicalization per D-23-note |

## Common Pitfalls

### Pitfall 1: SW suspension kills the cold-start path
**What goes wrong:** MV3 background SW is non-persistent; a fresh `chrome.runtime.sendMessage` can arrive before `MessageBus.init()` finished, or the SW can be spun down mid-stream.
**Why it happens:** `defineBackground.main()` runs on SW startup; without an idempotent init on every wake, listeners are missing.
**How to avoid:** `BackgroundRouter.register()` (internally `MessageBus.init()`) is idempotent and runs on every SW start (D-13); cold-start test `tests/background/message-bus-cold-start.test.ts` asserts a message right after init resolves. Source: PITFALLS P1 [CITED: .planning/research/PITFALLS.md].
**Warning signs:** First message after browser restart never answers; handler registered only on `onInstalled`.

### Pitfall 2: chrome.storage write-rate throttle
**What goes wrong:** `chrome.storage.local` drops writes silently at ~120 writes/min; `storage.sync` at 2/sec sustained (1,800/hour). Zustand persist writes on **every** `setState` — streaming chat state would blow the throttle.
**Why it happens:** No built-in debounce in zustand persist (verified); the adapter writes synchronously per change.
**How to avoid:** 250–500 ms trailing debounce + `beforeunload`/`visibilitychange` flush in `chromeStorageAdapter` (D-22); write-rate assertion test targets **≤ 30 writes/min** steady-state. Source: PITFALLS P2 [CITED].
**Warning signs:** `runtime.lastError` quota errors; state missing after hard close.

### Pitfall 3: sidePanel.open user-gesture rejection
**What goes wrong:** "`sidePanel.open()` may only be called in response to a user gesture" — even when triggered by a click.
**Why it happens:** The gesture flag survives only ~1 ms (crbug 1478648); any `await`/async hop before `open()` (tabs.query round-trip, storage read) destroys it.
**How to avoid:** Resolve `tabId` synchronously (from `sender.tab`) and call `open()` immediately in the listener; keep a fallback UI affordance if it rejects (see Pattern 2).
**Warning signs:** Intermittent failures only on the first click after idle; works in devtools, fails in production.

### Pitfall 4: Message-channel races (sendResponse twice / never)
**What goes wrong:** Async `sendResponse` called after the channel closed, or handler returns `false` while still sending — message lost.
**Why it happens:** MV3 SW can suspend between send and response; two handlers can both answer one message.
**How to avoid:** Every envelope handler returns `true` synchronously and calls `sendResponse` **once** (D-13, REQ-R01). Source: PITFALLS P4 [CITED].
**Warning signs:** Content script hangs waiting on SW; "The message port closed before a response was received" in console.

### Pitfall 5: Hidden side panel misses storage.onChanged
**What goes wrong:** Theme/handoff updates don't appear until the panel is visible again.
**Why it happens:** A hidden side panel's JS is throttled (rAF-driven React renders don't run); storage events are queued until visible [CITED: chromium-extensions thread 2024-10].
**How to avoid:** Handoff flushes state + WORKSPACE_HANDOFF *before* opening the tab (Flow 11 order); the mirror banner is read on refocus (visibilitychange). Do not rely on live onChanged delivery to a hidden panel.
**Warning signs:** Panel shows stale theme after toggling in Standalone view while panel closed.

### Pitfall 6: Grep gates passing vacuously
**What goes wrong:** Isolation test greps non-existent paths (`components/app/`) — always green, proves nothing (verified: tests/isolation/cross-entrypoint-imports.test.ts).
**Why it happens:** Tests were written against the spec's future layout, not the scaffold.
**How to avoid:** D-17 repoints greps at real dirs (`src/components/chat/`, `standalone/`, `options/`) and adds the content-script `fetch(` grep. Keep gate strings literal (`tailwind|shadcn|@radix-ui|framer-motion` — note `motion` alone is legal per STACK.md §35).
**Warning signs:** Isolation test file references paths that don't exist (assert with `glob` in the test itself).

### Pitfall 7: strict:true flood
**What goes wrong:** Enabling `strict: true` surfaces hundreds of errors across the scaffold — the phase stalls.
**Why it happens:** Scaffold was written under `strict: false`; `.wxt` generated shims and third-party typing gaps add noise.
**How to avoid:** D-21's two-tier sweep: trivial ≤1-line fixes first, then `// @ts-expect-error NP-STRICT-<n>: <reason>` for structural residue with a declared ceiling enforced by a grep test. `verify:phase-1` is `tsc --noEmit` — noEmitOnError is a no-op, so the gate only goes green when errors are actually gone or suppressed.
**Warning signs:** `tsc --noEmit` error count > 50 after the cheap sweep — sweep ordering was skipped.

## Code Examples

### 1. Idempotent standalone open with dedup (Flow 11 core)
```typescript
// Shape: in-repo WorkspaceRouter.ts + tabs.query semantics
// [CITED: developer.chrome.com/docs/extensions/reference/api/tabs — url match patterns,
//  fragment identifiers are not matched; query strings are ignored by pattern matching]
const STANDALONE_URL = chrome.runtime.getURL('standalone.html');

async function openStandalone(workspaceId: string, conversationId?: string, page?: string) {
  const existing = await chrome.tabs.query({ url: STANDALONE_URL }); // matches ?workspaceId=… too
  const params = new URLSearchParams({ workspaceId });
  if (conversationId) params.set('conversationId', conversationId);
  if (page) params.set('page', page);
  const url = `${STANDALONE_URL}?${params.toString()}`;
  if (existing.length > 0) {
    await chrome.tabs.update(existing[0].id!, { active: true, url });  // no duplicate tab
    await chrome.windows.update(existing[0].windowId, { focused: true }); // macOS focus
  } else {
    await chrome.tabs.create({ url });
  }
}
```

### 2. Zustand persist with version + migrate (D-22)
```typescript
// Source: zustand v5 persist docs — version/migrate + createJSONStorage [CITED: pmndrs/zustand]
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({ workspaceId: crypto.randomUUID(), activeSurface: 'sidepanel', /* … */ }),
    {
      name: 'np_workspace',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        if (version === 0) { /* future migrations shape v0 → v1 here */ }
        return persisted as WorkspaceState;
      },
      storage: createJSONStorage(() => chromeStorageAdapter), // debounce inside adapter
    },
  ),
);
```

### 3. AntD v6 Modal (OnboardingModal / CommandPalette)
```tsx
// Source: antd v6 Modal API — open, destroyOnHidden (not destroyOnClose), mask.closable
// [CITED: ant-design/components/modal/index.en-US.md]
<Modal
  open={open}
  onCancel={onClose}
  destroyOnHidden          // v6 name; destroyOnClose is deprecated
  maskClosable={false}     // or mask={{ closable: false }} (maskClosable deprecated in v6)
  footer={null}
  width={420}
>
  <Steps current={step} items={[{ title: 'NowPilot' }, { title: 'Provider' }, { title: 'Key' }, { title: 'Validate' }]} />
</Modal>
```

### 4. Theme switch via ConfigProvider theme update
```tsx
// Source: antd customize-theme docs — dynamic switching is a prop update [CITED]
const { mode, effectiveDark } = useThemeStore();
const algorithm = [effectiveDark ? theme.darkAlgorithm : theme.defaultAlgorithm];
return (
  <ConfigProvider theme={{ algorithm, token: { colorPrimary: '#3B82F6', borderRadius: 8 } }}>
    {/* antd v6: cssVar and zeroRuntime (v6.0.0+) are optional ConfigProvider.theme fields */}
  </ConfigProvider>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| antd v5 (`visible`, `destroyOnClose`, `maskClosable`) | antd v6 (`open`, `destroyOnHidden`, `mask.closable`; cssVar/zeroRuntime) | v6.0.0 (2025) | Scaffold must use v6 prop names; verify all Modal/Drawer usages in Phase 1 |
| framer-motion | `motion` package (motion.dev) | 2024 rebrand | Spec's "no framer-motion" forbids the literal package name; `motion` ^12 is allowed (STACK.md §35) |
| WXT 0.20 | WXT 0.21 (generated tsconfig strict:true) | 0.21.x | ADR-STACK-01 holds 0.20.27 for v0.1; 0.21 is the post-v0.1 upgrade |
| zustand v4 | zustand v5 (persist middleware unchanged API, createJSONStorage) | v5.0.0 | Persist options verified against v5 docs |
| Raw onMessage + localStorage fallback | Typed envelopes + chrome.storage.sync/onChanged | Phase 1 (this phase) | Single-source-of-truth per APPR-03; storage.onChanged is the propagation channel |

**Deprecated/outdated:**
- `chrome.sidePanel.close()` without tabId: rejects since Chrome 145 if only the global panel is open — not used in Phase 1, note for later.
- `tabs.query` fragment matching: fragments are never matched — don't dedup on fragment values.
- `@ts-ignore`: replaced by `@ts-expect-error NP-STRICT-<n>` self-destructing suppressions (D-21).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chrome.tabs.query({url: chrome-extension://…/standalone.html})` matches tabs opened with query params — match patterns ignore query strings [ASSUMED: inferred from match-pattern semantics; official docs confirm "fragment identifiers are not matched" but don't state query handling explicitly] | Code Examples 1 | Dedup silently creates duplicate tabs; mitigated by the D-04 acceptance criterion (idempotent re-open test in WorkspaceRouter.test.ts) |
| A2 | Hidden side panel JS is suspended/throttled such that storage.onChanged is not processed until visible [ASSUMED: from chromium-extensions forum reports, not official docs] | Pitfall 5 | Mirror-banner refresh-on-refocus still works via visibilitychange; theme may look stale while panel hidden — cosmetic only |
| A3 | WXT 0.21 flips generated tsconfig to strict:true (basis of ADR-STACK-01 hold) [ASSUMED: cited from RESEARCH-RECONCILIATION.md, not re-verified against wxt changelog this session] | Standard Stack | Hold remains correct either way; only the rationale changes |
| A4 | CONTEXT.md's "14 references" to OnboardingWizard: this session found 2 (`SidepanelChat.tsx:5,412`) [ASSUMED: grep may miss dynamic/indirect references] | User Constraints D-01 | Cosmetic — the D-01 migration sweep is exhaustive regardless of reference count |
| A5 | `motion` ^12.23.24 satisfies the grep gate because the literal string `framer-motion` doesn't appear in package.json [ASSUMED: verified this session — package.json contains `motion`, not `framer-motion`] | Pitfall 6 | If the gate is interpreted as "no animation libraries at all", D-18 must also remove `motion` — flag for discuss-phase confirmation |
| A6 | ctx7 CLI (npm, 0.5.8, official upstash/context7 repo) is a legitimate research tool [ASSUMED: seam flags SUS due to recency only; 42K weekly downloads, repo matches official org] | Sources | Research-tooling only; zero impact on the build |
| A7 | `storage.sync` write limits (120/min, 1800/hour) apply as documented [ASSUMED: cited from MDN/Chrome docs snapshots in websearch results] | Don't Hand-Roll | D-22's ≤30 writes/min target is 4× under the limit either way — safe margin |

## Open Questions

1. **Debounce window: 250 ms vs 500 ms (D-22)**
   - What we know: spec/context mandate 250–500 ms trailing debounce; write-rate target ≤ 30 writes/min.
   - What's unclear: exact value; shorter = fresher handoff flush, longer = fewer writes.
   - Recommendation: 300 ms trailing + flush hooks; the write-rate assertion test makes either value verifiable — planner's call.
2. **Keep `np_theme` BroadcastChannel alongside storage.sync + onChanged?**
   - What we know: D-10 permits retaining it; APPR-03 makes sync+onChanged the source of truth.
   - What's unclear: the BroadcastBus adds an extra propagation path that can race with onChanged.
   - Recommendation: retain the channel as the *fast path* for same-window surfaces, storage.onChanged as the *recovery path* — but a single-path implementation (onChanged only) is also compliant. Planner picks one; document in code.
3. **D-07a entrypoint location — RESOLVED (not open):**
   - Decision: entrypoints KEPT at project root `entrypoints/` (WXT default; the built scaffold already uses it). No migration to src/entrypoints/. (PHASE-1-PLANNING-ADDENDUM §3 / STATE.md decision 16.)
   - Consequence: set wxt.config.ts `srcDir` to root; reconcile spec §5.1/§8.5 `src/entrypoints/` wording DOWN to root. Only the content-script path shape is normalized to `entrypoints/content/core.content.ts`. No relocation task; no import rewrite.
4. **Tailwind CSS usage extent in src/components**
   - What we know: `src/index.css:1` imports tailwind; plugin in wxt.config.ts:15; package.json devDeps.
   - What's unclear: how many components actually use `bg-`/`flex-`/`text-` utility classes (not yet counted this session) — determines the D-18 rewrite blast radius.
   - Recommendation: add a Wave-0 task "grep `className=.*(bg-|flex-|text-|p-|m-|w-|h-)` in src/components" to size the rewrite before the D-18 task starts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, tests, wxt CLI | ✓ | v24.19.0 | — |
| pnpm | Package manager (canonical per D-23-note) | ✓ | 11.22.0 | npm 12.0.2 (warning only) |
| npm | Registry queries | ✓ | 12.0.2 | — |
| Google Chrome | MV3 extension runtime (manual dev-testing via `wxt`) | ✓ | /Applications/Google Chrome.app | — |
| wxt CLI | `wxt` / `wxt build` | ✓ (via pnpm scripts) | 0.20.27 | — |
| ctx7 CLI | Research only (this session) | ✓ | 0.5.8 | — |
| vitest | Test runner | ✓ (via pnpm) | 3.x | — |

**Missing dependencies with no fallback:** none — all Phase-1 dependencies are present.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (STACK.md 3.2.7) + jsdom 25 + @testing-library/react 16 |
| Config file | vitest.config.ts (jsdom env, globals: true, setupFiles: tests/setup.ts, alias `@`) |
| Quick run command | `pnpm vitest run tests/core/workspace -t openStandalone` |
| Full suite command | pnpm run verify:phase-1 = tsc --noEmit && vitest run tests (whole tests/ tree). **B2 fix:** the scaffold script only globs tests/core/{runtime,events,workspace,theme}, which EXCLUDES the Wave-0 tests in tests/background/, tests/components/, tests/core/storage/, tests/isolation/, and the NP-STRICT grep — widen the script (see below) so the phase gate actually runs them. Reconcile with spec §24: whatever §24 fixes verify:phase-1 to, the DONE-when tests MUST be inside its glob. |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-R01 | MessageBus cold start: envelope answered right after init; single sendResponse | unit | `pnpm vitest run tests/background/message-bus-cold-start.test.ts` | ❌ Wave 0 (D-13) |
| REQ-R01 | BackgroundRouter registers typed handlers; raw listener gone | unit | `pnpm vitest run tests/background/background-router.test.ts` | ❌ Wave 0 |
| REQ-F05/F20 | openStandalone dedup: existing tab focused, no duplicate; URL params correct | unit | `pnpm vitest run tests/core/workspace/WorkspaceRouter.test.ts` | ✅ — **but asserts `app.html` (legacy) — must be updated for D-07** |
| REQ-F05 | hydrateFromURL parses ws/conv/page params | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts` | ✅ (extend) |
| REQ-R05 | isPrimaryWriter() returns true, stable signature | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts` | ✅ (extend) |
| REQ-F12 | Flow 10 command set registered on both surfaces; duplicate-id throw | unit | `pnpm vitest run tests/components/CommandPalette.test.tsx` (new) | ❌ Wave 0 |
| REQ-F19 | OnboardingModal 4 steps, connection-failure keeps wizard open, §12 strings | component | `pnpm vitest run tests/components/OnboardingModal.test.tsx` (new) | ❌ Wave 0 |
| D-10 | ThemeStore persists to sync.np_theme; pack field default 'default'; onChanged propagation | unit | `pnpm vitest run tests/core/theme/ThemeStore.test.ts` + `ThemeSync.test.tsx` | ✅ (extend) |
| D-22 | Write-rate ≤ 30/min with debounce; flush on visibilitychange | unit | `pnpm vitest run tests/core/storage/chromeStorageAdapter.test.ts` (new) | ❌ Wave 0 |
| REQ-R02 | No fetch( in content entrypoints; no cross-imports between surface dirs | unit (grep-based, repointed) | `pnpm vitest run tests/isolation` | ✅ (rewrite per D-17) |
| REQ-R04 | Frozen extraction envelope types compile | unit | `pnpm vitest run tests/core/runtime/RuntimeEnvelope.test.ts` | ✅ (extend) |
| D-21 | NP-STRICT marker count ≤ ceiling | grep assertion | part of `verify:phase-1` (new test) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <affected-scope>` (e.g., `tests/core/workspace`)
- **Per wave merge:** `pnpm run verify:phase-1` (full suite + tsc)
- **Phase gate:** Full suite green + grep gates at zero before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/background/message-bus-cold-start.test.ts` — REQ-R01 cold-start (D-13)
- [ ] `tests/background/background-router.test.ts` — REQ-R01 registration (D-14)
- [ ] `tests/components/OnboardingModal.test.tsx` — REQ-F19 (D-01/D-02/D-03)
- [ ] `tests/components/CommandPalette.test.tsx` — REQ-F12/F20 command sets (D-08)
- [ ] `tests/core/storage/chromeStorageAdapter.test.ts` — D-22 write-rate assertion
- [ ] `tests/core/workspace/WorkspaceRouter.test.ts` **update** — currently asserts `app.html` legacy URLs (verified) — breaks on D-07 rename
- [ ] NP-STRICT ceiling grep test — D-21

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user accounts in v0.1; provider API keys are config, not auth |
| V3 Session Management | no | MV3 SW lifecycle is browser-managed; no sessions |
| V4 Access Control | yes | Least-privilege manifest `['sidePanel','storage','tabs']` (D-19a); `optional_host_permissions` + `chrome.permissions.request()` deferred per-phase; `optional_permissions: ['webNavigation']` (Appendix G) |
| V5 Input Validation | yes | zod ^4 runtime validation on envelope payloads and provider config; `RuntimeEnvelope.isEnvelope` discriminated-union check |
| V6 Cryptography | no | No crypto in Phase 1; API keys in chrome.storage.local (unencrypted by platform design) — Phase 3 should consider masking + never logging keys |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Message spoofing / forged envelopes from content scripts | Spoofing | Typed envelopes + sender validation (`sender.id === chrome.runtime.id`) in BackgroundRouter handlers; no raw onMessage path after D-13 |
| XSS via innerHTML | Tampering | Grep gate: 0 `innerHTML`/`dangerouslySetInnerHTML` in `src/` (verified passing today); antd renders text safely; @ant-design/x-markdown output sanitized downstream (Phase 3+ concern) |
| Injection via content-script-sourced payloads (P7 discipline) | Tampering | Treat content-script payloads as untrusted input; frozen envelope types with zod validation at the SW boundary (REQ-R04/D-15); indirect prompt-injection red-team corpus deferred to Phase 19 |
| Storage tampering / quota abuse | Tampering/DoS | Coalesced writes (D-22) stay under storage.sync throttle; `runtime.lastError` never swallowed by the adapter (REQ-R07 lands Phase 2) |
| CSP violations / connect-src creep | — | script-src 'self'; connect-src widened per-provider at Phase 3, not pre-opened (D-19); extension_pages CSP per Appendix G |

## Sources

### Primary (HIGH confidence — in-repo, read this session)
- `src/core/messaging/MessageBus.ts` (init at :49, no callers — verified via grep) — dual messaging path
- `entrypoints/background.ts:28-34` raw onMessage listener; onInstalled onboardingComplete logic
- `src/core/workspace/WorkspaceRouter.ts:12,21` — `app.html` reference (file does not exist)
- `src/core/runtime/RuntimeEnvelope.ts` — MessageTypeValues (8 values) + source union (5 values) + createEnvelope/randomUUID
- `src/core/theme/{ThemeStore,ThemeSync,chromeStorageAdapter}.ts` — np_theme persist, BroadcastBus, storage adapter
- `src/core/commands/CommandRegistry.ts`, `src/components/common/CommandPalette.tsx` — palette infra
- `src/components/common/OnboardingWizard.tsx` (1006 lines; timer :99-108; handleTestConnection :112-119; motion import :17)
- `src/store/useExtensionStore.ts` (INITIAL_* :84-515; proxyUrl :31,70; themeMode bridging :578-588)
- `src/services/aiProvider.ts` (simulateStreamResponse :101-217; fallback models :76-88)
- `package.json` (verify:phase-1 script; **tailwindcss/@tailwindcss/vite in devDeps — grep gate fails**; zod ^3.24.0/immer ^10.1.1 pre-bump), `wxt.config.ts` (9 permissions :31-45; tailwind plugin :15), `tsconfig.json:8` (strict: false)
- `tests/setup.ts` (152 lines; localStorage/matchMedia/Map-backed chrome.storage.local mocks), existing test files in tests/core/*
- `.planning/CONTEXT.md` (D-01…D-23, discretion, deferred — verbatim above)
- `.planning/RESEARCH-RECONCILIATION.md` (REQ-R register, ADR-STACK-01/02), `.planning/PRODUCT_SPEC_v0_1.md` (Flows 9-11, §12, App. F/G, §18), `.planning/ROADMAP.md` Phase 1 row, `.planning/codebase/{CONCERNS,STACK}.md`

### Secondary (MEDIUM confidence — official docs via context7 CLI / websearch of official sources)
- [CITED: wxt.dev/guide/essentials/entrypoints] — defineBackground/defineContentScript/side-panel HTML meta tags (context7: /websites/wxt_dev_guide)
- [CITED: developer.chrome.com/docs/extensions/reference/api/sidePanel] — open()/setPanelBehavior/gesture semantics (context7-adjacent; official reference surfaced via websearch)
- [CITED: developer.chrome.com/docs/extensions/reference/api/tabs] — query url match patterns; fragment caveat
- [CITED: developer.chrome.com/docs/extensions/reference/api/storage] — quotas + onChanged pattern
- [CITED: pmndrs/zustand persisting-store-data.md / persist.md] — version/migrate/createJSONStorage/partialize/skipHydration (context7: /pmndrs/zustand)
- [CITED: ant-design customize-theme.en-US.md + components/modal/index.en-US.md] — algorithm array, dynamic switching, v6 Modal props (context7: /ant-design/ant-design)

### Tertiary (LOW confidence — websearch threads, marked for validation)
- [ASSUMED/CITED: crbug.com/1478648, chromium-extensions threads] — ~1 ms gesture window; hidden-side-panel event throttling
- [ASSUMED: stackoverflow.com/questions/77213045] — callback-vs-await workaround for sidePanel.open

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified via npm registry this session; SUS verdicts explained as recency artifacts
- Architecture: HIGH — all in-repo facts read from source this session (paths + line ranges cited); external API details MEDIUM (official docs) to LOW (forum-derived)
- Pitfalls: HIGH for in-repo-verified items (dual messaging, vacuous tests, tailwind gate, app.html); MEDIUM for platform-behavior items (gesture window, hidden-panel throttling)

**Research date:** 2026-08-19
**Valid until:** 2026-09-18 (30 days — stack is stable; WXT/antd patch releases may drift versions)