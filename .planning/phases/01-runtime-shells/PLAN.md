# Phase 1 — MV3/WXT Runtime + AntD Shells + Workspace

## Goal

Establish the Chrome MV3 extension foundation: WXT build config, background service worker, Chat-only Side Panel, Standalone shell, Ant Design v6 theming, workspace state/runtime, cross-context messaging, command palette, and onboarding shell with static introduction placeholder. The extension must load, both surfaces must render, onboarding shell must appear on fresh install, and workspace state must hand off correctly between surfaces.

## Non-Goals

- AI providers, planner/executor/renderer (Phase 3)
- Storage encryption, IndexedDB, WriteJournal (Phase 2)
- Content extraction strategies (Phase 6)
- RICH persona behaviour including RICH-R-03 (Phase 15)
- Host-page injection or write-back (v0.2+, §25)
- Add-on runtime registration beyond the registry stubs (Phase 17)
- Tool governance (Phase 18)
- Provider connection testing (Phase 3)
- Popup action UI (not in §18 Phase 1 create list)
- SlashCommandRegistry (not in §18 Phase 1 create list)
- User-facing Appearance controls / theme toggle UI (Phase 15)

## Dependencies and Preconditions

- Node.js 20+ and pnpm 11.22.0 installed
- Chrome 120+ for testing
- DEC-012 ratified: fresh start on `sapphire`, ignore `alaska`
- DEC-013 ratified: command palette component path assigned

## Requirement Traceability

| Requirement | Task(s) | Enforced by |
|---|---|---|
| REQ-P01 (MV3/WXT extension) | T1, T2, T3 | `verify:phase-1` build gate |
| REQ-P02 (Chat-only Side Panel) | T5, T11 | `tests/components/sidepanel/SidePanelShell.test.tsx` |
| REQ-P03 (Standalone workspace) | T6, T11 | `tests/components/standalone/StandaloneShell.test.tsx` |
| REQ-P04 (Cross-surface continuity) | T7, T11, T14 | `tests/core/workspace/WorkspaceStore.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`, manual cross-surface acceptance |
| REQ-P06 (AntD v6 + AntD X) | T4, T5, T6 | `tests/core/theme/ThemeStore.test.ts`, render tests |
| REQ-P07 (Content scripts extraction-only) | T3 | `tests/isolation/no-content-script-ui.test.ts` |
| REQ-Q01 (Canonical paths/identifiers) | All tasks | `tsc --noEmit` |
| REQ-Q03 (Fixture tests per boundary) | T13–T19 | `verify:phase-1` test gates |
| REQ-Q06 (Git/PLAN/RESULT/STATUS) | T20, T21 | Manual evidence |
| REQ-UX01 (Side Panel 400px responsive) | T5 | Manual acceptance |
| REQ-UX02 (Standalone narrow alert) | T6 | Manual acceptance |
| REQ-UX03 (One XProvider per surface) | T5, T6 | Render tests |
| REQ-UX04 (Light/dark/auto + theme packs) | T4 | `tests/core/theme/ThemeStore.test.ts` |

## Decision Traceability

| Decision | Task(s) |
|---|---|
| DEC-003 (v0.1 UI system: AntD v6 + AntD X 2.x) | T4, T5, T6 |
| DEC-004 (Side Panel Chat only; Standalone owns all pages) | T5, T6 |
| DEC-005 (Standalone paths `src/entrypoints/standalone/`, `src/components/standalone/`) | T6 |
| DEC-006 (Content scripts extraction-only) | T3 |
| DEC-012 (Fresh start on sapphire) | T1 |
| DEC-013 (Shared command palette component path) | T9 |

## Repository Findings

- **No application code exists.** `src/`, `tests/`, `package.json`, `wxt.config.ts`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` are all absent.
- `package-lock.json` exists (lockfileVersion 3) but is a stale npm lockfile — must be removed; pnpm 11 is canonical.
- `.planning/` directory is fully populated.
- `AGENTS.md` is at repository root.
- `.gitignore` excludes `node_modules/`, `dist/`, `.output/`, `.wxt/`.
- WXT auto-discovers entrypoints from `src/entrypoints/`; no root `index.html` required.

### Phase 1 Visual References

Mock-up directory:

`.planning/mockups/phase-01/`

| File | Status | Phase 1 binding scope |
|---|---|---|
| `shell-layout-reference.png` | reference-only | Overall relationship between Standalone and Side Panel surfaces |
| `sidepanel-shell-reference.png` | binding-layout | Header, conversation region, composer, status area and 400 px proportions |
| `sidepanel-empty-state-reference.png` | binding-layout | Empty-state composition, static suggestions and composer placement |
| `standalone-shell-reference.png` | reference-only | Navigation, header, workspace and drawer region placement |

Phase 1 implements shells, static placeholders and responsive structure only.

The following visible mock-up features are explicitly non-binding for Phase 1:

- AI responses and streaming;
- model selectors;
- provider status and provider configuration;
- attachments;
- conversation-history persistence;
- functional message actions;
- Notes workspace functionality;
- TeamGQM functionality;
- Appearance controls;
- API-key persistence or connection testing;
- final RICH visual polish.

When a mock-up conflicts with the product specification, decisions or this plan, the higher-authority written contract wins.

## Ordered Task List

### T1 — Project scaffold and toolchain

**Precondition:** None (this task creates `package.json`).

**Files to create:**
- `package.json` — dependencies from §7, `"packageManager": "pnpm@11.22.0"`, and a fully functional `verify:phase-1` script. Future `verify:phase-N` scripts may be omitted until their phase; if created early, they must fail explicitly with `PHASE_NOT_IMPLEMENTED` and a non-zero exit code.
- `tsconfig.json` — strict mode, path aliases (`@/*` → `src/*`)
- `vite.config.ts` — React plugin, path resolution
- `vitest.config.ts` — jsdom environment, `setupFiles: ['./tests/setup.ts']`
- `wxt.config.ts` — Appendix G verbatim with `srcDir: 'src'`

**Files to delete:**
- `package-lock.json` — stale npm lockfile; replaced by `pnpm-lock.yaml`

**Completion criteria:**
- `pnpm install` succeeds, produces `pnpm-lock.yaml`
- `pnpm run build:ext` succeeds
- `tsc --noEmit` passes
- `pnpm-lock.yaml` committed; `package-lock.json` removed and committed

---

### T2 — Background service worker and runtime messaging

**Precondition:** T1

**Files to create:**
- `src/entrypoints/background.ts` — BackgroundRouter per Appendix E
- `src/core/runtime/RuntimeEnvelope.ts` — `RuntimeEnvelope<T>` and `ResponseEnvelope<T>` from Appendix C
- `src/core/runtime/MessageType.ts` — `MessageType` and `MessageTypeValue` from Appendix E
- `src/core/runtime/OperationId.ts` — operation ID generator using `crypto.randomUUID()`
- `src/core/runtime/BroadcastBus.ts` — cross-context broadcast
- `src/core/runtime/PortReader.ts` — `readPort<T>()` from Appendix E
- `src/core/runtime/workerState.ts` — worker state tracking

**Canonical contracts:**
- `RuntimeEnvelope<T>`, `ResponseEnvelope<T>` — Appendix C
- `MessageType`, `MessageTypeValues` — Appendix E
- `BackgroundRouter.register()` — Appendix E

**Completion criteria:**
- Background router registers `onMessage` listener synchronously
- `RuntimeEnvelope` fixtures parse correctly
- Unknown `MessageTypeValues` rejected

---

### T3 — Extraction-only content script

**Precondition:** T1

**Files to create:**
- `src/entrypoints/core.content.ts` — WXT `defineContentScript` entrypoint
- `src/core/log/debugLog.ts` — debug logger

**Canonical path:** `src/entrypoints/core.content.ts` (WXT auto-discovers from `src/entrypoints/`; `srcDir: 'src'` in `wxt.config.ts`).

**Canonical contracts:**
- `defineContentScript({ matches: ['<all_urls>'], runAt: 'document_idle', world: 'ISOLATED' })` — §5.1
- Content script MUST NOT import antd, react, react-dom, defuddle, yaml, mathml-to-latex, temml, turndown (§0.2, §24, Appendix G)

**Completion criteria:**
- Content script bundle contains no banned imports (enforced by isolation test)

---

### T4 — Theme system (AntD v6 + theme packs)

**Precondition:** T1

**Files to create:**
- `src/core/theme/ThemeStore.ts` — `useThemeStore` from Appendix F.1 verbatim
- `src/core/theme/antdConfig.ts` — `getAntdConfig()` from Appendix F.2 verbatim

**Canonical contracts:**
- `ThemeMode = 'light' | 'dark' | 'auto'`
- `ThemePack = 'default' | 'liquid-glass' | 'claude-warm'`
- Persisted to `chrome.storage.sync` via Zustand persist
- Propagation tested by updating `ThemeStore` and simulating `chrome.storage.onChanged`

**Acceptance:** Theme propagation is verified programmatically (store update → storage sync → other surface re-renders). No user-facing theme toggle UI is built in Phase 1 — final Appearance controls (display mode + theme pack selectors) are Phase 15.

**Completion criteria:**
- Dark mode switches via `theme.darkAlgorithm` (not `.dark` class)
- Pack token overlay applied
- `ThemeStore` update + `chrome.storage.onChanged` simulation propagates to both surfaces

---

### T5 — Side Panel shell (Chat only)

**Precondition:** T1, T4

**Files to create:**
- `src/entrypoints/sidepanel/index.html`
- `src/entrypoints/sidepanel/main.tsx` — Appendix F.3 mounting pattern (XProvider ⊃ ConfigProvider)
- `src/components/sidepanel/SidePanelShell.tsx` — chat-only shell
- `src/components/sidepanel/SidePanelRouter.tsx` — internal routing
- `src/core/components/ErrorBoundary.tsx`
- `src/core/components/PortableMarkdown.tsx`
- `src/core/i18n/strings.ts` — `STR` from Appendix B verbatim

**Canonical contracts:**
- Follow the exact Appendix F.3 provider hierarchy.
- There must be exactly one `XProvider` in the Side Panel surface root.
- Do not introduce an additional `ConfigProvider` unless Appendix F.3 explicitly contains it.
- `compact: true` for Side Panel.
- `App.useApp()` for imperative APIs (§F.4).

**Visual references:**
- `.planning/mockups/phase-01/sidepanel-shell-reference.png`
- `.planning/mockups/phase-01/sidepanel-empty-state-reference.png`

**Binding visual scope:**
- Header region.
- Chat-only surface.
- Empty-state placeholder.
- Conversation-region placeholder.
- Composer shell.
- Status-row shell.
- Responsive behaviour at approximately 400 px and below 380 px.

**Explicitly non-binding for Phase 1:**
- Functional model selection.
- Conversation-history persistence.
- Provider status or provider configuration.
- Attachments.
- AI responses or streaming.
- Functional message actions.

**Completion criteria:**
- Side Panel renders
- Usable at ~400px and below 380px (§REQ-UX01)

---

### T6 — Standalone shell

**Precondition:** T1, T4

**Files to create:**
- `src/entrypoints/standalone/index.html`
- `src/entrypoints/standalone/main.tsx` — Appendix F.3 mounting pattern
- `src/components/standalone/StandaloneShell.tsx` — full workspace shell
- `src/components/standalone/StandaloneRouter.tsx` — page routing
- `src/components/pages/ChatPage.tsx` — skeleton only
- `src/components/pages/AgentPage.tsx` — skeleton only
- `src/components/pages/NotesPage.tsx` — skeleton only
- `src/components/pages/OptionsPage.tsx` — skeleton only

**Canonical contracts:**
- Follow the exact Appendix F.3 provider hierarchy.
- There must be exactly one `XProvider` in the Standalone surface root.
- Do not introduce an additional `ConfigProvider` unless Appendix F.3 explicitly contains it.
- `compact: false` for Standalone.
- Paths: `src/entrypoints/standalone/`, `src/components/standalone/` (DEC-005).

**Visual references:**
- `.planning/mockups/phase-01/standalone-shell-reference.png`
- `.planning/mockups/phase-01/shell-layout-reference.png`

**Binding visual scope:**
- Standalone navigation shell.
- Top header.
- Page-content outlet.
- Skeleton pages.
- Narrow-screen warning.
- Workspace-region structure.

**Explicitly non-binding for Phase 1:**
- Functional Chat history.
- AI message rendering or streaming.
- Model and provider controls.
- TeamGQM behaviour.
- Notes workspace functionality.
- Final message actions and RICH visual polish.

**Completion criteria:**
- Standalone view renders
- Shows narrow-screen alert below supported width (§REQ-UX02)

---

### T7 — Workspace state and routing

**Precondition:** T1

**Files to create:**
- `src/core/workspace/WorkspaceStore.ts` — `WorkspaceState` from Appendix C
- `src/core/workspace/WorkspaceRouter.ts` — surface election and handoff
- `src/core/workspace/WorkspaceSync.ts` — cross-surface sync

**Canonical contracts:**
- `WorkspaceState`, `ActiveSurface` — Appendix C

**Completion criteria:**
- `WorkspaceRouter.openStandalone()` deduplicates tabs
- State hands off between surfaces

---

### T8 — Cross-context messaging and events

**Precondition:** T2

**Files to create:**
- `src/core/messaging/MessageBus.ts` — typed message bus
- `src/core/events/EventBus.ts` — internal event bus
- `src/core/registry/Registry.ts` — base registry
- `src/core/registry/AddonRegistry.ts` — stub
- `src/core/registry/AddonSettingsStore.ts`
- `src/core/registry/SidePanelPageRegistry.ts` — `SidePanelPageRegistration` from Appendix C
- `src/core/registry/StandalonePageRegistry.ts` — `StandalonePageRegistration` from Appendix C

**Canonical contracts:**
- All messages wrapped in `RuntimeEnvelope<T>` (§0.2)

**Completion criteria:**
- MessageBus sends/receives typed envelopes
- EventBus dispatches events

---

### T9 — Command registry, keymap registry, and shared command palette

**Precondition:** T1

**Files to create:**
- `src/core/commands/CommandRegistry.ts` — **DEC-013 canonical path** (owns command IDs, labels, availability, handlers)
- `src/core/input/KeymapRegistry.ts` — `KeymapRegistration` from Appendix C (maps keyboard combos to command IDs)
- `src/components/CommandPalette.tsx` — **DEC-013 canonical path** (shared palette component)
- `src/core/prompts/types.ts` — `PromptTemplate`, `Macro` from Appendix C
- `src/core/prompts/index.ts` — prompt registry stub

**DEC-013 canonical contract:**
- Command registry path: `src/core/commands/CommandRegistry.ts`
- Keymap registry path: `src/core/input/KeymapRegistry.ts`
- Shared palette path: `src/components/CommandPalette.tsx`
- Single shared palette instance used by both `SidePanelShell` and `StandaloneShell`
- Triggered by `KeymapRegistry` Cmd+K combo
- Renders as AntD Modal with Input + filtered list (Flow 10, §17)
- Command set: Open Standalone view, Focus Side Panel, Open Options (minimum Flow 10 set)
- `KeymapRegistry` must not own or register command definitions

**Test paths:**
- `tests/core/commands/CommandRegistry.test.ts` — command registration, lookup, availability, handler invocation
- `tests/core/input/KeymapRegistry.test.ts` — combo registration, combo-to-command resolution, `when` clause
- `tests/components/CommandPalette.test.tsx` — render, Cmd+K trigger, command list, selection

**Completion criteria:**
- CommandRegistry and KeymapRegistry are separate registries with strict ownership
- Cmd+K opens palette on both surfaces
- Palette is the SAME component (not duplicated per surface)
- Minimum Flow 10 command set present

---

### T10 — Onboarding shell with static introduction placeholder

**Precondition:** T5

**Files to create:**
- `src/components/OnboardingModal.tsx` — Flow 9 shell with static introduction placeholder

**Scope:**
- Renders the onboarding modal shell over disabled surface
- Step 1: static introduction placeholder (NOT full RICH-R-03 persona selection — that is Phase 15)
- Steps 2–4: provider selection, API key entry, connection state (UI only — actual connection testing deferred to Phase 3)
- Canonical deferred/unavailable connection-test state

**Secret-handling rule:**
- API-key input remains component-local state only
- API-key input is cleared from component state when onboarding modal closes
- API-key input is NOT persisted, validated, logged, or submitted in Phase 1
- No `debugLog` call includes the key value
- No network request includes the key
- No storage API (`chrome.storage`, IndexedDB) stores the key

**Explicitly deferred to Phase 15:**
- RICH-R-03 persona card behaviour
- Full persona selection and injection

**Explicitly deferred to Phase 3:**
- Provider connection testing (`validateConfig`)
- API key persistence

**Completion criteria:**
- Onboarding shell appears on fresh install
- Static introduction placeholder shown (no persona logic)
- No Phase 15 RICH-R-03 behaviour implemented
- API key never leaves component-local state; cleared on close

---

### T11 — Cross-surface workspace handoff

**Precondition:** T5, T6, T7

**Files to modify:**
- `src/entrypoints/background.ts` — extend `BackgroundRouter` (same canonical file from T2) to register `OPEN_STANDALONE`, `WORKSPACE_HANDOFF`, and `WORKSPACE_UPDATED` message handlers

**Implementation:**
- Wire `WorkspaceRouter` into both shells
- Extend `BackgroundRouter.register()` in `src/entrypoints/background.ts` to handle:
  - `OPEN_STANDALONE` — opens or focuses existing Standalone tab
  - `WORKSPACE_HANDOFF` — transfers workspace state to Standalone surface
  - `WORKSPACE_UPDATED` — notifies other surfaces of workspace changes
- Implement Flow 11 protocol (§17)

**Canonical contracts:**
- `MessageType.OPEN_STANDALONE`, `WORKSPACE_HANDOFF`, `WORKSPACE_UPDATED` — Appendix E
- `src/entrypoints/background.ts` is the single canonical file owning the `BackgroundRouter`

**Completion criteria:**
- Side Panel opens Standalone view
- Standalone re-open deduplicated
- Workspace state transfers
- All three message types handled in the same `BackgroundRouter` from T2

---

### T12 — Test setup file (Chrome API mocking)

**Precondition:** T1

**Files to create:**
- `tests/setup.ts` — Chrome API mock setup

**Chrome API mocking strategy:**
- Use `vitest-chrome` (`import { chrome } from 'vitest-chrome'`)
- Referenced in `vitest.config.ts` as `setupFiles: ['./tests/setup.ts']`
- Reset: `vi.clearAllMocks()` in `beforeEach`
- Restore: `vi.restoreAllMocks()` in `afterEach`
- No alternative mocking approach used

**Completion criteria:**
- `tests/setup.ts` configures `globalThis.chrome`
- Mocks reset between tests

---

### T13 — Runtime and operation ID tests

**Precondition:** T2

**Files:**
- `tests/core/runtime/RuntimeEnvelope.test.ts`
- `tests/core/runtime/OperationId.test.ts`
- `tests/core/runtime/BroadcastBus.test.ts`
- `tests/core/runtime/PortReader.test.ts`

**Completion criteria:** Envelope fixtures parse; OperationIds unique; broadcast delivers; port reads

---

### T14 — Workspace and theme tests

**Precondition:** T4, T7

**Files:**
- `tests/core/workspace/WorkspaceStore.test.ts`
- `tests/core/workspace/WorkspaceRouter.test.ts`
- `tests/core/theme/ThemeStore.test.ts`

**Completion criteria:** State transitions, handoff election, theme switching + propagation pass

---

### T15 — Messaging, registry, and input tests

**Precondition:** T8, T9

**Files:**
- `tests/core/messaging/MessageBus.test.ts`
- `tests/core/registry/Registry.test.ts`
- `tests/core/registry/PageRegistry.test.ts`
- `tests/core/commands/CommandRegistry.test.ts`
- `tests/core/input/KeymapRegistry.test.ts`

**Completion criteria:** MessageBus sends/receives typed envelopes; registries register/lookup; command registry registers/looks up/commands with handlers; keymap registers/combo-matches

---

### T16 — Event bus and isolation tests

**Precondition:** T3, T8

**Files:**
- `tests/core/events/EventBus.test.ts`
- `tests/isolation/no-content-script-ui.test.ts`

**Completion criteria:** Events dispatch; content bundle has no banned imports

---

### T17 — Component render tests

**Precondition:** T5, T6, T9, T10

**Files:**
- `tests/components/sidepanel/SidePanelShell.test.tsx`
- `tests/components/standalone/StandaloneShell.test.tsx`
- `tests/components/CommandPalette.test.tsx`
- `tests/components/OnboardingModal.test.tsx`

**Completion criteria:** All components render without crashes

---

### T18 — Security grep gate scripts

**Precondition:** All code tasks

**Files to create:**
- `scripts/verify-no-tailwind.sh` — exits non-zero if `tailwind|shadcn|@radix-ui` found in `package.json`
- `scripts/verify-no-framer-motion.sh` — exits non-zero if `framer-motion` found in `package.json`
- `scripts/verify-no-dangerous-html.sh` — exits non-zero if `innerHTML|dangerouslySetInnerHTML` found in `src/`

**Completion criteria:** All scripts pass

---

### T19 — Onboarding secret-handling test

**Precondition:** T10

**Files:**
- `tests/components/OnboardingModal.test.tsx` (extended with secret-handling assertions)

**Test assertions:**
- API key input value is not present in component state after modal closes
- No `chrome.storage` write occurs during onboarding
- No `debugLog` call includes the key value
- No `fetch` / network call includes the key

**Completion criteria:** All secret-handling assertions pass

---

### T20 — Implementation verification

**Precondition:** T1–T19 complete

**Actions:**
1. Commit all implementation (code, tests, scripts, configs) → this is the **candidate implementation commit**
2. Record the candidate commit SHA
3. Run `pnpm run verify:phase-1` against that commit SHA
4. If verification passes → record as **verified implementation SHA**
5. If verification fails → fix code, re-commit, re-verify (new candidate SHA)

**Final verified implementation commit SHA:** `<to-be-recorded>`

---

### T21 — Evidence recording

**Precondition:** T20 verification passed

**Actions:**
1. Create `RESULT.md` with:
   - Exact verification command run
   - UTC timestamp
   - Exit status (0 = pass)
   - Test summary (count, pass/fail)
   - Verified implementation commit SHA
   - Deviations from plan
   - Known issues
   - Deferred items
2. Create `ACCEPTANCE.md` with:
   - Manual acceptance checklist results
   - Visual evidence references
   - Requirement coverage matrix
3. Capture and commit the following Phase 1 evidence under `.planning/evidence/phase-01/`:
   - `sidepanel-400px.png`
   - `sidepanel-under-380px.png`
      - Required only if the below-380 px rendering differs visibly from the canonical responsive screenshot or exposes a responsive issue.
      - Otherwise record the tested width and unchanged result in `ACCEPTANCE.md`.
   - `sidepanel-empty-state.png`
   - `standalone-default.png`
   - `standalone-narrow-alert.png`
   - `command-palette-sidepanel.png`
   - `command-palette-standalone.png`
   - `onboarding-shell.png`
4. Update `.planning/STATUS.md` with verified commit SHA
5. Commit evidence files → this is the **evidence-only commit SHA**

**Verification invalidation rule:** Any change to `src/`, `tests/`, `package.json`, `wxt.config.ts`, or other application files after the verified implementation commit invalidates verification. Re-run `verify:phase-1` after any such change. Evidence-only commits (RESULT.md, ACCEPTANCE.md, STATUS.md) do NOT invalidate verification.

**Final evidence-only commit SHA:** `<to-be-recorded>`

**Phase status after T21:** `Verified, awaiting merge`.

**Phase complete:** Only after both the verified implementation commit and the evidence-only commit are merged into the canonical integration branch. If the merged application tree differs from the verified implementation tree, re-run `verify:phase-1` against the merged result.

---

## Final verify:phase-1 Script

```json
"verify:phase-1": "tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme tests/core/messaging tests/core/registry tests/core/commands tests/core/input tests/components/sidepanel tests/components/standalone tests/components/CommandPalette.test.tsx tests/components/OnboardingModal.test.tsx tests/isolation && bash scripts/verify-no-tailwind.sh && bash scripts/verify-no-framer-motion.sh && bash scripts/verify-no-dangerous-html.sh && pnpm run build:ext"
```

**Gates included:**
1. TypeScript checking (`tsc --noEmit`)
2. Runtime tests (`tests/core/runtime`)
3. Event bus tests (`tests/core/events`)
4. Workspace tests (`tests/core/workspace`)
5. Theme tests (`tests/core/theme`)
6. Messaging tests (`tests/core/messaging`)
7. Registry tests (`tests/core/registry`)
8. Command registry tests (`tests/core/commands`)
9. Input tests (`tests/core/input`)
10. Side Panel component tests (`tests/components/sidepanel`)
11. Standalone component tests (`tests/components/standalone`)
12. Command palette test (`tests/components/CommandPalette.test.tsx`)
13. Onboarding modal test (`tests/components/OnboardingModal.test.tsx`)
14. Content-script isolation test (`tests/isolation`)
15. Security: no tailwind/shadcn/radix (`scripts/verify-no-tailwind.sh`)
16. Security: no framer-motion (`scripts/verify-no-framer-motion.sh`)
17. Security: no dangerous HTML (`scripts/verify-no-dangerous-html.sh`)
18. Extension production build (`pnpm run build:ext`)

## Future Verification-Script Behaviour

- Phase 1 must create a fully functional `verify:phase-1` script.
- Unimplemented `verify:phase-N` scripts may be omitted until their phase.
- If an unimplemented future-phase script is created early, it must print `PHASE_NOT_IMPLEMENTED` and exit non-zero.
- No verification script may use `echo passed`, `exit 0`, or equivalent false-success behaviour.
- When a future phase is implemented, its placeholder or omission must be replaced with the real command required by §24.

## Manual Acceptance Checks

1. Load extension in Chrome 120+ via `pnpm run dev:ext`
2. Click extension icon → Side Panel opens
3. Onboarding shell appears on fresh install (static intro placeholder, no persona logic, API key not persisted)
4. Theme propagation: `ThemeStore.setMode('dark')` → both surfaces re-render dark (verified via `chrome.storage.onChanged`)
5. Open Standalone view from Side Panel → workspace state transfers
6. Close and reopen Standalone → no tab duplication
7. Cmd+K opens shared command palette on both surfaces
8. Side Panel usable at 400px width
9. Standalone shows narrow-screen alert below minimum width
10. Content script bundle contains no banned imports (verified by isolation test)
11. Onboarding API key is cleared on close and never persisted
12. Major Side Panel regions match the applicable `binding-layout` references.
13. Side Panel responsive behaviour takes precedence over fixed mock-up dimensions.
14. Standalone shell follows the referenced navigation, header and workspace-region hierarchy.
15. Placeholder content is used where functionality belongs to a later phase.
16. No model selection, provider configuration, attachments, persisted history, Notes functionality, TeamGQM behaviour, AI streaming or message actions are implemented merely because they appear in a mock-up.
17. All required screenshots listed in T21 exist under `.planning/evidence/phase-01/` and are referenced from `ACCEPTANCE.md`.

## Risks, Rollback, and Deferred Items

### Risks
- **WXT version mismatch**: Ensure `@wxt-dev/module-react` compatibility with WXT 0.20
- **AntD XProvider config**: Must pass full `ConfigProviderProps` to XProvider

### Rollback
- Revert to last commit; each task is independently commitable

### Deferred
- Provider connection testing (Phase 3)
- SlashCommandRegistry (not in §18 Phase 1; restrict to KeymapRegistry only)
- Full RICH-R-03 persona behaviour (Phase 15)
- User-facing Appearance controls / theme toggle UI (Phase 15)
- Popup action UI (not in §18 Phase 1)
- Add-on runtime registration beyond stubs (Phase 17)
- Full page implementations (skeletons only in Phase 1)
- Content extraction strategies (Phase 6)
- Host-page write-back (v0.2+, §25)

## Final Completeness Checklist

- [ ] `package.json` with `packageManager: "pnpm@11.22.0"`, all Phase 1 §7 dependencies, fully functional `verify:phase-1`, and no false-passing future scripts
- [ ] `package-lock.json` removed; `pnpm-lock.yaml` committed
- [ ] `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `wxt.config.ts` (with `srcDir: 'src'`)
- [ ] Background SW with `BackgroundRouter`
- [ ] `RuntimeEnvelope`, `OperationId`, `BroadcastBus`, `PortReader`
- [ ] Content script at `src/entrypoints/core.content.ts` (WXT-compatible)
- [ ] Theme system completed BEFORE shells (no user-facing toggle)
- [ ] Side Panel shell (Chat only, compact, exactly one XProvider) matches Phase 1 binding-layout references within the permitted scope
- [ ] Standalone shell (full workspace, exactly one XProvider) follows the Phase 1 reference-only region hierarchy without future-phase functionality
- [ ] WorkspaceStore, WorkspaceRouter, WorkspaceSync
- [ ] MessageBus, EventBus, registries
- [ ] CommandRegistry, KeymapRegistry and shared `CommandPalette` component (DEC-013)
- [ ] OnboardingModal shell with static intro placeholder (no RICH-R-03)
- [ ] Onboarding secret-handling rule implemented and tested
- [ ] Cross-surface handoff wired
- [ ] `tests/setup.ts` with `vitest-chrome`
- [ ] All required tests passing (T13–T19), including `tests/core/commands/CommandRegistry.test.ts`
- [ ] Security grep scripts created and passing
- [ ] `verify:phase-1` passes (including `build:ext`)
- [ ] Candidate implementation committed and SHA recorded
- [ ] Verified implementation SHA recorded
- [ ] `RESULT.md` and `ACCEPTANCE.md` written, with required Phase 1 visual evidence saved under `.planning/evidence/phase-01/`
- [ ] `.planning/STATUS.md` updated
- [ ] Evidence-only commit created and SHA recorded
