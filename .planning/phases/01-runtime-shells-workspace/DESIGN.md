# Phase 01 — Runtime, Shells, and Workspace (DESIGN)

**Document ID:** `NOWPILOT_PHASE_01_DESIGN`
**Phase:** 01 — Runtime, Shells, and Workspace
**Status:** Approved
**Approval date:** 2026-09-19
**Planning baseline branch:** `phoenix`
**Implementation branch:** `phoenix`
**Package manager:** pnpm

## 0. Document status

This section records only the minimum design-status information that can be
known without a future commit SHA.

- **Design status:** Approved (2026-09-19); sequencing correction incorporated.
- **Plan status:** Not created. `PLAN.md` will be produced by the writing-plans
  skill after the governance baseline commit.
- **Implementation status:** Not started.
- **Planning baseline branch:** `phoenix`.
- **Implementation branch:** `phoenix` (single sequential branch; no separate
  implementation branch or linked worktree).
- **Governance baseline commit:** Not yet created.
- **Approved planning baseline commit:** `approvedPlanningBaselineCommit` is not
  yet recorded; it is read from `.planning/STATUS.md` after the approved-plan
  commit exists.
- **SHA-dependent fields:** None recorded in this document. No absolute
  filesystem path is stored in this document.

---

## 1. Outcome and non-goals

**Outcome.** A deterministic WXT/Chrome MV3 baseline: two extension-owned
surfaces (Chat-only Side Panel, Standalone workspace) over one canonical
`RuntimeEnvelope`, one elected single-writer workspace, a theme foundation, and
the canonical 7-entry Standalone registry with skeleton pages.

**Non-goals (deferred, must not appear):** AI/provider streaming,
Planner/Executor/Renderer (Phase 3); IndexedDB/encryption/migrations/write
journal (Phase 2); extraction/content script (Phase 6); notes/memory/search
(Phase 8); diagnostics functionality (Phase 10); full page UX (Phase 11);
TeamGQM/ServiceNow/Write behaviour (Phase 12); host-page UI/write-back; browser
automation.

## 2. Locked decisions carried in

`standalone` stem only (no `app`); Side Panel Chat-only; deep-work/admin in
Standalone only; content scripts extraction-only (none in Phase 01);
provider/MCP streams only in UI surfaces; background does no AI/MCP/IndexedDB;
Zod-validated boundaries; notes/memory local-first; no invented identifiers.

## 3. Toolchain and pinned versions

**Package manager:** pnpm `12.4.2` (exact `packageManager`), single-package repo
(`pnpm-workspace.yaml` not added). `.npmrc`: `engine-strict=true`,
`save-exact=true`.

**Node engines:** `"^22.22.2 || ^24.15.0 || >=26.0.0"` — the exact intersection
of WXT 0.21.4 (`>=22`), Vite 8.3.0 (`^20.19.0 || >=22.12.0`), Vitest 5.0.1
(`^22.12.0 || ^24.0.0 || >=26.0.0`), jsdom 30.1.0
(`^22.22.2 || ^24.15.0 || >=26.0.0`), and ESLint 10.11.0
(`^20.19.0 || ^22.13.0 || >=24`). Recommended runtime: Node 24.15.0+.

**Version verification:** all versions verified against npm registry metadata
(`registry.npmjs.org`) on **2026-09-19**. All selected versions are stable
releases; none is a pre-release.

### 3.1 Runtime dependencies (exact, no `^`, `~`, `latest`, or wildcard)

| Package | Exact version |
|---|---|
| react | `19.3.0` |
| react-dom | `19.3.0` |
| antd | `6.6.4` |
| @ant-design/icons | `6.3.4` |
| zustand | `5.0.15` |
| zod | `4.6.5` |

### 3.2 Development dependencies (exact, no `^`, `~`, `latest`, or wildcard)

| Package | Exact version | Notes |
|---|---|---|
| wxt | `0.21.4` | current stable; Node ≥22; `vite` required peer |
| @wxt-dev/module-react | `1.2.2` | brings `@vitejs/plugin-react@6.1.1` (peer `vite ^8`) |
| vite | `8.3.0` | required peer of `wxt` and `vitest` |
| typescript | `5.9.3` | pinned: lint stack peer `<6.1.0`; TS 7.0.2 unsupported |
| @types/react | `19.3.0` | |
| @types/react-dom | `19.3.0` | |
| @types/node | `24.13.6` | matches Node 24 runtime; peer of vite/vitest |
| @types/chrome | `0.3.0` | |
| eslint | `10.11.0` | |
| typescript-eslint | `8.70.0` | flat config |
| prettier | `3.9.8` | |
| vitest | `5.0.1` | peer `vite ^6.4 || ^7 || ^8` |
| jsdom | `30.1.0` | vitest environment; engine intersection |
| @testing-library/react | `16.3.3` | peer `@testing-library/dom ^10` |
| @testing-library/dom | `10.4.2` | required peer |
| @testing-library/jest-dom | `7.0.1` | |

### 3.3 Peer-compatibility verification (2026-09-19)

- `wxt@0.21.4` peers `vite ^6.3.4 || ^7 || ^8` → `8.3.0` satisfied; optional
  peers `eslint ^8.57 || ^9 || ^10` → `10.11.0` satisfied, `typescript >=5.4` →
  `5.9.3` satisfied; `web-ext` optional peer omitted (not used in Phase 01).
- `@wxt-dev/module-react@1.2.2` peers `wxt >=0.19.16` and
  `vite ^5.4.19 || ^6.3.4 || ^7 || ^8` → satisfied; its dependency
  `@vitejs/plugin-react@6.1.1` peers `vite ^8.0.0` → satisfied; its remaining
  peers are optional.
- `vitest@5.0.1` peers `vite ^6.4 || ^7 || ^8`, `@types/node ^22.0.0 || >=24`,
  `jsdom *` → satisfied.
- `vite@8.3.0` engines `^20.19.0 || >=22.12.0` → satisfied.
- `antd@6.6.4` peer `react >=18` → satisfied; `@ant-design/icons@6.3.4` peer
  `react >=16` → satisfied.
- `@testing-library/react@16.3.3` peers `react ^18 || ^19`, `react-dom ^18 || ^19`,
  `@types/react ^18 || ^19`, `@types/react-dom ^18 || ^19`,
  `@testing-library/dom ^10` → satisfied.
- `typescript-eslint@8.70.0` peers `eslint ^8.57 || ^9 || ^10` → `10.11.0`
  satisfied, and `typescript >=4.8.4 <6.1.0` → `5.9.3` satisfied (TypeScript
  `7.0.2` rejected).
- `pnpm@12.4.2` engines `>=18.*` supports the selected Node range.

### 3.4 Excluded dependencies (deferred to their phases)

`@ant-design/x`, `@ant-design/x-markdown`, `ai` and provider SDKs,
`@modelcontextprotocol/sdk`, `defuddle`, `@mozilla/readability`, `minisearch`,
`d3-force`, `jszip`, `turndown`, `yaml`, `jsonrepair`, `web-ext`,
`@types/wicg-file-system-access`.

`pnpm-lock.yaml` is generated from these approved pins; `package-lock.json` is
removed. No dependency with a floating range is authoritative.

## 4. Canonical file map (allowed files)

### 4.1 Already approved or prerequisite governance files (governance prerequisite commit)

`README.md`, `.gitignore`, `.planning/README.md`, `.planning/STATUS.md`,
`.planning/DECISIONS.md`, `.planning/phases/01-runtime-shells-workspace/DESIGN.md`,
and the evidence directory paths `.planning/evidence/phase-01/` and
`.planning/evidence/phase-01/screenshots/` (**declared**, not committed empty).

### 4.2 Generated only after design approval

`.planning/phases/01-runtime-shells-workspace/PLAN.md`.

### 4.3 Generated during or after execution

`.planning/phases/01-runtime-shells-workspace/ACCEPTANCE.md`,
`.planning/evidence/phase-01/verification.txt`,
`.planning/evidence/phase-01/review.md`,
`.planning/evidence/phase-01/manual-checks.md`, reviewed
`.planning/evidence/phase-01/screenshots/`.

**Empty-directory policy:** Git does not track empty directories. No `.gitkeep`
or placeholder is committed. An evidence directory is materialised only when it
gains its first real file.

### 4.4 Phase 01 implementation file map

```text
package.json  .npmrc  pnpm-lock.yaml (removes package-lock.json)
tsconfig.json  wxt.config.ts  vitest.config.ts  eslint.config.mjs  .prettierrc  .prettierignore
public/icon/{16,32,48,128}.png
src/entrypoints/background.ts
src/entrypoints/sidepanel/{index.html,main.tsx,App.tsx}
src/entrypoints/standalone/{index.html,main.tsx,App.tsx}
src/components/sidepanel/SidePanelShell.tsx
src/components/standalone/{StandaloneShell.tsx,StandaloneRouter.tsx,StandaloneSider.tsx}
src/components/standalone/pages/{ChatPage,AgentPage,NotesPage,WritePage,ToolsPage,DiagnosticsPage}.tsx
src/components/options/{OptionsPage.tsx,AppearanceSection.tsx}
src/core/runtime/{RuntimeEnvelope.ts,messageSchemas.ts,MessageType.ts,RuntimeSurface.ts,OperationId.ts,BroadcastBus.ts,StandaloneNavigation.ts}
src/core/workspace/{workspaceTypes.ts,WorkspaceStore.ts,WorkspaceElection.ts,WorkspaceHandoff.ts,WorkspaceMutations.ts,WorkspaceSync.ts}
src/core/registry/{standaloneRoutes.ts,StandalonePageRegistry.ts,registerCorePages.ts}
src/core/theme/{antdConfig.ts,themeTypes.ts,ThemeStore.ts,useTheme.ts}
src/core/storage/{storageKeys.ts,chromeStorage.ts}
src/core/error/{errorCodes.ts,debugLog.ts}
tests/**  (exact files named by PLAN.md)
```

**Corrections applied:** `.gitignore`, root `README.md`, `.planning/STATUS.md`
updates, and `.planning/evidence/phase-01/**` included; `.codex/` removed
(OpenCode project); CI deferred to a later approved phase (no workflow file in
Phase 01); `chromePolyfill.ts` removed (added only if a task proves it
necessary).

## 5. Canonical RuntimeEnvelope and registries

- **Rule:** `MessageType` and payload schema form one closed discriminated
  union; each type maps to exactly one named payload schema; envelopes parse
  through the union; unknown types fail closed (`RUNTIME_ENVELOPE_INVALID`); all
  payload schemas live in one canonical registry,
  `src/core/runtime/messageSchemas.ts`. PLAN.md must use these canonical names
  without invention.
- `RuntimeSurface = 'background' | 'sidepanel' | 'standalone'`.
- Base envelope:
  `{ envelopeVersion: 1; id: OperationId; type: MessageType; source: RuntimeSurface; target: RuntimeSurface | '*'; timestamp: number; correlationId?: string; electionEpoch?: number; workspaceVersion?: number; payload: <union> }`.
- **Canonical type → payload schema names:**
  - `workspace.mutation` → `WorkspaceMutationPayload`
  - `workspace.handoff.prepare` → `WorkspaceHandoffPreparePayload`
  - `workspace.handoff.ack` → `WorkspaceHandoffAckPayload`
  - `workspace.handoff.commit` → `WorkspaceHandoffCommitPayload`
  - `workspace.relinquish` → `WorkspaceRelinquishPayload`
  - `workspace.rehydrate.request` → `WorkspaceRehydrateRequestPayload`
  - `workspace.rehydrate.response` → `WorkspaceRehydrateResponsePayload`
  - `standalone.open` → `StandaloneOpenPayload` (`destination: StandaloneRouteId`)
  - `standalone.focus` → `StandaloneFocusPayload` (`destination: StandaloneRouteId`)
  - `standalone.closed` → `StandaloneClosedPayload`
  - `runtime.error` → `RuntimeErrorPayload`
- Handlers validate both sender and envelope at the trust boundary; invalid →
  fail closed.
- **Two separate closed registries in `src/core/error/errorCodes.ts`:**
  - `ErrorCode` is for **operational failures**.
  - `DiagnosticEvent` is for **non-failing structured observations**.

  They are distinct closed schemas and are **not** described or modelled as one
  union. `ErrorCode`: `RUNTIME_ENVELOPE_INVALID`, `RUNTIME_SENDER_REJECTED`,
  `WORKSPACE_INVALID_METADATA`, `WORKSPACE_OWNERSHIP_AMBIGUOUS`,
  `WORKSPACE_EPOCH_MISMATCH`, `WORKSPACE_VERSION_CONFLICT`,
  `WORKSPACE_STALE_MUTATION`, `WORKSPACE_REHYDRATION_REQUIRED`,
  `WORKSPACE_HANDOFF_FAILED`, `STANDALONE_TAB_INVALID`,
  `STANDALONE_OPEN_FAILED`, `THEME_INVALID_VALUE`, `THEME_PERSIST_FAILED`.
  `DiagnosticEvent`: `STANDALONE_ROUTE_FALLBACK` (a diagnostic, **not** an
  error).

  `debugLog` accepts a typed `ErrorCode` record or a typed `DiagnosticEvent`
  record; neither registry accepts arbitrary strings.

## 6. Workspace coordination — elected single writer

Implements the approved protocol verbatim:

- **Ownership:** one live writer; Standalone preferred after handoff, else Side
  Panel; background is not owner/broker.
- **Storage ownership:** `local` → metadata + committed version; `sync` →
  appearance only; `session` → election, instance IDs, handoff intent, singleton
  tab ID.
- **Surface identity:** unique session-scoped instance ID per instance; election
  metadata records writer type, instance ID, epoch, committed version, handoff
  state, target ID. Writer identity never inferred from surface type alone.
- **Initial election:** first eligible Side Panel may claim when no valid writer;
  Standalone priority but mutates only after acquisition; schema-validated
  records; tested stale/invalid recovery.
- **Handoff:** prepare → acknowledge → commit; Side Panel stays writer while
  pending; Standalone hydrates and acks same version+epoch; Side Panel stops
  accepting and flushes; ownership changes only after commit persisted; new
  epoch; both confirm; Side Panel becomes read-only mirror; never two authorised
  writers.
- **Close/fallback:** writer relinquishes and persists final version; Side Panel
  claims only after observing relinquish/invalid; crashed Standalone validated
  via stored tab ID before new epoch; preserve committed version; never replay a
  committed mutation.
- **Mutation protocol:** mutation ID, writer instance ID, epoch, base version,
  resulting version, type, schema-valid payload; reject wrong writer/epoch/stale
  base; apply once; increment monotonically; persist; emit envelope; mutation IDs
  idempotent within Phase 01.
- **Mirror:** no direct writes; submit intent; apply only current-epoch
  next-version envelopes; ignore duplicate/stale; rehydrate on gaps;
  `chrome.storage.onChanged` is recovery/convergence support, not an unversioned
  stream.
- **Failure:** fail closed, stop mutations, preserve committed state, attempt
  designed recovery, surface canonical error, never silently pick a writer or
  drop a mutation.

## 7. Standalone deduplication

- Singleton identity = stored Standalone tab ID in session metadata.
- Open: read stored ID → validate via non-sensitive `chrome.tabs.get` (no
  URL/title read) → `tabs.update({active:true})` / `windows.update({focused:true})`
  if live → else clear stale ID and `chrome.tabs.create` the Standalone
  entrypoint at the requested hash route.
- **The background service worker is the only caller of `chrome.tabs`.** UI
  components use the canonical navigation service (Section 10).
- **Authoritative close recovery:** `chrome.tabs.onRemoved` + stored tab-ID
  validation + election-record validation + tested stale-writer recovery. The
  `standalone.closed` unload message is **best-effort only and never
  authoritative**; the design stays correct if it is never sent.
- No query-by-URL; no active-page URL/title/favicon/content reads.
- If `tabs` proves necessary, stop and escalate (affected criterion, exact API,
  official docs, extra data exposed, permission-free alternative,
  recommendation) — never add silently.

## 8. Theme foundation

- One seed + pack overlays: `getAntdConfig({ mode, pack, compact })`
  (seed → pack overlay → algorithm). Requirements are restated here directly;
  `.planning/DESIGN_SYSTEM.md` is a non-authoritative companion and section
  numbers are not relied on.
- Keys `np_theme` (Auto/Light/Dark) and `np_theme_pack` (Default/Liquid
  Glass/Claude Warm) in `chrome.storage.sync`; Zod-validated; invalid →
  canonical defaults.
- One provider per surface; Side Panel `compact: true`, Standalone
  `compact: false`; token-first (no hard-coded hex in components).
- Live propagation via `chrome.storage.onChanged`, independent of writer
  election.

## 9. Storage keys and durability

| Key | Store | Durability |
|---|---|---|
| `np_workspace_meta` | `chrome.storage.local` | survives service-worker restart and browser restart |
| `np_workspace_version` | `chrome.storage.local` | survives service-worker restart and browser restart |
| `np_workspace_election` | `chrome.storage.session` | ephemeral coordination state for the browser session |
| `np_workspace_handoff` | `chrome.storage.session` | ephemeral coordination state |
| `np_standalone_tab` | `chrome.storage.session` | ephemeral coordination state |
| `np_theme` | `chrome.storage.sync` | user-facing appearance preference |
| `np_theme_pack` | `chrome.storage.sync` | user-facing appearance preference |

Session values are **never** described as durable workspace state. All keys are
declared once in `storageKeys.ts`; all values are Zod-validated.

## 10. Side Panel shell and action behaviour

Shell may contain only: header; Chat-labelled content region; deterministic
empty state; Options action; Switch to Full Chat action. The future composer
region may appear only as a non-interactive, non-form structural region. **Must
not** contain text input, send button, attachment button, model selector,
inactive provider controls, keyboard-submit behaviour, or speculative chat
state. Side Panel must not expose Standalone navigation or administration pages.

**Canonical navigation service `src/core/runtime/StandaloneNavigation.ts`.** Both
actions depend on this one service; UI components never call `chrome.tabs`
directly and never build routing strings.

- **Switch to Full Chat:** `openStandalone('chat')` → open or focus the singleton
  Standalone tab, navigate it to the canonical Chat route, initiate the approved
  writer-handoff protocol when the Side Panel is the current writer, preserve
  workspace identity and committed version, and never create a duplicate tab.
- **Options:** `openStandalone('options')` → open or focus the same singleton
  Standalone tab, navigate it to the canonical Options route, use the same dedup
  service, initiate the same handoff when required, and never open a separate
  options tab or the browser options page.
- **Destination conveyance:** the service sends `standalone.open` /
  `standalone.focus` with the canonical typed `destination: StandaloneRouteId`.
  On **creation**, the background builds the first-load URL hash from
  `destination`. On **focus of an existing tab**, the background focuses it and
  sends `standalone.focus { destination }`, which the live Standalone applies.

## 11. Standalone shell, route representation, and registry

- **Canonical route identifiers (`StandaloneRouteId`, defined in
  `src/core/registry/standaloneRoutes.ts`):** `chat`, `agent`, `notes`, `write`,
  `tools`, `options`, `diagnostics`. **Default route:** `chat`. The registry
  remains the single source of truth for identity, route, label, navigation
  placement, ordering, and skeleton component.
- **URL representation:** hash routing on `standalone.html`; the route format is
  `#/` followed by a validated `StandaloneRouteId`. Examples:
  `standalone.html#/chat` and `standalone.html#/options`.
- **Initial navigation:** read from `location.hash`, validated against the
  registry.
- **Navigation to an already-open tab:** requested via the
  `standalone.focus { destination }` envelope; the live router applies the
  destination.
- **Unknown values:** normalise to the canonical Chat route (`#/chat`) and record
  the `STANDALONE_ROUTE_FALLBACK` diagnostic; no user-facing error; no
  `runtime.error` envelope unless the failure crosses a runtime-context boundary;
  never crash or blank page.
- **Browser history:** intentionally **not** used. The router updates the hash
  with `history.replaceState` (no new history entries) and does **not** route on
  `hashchange`/`popstate`; back/forward must not traverse Standalone pages. There
  is no query or path routing and no in-memory-only model.
- **Shell/navigation:** `StandaloneShell`, `StandaloneSider`, `StandaloneRouter`,
  `StandalonePageRegistry`, `registerCorePages`. Primary navigation: Chat, Agent,
  Notes, Write, Tools. Footer navigation: Options, Diagnostics. Pages are not
  duplicated in hard-coded Sider arrays. TeamGQM and ServiceNow are absent.
  Agent/Notes/Write/Tools/Diagnostics are labelled skeleton placeholders only,
  with no later-phase logic, mock services, or inactive controls.

## 12. Options — General → Appearance only

Nested exactly `General → Appearance → { Display mode, Theme pack }`. Controls
update only approved theme config and persistence. No other Options sections or
controls.

## 13. Manifest, permissions, isolation

- WXT-generated MV3 manifest: `permissions: ["sidePanel","storage"]`; action
  button; `sidepanel` + `standalone.html` entries. No `tabs`, `activeTab`,
  `scripting`, `alarms`, `unlimitedStorage`, host permissions, or content
  scripts.
- **Generated-manifest inspection** (post-build) asserts presence of
  `sidePanel`/`storage`, absence of the rest, and no content-script declaration.
- **Post-build bundle-isolation inspection** asserts the background bundle
  imports no React/antd/IndexedDB/provider; the Side Panel bundle imports no
  Standalone pages/registry/admin; no content-script bundle exists.
- Side-effect/ownership failures never render as success.

## 14. Testing scope (explicitly separated)

1. **Unit tests** — schemas, election, handoff, mutation/version/idempotency,
   dedup, theme validation, registry.
2. **Integration tests (mocked Chrome APIs)** — single-writer convergence,
   mirror ordering, gap rehydration, restart durability, theme propagation.
3. **Generated-manifest inspection** — parses
   `.output/chrome-mv3/manifest.json` after build. A config unit test is **not**
   accepted as proof of the generated manifest.
4. **Post-build bundle-isolation inspection** — scans built artifacts. A
   source-scan test is **not** accepted as proof of the output bundles.
5. **Manual unpacked-extension checks** — load unpacked, Side Panel Chat-only,
   Switch to Full Chat dedup, theme across both surfaces, service-worker restart.
   Recorded in `manual-checks.md` with screenshots.

PLAN.md must name every exact test file and command.

## 15. Verification gates

### 15.1 Pre-implementation repository baseline

Git/filesystem only; the design states the required assertions, and PLAN.md
contains the exact executable commands. The approved planning baseline commit is
read from `.planning/STATUS.md` after the approved-plan commit exists. No
absolute filesystem path is stored in this design.

Required assertions:

1. the current directory is the repository root
   (`git rev-parse --is-inside-work-tree` is `true` and
   `git rev-parse --show-toplevel` equals the resolved current directory);
2. the current branch is exactly `phoenix`;
3. the working tree is clean (`git status --porcelain` is empty);
4. `.planning/README.md`, `.planning/STATUS.md`, and `.planning/DECISIONS.md`
   exist;
5. the approved `DESIGN.md` and `PLAN.md` exist;
6. `package-lock.json` and `pnpm-lock.yaml` do not coexist;
7. `HEAD` contains the approved planning commit and the status commit that
   records it: the `approvedPlanningBaselineCommit` value recorded in
   `.planning/STATUS.md` exists as a commit,
   `git merge-base --is-ancestor "$approvedPlanningBaselineCommit" HEAD`
   succeeds, and `HEAD` contains the later status-record commit that names that
   value.

`approvedPlanningBaselineCommit` refers to the immutable **approved-plan
commit**, not to the later status-record commit and not to the branch HEAD.

**Lockfile state transition:** before the package-bootstrap task, the orphan
`package-lock.json` may exist alone; after that task, `package-lock.json` must be
absent and `pnpm-lock.yaml` must exist.

### 15.2 Final Phase 01 verification

After the relevant scripts exist:

```text
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run test:manifest
pnpm run test:isolation
pnpm run verify:phase-1
```

`verify:phase-1` and `verify:all` are aligned and intentional (both run
`typecheck → lint → test → build → test:manifest → test:isolation`); neither is
weaker. `verify:phase-1` is explicitly **not** the pre-implementation baseline.

## 16. Evidence and acceptance

Evidence at
`.planning/evidence/phase-01/{verification.txt,review.md,manual-checks.md,screenshots/}`.
Every Section 11, 6, 7, 13, and 14 point maps to an acceptance criterion. Phase
acceptance requires fresh command output, spec-compliance then code-quality
reviews, manual checks with screenshots, and operator acceptance.

## 17. Governance sequencing and branch model

**Branch model (locked, operator decision 2026-09-19):** the single sequential
branch for Phase 01 is `phoenix`; planning and implementation share it.
Implementation occurs directly on `phoenix` in the repository root. Prior
historical branches remain read-only references. A separate implementation
branch and a linked worktree are not used. The earlier decision to use a
`phase/01-phoenix` implementation branch and an isolated worktree is superseded
and retained as decision history only. The exact filesystem path is not
hard-coded in this document.

**Deterministic sequence:**

1. Save the approved `DESIGN.md`.
2. Create and commit the governance baseline:
   `docs: initialise planning governance`.
3. Use the writing-plans skill to create `PLAN.md`.
4. Review and approve `PLAN.md`.
5. Commit `PLAN.md` and the corresponding `STATUS.md` update:
   `docs(phase-01): approve runtime implementation plan`.
6. Capture the exact SHA of that approved-plan commit with `git rev-parse HEAD`,
   and assign it to the named value `approvedPlanningBaselineCommit`.
7. Update `.planning/STATUS.md` with:
   - approved planning baseline commit: `approvedPlanningBaselineCommit` (the
     exact SHA captured in step 6);
   - implementation branch: `phoenix`;
   - implementation status: not started;
   - next task: the first task from `PLAN.md`.
8. Commit that status record separately:
   `docs(phase-01): record approved planning baseline`.
9. During implementation baseline verification, require the assertions in
   Section 15.1. The status-record commit from step 8 remains part of `HEAD`
   history.

`approvedPlanningBaselineCommit` is the immutable **approved-plan commit**
recorded in `.planning/STATUS.md`; it is not the later status-record commit and
not the branch HEAD. A governance commit cannot record its own SHA, so the value
is captured only after the approved-plan commit exists.

`.planning/DESIGN_SYSTEM.md` is a non-authoritative design companion; functional
requirements derived from it are restated directly in this document.

## References

- `.planning/product/PRODUCT_SPEC.md` — active product specification.
- `.planning/architecture/ARCHITECTURE.md` — architecture baseline.
- `.planning/roadmap/ROADMAP.md` — phase order.
- `.planning/operations/EXECUTION_PROTOCOL.md` — Superpowers execution workflow.
- `.planning/operations/DEPLOYMENT.md` — build, deployment, and release.
- `.planning/DESIGN_SYSTEM.md` — non-authoritative visual-language companion.
- `AGENTS.md` — repository agent instructions and locked decisions.

## Resolved decisions

| # | Decision |
|---|---|
| 1 | Baseline: fresh bootstrap on `phoenix`; prior branches read-only reference |
| 2 | pnpm 12.4.2; remove `package-lock.json`; no workspace file; `.npmrc` strict/exact |
| 3 | Governance: separate pre-planning commit before writing-plans |
| 4 | Skeleton scope: 7-entry core registry + minimal Options/Appearance |
| 5 | Permissions: `sidePanel` + `storage` only; dedup via stored tab ID |
| 6 | Coordination: elected single writer with prepare/ack/commit handoff |
| 7 | WXT 0.21.4 (Node ≥22), explicit `vite` 8.3.0 peer |
| 8 | TypeScript 5.9.3 (typescript-eslint peer `<6.1.0`); not TS 7 |
| 9 | Composer: no interactive or disabled control in Phase 01 |
| 10 | Unknown routes: Chat fallback + `STANDALONE_ROUTE_FALLBACK` DiagnosticEvent |
| 11 | Sider: 5 primary + 2 footer, registry-sourced |
| 12 | Verification: separate pre-baseline vs final gate; `verify:all` == `verify:phase-1` |
| 13 | Files: gitignore/README/STATUS/tests added; no `.codex`; CI deferred; no `chromePolyfill`; no empty-dir placeholders |
| 14 | `.planning/DESIGN_SYSTEM.md` non-authoritative; requirements restated; exact path referenced |
| 15 | Envelope: one closed discriminated union registry in `messageSchemas.ts` |
| 16 | Storage key→store mapping and durability clarified |
| 17 | Standalone close: unload best-effort; `tabs.onRemoved` authoritative |
| 18 | Testing categories separated (unit / integration / manifest / bundle / manual) |
| 19 | Exact dependency set pinned from registry metadata; later-phase deps excluded |
| 20 | Branch model: `phoenix` is the single sequential branch for planning and implementation; the earlier `phase/01-phoenix` implementation branch and linked worktree are superseded (operator decision 2026-09-19) |
| 21 | Route model: hash route format `#/` plus a validated `StandaloneRouteId` (examples `#/chat`, `#/options`); default `chat`; `replaceState`; no history routing |
| 22 | Side Panel actions via one canonical `StandaloneNavigation` service; typed destination |
| 23 | Registries: `ErrorCode` and `DiagnosticEvent` are separate closed schemas |
| 24 | `approvedPlanningBaselineCommit` is the immutable approved-plan commit, recorded by a later status commit |

## Design completeness

Zero unresolved design decisions remain. Future generated values,
including the approved planning baseline commit SHA, are governed by
the deterministic sequence in Section 17 and are not design
decisions.
