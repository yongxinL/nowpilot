# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 converges the existing WXT/MV3 scaffold onto a single typed messaging + persistence layer, wires the **workspace handoff** between Side Panel and Standalone view (Flow 11), establishes the **cross-surface Cmd+K palette** (Flow 10), triggers **first-run OnboardingModal** on fresh install (Flow 9), proves **theme propagation** between surfaces via the existing `BroadcastBus` (`np_theme`), and ships the **MV3 discipline** that every later phase builds on (single MessageBus layer, frozen extraction envelope types, `isPrimaryWriter()` predicate, coalesced persistence, least-privilege manifest, `strict: true`).

**Scope is per spec §18 Phase 1.** Success criteria are the verbatim Phase 1 DONE-when checklist: Side Panel opens; OnboardingModal on fresh install; Standalone view open + idempotent re-open by workspaceId (no duplicate tabs); BackgroundRouter envelope dispatch; RuntimeEnvelope fixtures; Cmd+K palette on both surfaces with the Flow 10 set; theme toggle propagates immediately; grep gates (`innerHTML`/`dangerouslySetInnerHTML` → 0; `tailwind`/`shadcn`/`@radix-ui`/`framer-motion` in `package.json` → 0); `pnpm run verify:phase-1` passes.

**Out of scope (verified in PROJECT.md / REQUIREMENTS.md Out of Scope):** real AI provider integration (Phase 3), page extraction strategies (Phase 6), trust-aware context (Phase 7), notes/memory (Phase 8/9/10), RICH persona card "Meet NowPilot" (Phase 15 — RICH-R-03 deferred to a Flow 9 step-1 placeholder only in Phase 1, real card in 15.3).

**Bounded by PROJECT.md Validated inventory:** Phase 1 builds on the existing scaffold (entry points, Side Panel compact chat UI, Standalone shell, Options, Runtime/MessageBus/EventBus/BroadcastBus, Zustand+immer stores w/ chrome.storage, AI provider service, registries, theme system). Phase 1 does NOT rebuild these; it converges the dual messaging paths, removes the spec-violating Tailwind scaffold leftover, dead-code-removes the unwired infrastructure, and re-baselines manifest/strictness per ADR-STACK-01/STACK-02.

</domain>

<decisions>
## Implementation Decisions

### Onboarding (Flow 9)

- **D-01 (OnboardingWizard → OnboardingModal):** Migrate `src/components/common/OnboardingWizard.tsx` (1006 lines, 7 steps, Step 4 auto-advances on a 10 s timer, Steps 6/7 mutate local state only) to a **thin 4-step `src/components/OnboardingModal.tsx`** matching spec §18's create list. Step 4 sequence: **Meet-NowPilot placeholder → pick provider → enter key → validate**. The persona card (RICH-R-03) ships as a placeholder Step 1 in Phase 1; the real "Meet NowPilot" character-introduction card lands in Phase 15.3. — **Reversibility:** `costly` — rationale: spec file path + Flow-9 step sequence is the public API surface; renaming `OnboardingWizard` callers (14 references in `src/components/chat/SidepanelChat.tsx` etc.) is a one-sweep move but the wizard component lives in many UAT scripts and integration sites downstream phases will inherit.
- **D-02 (Drop Step-4 10 s auto-advance + Steps 6/7):** Onboarding must advance only on explicit "Next" or successful connection test. The 10 s timer in `OnboardingWizard.tsx:99-108` is removed; MCP-tool / ServiceNow-permission switches (Steps 6/7, mutate local state only) are dropped entirely from Phase 1 scope (they need permissions that don't ship until Phase 17). — **Reversibility:** `reversible` — rationale: local component refactor; no external contract.
- **D-03 (Real connection test):** Replace the 1 s `setTimeout` always-success test (`OnboardingWizard.tsx:112-119` + `OptionsPage.tsx:240-257`) with a real `fetchProviderModels` call. The test reports `resp.ok` / HTTP error; a failed connection must show the spec §12 string `Connection failed: [error]` and keep the wizard open. — **Reversibility:** `reversible` — rationale: pure function replacement inside the validation path.

### Workspace handoff (Flow 11) + cross-surface messaging

- **D-04 (Wire full Flow 11 — no stub):** Phase 1 ships end-to-end workspace handoff, not a UI mirror against a stubbed handoff. This is a Phase-1 v1 requirement (REQ-F05, REQ-F19, REQ-F20, REQ-F12). Implementation: `WorkspaceRouter.openStandalone(workspaceId, conversationId?, page?)` (currently `openFullApp` and points at non-existent `app.html`) is renamed and fixed to open `standalone.html?workspaceId=…&conversationId=…&page=…`. Standalone view boots → calls `WorkspaceStore.hydrateFromURL(searchParams)` → fires `WORKSPACE_HANDOFF` over `np_workspace` `BroadcastChannel`. Side Panel demotes to read-only mirror until refocused (per Flow 11) instead of `window.close()`'ing. — **Reversibility:** `costly` — rationale: touches every entry point and the BroadcastBus typed-message contract; Phase-2 authoritativeness builds on it.
- **D-05 (Side Panel post-handoff behavior):** Flow 11 says "side panel demotes to read-only mirror until refocused." Phase 1 implements the mirror, not a close. The mirror means: in Side Panel, the composer is disabled, the message list is read-only, and a thin status banner reads "Switched to Standalone. [Refocus here]". On user click, the banner clears and the composer re-enables. The current `handleOpenStandalone → window.close()` (entrypoints/sidepanel/main.tsx:36) is replaced. — **Reversibility:** `reversible` — rationale: pure UI-side behavior.
- **D-06 (Standalone → Side Panel refocus):** Symmetric "Focus Side Panel" command (REQ-F21, Phase 15 full polish — but Phase 1 ships the framework; the actual command ships as a Flow 10 entry `open-side-panel` that calls `chrome.sidePanel.open({ tabId })`). Phase 15 will swap the empty handler for the full UI merge. — **Reversibility:** `reversible` — rationale: command-stub; Phase 15 replaces.
- **D-07 (Canonicalize Standalone naming):** Spec split: §5.1/§5.4/§18 use `standalone`; §8.1/§8.5 use `app`. Spec §0.4 says "single source of truth" — Phase 1 picks `standalone`. Rename in lockstep: `openFullApp → openStandalone`, `app.html → standalone.html` (reference paths only; the file at `entrypoints/standalone/index.html` already exists), `FullAppPageRegistry → StandalonePageRegistry`, `appPageId → standalonePageId` (consumers: `WorkspaceRouter.ts:12,21`, `entrypoints/standalone/main.tsx`, `src/core/registry/Registry.ts`, anything that mentions `app.html`). Fixes CONCERNS "Stale Architecture References". — **Reversibility:** `costly` — rationale: the names appear in CHANGELOG, type imports, and downstream references the planner will discover; one-time rename that must be exhaustive.

### Cross-surface Cmd+K palette (Flow 10)

- **D-08 (Flow 10 base set on both surfaces):** `src/components/common/CommandPalette.tsx` (existing) is the renderer. Phase 1 registers the Flow 10 base command set on both surfaces (`open-standalone-view`, `open-options`, `open-side-panel`, `toggle-theme`, `reload-extension`). Standalone view also gets `open-standalone-view` removed since the user is already there, plus a stubbed `focus-side-panel` (D-06). Side Panel mirrors are: `open-standalone-view` (REQ-F05), `open-options`. Phase 15 will register the full RICH catalog (suggestion templates, slash commands, etc.) on top of this base. — **Reversibility:** `reversible` — rationale: commands are registered in `useEffect` cleanup blocks; reversible via registry.
- **D-09 (Existing local Cmd+K handler kept in entrypoints):** The local `(Meta|Ctrl)+K → toggle palette` listeners (`sidepanel/main.tsx:109-118`, `standalone/main.tsx:78-87`) are reused. KeymapRegistry is the future home (per Flow 8) but Phase 1 does not wire it (that's a Phase 18 / Tool Governance job). — **Reversibility:** `reversible` — rationale: per-entrypoint local handlers; Phase 18 swap.

### Cross-surface theme propagation

- **D-10 (ThemeStore is the single source of truth):** `useThemeStore.mode` lives in both `useExtensionStore.config.themeMode` and `ThemeStore.mode` today (CONCERNS "Duplicate theme state with drift risk"). Phase 1 makes `ThemeStore` authoritative — `themeMode` is read-only and removed from `useExtensionStore` writes; the bridging in `updateConfig` (`useExtensionStore.ts:578-588`) is deleted; `useThemeSync` owns the `BroadcastBus` `np_theme` propagation. Phase 17 will rename to `np_theme_mode` (per spec §15.1 / §17.1a) when indexed DB schema versions align. — **Reversibility:** `costly` — rationale: per-store persistence keys (`np_theme_store` vs. `np_store`) and a manual mirror; one-time plus a migration if persisted user data still has the old field.

### Demo / simulated-AI purge (REQ-R20)

- **D-11 (Empty fresh-install state):** Phase 1 ships an empty first-run experience. All three `INITIAL_*` arrays are emptied (`INITIAL_SESSIONS` at `useExtensionStore.ts:84-318`, `INITIAL_WRITE_HISTORY` `:320-375`, `INITIAL_NOTES` `:377-515`). The hardcoded "critical thinking" / "Good morning to you too!" responses, fake INC001234 incident, and Unsplash image thumbnails are removed. Fresh install is a clean workspace. — **Reversibility:** `costly` — rationale: changes the default `np_store` JSON shape; any user upgrading from the scaffold's current state loses the demo content (acceptable — the prior data was fake anyway).
- **D-12 (simulateStreamResponse gated):** `simulateStreamResponse` (`src/services/aiProvider.ts:101-217`) is gated behind an explicit `DEMO_MODE` config key (default `false`) **AND** `import.meta.env.DEV`. Real fetch failures surface via `onError` (no canned fallback). The default `http://localhost:12380/v1` proxyUrl (`useExtensionStore.ts:31,70`) remains as a configured-but-disabled example; `simulateStreamResponse` is never the default code path. — **Reversibility:** `reversible` — rationale: gated feature flag; restore by re-enabling DEMO_MODE.

### Scaffold cleanup (REQ-R01, R02, R19, R21)

- **D-13 (Single messaging layer — REQ-R01):** `entrypoints/background.ts` calls `MessageBus.init()` on startup and registers handlers for the typed envelope types (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION` migrated to envelopes). The raw `chrome.runtime.onMessage` listener at `background.ts:28-34` is removed. Every handler returns `true` synchronously and calls `sendResponse` once (Pitfall 4). Cold-start test added: `tests/background/message-bus-cold-start.test.ts`. — **Reversibility:** `costly` — rationale: changes the public messaging contract; future phases add handlers against the typed envelope.
- **D-14 (BackgroundRouter as the typed wrapper):** ROADMAP.md Phase 1 goal reads "dual messaging paths converge onto `BackgroundRouter`". Phase 1 introduces `src/core/messaging/BackgroundRouter.ts` as the thin typed wrapper that calls `MessageBus.init()` and exposes a single registration API for background-side handlers. Content-script migration to typed envelopes happens at the same time so extraction envelope types are frozen (per Flag A). — **Reversibility:** `costly` — rationale: new public type, all background handlers route through it.
- **D-15 (Frozen extraction envelope types — REQ-R04 / Flag A):** Phase 1 declares `PAGE_LIVE_CONTEXT` (always-on), `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD` (with `baseUrl` + `truncated` reserved) in `src/core/runtime/RuntimeEnvelope.ts`. Implementation is type-only; the strategies (Defuddle → Readability, AX → DOM) ship in Phase 6. Phase 17's ServiceNow strategy + ordering reserve their `strategyId` here. — **Reversibility:** `costly` — rationale: cross-phase type contract; downstream phases import these symbols by name.
- **D-16 (isPrimaryWriter() predicate — REQ-R05 / Flag B):** Phase 1 declares `WorkspaceStore.isPrimaryWriter(): boolean`. In Phase 1 the predicate returns `true` for any caller (Phase 1 owns the *signature* and *interface*; Phase 2 owns the *election semantics* and gates MemoryEngine write paths). The predicate interface stays stable. — **Reversibility:** `reversible` — rationale: additive interface; Phase 2 layers enforcement.
- **D-17 (Real isolation tests — REQ-R02):** The current isolation test (`tests/isolation/cross-entrypoint-imports.test.ts`) greps for non-existent `components/app/` / `components/sidepanel/` paths and is vacuous. Phase 1 repoints the greps at the real directories (`src/components/chat/`, `src/components/standalone/`, `src/components/options/`) and asserts no cross-imports in either direction. Also adds: `grep -r 'fetch(' entrypoints/content.core.ts entrypoints/content/** → zero` (no `fetch` in content scripts, per PITFALLS P3). — **Reversibility:** `reversible` — rationale: test refactor; no production code touched.
- **D-18 (Remove Tailwind scaffold leftover — REQ-R19):** Spec §0.2 forbids `tailwind` / `shadcn` / `@radix-ui` / `framer-motion`. Phase 1 removes the `@tailwindcss/vite` plugin from `wxt.config.ts:8`, the `@import "tailwindcss"` from `src/index.css:1`, and any `tailwind.config.*` files. The `motion` package (^12 — successor of framer-motion, kept per STACK.md §35) is the only animation library. Verification gates: `grep 'tailwind|shadcn|@radix-ui|framer-motion' package.json → zero`. CSS that was authored with `bg-` / `flex-` / `text-` utility classes is rewritten to AntD-native equivalents + inline styles where unavoidable. — **Reversibility:** `costly` — rationale: every CSS-bearing file changes; visual regression risk.
- **D-19 (Least-privilege manifest — REQ-R21):** Drop the 5 (or 6 — see D-19-note) unused permissions from `wxt.config.ts:31-45`. Verified per VAI-08: only `sidePanel`, `storage`, `tabs` are exercised today. Drop: `cookies`, `alarms`, `scripting`, `contextMenus`, `notifications`, `declarativeNetRequest`. Phase 17 will re-add `cookies`, `scripting`, `contextMenus` via `chrome.permissions.request()` when ServiceNow / Selection → Ask AI ship; `alarms`, `notifications`, `declarativeNetRequest` stay out. CSP `connect-src` widens per-provider as users configure endpoints. — **Reversibility:** `reversible` — rationale: declarative permission; add back in Phase 17 via `optional_permissions`.
- **D-19-note (Verification gate before scope change):** Per VAI-08, `CONCERNS.md` (refreshed 2026-08-18) was not part of the research set — **Phase 1 must verify each defect against `src/` before treating as fact.** The list above reflects what VAI-08 verification confirmed: 5 unused permissions confirmed; dual messaging paths confirmed (raw `background.ts` + never-initialized `MessageBus`); Tailwind plugin confirmed; `localhost:12380` confirmed as default; `WorkspaceRouter.openFullApp → app.html` confirmed (file does not exist; real surface is `entrypoints/standalone/`).

### Stack + strictness drift (spec §7)

- **D-20 (Bump Immer 10 → 11, Zod 3 → 4):** Spec §7.3 / §7.4 mandate Immer 11 and Zod 4. Scaffold ships Immer 10.2.0 and Zod 3.24.0. Bump both in `package.json`; verify against the verified-version table in `RESEARCH-RECONCILIATION.md`. — **Reversibility:** `reversible` — rationale: dependency bumps; rollback is a revert + reinstall.
- **D-21 (strict: true in Phase 1):** Enable `tsconfig.json:8 → strict: true` per spec §7.8. Keep `noEmitOnError: false` so build emits for downstream consumption. Sweep every trivial cast (`as any` / `@ts-ignore` / `@ts-expect-error`) fixable in ≤1 line (e.g., `BroadcastBus event.data as any` → `MessageEvent<ThemeSyncMessage>`; store action payloads; runtime-envelope type assertions). For the residue that is genuinely structural (the `wxt.config.ts:15` tailwind-plugin cast `as any`, WXT-generated `.wxt` shims, third-party typing gaps), suppress with `// @ts-expect-error NP-STRICT-<n>: <reason>` — chosen over `@ts-ignore` because a suppressed error self-destructs once the underlying type is fixed (no silent rot). Add `verify:phase-1` assertion that greps `src/` + `entrypoints/` for `NP-STRICT-` markers and fails if the count exceeds a declared ceiling (the count remaining after the cheap-fix sweep). Phase 2–3 task: reduce the NP-STRICT ceiling to 0 (recorded in `.planning/STATE.md` watch-list, not implicit). — **Reversibility:** `costly` — rationale: touches every TypeScript file in the repo; the strict-mode enable is one-way until typed.

### Persistence granularity (REQ-R03)

- **D-22 (Coalesce + version/migrate — Phase 1 scope):** Add a `verify:phase-1` write-rate assertion test. Implement a 250–500 ms trailing-debounce + `beforeunload`/`visibilitychange` flush in the `chromeStorageAdapter` for `useExtensionStore` (the god-store, the canonical silent-data-loss victim per PITFALLS P2). Add `version: 1` + `migrate` to the zustand `persist` config; current users get no-op migrate because v1 *is* the schema (Phase 2's IndexedDB introduces v2). `WorkspaceStore` and `ThemeStore` get the same debounce. The full god-store → slice-store split is deferred to Phase 2 (per ROADMAP.md Phase 2 success criteria). — **Reversibility:** `costly` — rationale: touches the persistence-adapter contract and every persisted store; Phase 2 schema migrations assume v1 baseline.

### Git baseline first

- **D-23 (Commit scaffold as-is before any Phase-1 remediation):** `git ls-files` reports 13 tracked files; `src/`, `entrypoints/`, `tests/`, configs are untracked. Phase 1's first task is **a single "chore: scaffold import" commit** covering the implementation (excluding `.output/`, `dist/`, `.wxt/`), plus committing `pnpm-lock.yaml` and `pnpm-workspace.yaml` (currently untracked — see D-23-note). Every subsequent Phase-1 cleanup is then a diffable, revertable commit. — **Reversibility:** `reversible` — rationale: it's a commit, not a code change.
- **D-23-note (Single lockfile + package-manager canonicalization):** Both `package-lock.json` (committed) and `pnpm-lock.yaml` + `pnpm-workspace.yaml` (untracked) exist. Phase 1 picks pnpm as canonical (spec §7; `pnpm-workspace.yaml` is the intended pin), removes `package-lock.json`, commits `pnpm-lock.yaml`. Scripts continue to work via `pnpm run`; npm users get a warning pointing at the chosen manager. Record in `package.json` `packageManager: "pnpm@11.22.0"` field. — **Reversibility:** `reversible` — rationale: file deletion + lockfile track; revert by re-adding `package-lock.json`.

### the agent's Discretion

- **`isPrimaryWriter()` election semantics in Phase 1:** Phase 1 returns `true` for any caller (predicate exists but is not yet enforced). The election algorithm (background-SW authoritative vs. tabs.query highest-id vs. BroadcastBus subscriber) is the planner's call — it only matters in Phase 2 when MemoryEngine writes start calling it. Document the Phase-2 swap point in a code comment.
- **OnboardingModal step labels:** exact copy is the planner's call (spec §12 gives the *state strings*, not the *step labels*). Follow AntD conversational patterns.
- **Demoware-failover for the simulator refactor:** the agent may keep a minimal dev-only `src/dev/simulator.ts` if it makes `simulateStreamResponse` testable; placement is up to the planner.
- **Phase 1 plan split into 2 or 3 plans:** ROADMAP.md Progress Table lists `Phase 1: 0/3`. The planner decides whether 3 plans is appropriate or whether 2 wave-grouped plans is enough given the deliverables.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 1 block — Create list, Required tests, DONE-when checklist) — sole authority on the Phase-1 file inventory and gates.
- `.planning/PRODUCT_SPEC_v0_1.md` §9.1 / §9.2 — REQ-F05/F12/F19/F20 surface-level behavior (Side Panel / Standalone view).
- `.planning/PRODUCT_SPEC_v0_1.md` §12 — component-state strings (the State Matrix already names `Onboarding` strings).
- `.planning/PRODUCT_SPEC_v0_1.md` §16.4 — `permissions` / `host_permissions` / CSP at Phase 1 baseline.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 — explicit forbids: `tailwind`, `shadcn`, `@radix-ui`, `framer-motion`.
- `.planning/PRODUCT_SPEC_v0_1.md` §7 — `strict: true`, Immer ^11, Zod ^4 stack mandates.
- `.planning/PRODUCT_SPEC_v0_1.md` Flow 9, Flow 10, Flow 11 — handoff and palette semantics (§ "Flows 9-11").

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff" — goal + success criteria + verification gate.
- `.planning/PROJECT.md` §Key Decisions (decision #7: build on scaffold) and §Validated (the surfaced Phase-1-adjacent inventory).
- `.planning/REQUIREMENTS.md` §Traceability Phase-1 row — REQ-F05, F12, F19, F20 are the v1 IDs shipping here.
- `.planning/STATE.md` §Watch items VAI-05/VAI-08 — `wxt submit init` v2 confirm at Phase 19; CONCERNS verification at Phase 1.

### Research / pitfalls
- `.planning/RESEARCH-RECONCILIATION.md` §D — REQ-R01/R02/R04/R05/R19/R21 Phase-1 rows + §F (decisions log) for REQ-R06/R11/R14/R22/R24.
- `.planning/research/SUMMARY.md` Phase 1 row — single-message-layer / return-true / `ensureInitialized()` / remove Tailwind / coalesce storage / least-privilege manifest / frozen envelope types / `isPrimaryWriter()` predicate.
- `.planning/research/PITFALLS.md` P1 (SW suspension + cold-start), P2 (chrome.storage write-rate), P4 (message-channel races), P7 (indirect prompt injection — Phase 19 red-team but discipline starts Phase 1), P9 (filesystem sync conflicts — Phase 9 but convention now), P15 (CWS review readiness).

### ADRs
- `.planning/adr/ADR-STACK-01-wxt-hold-0.20.md` — WXT 0.20.27 held for v0.1.
- `.planning/adr/ADR-STACK-02-unlimitedstorage-phase2.md` — `unlimitedStorage` added at Phase 2 (not Phase 1).
- `.planning/adr/ADR-SEC-01-dual-llm-quarantine-v0.2.md` — six-layer defense ships in v0.1; layer-3 deferred.
- `.planning/adr/ADR-NOTE-01-wiki-id-identity.md` — WIKI-ID UUID; Phase 8/9 lands, but the alias-store decision is the spec-authoritative note identity baseline.

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/ARCHITECTURE.md` — envelope / BroadcastBus / chromeStorageAdapter / RuntimeEnvelope abstractions + Architecture Constraints (each per-surface module singleton).
- `.planning/codebase/CONCERNS.md` — every Phase-1-relevant defect: simulated-AI, demo defaults, dead code (MessageBus init, WorkspaceRouter app.html), dual messaging, unused permissions, Tailwind, full-store re-serialization, vacuous isolation test.
- `.planning/codebase/STRUCTURE.md` — directory layout (entrypoints/, src/{components,core,services,store,types,theme}/).
- `.planning/codebase/STACK.md` — exact version table (antd 6.6.1, WXT 0.20.27, Immer 10.2.0 to be bumped to 11, Zod 3.24.0 to be bumped to 4, ts strict: false to be true).

### Visual reference
- `.planning/DESIGN_SYSTEM.md` §8.1 — Side Panel metrics (header 52, composer 44, input 60, status 28 px; 400 px wide).
- `.planning/mockup/` — `00-sidepanel-chat.png`, `01-standalone-chat.png`, etc. (visual acceptance lands at Phase 15, but Phase 1 Cmd+K uses the same modal pattern).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/common/CommandPalette.tsx` (127 lines) — `props: { commands: Command[]; open: boolean; onClose }` already modal-based; reads `commands` from `CommandRegistry.getAll()`. Phase 1 wires Flow 10 base set against this renderer.
- `src/components/chat/SidepanelChat.tsx` — owns the Side Panel container; today calls `handleOpenStandalone` that invokes `window.close()` (post-handoff behavior per D-05 to be reworked).
- `src/components/standalone/StandaloneWorkspace.tsx` (61 lines) — sidebar nav stub; Phase 1 extends for `onOpenSidepanel`.
- `src/core/workspace/WorkspaceStore.ts` (121 lines) — Zustand+immer+persist; fields: `workspaceId`, `conversationId`, `activeSurface`, `openedFullAppTabId` (rename D-07), `version`. Phase 1 adds `isPrimaryWriter()` predicate (D-16).
- `src/core/workspace/WorkspaceRouter.ts` (47 lines) — `openFullApp(workspaceId, conversationId?, page?)` — renames to `openStandalone` and fixes the `app.html` → `standalone.html` reference (D-04, D-07).
- `src/core/workspace/WorkspaceSync.ts` (32 lines) — publishes/subscribes on `np_workspace` BroadcastChannel — wires per D-04.
- `src/core/theme/ThemeStore.ts` + `ThemeSync.ts` + `ThemeConfig.ts` — the cross-surface theme propagation pipeline; D-10 makes ThemeStore authoritative.
- `src/core/runtime/BroadcastBus.ts` — `subscribe(publish)(channel, handler)` with self-message suppression via `INSTANCE_ID`. Already used by `ThemeSync` and `WorkspaceSync`.
- `src/core/runtime/RuntimeEnvelope.ts` — discriminated `MessageTypeValues` + `createEnvelope` + `isEnvelope`. Phase 1 adds the frozen extraction envelope types (D-15).
- `src/core/messaging/MessageBus.ts` (66 lines) — `init()` registers the typed listener, returns `true`, `sendResponse({ ok: true })` once; Phase 1 calls `init()` from background.ts (D-13).
- `src/core/commands/CommandRegistry.ts` (50 lines) — module-level singleton `Map<string, Command>`; Phase 1 registers Flow 10 command set in both entrypoints (D-08).
- `src/core/events/EventBus.ts` — typed in-process eventing; deferred wiring (Pitfall-scope).
- `src/core/theme/chromeStorageAdapter.ts` — Zustand `StateStorage`; D-22 adds trailing-debounce + flush hooks.
- `src/core/registry/Registry.ts` — `FullAppPageRegistry` (rename to `StandalonePageRegistry` per D-07).
- `entrypoints/background.ts` — MV3 non-persistent SW; init `MessageBus` here (D-13).
- `entrypoints/content.core.ts` — ISOLATED-world SPA navigation detector; content-script isolation tests (no React/AntD/defuddle/yaml) live here.
- `entrypoints/sidepanel/main.tsx` (137 lines) — renders `SidepanelChat` + `CommandPalette`; binds Cmd+K (Meta+K); locally registers 3 commands.
- `entrypoints/standalone/main.tsx` (106 lines) — symmetric shell; binds Cmd+K; registers 2 commands (no `open-standalone-view` since it is itself).
- `src/components/common/OnboardingWizard.tsx` (1006 lines) — to be replaced by `src/components/OnboardingModal.tsx` (D-01); the new file goes at the spec path, not the scaffold path.

### Established Patterns
- **Layered MV3 architecture:** entrypoints → React UI → Zustand stores → core runtime → chrome.* APIs. Each per-surface module singleton is per-context (per ARCHITECTURE §Architectural Constraints).
- **Zustand `persist(immer(...), { name, partialize, version?, migrate? })`:** the persistence pattern; Phase 1 adds version+migrate to `useExtensionStore` (D-22).
- **Cross-surface pub/sub via `BroadcastBus` with `INSTANCE_ID` self-message suppression:** already used by `ThemeSync`; `WorkspaceSync` follows the same pattern.
- **Typed envelope dispatch via `RuntimeEnvelope`:** discriminated union + `createEnvelope` + `isEnvelope`; Phase 1 makes it the single background→surface path (D-13).
- **Failure tolerance at edges:** empty-handler `try/.catch(() => {})` patterns in `background.ts:10`, `standalone/main.tsx:40`; documented and kept.

### Integration Points
- `background.ts → MessageBus.init() → BackgroundRouter → envelope handlers` is the new authoritative path; content-script `chrome.runtime.sendMessage` traffic migrates from raw to typed envelopes at the same time.
- `WorkspaceRouter.openStandalone(url) ↔ tabs.query({ url: chrome.runtime.getURL('standalone.html') }) ↔ chrome.tabs.update|create ↔ WorkspaceStore.openedStandaloneTabId` is the Flow 11 integration seam.
- `WorkspaceStore.hydrateFromURL(searchParams) ↔ BrowserLocation` on Standalone-view mount (early, in `useEffect`) before any panel renders.
- `ThemeStore.setMode → useThemeSync effect → BroadcastBus('np_theme') → each surface ThemeProvider applies` is the cross-surface theme pattern; OnboardingModal's success state on `providers` saves through the same chain.
- `chrome.storage.onChanged` for the storage-side mirror (not used today; Phase 2 picks it up for cross-surface write reconciliation per CONCERNS "Cross-surface writes").

</code_context>

<specifics>
## Specific Ideas

- **OnboardingModal step 1 placeholder:** a panel that reads "Step 1 of 4 · **NowPilot** (Persona card placeholder — Phase 15.3 will replace with RICH-R-03)." No avatar animation, no character card art in Phase 1.
- **NP-STRICT marker scheme (D-21):** comment shape `// @ts-expect-error NP-STRICT-<n>: <reason>` — sequential `<n>` per file, `<reason>` is one short noun phrase naming what blocks typing. The `verify:phase-1` grep test counts markers + diffs against a ceiling stored in `package.json` or `.planning/STATE.md` watch list.
- **"Standalone" not "App" naming:** spec is split (§5.1 vs §8.5) but spec §0.4 names one source of truth — Phase 1 picks `standalone`. Any planner artifact that says "FullApp" must be translated to "Standalone" in the same plan.
- **Write-rate assertion target:** PITFALLS.md P2 says `chrome.storage.local` drops silently at ~120 writes/min. Phase 1's coalescing+debounce target is **≤ 30 writes/min** during steady-state streaming (well below the throttle boundary), verified by the test.
- **`motion` package (^12) is allowed:** STACK.md §35 explicitly clarifies "the spec's 'no framer-motion' refers to the old package name; keep the `motion` import." Phase 1 keeps the Onboarding wizard's `motion`-based animations (where they survive after the D-01 migration); the grep gate excludes `framer-motion` only.
- **Single-shell onboarding (not two):** D-01 lands one `src/components/OnboardingModal.tsx` used by both Side Panel (auto-shown on first open, fresh install) and Standalone view (shown if user opens Standalone without provider configured — REQ-F19).
- **Git baseline first commit message:** `chore: scaffold import — initial implementation baseline for NowPilot v0.1`. Single atomic commit, no Phase-1 changes mixed in. The next commit is Phase-1-PLAN-1.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope. Defer-list candidates captured implicitly:
- Persona card art / "Meet NowPilot" character → Phase 15.3 (RICH-R-03).
- Real `unlimitedStorage` permission → Phase 2 (ADR-STACK-02).
- ServiceNow `cookies` / `scripting` / `contextMenus` permissions → Phase 17 (D-19).
- Dual-LLM quarantine (REQ-R11 layer 3) → v0.2+ (ADR-SEC-01).
- Note / memory / MiniSearch / Filesystem Sync / trust-aware context / multimodal / evolution — all in their own phases per ROADMAP.md.

</deferred>

---
*Phase: 1-MV3/WXT Runtime + AntD Shells + Workspace Handoff*
*Context gathered: 2026-08-19*
