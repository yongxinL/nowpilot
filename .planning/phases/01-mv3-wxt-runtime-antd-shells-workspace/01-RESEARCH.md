# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace — Research

**Researched:** 2026-08-04
**Domain:** Chrome MV3 extension runtime (WXT) + React 19 + AntD v6 theming + cross-surface workspace state
**Confidence:** HIGH

## Summary

Phase 1 is the greenfield foundation of the NowPilot Chrome MV3 extension: a WXT scaffold with two independently-mountable surfaces (Side Panel + Standalone tab), a shared Zustand WorkspaceStore synced across surfaces, a complete AntD v6 theme architecture (`ThemeStore` + `antdConfig` + pack registry), first-run onboarding (persona card + configure-later gate), a Cmd+K palette, an extraction-only content-script skeleton speaking the canonical RuntimeEnvelope protocol, and Chat/Agent/Notes/Options page skeletons. All file paths, types, message contracts, and flows are locked by spec §18 / §8.5 / Appendices C/E/F/G/M — the research job is to pin the external stack versions, surface the spec's internal inconsistencies, and flag the runtime landmines (user-gesture loss in `chrome.sidePanel.open`, zustand-persist-not-cross-surface, bundle isolation).

**Primary recommendation:** Bootstrap with `pnpm dlx wxt@0.19.29 init` (pin the approved `^0.19` line — `wxt@latest` is now 0.21.x and would drift the locked stack), then overlay the spec §18 file set exactly. Use `wxt/testing/vitest-plugin` + `fakeBrowser` for chrome API mocking (not vitest-chrome). Follow the Appendix F mounting pattern verbatim (one `XProvider` per surface, `App.useApp()` for imperative APIs). Wire `chrome.storage.onChanged` for theme sync per D-13 and implement `WorkspaceRouter.focusSidePanel` with **callback-style** `chrome.tabs.query` to preserve the user-gesture flag (crbug 1478648). The content-script bundle isolation rule (no antd/react/defuddle/yaml) is enforceable in Phase 1 because the content entrypoint imports only core runtime modules — but the isolation *test* greps a built bundle, so `verify:phase-1` must run `wxt build` before it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Package Manager & Tooling
- **D-01:** Standardize on **pnpm**. Remove the npm `package-lock.json` to avoid lockfile drift. pnpm 11.18.0 is installed.
- **D-02:** Verification is per-phase: `verify:phase-1` … `verify:phase-9` scripts plus an aggregate `verify:all` (per spec §24).
- **D-03:** Test stack: **vitest + @testing-library/react + jsdom + msw** (spec §7.8) — established now, msw ready for later provider mocking.
- **D-04:** Quality gates inside `verify:phase-N`: eslint + prettier + `tsc --noEmit` (typecheck), in addition to the phase's Zod fixture tests and isolation checks.
- **D-05:** Bootstrap via **WXT scaffold** (`pnpm dlx wxt@latest init` / `wxt add`), then overlay the spec §18 / Appendix G file set. Do not hand-write the scaffold from scratch.

#### Onboarding (Flow 9)
- **D-06:** Phase 1 ships **Step 1 (persona card) + a "configure later" gate** — not the full 4-step provider flow. Provider steps (pick provider → enter key → validate) arrive with Phase 3.
- **D-07:** The gate condition is a **ProviderRegistry check** for an active provider (`activeProvider`). No provider configured ⇒ onboarding shows persona card then a disabled surface.
- **D-08:** The persona card is **read-only default persona** (name/tone/brevity from `np_persona` defaults in PreferenceMemoryStore) — not editable (editing is Phase 7 Options → Persona).
- **D-09:** The "Configure provider" CTA **deep-links to Options** in the Standalone view (via WorkspaceRouter). Onboarding completes once a provider is configured.

#### Theme (Appendix F)
- **D-10:** Phase 1 establishes the **complete theming architecture**: `themePack` + `displayMode` + token overlay system + persistence + system appearance detection. Only the **Default** pack is required to be fully implemented; Liquid Glass and Claude Warm may be registered but are **not** required for Phase 1 DONE.
- **D-11:** Display modes (Light / Dark / Auto) **are required** in Phase 1.
- **D-12:** Packs register via a **ThemePackRegistry with a `ready` flag**. Default is `ready`; liquid-glass/claude-warm are registered as not-ready.
- **D-13:** Theme persistence: **chrome.storage.local is the canonical source of truth** for `themePack` + `displayMode`, with **chrome.storage.onChanged synchronisation** across surfaces. Optional optimization: a local BroadcastBus event for immediate same-context updates. All surfaces stay consistent after reloads and browser restarts.
- **D-14:** The Phase 1 UI exposes **displayMode selection (light/dark/auto) only**. No theme-pack selector appears until at least one additional pack reaches active status. No schema or service changes should be required when future packs become enabled.

#### Cmd+K Palette (Flow 10)
- **D-15:** Phase 1 registers **only commands whose targets exist** in Phase 1: Open Standalone view, Focus Side Panel, Open Options (Options is a page skeleton). Do not register stub commands for features landing in later phases.

#### Content Script (core.content.ts)
- **D-16:** Ships as an **architecture skeleton only**: ISOLATED-world execution, ContentScriptHost skeleton, PageContextBridge plumbing, message routing, and ping/status handlers. **No** DOM extraction, readability parsing, SPA navigation monitoring, page annotations, or page actions. Extraction begins in Phase 4a.
- **D-17:** The content bridge **MUST use the canonical RuntimeEnvelope + MessageType protocol** (Appendix C/E). Throwaway or phase-specific message contracts are prohibited. Phase 1 implements the minimum message subset: `PING`, `PONG`, `GET_CONTENT_CAPABILITIES`, `CONTENT_CAPABILITIES`. Future phases extend via additional MessageType values without changing the transport contract.

#### Workspace (Appendix M / §8.4)
- **D-18:** The shared WorkspaceStore declares the **full §8.4 field set** in its type (workspaceId, conversationId, activeProvider, selectedModel, pinnedTabs, currentPageContext, selectedNotes, activeAddonContext, activeSkillRun, activeSurface, openedStandaloneTabId), with only the fields Phase 1 needs **active** (workspaceId, conversationId, activeSurface, openedStandaloneTabId). The rest are present in the type but inert — this prevents type churn in later phases.

### the agent's Discretion
- Empty-state layouts for the four page skeletons (Chat/Agent/Notes/Options) — render a functional placeholder consistent with the AntD theme; no innerHTML.
- KeymapRegistry defaults for Cmd+K (macOS `mod+k`, Windows/Linux `ctrl+k`) — follow WXT/Chrome conventions.
- i18n strings: seed from spec Appendix B canonical strings; no full translation framework in Phase 1.

### Deferred Ideas (OUT OF SCOPE)
- **Full 4-step onboarding (pick provider → enter key → validate)** — belongs to Phase 3 when provider config exists.
- **Theme pack selector UI** — appears once a second pack (liquid-glass / claude-warm) reaches active status (Phase 7 Options appearance section likely).
- **Provider editing, diagnostics, prompt management, MCP editor, feature flags, Import/Export in side panel** — spec §9.1 explicitly excludes these from the side panel; they belong to the Standalone view in later phases.
- **Page injection / host-page automation** — explicitly out of scope for v0.1 (spec §0.2 R1, §6.5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUNTIME-01 | WXT MV3 extension builds with side panel, standalone view, background SW, and extraction-only content script entrypoints | Appendix G wxt.config.ts (verified compatible with wxt 0.19.29 + @wxt-dev/module-react ^1.2.2, peer `wxt >= 0.19.16`); entrypoint naming: `sidepanel/index.html`→`sidepanel.html`, `standalone/index.html`→`standalone.html`, `content/core.content.ts`, `background.ts` |
| RUNTIME-02 | Side panel opens; first-run onboarding appears on fresh install | `chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true})` in LifecycleManager (onInstalled + onStartup); OnboardingModal gate on `workspace.activeProvider` (D-07) |
| RUNTIME-03 | Standalone view opens from side panel; workspace state hands off correctly (no duplicate tabs) | Appendix M.2 `WorkspaceRouter.openStandalone` — persist → `chrome.tabs.query` by `standalone.html*` URL → update-or-create; M.1 `hydrateFromURL` on mount; §20.2 idempotency key = workspaceId |
| RUNTIME-04 | AntD theme/design tokens applied via ThemeStore + antdConfig (compact for side panel, default for standalone) | Appendix F getAntdConfig (algorithm array incl. compactAlgorithm); one XProvider per surface; antd 6.5.3 CSS-variable theming verified; App.useApp() required |
| RUNTIME-05 | Chat, Agent, Notes, Options page skeletons render in both surfaces | §18 file list + SidePanelPageRegistry/StandalonePageRegistry; side panel = Chat+Agent; standalone = Chat+Agent+Notes+Options (§8.3); AntD Skeleton blocks per UI-SPEC |
| WSPC-01 | WorkspaceStore (Zustand) persists theme, conversation, and add-on state | Appendix M.1 (subscribeWithSelector + chrome.storage.local `np_workspace` + version-bumped setState); §21.5 WorkspaceState type; D-18 field-set split |
| WSPC-02 | WorkspaceSync keeps side panel and standalone surfaces in sync via BroadcastBus | Appendix M.3 (WORKSPACE_UPDATED last-write-wins by version, WORKSPACE_HEARTBEAT 3 s); §20.11 primary-election via `np_workspace_primary` in chrome.storage.session |
| WSPC-03 | MessageBus, EventBus, and BroadcastBus provide cross-context / in-panel / cross-surface communication | §8.1 decomposition: MessageBus = typed RuntimeEnvelope request/response over chrome.runtime.sendMessage; EventBus = in-panel sync; BroadcastBus = cross-surface pub/sub; ResponseEnvelope (Appendix C) |
| WSPC-04 | AddonRegistry, Registry, AddonSettingsStore, and page registries register add-ons at startup | §8.5 `src/core/registry/` file set; Phase 1 registers zero add-ons but ships the registries + page registrations (Chat/Agent side panel; Chat/Agent/Notes/Options standalone) |
| WSPC-05 | ErrorBoundary, PortableMarkdown, and debugLog (canonical §C.2 codes) exist | §18 files `src/core/components/{ErrorBoundary,PortableMarkdown}.tsx`, `src/core/log/debugLog.ts`; golden rule 9; C.2 registry must be extended with Phase-1 codes (see Open Questions) |

**Cross-cutting DONE-when gates (§18):** zero `innerHTML|dangerouslySetInnerHTML` in src; zero `tailwind|shadcn|@radix-ui` and zero `framer-motion` in package.json; `pnpm run verify:phase-1` green; background router registers listeners synchronously; RuntimeEnvelope fixtures parse.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest / build / bundle splitting | Background SW build (WXT) | — | wxt.config.ts owns entrypoints, permissions, manualChunks (Appendix G) |
| Side panel UI + AI + IndexedDB | Side Panel | — | §8.1: AI streaming, MCP, MemoryEngine, IndexedDB live ONLY in side panel/standalone (R-3) |
| Standalone UI (Chat/Agent/Notes/Options) | Standalone tab | — | Full workspace + Options (§9.2); shows Directory Picker later (Phase 5a) |
| Cross-surface workspace state | WorkspaceStore (both surfaces) | chrome.storage.local | Appendix M: single source of truth; storage is the durable medium, BroadcastBus the live channel |
| Theme tokens + display mode | ThemeStore + antdConfig (both surfaces) | chrome.storage.onChanged | D-13: chrome.storage.local canonical, onChanged sync across contexts |
| Background messaging (PROXY_FETCH, OPEN_*) | Background SW | MessageBus | SW is the only context all others reach; typed RuntimeEnvelope |
| Content-script bridge | Content script (ISOLATED) | Background router | PING/PONG/CAPABILITIES only; no UI, no extraction in Phase 1 (D-16/D-17) |
| Onboarding gate | Side Panel (first-run) | WorkspaceStore.activeProvider | D-07 gate reads activeProvider; CTA deep-links via WorkspaceRouter |
| Command palette | Both surfaces (in-page) | WorkspaceRouter / chrome.sidePanel | Flow 10 commands execute surface-local or via router; sidePanel.open needs gesture |
| Registries | Core (both surfaces) | — | AddonRegistry/Registry/AddonSettingsStore/page registries register at startup (WSPC-04) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | ^0.19.29 | MV3 build framework: file-based entrypoints, manifest generation, HMR | Approved stack §7.1; scaffold per D-05; **pin ^0.19 — latest is 0.21.3 (drift)** |
| @wxt-dev/module-react | ^1.2.2 | React plugin for WXT (Vite) | Peer `wxt >= 0.19.16` verified — compatible with wxt 0.19.x; STACK.md's "^0.3" is stale (package is 1.x now) |
| react / react-dom | ^19.2.8 | UI runtime | Approved stack; antd 6.5.3 peer `react >= 18` ✓ |
| antd | ^6.5.3 | Component library + theming | Approved stack §7.2; CSS-variable theming default in v6 |
| @ant-design/x | ^2.9.0 | XProvider (extends ConfigProvider) + chat primitives | §5.5 mandates XProvider; Phase 1 uses XProvider only, not RICH chat components |
| @ant-design/icons | ^6.3.2 | Icons (must match antd major) | §7.2; UI-SPEC icon inventory |
| @ant-design/x-markdown | ^2.9.0 | Streaming markdown (PortableMarkdown target) | Approved; Phase 1 ships a passthrough skeleton — the real renderer is Phase 7 |
| motion | ^12.43.0 | Animation (import from `motion/react`) | Approved §7; **never framer-motion** (R-9) |
| zustand | ^5.0.14 | WorkspaceStore + ThemeStore | Approved §7.3; Appendix M/F reference implementation |
| immer | ^10.2.0 | Immutable updates | Approved; **pin ^10 — latest is 11.x (drift)** |
| zod | ^3.25.76 | Boundary validation / fixture tests | Approved; **pin ^3 — latest is 4.x and spec schemas are zod-3 style** |
| typescript | ^5.9.3 | TypeScript strict (`strict: true`) | Spec §7.8; **pin 5.x — latest npm tag is 7.x (native port)** |
| vitest | ^4.1.10 | Test runner | D-03; peer vite ^6/^7/^8 ✓ wxt 0.19's vite ^6 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| @testing-library/react | ^16.3.2 | React component testing | Shell/Onboarding/page-skeleton tests (peer @testing-library/dom ^10, react ^18/^19) |
| @testing-library/dom | ^10.4.1 | DOM queries | Peer of @testing-library/react 16 |
| @testing-library/jest-dom | ^7.0.0 | DOM matchers | `toBeInTheDocument()` etc. |
| jsdom | ^30.0.1 | DOM environment for vitest | Component tests; `environment: 'jsdom'` |
| msw | ^2.15.0 | Network mocking (worker/server) | D-03 — established now, used for provider mocking in Phase 3 |
| wxt/testing (built-in) | wxt 0.19.29 | `WxtVitest()` plugin + `fakeBrowser` (@webext-core/fake-browser ^2.0.1) | Chrome API mocking — **preferred over vitest-chrome** (official WXT path) |
| @types/chrome | ^0.2.5 | Chrome API types | tsc for chrome.* globals |
| @types/react / @types/react-dom | ^19 | React types | tsc strict |
| eslint | ^10 | Lint (quality gate D-04) | `eslint .` in verify:phase-1; WXT scaffold ships flat config |
| prettier | ^3 | Format (quality gate D-04) | `prettier --check .` in verify:phase-1 |
| @webext-core/fake-browser | ^2.0.1 | In-memory browser API mock | Transitive dep of wxt testing; import as `wxt/testing/fake-browser` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| wxt ^0.19 (locked) | wxt ^0.21 (latest) | 0.21 changes config surface; locked stack §7 says ^0.19 — stay pinned, upgrade decision belongs to discuss-phase |
| wxt/testing/fake-browser | vitest-chrome | vitest-chrome is 3 yrs stale (0.1.0); WXT official plugin also wires aliases + import.meta.env |
| XProvider (one provider) | ConfigProvider + XProvider nested | §5.5 explicitly forbids double-wrapping theme/locale context |
| chrome.storage.local + onChanged (D-13) | zustand persist middleware (localStorage) | localStorage does NOT sync across extension pages; D-13 overrides Appendix F's sync-adapter note |

**Installation:**
```bash
# After `pnpm dlx wxt@0.19.29 init` (template react) in an EMPTY dir, add deps:
pnpm add antd @ant-design/x @ant-design/icons @ant-design/x-markdown motion zustand immer@^10 zod@^3
pnpm add -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom msw @types/chrome
# wxt + react + module-react come from the scaffold; verify they resolve to ^0.19 / ^19 / ^1.2
```

**Version verification (verified 2026-08-04 via npm registry):** wxt 0.19.29 · @wxt-dev/module-react 1.2.2 (peer `wxt >= 0.19.16`) · antd 6.5.3 · @ant-design/x 2.9.0 · @ant-design/icons 6.3.2 · @ant-design/x-markdown 2.9.0 · react/react-dom 19.2.8 · zustand 5.0.14 · immer 10.2.0 (11.1.15 is latest major — pin ^10) · zod 3.25.76 (4.4.3 is latest major — pin ^3) · typescript 5.9.3 (7.0.2 is latest tag — pin 5.x) · vitest 4.1.10 · @testing-library/react 16.3.2 · @testing-library/dom 10.4.1 · @testing-library/jest-dom 7.0.0 · jsdom 30.0.1 · msw 2.15.0 · eslint 10.8.0 · @types/chrome 0.2.5 · @webext-core/fake-browser 2.0.1.

**Stack-drift flags (all three must be pinned to the approved lines, not `latest`):** `immer@^10` (approved) vs 11.x latest; `zod@^3` (approved) vs 4.x latest — the spec's Appendix C schemas (`z.lazy`, `APCLiteNodeSchema`) are zod-3 style; `typescript@^5` (spec ≥5.5) vs 7.x native-port tag. Also `@wxt-dev/module-react` is 1.x now (STACK.md's ^0.3 stale) and `wxt@latest` is 0.21.x (approved stack pins ^0.19) — the D-05 scaffold command should be `pnpm dlx wxt@0.19.29 init` to stay on the locked line.

## Package Legitimacy Audit

> Run 2026-08-04 via gsd-tools package-legitimacy check + npm registry. All "too-new" verdicts are **publish-recency artifacts** (the checker treats a <30-day publish as new): react/antd/typescript are 10–13-year-old canonical packages that publish monthly. No package in this list is a slopsquat.

| Package | Registry | Age | Downloads (wk) | Source Repo | Verdict | Disposition |
|---------|----------|-----|----------------|-------------|---------|-------------|
| wxt | npm | 3+ yrs | 543K | github.com/wxt-dev/wxt | SUS (too-new) | Approved — canonical framework, locked ^0.19 |
| @wxt-dev/module-react | npm | 2+ yrs | 329K | github.com/wxt-dev/wxt | OK | Approved |
| react / react-dom | npm | 12+ yrs | 162M / 153M | github.com/react/react | SUS (too-new) | Approved — top-tier canonical |
| antd | npm | 10+ yrs | 3.6M | github.com/ant-design/ant-design | SUS (too-new) | Approved |
| @ant-design/icons | npm | 8+ yrs | 4.4M | ant-design-icons | OK | Approved |
| @ant-design/x | npm | 2+ yrs | 106K | github.com/ant-design/x | SUS (too-new) | Approved — locked by §7.2 |
| @ant-design/x-markdown | npm | 2+ yrs | 28K | github.com/ant-design/x | SUS (too-new) | Approved |
| motion | npm | 5+ yrs | 17M | github.com/motiondivision/motion | SUS (too-new) | Approved — import from `motion/react` |
| zustand | npm | 6+ yrs | 49M | github.com/pmndrs/zustand | OK | Approved |
| immer | npm | 8+ yrs | 56M | github.com/immerjs/immer | SUS (too-new) | Approved — pin ^10 |
| zod | npm | 5+ yrs | 251M | github.com/colinhacks/zod | OK | Approved — pin ^3 |
| typescript | npm | 13+ yrs | 259M | github.com/microsoft/TypeScript | SUS (too-new) | Approved — pin 5.x |
| vitest | npm | 4+ yrs | 88M | github.com/vitest-dev/vitest | SUS (too-new) | Approved |
| @testing-library/react / dom / jest-dom | npm | 7/7/7+ yrs | 51M/64M/58M | testing-library | OK / OK / SUS | Approved |
| jsdom | npm | 15+ yrs | 91M | github.com/jsdom/jsdom | SUS (too-new) | Approved |
| msw | npm | 5+ yrs | 19.7M | github.com/mswjs/msw | **SLOP (suspicious-postinstall)** | **False positive — approved** (see note) |
| prettier / eslint | npm | 10+ yrs | 128M / 155M | prettier / eslint | SUS (too-new) | Approved |
| @types/chrome | npm | 8+ yrs | 3.6M | DefinitelyTyped | SUS (too-new) | Approved |
| @webext-core/fake-browser | npm | 2+ yrs | 551K | aklinker1/webext-core | SUS (too-new) | Approved — dep of wxt testing |

**msw postinstall investigation (protocol Step 3):** `npm view msw@2.15.0 scripts` → `postinstall: node -e "import('./config/scripts/postinstall.js').catch(() => void 0)"`. This is msw's long-standing informational postinstall (prints setup hints) — it imports a **local** script, makes **no network calls**, writes **nothing outside the project**, and fails silently (`catch(() => void 0)`). It does NOT meet the high-risk criteria (network call or external filesystem path). Verdict: keep msw — it is also user-locked by D-03.

**Packages removed due to [SLOP] verdict:** none (msw false-positive resolved above).
**Packages flagged as suspicious [SUS]:** none requiring a human-verify checkpoint — all SUS verdicts are publish-recency artifacts of canonical, 100M+-download packages; disposition Approved for all. (`@wxt-dev/testing` does not exist on npm — the correct testing entry is `wxt/testing/vitest-plugin` inside the `wxt` package.)

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │            Chrome Browser (MV3)             │
                        └─────────────────────────────────────────────┘
 ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
 │ Background SW        │   │ Side Panel           │   │ Standalone tab           │
 │ background.ts        │   │ sidepanel.html       │   │ standalone.html          │
 │ (ephemeral)          │   │ (persistent while    │   │ (persistent tab)         │
 │                      │   │  open)               │   │                          │
 │ BackgroundRouter ◄───┼───┼── MessageBus         │   │ MessageBus ──────┐       │
 │  (sync listener reg) │   │  (chrome.runtime     │   │                 │       │
 │ LifecycleManager     │   │   sendMessage +      │   │  EventBus (in-panel)     │
 │  setPanelBehavior    │   │   ResponseEnvelope)  │   │  BroadcastBus ◄──────┐   │
 │ KeepAliveManager     │   │  EventBus            │   │  EventBus            │   │
 │  (alarms, panel ping)│   │  BroadcastBus ◄──────┼───┼──┐ (cross-surface)  │   │
 │ ContextMenuHost      │   │  WorkspaceStore ─────┼───┼──┼── sync via        │   │
 │ WorkspaceRouter      │   │  WorkspaceSync       │   │  │  BroadcastBus     │   │
 │  (tabs.create/update)│   │  ThemeStore ─────────┼───┼──┼── chrome.storage  │   │
 │                      │   │  (chrome.storage.onChanged)                    │   │
 └──────────┬───────────┘   │  OnboardingModal     │   │  WorkspaceStore     │   │
            │              │  Cmd+K palette       │   │  ThemeStore         │   │
            │              │  Shell: Chat|Agent   │   │  Cmd+K palette      │   │
            │              └──────────────────────┘   │  Shell: Chat|Agent| │   │
            │                                         │   Notes|Options     │   │
            │  chrome.runtime.sendMessage(RuntimeEnvelope)                  │   │
            │                                         └─────────────────────┘   │
 ┌──────────▼───────────┐                          ┌────────────────────────────┘
 │ Content script       │   chrome.storage.local:  │
 │ core.content.ts      │   np_workspace           │
 │ (ISOLATED world)     │   np_theme / np_theme_pack
 │ ContentScriptHost    │   chrome.storage.session:
 │  PING→PONG           │   np_workspace_primary   │
 │  GET_CONTENT_CAPABIL-│                          │
 │  ITIES→CONTENT_CAPAB-│                          │
 │  ILITIES             │                          │
 └──────────────────────┘   ▲                      │
                            └── BroadcastBus: WORKSPACE_UPDATED (version LWW),
                                WORKSPACE_HEARTBEAT (3 s), WORKSPACE_HANDOFF
```

**Primary use case trace (Flow 11 handoff):** user clicks "Switch to Full chat" in side panel → `WorkspaceRouter.openStandalone` → persist `np_workspace` → `chrome.tabs.query({url: chrome-extension://<id>/standalone.html*})` → tab exists ? update+focus : create → set `openedStandaloneTabId` → standalone boots → `hydrateFromURL()` reads `workspaceId`/`conversationId`/`page` → fires `WORKSPACE_HANDOFF` → side panel demotes to mirror (Flow 11). Theme change: Options Appearance → `setMode` writes `np_theme` → `chrome.storage.onChanged` fires in BOTH contexts → both `getAntdConfig` re-render (D-13, criterion 3).

### Recommended Project Structure (from spec §18 — create exactly these)

```
wxt.config.ts                       # Appendix G verbatim
src/
├── entrypoints/
│   ├── background.ts               # defineBackground: register listeners SYNCHRONOUSLY
│   ├── sidepanel/{index.html, main.tsx}   # XProvider (compact) → AntdApp → SidePanelShell
│   ├── standalone/{index.html, main.tsx}  # XProvider (default) → AntdApp → StandaloneShell
│   └── content/core.content.ts     # defineContentScript ISOLATED, document_idle, <all_urls>
├── core/
│   ├── theme/{ThemeStore.ts, antdConfig.ts}
│   ├── workspace/{WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts}
│   ├── runtime/{RuntimeEnvelope.ts, OperationId.ts, BroadcastBus.ts, PortReader.ts, workerState.ts, MessageType.ts}
│   ├── messaging/MessageBus.ts
│   ├── events/EventBus.ts
│   ├── log/debugLog.ts
│   ├── i18n/strings.ts             # Appendix B canonical strings
│   ├── prompts/index.ts            # Appendix A constants
│   ├── registry/{AddonRegistry, Registry, AddonSettingsStore, SidePanelPageRegistry, StandalonePageRegistry}.ts
│   ├── input/KeymapRegistry.ts
│   └── components/{ErrorBoundary.tsx, PortableMarkdown.tsx}
├── components/
│   ├── sidepanel/{SidePanelShell, SidePanelRouter}.tsx
│   ├── standalone/{StandaloneShell, StandaloneRouter}.tsx
│   ├── OnboardingModal.tsx
│   └── pages/{ChatPage, AgentPage, NotesPage, OptionsPage}.tsx
└── types/{workspace.ts, harness.ts}   # §21.5 WorkspaceState/ActiveSurface live here
tests/
├── core/runtime/{RuntimeEnvelope, OperationId}.test.ts
├── core/events/EventBus.test.ts
├── core/workspace/{WorkspaceStore, WorkspaceRouter}.test.ts
├── core/theme/ThemeStore.test.ts
└── isolation/no-content-script-ui.test.ts   # Appendix G + §24
```

**Spec reconciliation (three inconsistencies the planner must resolve):**
1. **§8.5 line 1320 says `src/entrypoints/app/`** — the glossary (line 1042), §5.1, §18, and `WorkspaceRouter.openStandalone` all use **`standalone/`** → `standalone.html`. Use `standalone/`; the `app/` diagram line is stale.
2. **D-17 adds PING / PONG / GET_CONTENT_CAPABILITIES / CONTENT_CAPABILITIES** to the canonical MessageType registry — Appendix E does not list them. These are **additions to the canonical enum** (the registry is designed to be extended), NOT a phase-local contract. Implement `MessageType.ts` = Appendix E values + the four D-17 values.
3. **D-16 names `ContentScriptHost` + `PageContextBridge`** (canonical paths `src/core/content/` per §8.5) but §18's Phase 1 Create list omits them. Create minimal skeletons at `src/core/content/{ContentScriptHost.ts, PageContextBridge.ts}`.

### Pattern 1: One-Provider Mounting (Appendix F.3 / §5.5)

**What:** Each surface mounts exactly ONE provider — `XProvider` (extends ConfigProvider) — wrapping `AntdApp`; `getAntdConfig({mode, pack, compact})` returns the `ConfigProviderProps` spread into it. Never nest ConfigProvider inside XProvider.
**When to use:** Every surface entrypoint (side panel compact, standalone default).
**Example (side panel):**
```tsx
// src/entrypoints/sidepanel/main.tsx — Source: spec §5.5 / Appendix F.3 (canonical)
function Root() {
  const { mode, pack } = useThemeStore(s => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: true });
  return (
    <XProvider {...cfg}>
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

### Pattern 2: chrome.storage.onChanged Cross-Surface Theme Sync (D-13)

**What:** ThemeStore holds runtime `{mode, pack, effectiveDark}` in memory; a storage adapter writes `np_theme` (displayMode) + `np_theme_pack` to `chrome.storage.local`; every context subscribes to `chrome.storage.onChanged` and hydrates its store. Do NOT rely on zustand `persist` middleware's default localStorage (does not cross surfaces).
**When to use:** Theme (D-13) and Workspace metadata (`np_workspace`, Appendix M.1).
**Example:**
```ts
// Source: D-13 + Appendix F resolveDark pattern (canonical keys np_theme / np_theme_pack)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.np_theme)   useThemeStore.setState({ mode: changes.np_theme.newValue as ThemeMode });
  if (changes.np_theme_pack) useThemeStore.setState({ pack: changes.np_theme_pack.newValue as ThemePack });
});
```

### Pattern 3: Preserving the User Gesture for chrome.sidePanel.open

**What:** `chrome.sidePanel.open({tabId})` (Chrome 116+) may only be called in response to a user gesture. Known Chromium bug (crbug 1478648, stricter from Chrome 127): the gesture flag is dropped if an `await` precedes the call inside a command/message handler. Use callback style so the query completes within the gesture window.
**When to use:** `WorkspaceRouter.focusSidePanel` (Cmd+K "Focus Side Panel" on standalone) and any background `commands.onCommand` handler.
**Example:**
```ts
// Source: crbug 1478648 workaround (verified via Chrome docs + SO); adapt Appendix M.2
async function focusSidePanel() {
  // callback style — no await before sidePanel.open
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id !== undefined) void chrome.sidePanel.open({ tabId: tab.id });
  });
}
```

### Pattern 4: WXT Vitest Wiring (D-03 + wxt.dev unit-testing guide)

**What:** `vitest.config.ts` uses `WxtVitest()` from `wxt/testing/vitest-plugin`; chrome APIs are provided by the in-memory `fakeBrowser` (`wxt/testing/fake-browser`, reset per test). No vitest-chrome needed.
**When to use:** All `tests/core/**` unit tests that touch `chrome.*` (WorkspaceStore, WorkspaceRouter, ThemeStore, MessageBus).
**Example:**
```ts
// vitest.config.ts — Source: wxt.dev/guide/essentials/unit-testing
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
// tests: import { fakeBrowser } from 'wxt/testing/fake-browser'; beforeEach(() => fakeBrowser.reset());
```

### Anti-Patterns to Avoid
- **Double provider wrapping:** Nesting `ConfigProvider` inside `XProvider` double-wraps theme/locale context → subtle token loss (§5.5 forbids).
- **Static message/notification/Modal imports:** `message.error(...)` bypasses ConfigProvider theme/locale — must use `App.useApp()` (F.4; UI-SPEC error toasts depend on it).
- **`await` before `sidePanel.open`:** loses the user gesture → "may only be called in response to a user gesture" (crbug 1478648). Callback-style only.
- **zustand persist for cross-surface state:** localStorage persist does not sync between side panel and standalone contexts; theme/workspace must go through chrome.storage.local + onChanged (D-13).
- **Custom message contracts for the content bridge:** any throwaway message shape violates D-17; always wrap in `RuntimeEnvelope` with canonical `MessageType` values.
- **Importing side panel code into standalone (or vice versa):** §0.2 — each surface is independently mountable; share only `src/core/**` + `src/components/**` shells.
- **`window.matchMedia` unguarded in tests:** `resolveDark`/`getAntdConfig` guard with `typeof window !== 'undefined'`; jsdom lacks matchMedia by default — polyfill in `tests/setup.ts` or the ThemeStore test asserts the auto branch with a mock.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chrome API mocking in vitest | Manual `globalThis.chrome` stubs | `WxtVitest()` + `fakeBrowser` (`wxt/testing/fake-browser`) | Official WXT path; in-memory storage/events behave like real extension; resets per test |
| Vite/React/bundle pipeline | Custom build config | WXT + `@wxt-dev/module-react` | File-based entrypoints, manifest gen, HMR, bundle splitting built in (D-05) |
| Theme token derivation | Hand-written color math | antd `theme.darkAlgorithm`/`compactAlgorithm` + token overlay | v6 CSS-variable theming handles dark/light derivation; never hand-roll palettes |
| Version-bumped workspace state | Raw object spread with manual version field | Appendix M `setState` wrapper (bumps `version`, `updatedAt`, auto-`persist()`) | LWW sync depends on monotonic version |
| Random IDs | Hand-rolled `Date.now()+rand` | `crypto.randomUUID()` | Native, collision-safe; extension pages are secure contexts |
| Cmd+K keyboard handling | Raw keydown switch per surface | `KeymapRegistry` global keydown listener (Flow 8) | Single registry, `when` contexts, handlerId indirection — later phases add commands |

**Key insight:** Phase 1's "hard" problems (bundle splitting, cross-surface sync, gesture-safe side panel opening, CSS-variable theming) are all solved by the approved stack + canonical spec modules. The implementation risk is not building new machinery — it is *deviating* from the canonical shapes (wrong entrypoint name, second message contract, double provider, localStorage persist).

## Common Pitfalls

### Pitfall 1: `chrome.sidePanel.open` fails with "may only be called in response to a user gesture"
**What goes wrong:** Opening the side panel from a command/message handler throws after an `await`; also fails if the user clicks the WXT auto-injected action button (no listener bound).
**Why it happens:** Chrome ≤126 tracked the gesture flag loosely; Chrome 127+ (crbug 1478648) drops the flag when an `await` precedes `sidePanel.open` in the call chain. And `openPanelOnActionClick` requires `setPanelBehavior({openPanelOnActionClick:true})` at startup.
**How to avoid:** Callback-style `chrome.tabs.query` → `sidePanel.open({tabId})` without intervening awaits; call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in `background.ts` on startup.
**Warning signs:** `Uncaught Error: Cannot call sidePanel.open() without a user gesture` in the service worker console on first click-through test.

### Pitfall 2: wxt `latest` is 0.21.x but the approved stack pins `^0.19`
**What goes wrong:** `pnpm dlx wxt@latest init` scaffolds 0.21.x with a different config surface (wxt.config.ts option names, module resolution), then antd/React versions drift; the scaffolded config no longer matches Appendix G.
**Why it happens:** The approved-stack constraint `wxt ^0.19` + `@wxt-dev/module-react ^0.3` predates the 0.21 release line and the module's move to 1.x (peer `wxt >= 0.19.16`).
**How to avoid:** Scaffold with `pnpm dlx wxt@0.19.29 init`; set `"wxt": "^0.19.29"` explicitly in package.json; use `@wxt-dev/module-react@^1.2.2` (its peer range covers wxt 0.19.x). Do not run `pnpm update wxt` past 0.19.
**Warning signs:** package.json shows `wxt@^0.21` or `@wxt-dev/module-react@^0.3` unresolved (0.3 doesn't exist on the registry).

### Pitfall 3: `src/entrypoints/app/` vs `standalone/` — the spec contradicts itself
**What goes wrong:** Following §8.5's `app/` diagram line produces `chrome-extension://<id>/app.html`; the handoff URL builder and tests expect `standalone.html` (M.2 `openStandalone`, Flow 11).
**Why it happens:** §8.5 diagram (line ~1320) is stale; glossary (line ~1042), §5.1, §18 and all runtime code use the `standalone` stem.
**How to avoid:** Create `src/entrypoints/standalone/{index.html,main.tsx}`. Keep `standalone` as the canonical stem everywhere (URLs, tests, workspace). Do not create `app/`.
**Warning signs:** `hydrateFromURL` parses a stem; a test asserting `standalone.html` fails against an `app.html` entrypoint.

### Pitfall 4: Content scripts importing shared modules blow up the content bundle
**What goes wrong:** `core.content.ts` imports `MessageBus` → which imports `WorkspaceStore` → which pulls zustand + antd — bundling megabytes into every page's content script.
**Why it happens:** WXT by default includes shared chunk dependencies in the content-script entry; without manual chunking, antd/React land in the content bundle.
**How to avoid:** The Appendix G `manualChunks` (antd / antd-x / antd-x-markdown / ant-icons / defuddle / yaml) keeps content scripts lean — keep the config verbatim; content bridge modules must import only `RuntimeEnvelope` + `OperationId` + `MessageType` + `debugLog` (all dependency-free core files). Enforce with the isolation test in `verify:phase-1`.
**Warning signs:** Built `.output` content script > ~100KB, or a `wxt build` warning about shared chunks in content entries.

### Pitfall 5: Message contracts that bypass `RuntimeEnvelope`
**What goes wrong:** A handler replies with a bare object or a new one-off message type; the events bridge can't route it, tests fail, and `trust`/`instructionAuthority` fields silently vanish.
**Why it happens:** Fastest path to code in a greenfield phase; the canonical envelope looks heavier than a plain `{type, data}` object.
**How to avoid:** Every background and content handler returns `ResponseEnvelope` (via `workerState.ok`/`workerState.fail`); new message types are added to the canonical `MessageType` enum (per D-17, PING/PONG/GET_CONTENT_CAPABILITIES/CONTENT_CAPABILITIES are additions to it, not new contracts). Zod fixture tests per public boundary (§0.3) enforce shape.
**Warning signs:** `as any` casts at the edge of `MessageBus`, or a message object that has no `id`/`kind` fields.

### Pitfall 6: Theme breakage from the double-provider or matchMedia-in-jsdom
**What goes wrong:** Tokens don't apply (default white theme despite dark mode), or `getAntdConfig` throws in tests (`window.matchMedia is not a function`).
**Why it happens:** (a) `ConfigProvider` nested inside `XProvider` — the inner one silently resets tokens; (b) `resolveDark`/`auto` mode calls `window.matchMedia` at import time.
**How to avoid:** Exactly one `XProvider` per surface (Pattern 1); guard `matchMedia` with `typeof window !== 'undefined'` and polyfill `matchMedia` in `tests/setup.ts`. `compact: true` only on the side panel, `false` on standalone (per UI-SPEC).
**Warning signs:** `ConfigProvider` appears anywhere in a `main.tsx`; `matchMedia` called at module top level.

### Pitfall 7: Zustand persist middleware used for cross-surface state
**What goes wrong:** `persist` writes to localStorage; side panel writes, standalone never sees the change; opened-tab/theme state diverges.
**Why it happens:** localStorage is per-document; the spec explicitly routes cross-surface state through `chrome.storage.local` + `onChanged` (D-13, Appendix M.1).
**How to avoid:** Use plain zustand stores (no persist middleware) for ThemeStore/WorkspaceStore; synchronize via the storage adapter + `onChanged` listener (Pattern 2). `np_workspace`/`np_theme`/`np_theme_pack` keys are the single source of truth.
**Warning signs:** `persist` in a zustand `create` call; a test asserting cross-context sync passes without `fakeBrowser.storage`.

## Code Examples

### RuntimeEnvelope and a PONG reply (content bridge)
```typescript
// Source: spec §20.1 RuntimeEnvelope + D-17 (canonical)
// src/core/runtime/OperationId.ts
export function createOperationId(): string {
  return crypto.randomUUID();
}

// src/core/runtime/RuntimeEnvelope.ts
export interface RuntimeEnvelope<T extends MessageType = MessageType, D = unknown> {
  id: string;           // operationId
  kind: 'request' | 'response';
  type: T;              // canonical MessageType
  payload?: D;
  trust: 'trusted' | 'retrieved' | 'untrusted';
  instructionAuthority: boolean;
}

// content script reply (core.content.ts):
chrome.runtime.onMessage.addListener((msg: RuntimeEnvelope, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ...msg, kind: 'response', type: 'PONG', payload: { ok: true } });
  }
});
```

### WorkspaceRouter.openStandalone (Flow 11, M.2)
```typescript
// Source: spec Appendix M.2 (canonical, handoff URL shape)
const STANDALONE_URL = (id: string) => `chrome-extension://${id}/standalone.html`;
async function openStandalone(opts: { workspaceId: string; conversationId: string; page?: string }) {
  const { workspaceId, conversationId, page } = opts;
  const url = `${STANDALONE_URL(chrome.runtime.id)}?workspaceId=${workspaceId}&conversationId=${conversationId}${page ? `&page=${page}` : ''}`;
  const tabs = await chrome.tabs.query({ url: STANDALONE_URL(chrome.runtime.id) + '*' });
  if (tabs[0]?.id) {
    await chrome.tabs.update(tabs[0].id, { active: true, url });
  } else {
    await chrome.tabs.create({ url, active: true });
  }
  useWorkspaceStore.getState().setOpenedStandaloneTabId(tabs[0]?.id);
}
```

### WXT vitest setup (D-03)
```typescript
// vitest.config.ts — Source: wxt.dev/guide/essentials/unit-testing
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
```

### antd v6 theming with algorithm array
```typescript
// Source: antd v6 CSS-variable theming docs (verified) — combine darkAlgorithm + compactAlgorithm via array
import { theme } from 'antd';
const cfg = {
  theme: {
    algorithm: [theme.darkAlgorithm, theme.compactAlgorithm], // side panel: dark + compact
    token: { fontFamily: 'Inter, system-ui, sans-serif', colorPrimary: '#40a9ff' },
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webextension-polyfill` manual wrappers | WXT's `browser` global + file-based entrypoints | WXT 0.19 (2024-2025) | Manifest generation, HMR, and `wxt build` are canonical — no hand-written manifest.json |
| `vitest-chrome` mocking | `wxt/testing/vitest-plugin` + `fakeBrowser` | WXT 0.19 | Official in-memory chrome API mock; vitest-chrome is stale (0.1.0, 3 yrs old) |
| AntD v5 CSS-in-JS theming | AntD v6 CSS-variable theming (default) | AntD v6 (2025) | `algorithm` array composes; tokens become CSS vars — dark/compact composition is native |
| `ConfigProvider` + `ThemeProvider` split | `XProvider` (extends ConfigProvider) | @ant-design/x 2.x | Single provider for theme + locale; double-wrapping is now a footgun, not a feature |
| `wxt@latest` = 0.19.x | `wxt@latest` = 0.21.x | 2025-2026 | Approved stack pins ^0.19 — scaffold with explicit `wxt@0.19.29` |

**Deprecated/outdated:**
- `@wxt-dev/module-react@^0.3` (STACK.md pin): package only ever published 1.x; use `^1.2.2`.
- `vitest-chrome`: unmaintained; WXT ships its own mock.
- `framer-motion`: banned (R-9); use `motion` with `motion/react` import.
- `src/entrypoints/app/` naming: stale in §8.5; canonical stem is `standalone`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@wxt-dev/module-react` peer `wxt>=0.19.16` makes `^1.2.2` compatible with `wxt ^0.19` | Standard Stack | If peer resolution conflicts, pin module to a 1.x version verified against 0.19.29 or add `--legacy-peer-deps` |
| A2 | AntD v6 CSS-variable theming is the default and `algorithm` arrays compose (`[darkAlgorithm, compactAlgorithm]`) | State of the Art / Patterns | If v6 still requires CSS-in-JS opt-in, the theming pattern changes; verify against installed antd version at plan time |
| A3 | `chrome.sidePanel.open` gesture requirement + crbug 1478648 (await drops gesture in Chrome 127+) applies to WXT's runtime-messaging path | Common Pitfalls | If Chrome version in target env is <127, the bug may not reproduce, but the callback-style workaround is still safe |
| A4 | `WxtVitest()` + `fakeBrowser` is the current official WXT testing path (wxt.dev guide) | Code Examples | If the API changed in 0.19.x patch line, adapt to the documented `wxt/testing` entry in the installed version |
| A5 | jsdom lacks `window.matchMedia` by default and needs a polyfill in setup | Common Pitfalls | Trivial — polyfill is 10 lines; risk negligible |
| A6 | Background SW is ephemeral and `setPanelBehavior`/`contextMenus.create` must be re-registered per startup (WXT `defineBackground` runs on each SW start) | Architecture | If SW stays alive via keepalive, registrations persist, but re-registering is idempotent — safe either way |
| A7 | `crypto.randomUUID()` is available in all extension contexts (secure contexts) | Don't Hand-Roll | Available in SW, pages, content scripts in MV3 — no polyfill needed |
| A8 | No Chromium/Chrome binary is installed on the dev machine (`command -v chromium chromium-browser google-chrome` empty) | Environment Availability | Manual "load unpacked + click through" verification must fall back to `wxt build` + unit tests, or install Chromium for e2e |
| A9 | `/tmp` (tmpfs) quota exhaustion (80% full) makes repo-local scratch paths safer | Environment Availability | Trivial — repo paths are committed-ignored or removed after use |

## Open Questions

1. **Do we need a `verify:phase-1` script that runs `wxt build` before the isolation test?**
   - What we know: §24 lists `verify:phase-1`; the isolation/anti-pattern check (Pitfall 4) can only inspect `.output` after a build; D-04 requires eslint + prettier + tsc + tests.
   - What's unclear: whether "eslint + prettier + tsc + vitest" alone satisfies §24, or the isolation grep must run against a built bundle.
   - Recommendation: include `wxt build` + isolation check in the verify script; it's the only way to prove Pitfall 4 is avoided. Flag for planner to sequence build before verify.

2. **Chrome runtime target for `sidePanel.open` (user gesture) testing**
   - What we know: `chrome.sidePanel.open({tabId})` needs a gesture; Chrome 127+ is stricter.
   - What's unclear: which Chrome channel the user runs for manual testing; whether Cmd+K open actions are exercised manually in Phase 1.
   - Recommendation: rely on unit tests for router logic + the callback-style pattern (A3); manual side-panel-open verification deferred to e2e (Phase 8+).

3. **`wxt.config.ts` verbatim vs. `chrome120` target**
   - What we know: Appendix G pins `target: 'chrome120'` and `sourcemap: 'inline'`.
   - What's unclear: whether the user's actual browser is older (sidePanel API needs ≥116; setPanelBehavior ≥116).
   - Recommendation: keep Appendix G verbatim (D-05); note minimum Chrome 116 as a support constraint for the user.

4. **Do phase-1 `verify` steps run in CI or locally only?**
   - What we know: `.planning/config.json` has no CI wiring documented in phase docs; `verify:phase-1` is a local script per §24.
   - What's unclear: whether a GitHub Actions workflow exists for this repo.
   - Recommendation: treat verify as local-only in Phase 1 (no CI files in §18 create-list); CI is a later-phase concern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | WXT/vite/vitest | ✓ | v24.18.1 | — |
| pnpm | Install (D-01) | ✓ | 11.18.0 | — |
| git | GSD workflow | ✓ | 2.53.0 | — |
| Chrome/Chromium binary | Manual extension load + `sidePanel.open` gesture testing | ✗ | — | Use `wxt build` + vitest unit tests for Phase 1; install Chromium if manual click-through is required |
| npm registry access | Install deps | ✓ | — | — |

**Missing dependencies with no fallback:**
- None — all required tooling for Phase 1 build/test is available.

**Missing dependencies with fallback:**
- **Chrome browser binary** (for manual "load unpacked" validation): fallback is `wxt build` output inspection + unit tests; a future e2e phase (8+) installs the browser. Flag to the planner: do not schedule manual browser click-through tasks in Phase 1.

## Validation Architecture

> Per `.planning/config.json`: `workflow.nyquist_validation` enabled → this section is required. Phase gate: `verify:phase-1` (spec §24) must pass — eslint + prettier + `tsc --noEmit` + `vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` + isolation check.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 (jsdom env) + WxtVitest plugin |
| Config file | `vitest.config.ts` (WxtVitest) + `tests/setup.ts` (matchMedia polyfill, fakeBrowser reset) |
| Quick run command | `pnpm vitest run tests/core/runtime tests/core/events` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUNTIME-01 | RuntimeEnvelope serialize/deserialize round-trip | unit | `pnpm vitest run tests/core/runtime/RuntimeEnvelope.test.ts -x` | ❌ Wave 0 |
| RUNTIME-02 | Background registers listeners synchronously; workerState.ok/fail envelope replies | unit | `pnpm vitest run tests/core/runtime/workerState.test.ts -x` | ❌ Wave 0 |
| RUNTIME-03 | EventBus subscribe/emit/off + BroadcastBus cross-surface sync (fakeBrowser runtime events) | unit | `pnpm vitest run tests/core/events/EventBus.test.ts -x` | ❌ Wave 0 |
| RUNTIME-04 | MessageBus routes typed messages, returns ResponseEnvelope | unit | `pnpm vitest run tests/core/runtime/MessageBus.test.ts -x` | ❌ Wave 0 |
| RUNTIME-05 | Content bridge PING→PONG, capabilities request/reply (D-17) | unit | `pnpm vitest run tests/core/content/ContentScriptHost.test.ts -x` | ❌ Wave 0 |
| WSPC-01 | WorkspaceStore hydrate from chrome.storage.local + URL params (M.1) | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts -x` | ❌ Wave 0 |
| WSPC-02 | WorkspaceRouter.openStandalone creates/updates tabs, sets openedStandaloneTabId (M.2) | unit | `pnpm vitest run tests/core/workspace/WorkspaceRouter.test.ts -x` | ❌ Wave 0 |
| WSPC-03 | WorkspaceSync heartbeat + version LWW (WORKSPACE_UPDATED) | unit | `pnpm vitest run tests/core/workspace/WorkspaceSync.test.ts -x` | ❌ Wave 0 |
| WSPC-04 | Registries register at startup; page registry drives Shell nav | unit | `pnpm vitest run tests/core/registry -x` | ❌ Wave 0 |
| WSPC-05 | ThemeStore resolveDark + pack switch + storage onChanged sync (D-13) | unit | `pnpm vitest run tests/core/theme/ThemeStore.test.ts -x` | ❌ Wave 0 |
| UI-SPEC | Shells/Onboarding/page skeletons render with XProvider | component | `pnpm vitest run tests/components -x` | ❌ Wave 0 |
| §24 isolation | No UI/antd in content script bundle (built `.output`) | build+grep | `pnpm wxt build && node tests/isolation/check-content-bundle.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/core/runtime tests/core/events` (fast, 30s)
- **Per wave merge:** `pnpm vitest run` (full suite)
- **Phase gate:** `verify:phase-1` — `pnpm eslint . && pnpm prettier --check . && pnpm tsc --noEmit && pnpm wxt build && pnpm vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme && node tests/isolation/check-content-bundle.mjs`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — WxtVitest plugin (no test files yet)
- [ ] `tests/setup.ts` — matchMedia polyfill + `fakeBrowser.reset()` per test
- [ ] `tests/core/runtime/RuntimeEnvelope.test.ts` — RUNTIME-01 (zod fixture per §0.3)
- [ ] `tests/core/events/EventBus.test.ts` — RUNTIME-03
- [ ] `tests/core/workspace/WorkspaceStore.test.ts` — WSPC-01
- [ ] `tests/core/theme/ThemeStore.test.ts` — WSPC-05 (spec §24 requires this exact path)
- [ ] `tests/isolation/check-content-bundle.mjs` — §24 content-bundle isolation (grep for antd/React in built content script)
- [ ] Dev deps install: `pnpm add -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom` — none installed yet

## Security Domain

> `.planning/config.json` does not set `security_enforcement: false` → enabled. Phase 1 ships no AI, no IndexedDB, no remote calls — the security surface is the message bridge, storage keys, and the content bundle boundary.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | None in Phase 1 (no provider auth until Phase 3) |
| V3 Session Management | no | — |
| V4 Access Control | partial | Content script ISOLATED world (D-16); no `all_urls` host permission in manifest (Appendix G) |
| V5 Input Validation | yes | Zod `requestJson`/fixture tests (§0.3); RuntimeEnvelope shape enforced at every boundary |
| V6 Cryptography | no | AES-GCM vault is Phase 6 |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Content script DOM injection / page UI | Tampering | ISOLATED world, extraction-only (D-16); no UI mount in Phase 1 (R-5) |
| Message envelope spoofing from page | Spoofing | `MessageType` whitelist + `trust: 'retrieved'` default (Golden Rule 7); only trusted (own-extension) senders accepted |
| Storage key collision (np_workspace etc.) | Tampering | Canonical key names from Appendix M only; never store conversation bodies/API keys (R-10) |
| Bundle smuggling (antd/React into content script) | Tampering | Appendix G manualChunks verbatim + build-time isolation grep |
| Side panel/standalone cross-context state desync | — | Single source of truth = chrome.storage.local + onChanged (D-13) |

## Sources

### Primary (HIGH confidence)
- [PRODUCT_SPEC_v0_1.md] — §0.2/§5/§8.1/§8.4/§8.5/§13/§18 Phase-1 block/§20/§21.5/§24/Appendix A/B/C/E/F/G/M, Flows 9–12 (canonical; read in full this session)
- [01-CONTEXT.md] — decisions D-01..D-18 (user-locked)
- [01-UI-SPEC.md] — approved UI design contract
- [01-DISCUSSION-LOG.md] — D-01..D-18 rationale (esp. D-13 storage sync, D-17 content bridge)
- [npm registry] — verified versions/peers for all stack packages (2026-08-04)
- [wxt.dev guide (unit testing, entrypoints, config)] — WxtVitest/fake-browser, defineContentScript options

### Secondary (MEDIUM confidence)
- [crbug 1478648 / Chrome docs sidePanel.open] — gesture requirement + await-drops-gesture behavior
- [antd v6 theming docs] — CSS-variable theming default, algorithm arrays
- [@ant-design/x docs] — XProvider extends ConfigProvider

### Tertiary (LOW confidence)
- [Assumptions Log A1–A9] — all flagged `[ASSUMED]`; planner should verify peer-resolution (A1) and antd v6 defaults (A2) during plan execution if the installed versions differ

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions/peers verified against npm registry this session; spec §7 + CONTEXT D-01/D-03/D-05 locked
- Architecture: HIGH — all patterns traced to canonical spec sections (§5.5, §8.1, §18, Appendix F/G/M, Flows 9–12) read in full
- Pitfalls: MEDIUM — 7 documented pitfalls, of which the sidePanel-gesture (Pitfall 1) and wxt-version-drift (Pitfall 2) are the highest-impact; browser-behavior claims sourced from Chrome docs/crbug (A3)

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 (30 days; versions pinned via npm registry this session)




