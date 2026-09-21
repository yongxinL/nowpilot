# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace - Research

**Researched:** 2026-09-21
**Domain:** Chrome MV3 / WXT 0.20 journey + React 19 / AntD v6 shells + in-place prototype→canonical migration
**Confidence:** MEDIUM (in-repo facts are probe-verified; stack/API facts are doc-sourced; several
cross-document contract conflicts remain and are listed as blocking open questions)

> **How to read the provenance tags in this file**
>
> - `[VERIFIED: <path>:<lines>]` — I opened that file **this session** and the quoted text below is
>   verbatim from it. For file paths, the cited line is the one that *creates or names* the path.
> - `[VERIFIED: probe]` — I ran a command this session and paste its real output.
> - `[CITED: <url>]` — referenced from official documentation (Chrome for Developers / WXT / AntD).
> - `[ASSUMED]` — training knowledge or inference; **needs confirmation before it becomes a locked
>   decision**. Every `[ASSUMED]` appears in the Assumptions Log.
>
> Seam confidence tiers obtained from `gsd-tools query classify-confidence` this session:
> `context7` → **MEDIUM**; `webfetch` → **LOW**; `websearch --verified` → **MEDIUM**.
> Official Chrome documentation came through `webfetch`, so Chrome-API claims are tagged
> `[CITED: …]` (official source) while the *provider* tier is LOW — treat them as
> documentation-grade, not measurement-grade, and re-verify against the running extension.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `01-CONTEXT.md` § Implementation Decisions. D-01…D-16 are binding.

- **D-01:** Convert the UI-seed prototype **in place with canonical-contract validation** — do not rebuild from scratch. For each core module (`ThemeStore`, `WorkspaceStore`, `WorkspaceRouter`, `WorkspaceSync`, `MessageBus`, `BackgroundRouter`, `RuntimeEnvelope`, `EventBus`, `CommandRegistry`, `KeymapRegistry`, `debugLog`, `registry`, `chromeStorageAdapter`) classify **KEEP / ADAPT / REPLACE / REMOVE**. KEEP only when the module already satisfies canonical ownership, responsibility, API, validation, lifecycle, naming and security contracts. ADAPT when concept and most behaviour are correct but path, types, API, validation or responsibility boundary differs. REPLACE when implementation conflicts with an authoritative contract — especially workspace-writer election; background responsibilities; runtime-envelope validation; storage ownership; Chrome MV3 lifecycle; provider or MCP execution boundaries; content-script isolation. REMOVE only when duplicated, obsolete, unused, or an incompatible ordinary web-app / generated-server assumption. Canonical specifications and accepted ADRs override prototype names and behaviour. — **Reversibility:** costly — undoing the classification/target-path decisions means re-migrating every moved module, its importers and its test paths.
- **D-02:** Adopt the canonical production structure in Phase 1: **WXT with `srcDir: "src"`**, canonical `src/entrypoints/**` paths, canonical Side Panel and Standalone shell paths, canonical theme paths, canonical messaging and infrastructure boundaries. Temporary compatibility exports only when necessary to keep the migration incremental; they must be removed before Phase 1 acceptance unless the approved plan documents a later removal phase. **No parallel prototype and production implementations.** — **Reversibility:** costly — the layout is a published contract that every later phase and the spec's file structure build on.
- **D-03:** **Drop the standalone Vite browser dev shell as a production development path.** WXT is the single authoritative application and development runtime. After WXT entrypoints work and visual parity is verified, remove: root `index.html`; prototype `src/main.tsx`; standalone browser-shell routing; dev-shell-specific `vite.config.ts` code; dev-shell-only aliases, mocks and environment assumptions; scripts whose only purpose is launching/previewing the old Vite app. Replace scripts: `pnpm dev` → WXT development mode; `pnpm build` → WXT production build; `pnpm zip` → WXT extension packaging (when authorised by the release workflow). WXT entrypoint directories hold their related HTML, main module and entrypoint-specific assets together; no loose supporting files directly under `src/entrypoints/`. Preserve fast iteration through WXT dev mode/HMR, fixture-backed component states, unit and component tests, browser automation against built extension-owned pages, deterministic screenshot fixtures, and the actual Side Panel/Standalone entrypoints. No second top-level application for UI preview; a future browser-only preview must be narrowly scoped, import the same presentation components/fixtures, own no routing/storage/messaging/provider/Chrome behaviour, be excluded from extension output, not be represented as a production surface, and carry explicit acceptance value beyond WXT HMR and browser tests. Do **not** delete reusable React components, AntD theme modules, fixtures or approved visual assets merely because the Vite shell reached them. Migration sequence: (1) establish WXT entrypoints; (2) port shared React providers, theme and approved UI components; (3) verify Side Panel + Standalone render through WXT; (4) verify fixture-backed states and visual parity; (5) redirect `pnpm dev`/`pnpm build` to WXT; (6) remove the obsolete Vite browser shell and its exclusive wiring; (7) verify no extension code imports the deleted shell; (8) verify the generated extension contains only authorised entrypoints. — **Reversibility:** costly — restoring a removed dev shell would mean re-establishing deleted wiring and scripts.
- **D-04:** The required **file-level migration inventory** is a committed planner-owned artifact: `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md`, produced and validated **before** executable implementation plans. It is the authoritative conversion map. Per relevant file: current path; target canonical path; classification (KEEP/ADAPT/REPLACE/REMOVE); current responsibility; intended Phase 1 responsibility; reason; governing requirement IDs; governing architecture/design contract; dependencies and consumers; required tests; migration/compatibility steps; removal timing for temporary adapters; assigned Phase 1 plan; implementation status; verification status. One row per file unless several files are inseparable parts of one entrypoint/module — then list every included path explicitly. Minimum coverage: root dev-shell files; WXT + Vite config; package scripts + dependencies; current entrypoints; both shells; Notes and Options pages; ThemeStore + AntD theme modules; WorkspaceStore/WorkspaceRouter/WorkspaceSync; MessageBus/BackgroundRouter; RuntimeEnvelope; EventBus; CommandRegistry/KeymapRegistry; storage adapters; provider prototypes; fixtures and mock services; tests; generated-server/deployment files; obsolete aliases/compatibility modules. PLANs reference inventory rows rather than duplicating the table. Each plan states: rows it owns; permitted classifications and target paths; required tests; acceptance criteria; expected inventory status updates. The executor updates implementation/verification status as work completes. The verifier checks: every relevant prototype file classified; every ADAPT/REPLACE/REMOVE assigned to a plan; target paths exist for completed KEEP/ADAPT/REPLACE; REMOVE entries no longer participate in production builds; temporary adapters have an owner and removal condition; no unclassified prototype infrastructure remains; the final repository matches the canonical WXT architecture. Inventory must not live only inside PLAN.md. The executor must not invent or silently change classifications; any change during implementation is recorded with previous classification, replacement classification, reason, affected requirement/contract, affected plan and verification impact. Material architecture changes require operator review.
- **D-16 (locked during UI phase — non-Phase-1 page disposition):** Every non-Phase-1 page is assigned exactly **one** disposition in `01-MIGRATION-INVENTORY.md`: `fixture-preview` | `deferred-shell` | `remove`. **`fixture-preview`** when an approved reusable presentation already exists — render it with deterministic local fixtures only, mark the page root `data-np-backing="fixture"`, show a subtle `DeferredNotice` that production data/operations are not connected, disable or replace actions requiring later-phase services, never simulate successful destructive/external/persistent/provider/MCP/filesystem/memory/tool operations, no secrets, no network; keep keyboard accessibility and the required empty/populated/overflow/long-text states; exclude fixture-only state from production diagnostics/exports. **`deferred-shell`** when only the route or workspace shell is required — canonical shell + navigation with an **intentional deferred-state panel naming the owning roadmap phase**, mark the page root `data-np-backing="deferred"`, provide navigation back to an active Phase 1 surface where useful, no fake controls or dead interactive elements, no loading indicators unless a real Phase 1 async operation is occurring. **`remove`** only when obsolete, duplicated, conflicting with the canonical information architecture, or generated server/web-app infrastructure. **A skeleton is never used for deferred functionality** — skeletons communicate active loading; deferred uses a clear deferred/unavailable state. The planner must not choose freely between fixture and deferred presentation. Verification: every preserved approved page marked `fixture`; every incomplete page shell marked `deferred`; no page ambiguous; no perpetual skeleton; no fixture page invokes later-phase services; no deferred page has misleading enabled actions; screenshots/DOM checks distinguish the two; each deferred page names its future owner. Full rule text: `01-UI-SPEC.md` § Fixture-Backed & Deferred Marking Convention → "Non-Phase-1 page disposition (D-16)".
- **D-05:** Phase 1 ships the **complete onboarding interaction shell** — trigger; persona selection; provider selection; API-key entry presentation; validation-in-progress / success / failure; completion — backed by a **typed deferred provider contract** with **fixture-backed validation**. Use a canonical typed result identifier (e.g. `PROVIDER_RUNTIME_NOT_READY` / `PROVIDER_VALIDATION_DEFERRED`, or an existing equivalent defined by the specification — do not invent a new error identifier if the canonical registry already defines one). Do **not** call `testProviderConnection`, a real provider endpoint, a provider SDK, a generated backend, or an MCP server. Provide deterministic fixtures for validation success, invalid credential, provider unavailable, network unavailable, cancelled validation, and unexpected validation failure. The UI must clearly identify this as fixture-backed Phase 1 behaviour and must not imply provider connectivity is implemented. Phase 2 owns KeyVault/AES-GCM/secure persistence/migration; Phase 3 owns Requester/ProviderRouter/real validation/discovery/streaming/cancellation/fallback/canonical provider errors. Phase 1 exposes typed ports and UI states those later phases replace without redesigning the onboarding components. — **Reversibility:** reversible — the shell is intentionally replaced by later-phase implementations behind the same typed ports.
- **D-06:** The shared onboarding shell presents in **both extension-owned UI surfaces** with **no automatic surface opening after install**. On the first authorised opening of the Side Panel or Standalone, read non-secret onboarding state; if UI completion is false/unknown/missing/schema-incompatible, present onboarding in the surface the user opened. Never redirect Standalone → Side Panel to complete onboarding; never open the Side Panel or a Standalone tab automatically on installation; opening a surface must result from an approved user action or an existing approved extension-navigation flow. The Side Panel is the preferred experience when the user first opens NowPilot through the browser action/Side Panel; Standalone must provide the same flow when it is opened first, onboarding is incomplete/cancelled, state cannot be read, or recovery is required. The first surface to start onboarding is active for that attempt; the second must not run a competing flow. **One shared presentation + flow controller** in a neutral surface-independent module (e.g. `src/components/onboarding/OnboardingFlow.tsx`, typed application ports under the canonical contract location); both surfaces may import it; no surface-to-surface imports; the shared module must not call Chrome APIs directly — each surface supplies navigation/lifecycle adapters through typed props/ports. Side Panel presentation: compact, one primary step at a time, no navigation rail, preserved keyboard/focus behaviour, "Switch to Full setup" allowed. Standalone presentation: same steps, state machine, validation result types and copy, displayed in the Standalone shell on the larger canvas — **no separate state machines**. Completion state: persist only non-secret state (onboarding UI complete, selected persona, selected provider identifier, onboarding schema version, optional last completed step if resume is approved); keep distinct concepts: onboarding UI complete ≠ credential securely stored ≠ provider validated ≠ provider runtime ready — Phase 1 establishes only the first, with a separate fixture/demo marker so later phases cannot mistake it for production readiness. Concurrent surfaces: prevent duplicate onboarding attempts; synchronise only non-secret status via the approved messaging contract; never mirror/broadcast the API-key field; never include the key value in `RuntimeEnvelope`; never persist or log it. Completion in one surface updates the other from the non-secret completion event; cancellation preserves an explicit incomplete state. Re-entry: Side Panel setup affordance, Standalone Settings/AI access, typed provider-not-configured error action — still fixture-backed until later phases replace the adapters.
- **D-07:** **Strip secrets now.** Classify `services/aiProvider.ts` ADAPT or REPLACE; `np_store` provider configuration containing `apiKey` REPLACE; any persistence middleware that serialises provider credentials REPLACE; existing plaintext API-key values REMOVE through an explicit safe migration. Phase 1 may persist only non-secret provider metadata: provider ID, display name, enabled state, selected provider, non-secret endpoint configuration (if authorised), onboarding UI completion, fixture-validation state, provider configuration schema version. Phase 1 must not persist API keys, access/refresh/bearer tokens, credential-derived values, masked key fragments, key fingerprints (unless explicitly approved by a later security contract), or validation request/response bodies containing credentials. Remove `apiKey` and equivalent secret fields from every persisted provider-config schema. Use separate types — `PersistedProviderConfig` (non-secret metadata only), `TransientCredentialInput` (in-memory onboarding input only), `CredentialStorePort` (typed Phase 2 port with no Phase 1 persistent implementation), `ProviderValidationPort` (typed Phase 3 port, fixture-backed in Phase 1). Use existing canonical type/error names where defined; do not invent parallel contracts. **Legacy plaintext migration** on Phase 1 startup: detect legacy prototype provider records containing `apiKey`/`token`/`accessToken`/`secret`/equivalent recognised legacy credential fields; remove only the recognised secret fields; preserve authorised non-secret metadata; write back the sanitised configuration; record only a redacted migration result; never log/display/export/transmit/hash/copy/retain the removed value; make it idempotent; record a schema version indicating plaintext-secret cleanup completed. Do not migrate the plaintext key into another persistent location; do not encrypt-and-retain it in Phase 1 (Phase 2 owns KeyVault). Show a neutral notice: "Provider credentials must be configured again after secure credential storage is available." — never reveal whether a specific value was found or any part of the deleted value. — **Reversibility:** one-way — the cleanup deletes legacy plaintext key values, so users must re-enter credentials once Phase 2 secure storage exists.
- **D-08:** API-key input may exist **only in component memory** for the fixture-backed onboarding interaction. It must not reach `np_store`, Zustand persistence, Chrome storage (local/sync/managed/session), localStorage/sessionStorage, IndexedDB, BroadcastBus, MessageBus, `RuntimeEnvelope`, background messages, diagnostics, logs, analytics, exports, snapshots, screenshot fixtures, URLs or command-palette state. Clear it on completion, cancellation, closure, unmount, reload, and any terminal validation state where retention is unnecessary. Masked password-style input; no accidental value echo in error messages. Remove/disable Phase 1 `aiProvider.ts` code paths that read or write a persisted API key, test a real provider connection, construct authenticated network requests, expose provider credentials through exported state, or include secrets in errors/diagnostics; retain only non-secret types or reusable fixture-independent presentation contracts that comply with the canonical architecture. If `aiProvider.ts` mixes UI state, persistence and network access, split those responsibilities and classify the original as REPLACE. Tests use synthetic sentinel values only — never a real API key — and must verify a sentinel secret is absent after migration from stored provider configuration, serialised state, runtime messages, logs, and exported diagnostics.
- **D-09:** Phase 1 registers **shell/navigation commands only**; the palette renders whatever `CommandRegistry` holds, so later phases register chat/notes/tools/diagnostics commands without palette redesign. Phase 1 set: Open Standalone view (both surfaces), Focus Side Panel (Standalone-only per DEC-OP-01), Open Options, Toggle theme. Matches PRODUCT_SPEC Flow 10's examples. **Binding must move to `KeymapRegistry` (FLOW-8)** — remove the ad-hoc window keydown listeners in `entrypoints/sidepanel/main.tsx` and `entrypoints/standalone/main.tsx`; the canonical path is KeymapRegistry global keydown → handler → `preventDefault`.
- **D-10:** The destructive `reload-extension` command is **dev-only** — excluded from the production palette, exposed only in dev builds (`import.meta.env.DEV`) or dropped. It must never be reachable by production users and never auto-run on a partial match.
- **D-11:** **Freeze the full canonical §8.4 `WorkspaceState` contract in Phase 1**, with later-phase fields typed, safely defaulted, inert and producer-free. Canonical shape: `schemaVersion`, `workspaceId`, `conversationId`, `activeProvider`, `selectedModel`, `pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun`, `activeSurface`, `openedStandaloneTabId`. Phase 1 may actively produce or mutate only: `schemaVersion`, `workspaceId`, `conversationId` (when the shell creates a fixture-backed session), `activeSurface`, `openedStandaloneTabId`, and the minimum separately defined handoff metadata required by the approved Phase 1 contract. Later-phase inert fields: `activeProvider`, `selectedModel`, `pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun` — safe empty defaults only (nullable identifiers `null`; collections immutable empty; optional contextual objects `null`); no placeholder secrets, page bodies, note bodies, attachments or synthetic production values; do not create empty data just to make later-phase fields appear implemented. `activeProvider`/`selectedModel` are **resolved runtime metadata**, not direct user selection from the Chat composer — the user selects a Workflow; later routing phases resolve workflow → capability tier → provider → model. Until routing exists they default to `null`, no UI control writes them, fixture-backed UI may display explicitly labelled mock resolution metadata without persisting it, and **a raw model selector must not be reintroduced** (DEC-HTML-01). Keep transient UI state (modal/drawer visibility, hover/focus, loading spinners, API-key input, provider validation input, command-palette query, streaming buffers, temporary attachment bodies, complete onboarding form state, component-local selection) out of `WorkspaceState`. Validate `WorkspaceState` at every persistence, message, import, migration and cross-surface boundary; unknown/invalid fields fail through the canonical typed error or migration path; do not silently accept arbitrary objects. Include `schemaVersion` with an explicit migration path. **Declaring the full type does not authorise persisting or broadcasting every field** — use an explicit allowlist; never persist/broadcast page bodies, note contents, credentials, keys, attachments, tool/MCP payloads, memory contents, hidden reasoning, or later-phase fields merely because they exist in the type. `BroadcastBus` may carry only the approved non-secret handoff projection, never the complete `WorkspaceState` object. Ownership: extension-owned UI surfaces are workspace writers; background serialises writer identity and epoch changes only and is not the ordinary mutation broker; stale-writer mutations fail closed; duplicate election/handoff requests are idempotent; persistence and authoritative read-back govern handoff completion where required. Classify the prototype `WorkspaceStore` KEEP only if field meanings, ownership, mutation API, persistence behaviour, message behaviour, writer-election behaviour, validation and recovery already satisfy the contracts — otherwise ADAPT/REPLACE in the inventory; do not preserve prototype behaviour solely to reduce the diff. — **Reversibility:** costly — the frozen shape and its validation are the contract later phases and tests build on.
- **D-12:** **Defer active Side Panel read-only mirroring to Phase 2** (which owns authoritative writer election and persistence). Phase 1 behaviour on switching Side Panel → Standalone: locate an existing authorised Standalone tab/surface; focus it when found; create one only when none exists; prevent duplicate Standalone surfaces for the same workspace; hand off the approved Phase 1 metadata projection; retain the Side Panel as a normal writable shell under temporary Phase 1 single-surface assumptions; **do not show a read-only `MirrorBanner` merely because Standalone opened**; do not claim authoritative writer demotion occurred. Freeze the typed writer-state and mirror contracts required by Phase 2 but keep them inactive (states may include primary, mirror, election pending, handoff pending, handoff failed, writer unavailable — use exact canonical identifiers; do not invent parallel terminology). A Phase 1 adapter may report the current surface writable but must be explicitly identified as a Phase 1 adapter, not completed writer election, and must not fabricate election success, writer epoch, authoritative writer identity, persistence acknowledgement, successful demotion or successful read-only mirroring. Preserve `MirrorBanner` presentation and its tests if compliant (KEEP/ADAPT in inventory) but: do not mount it through normal Phase 1 production state; do not display it after every Standalone open; keep deterministic fixtures for visual/a11y testing; give it typed mirror-state props; ensure no direct dependency on Chrome APIs, `BroadcastBus`, `WorkspaceStore` or writer election; ensure it cannot switch authority by itself. Phase 2 connects it to authoritative election state. Rationale: read-only mirroring requires authoritative writer identity, election serialisation, writer epoch, stale-writer rejection, durable/authoritative state ownership, failed-handoff recovery, refocus/handback rules, cross-surface propagation and persistence/read-back — all Phase 2; UI state must not claim a security or consistency boundary the runtime does not enforce.
- **D-13:** Phase 1 handoff = **URL bootstrap identifiers + validated BroadcastBus ready/transfer/acknowledgement handshake**; **no `WorkspaceState` persistence in Phase 1.** URL may contain only minimum non-secret bootstrap: `workspaceId`; `conversationId` when available; target route/page; handoff request ID; handoff schema version (canonical parameter names). Never in the URL: composer draft, message content, page content, note content, attachment data, provider/model credentials, API keys or tokens, tool/MCP payloads, memory content, complete `WorkspaceState`, hidden or diagnostic state. The URL is an identifier/bootstrap channel, not a workspace-state transport; validate and normalise every parameter; unknown/malformed/oversized/unsupported-version/unauthorised parameters fail through the canonical typed error path. Cold-tab protocol: (1) Side Panel creates a unique handoff request ID; (2) opens/focuses the canonical Standalone URL containing only the approved bootstrap identifiers; (3) Standalone initialises, validates the URL and subscribes to `BroadcastBus`; (4) Standalone broadcasts a typed `ready` message containing workspaceId, handoff request ID, source/target surface, supported schema version; (5) Side Panel validates `ready` and sends the approved handoff projection; (6) Standalone validates and applies it; (7) Standalone returns a typed acknowledgement containing handoff request ID, applied schema version, success or canonical failure code; (8) Side Panel reports handoff success only after receiving and validating the acknowledgement. Never send the payload immediately after opening the tab and assume a cold tab received it; BroadcastBus messages are ephemeral and must not be treated as persistent state. **Phase 1 handoff projection (BroadcastBus only):** workspaceId; conversationId when available; source surface; target surface; active route/view; composer draft; request/correlation ID; schema version. The composer draft may travel through the validated ephemeral handoff but never through URL parameters or persistent storage. Never include: complete `WorkspaceState`, message history, attachments/bodies, extracted page bodies, selected note contents, credentials/keys, tool/MCP state, memory state, later-phase fields. Protocol must define request IDs, schema versions, source/target validation, payload validation, acknowledgement, bounded timeout, bounded retry, duplicate-message handling, idempotent application, cancellation and safe failure. On missing `ready`/acknowledgement: no success claim, Side Panel stays writable, local composer draft preserved, typed recoverable error, Retry allowed, no `MirrorBanner`, no fabricated election/persistence success. A repeated request with the same ID must not create duplicate Standalone tabs or apply the handoff twice. Existing Standalone tab: focus it, use the same protocol, no new tab, verify workspace ID and supported schema before transferring. Failure to open/focus: keep Side Panel writable, retain draft, typed recoverable error, Retry, no `MirrorBanner`, no handoff-completion claim. — **Reversibility:** costly — the handshake and projection are the contract Phase 2 extends with persistence and election.
- **D-14:** **Persistence boundary.** Phase 1 must not write `WorkspaceState` to `chrome.storage.local`, `chrome.storage.sync`, IndexedDB, localStorage, sessionStorage or another temporary persistent store — and therefore does not restore workspace state after browser restart, extension reload/update, or complete closure of all extension-owned UI surfaces. Phase 2 owns `np_workspace`, durable `WorkspaceState` persistence, persistence schema/migration, authoritative read-back, writer election, writer epochs, stale-writer rejection, mirror activation, restart restoration. Do not create a temporary Phase 1 storage key that Phase 2 must later remove. `BroadcastBus` is a transport adapter — not durable storage, writer-election authority, the background mutation broker, a source of truth, or a mechanism for broadcasting the entire `WorkspaceState` continuously; its Phase 1 purpose is limited to readiness negotiation, minimal handoff, acknowledgement, and approved non-secret shell synchronisation.
- **D-15:** Carry forward as Phase 1 requirements (no open questions raised): single source of truth `chrome.storage.sync.np_theme`; no `themeMode` on `UserPreferences`; `chrome.storage.onChanged` propagates to both surfaces; on change each surface re-derives `getAntdConfig({ mode, pack, compact })`; real-time via AntD v6 CSS variables with no remount; density is not user-configurable in v0.2 (Side Panel compact, Standalone default). Theme pack selector (Default · Liquid Glass · Claude Warm) is APPR-06 → Phase 15; Phase 1 keeps the config surface pack-ready but must not ship the pack selector UI.

### the agent's Discretion

Copied verbatim from `01-CONTEXT.md` § the agent's Discretion.

- **Inventory mechanics:** exact inventory table formatting, how plans cross-reference rows (row IDs vs paths), and status-update mechanics.
- **Fixture/deferred marking convention:** the concrete code-level convention for "clearly mark fixture-backed or deferred functionality" (e.g. typed marker constants, JSDoc tags, component props) — must be consistent, greppable, and must not imply production readiness. **Resolved in `01-UI-SPEC.md`:** `Phase1Backing` (`'fixture' | 'deferred'`) + `DeferredNotice` in `src/components/common/` + greppable `data-np-backing` DOM attribute with presence/absence tests + `deferred.*` string keys; D-16 adds the per-page disposition rule.
- **Verify script composition:** keep `verify:phase-1` green; align it toward the §24 minimum expectation (`tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme`) while retaining the phase-owned suites (`tests/background`, `tests/components`, `tests/isolation`, `scripts/verify-no-tailwind.sh`) as appropriate. Do not narrow it so far that Phase 1 acceptance gates stop running.
- **Test file placement** for new suites (e.g. onboarding, palette, handoff protocol) — follow existing `tests/<area>/` mirroring convention.
- **Message-type naming** for new envelope types (`ready`/handoff/ack) — use existing canonical `MessageTypeValues` literals where defined (`WORKSPACE_HANDOFF`, `WORKSPACE_HANDOFF_FAILED`); add only what the spec's registry lacks.
- **Surface shell routing internals** (SidePanelShell/SidePanelRouter/StandaloneShell/StandaloneRouter composition, view switching) — standard approaches within the design system.

### Deferred Ideas (OUT OF SCOPE)

Copied verbatim from `01-CONTEXT.md` § Deferred Ideas.

- **Read-only mirror activation** (writer election, epochs, stale-writer rejection, `MirrorBanner` mounting, handback) → Phase 2 (D-12). Typed contracts + presentation component are prepared in Phase 1.
- **Durable `WorkspaceState` persistence** (`np_workspace`, schema/migration, authoritative read-back, restart restoration) → Phase 2 (D-14).
- **Real provider validation, Requester, ProviderRouter, streaming, model discovery, cancellation, fallback, canonical provider errors** → Phase 3 (D-05).
- **Secure credential persistence (KeyVault, AES-GCM)** and credential re-entry UX after cleanup → Phase 2 (D-07).
- **Chat/notes/tools/diagnostics palette commands** → their owning phases (15 / 11 / 18) register via `CommandRegistry` with no palette redesign (D-09).
- **Theme pack selector UI (Default · Liquid Glass · Claude Warm)** → Phase 15 (APPR-06); Phase 1 keeps config pack-ready only (D-15).
- **Persona runtime / persona card content beyond the Phase 1 onboarding shell** → Phase 3 seed + Phase 15 RICH (D-05).
- **Full Options/Notes/Agent/Write/Tools functionality** — presentation is preserved per D-01 but stays disconnected and marked; functionality lands in Phases 15/17.
- **Browser-only component preview harness** — only if operationally necessary later; must meet the constraints in D-03 (no routing/storage/messaging/provider/Chrome behaviour, excluded from extension output).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | MV3/WXT runtime + two surfaces + shared WorkspaceStore handoff + theme store + RuntimeEnvelope/EventBus/registries/shells (§5, §6.2–§6.5, §8.3–§8.4; §18 Phase 1) | § WXT `srcDir` migration mechanics; § BroadcastBus handoff protocol; § Theme contract; § Standard Stack |
| SP-02 | Open Standalone view action (P0) — opens `standalone.html` with workspace handoff (§9.1, Flow 11) | § BroadcastBus handoff protocol; § Pitfall 3 (tab dedupe); Architecture Patterns §2 |
| SP-08 | Theme toggle (P1) — light/dark/auto via `chrome.storage.sync.np_theme` (§9.1, APPR-03) | § Theme contract; § Pitfall 1 (`np_theme` dual writer); Code Examples §2 |
| SP-09 | Cmd+K palette (P1) — includes "Open Standalone view" (§9.1) | § KeymapRegistry binding; § Pitfall 2 (`Cmd+K` never matches on macOS); Code Examples §3 |
| SA-08 | First-run onboarding entry point (P0) — when no provider is configured (§9.2) | § Onboarding shell + typed ports; § Credential-strip migration; Pitfall 7 (dual onboarding flag) |
| SA-09 | Cmd+K palette (P1) — same command set as Side Panel + Standalone-only commands (§9.2) | § Command palette contract; § Standard Stack § Command sets |
| SA-10 | Command "Focus Side Panel" (P1) — programmatically opens Side Panel for current tab (§9.2) | § Chrome side-panel APIs; § Pitfall 4 (user-gesture loss across `await`) |
| APPR-03 | Single source of truth `chrome.storage.sync.np_theme`; no `themeMode` on `UserPreferences`; `chrome.storage.onChanged` propagates to both surfaces (§17.1a) | § Theme contract (single-source resolution); Pitfall 1 |
| APPR-04 | On change, each surface re-derives `getAntdConfig({ mode, pack, compact })`; real-time via antd v6 CSS variables, no remount (§17.1a) | § Theme contract; `getAntdConfig` does not exist yet (verified) |
| APPR-05 | Density is not user-configurable in v0.2 (Side Panel compact; Standalone default) (§17.1a) | § Theme contract; `compactAlgorithm` combination (Context7) |
| FLOW-8 | Keyboard shortcut — KeymapRegistry global keydown → handler → `preventDefault` (§11) | § KeymapRegistry binding; Pitfall 2 |
| FLOW-9 | First-run onboarding — persona card → provider → key → validate (§11) | § Onboarding shell + typed ports; § Fixture-backed marking |
| FLOW-10 | Cmd+K command palette — filtered command list (§11) | § Command palette contract; exact pinned command set in UI-SPEC |
| FLOW-11 | Open Standalone view — persist → dedupe → hydrate → `WORKSPACE_HANDOFF` (D-12/D-13 narrow "persist" and the mirror step) | § BroadcastBus handoff protocol; § URL bootstrap allowlist |

</phase_requirements>

## Summary

Phase 1 is not a greenfield build — it is a **contract-conformance migration of a working UI-seed
prototype** plus the addition of four genuinely new capabilities (the ready/transfer/ack handoff
protocol, `getAntdConfig`, the fixture-backed onboarding shell, and the KeymapRegistry-driven
command binding). The prototype currently boots: `npx vitest run` is **18 files / 166 tests green in
6.2 s**, `npx tsc --noEmit` exits 0, the Tailwind gate exits 0, and `pnpm build:ext` produces a valid
MV3 manifest `[VERIFIED: probe]`. So the migration risk is *not* "will it run" — it is
**silent contract drift**, and I found five instances of it that the phase must not inherit:

1. **`srcDir: "src"` does not exist yet, and the alias system is actively wrong for it.**
   `wxt.config.ts` has no `srcDir` `[VERIFIED: wxt.config.ts:3-4]`; `tsconfig.json` maps `@/*` → `./*`
   (repo root) `[VERIFIED: tsconfig.json:22-25]`; WXT's generated `.wxt/tsconfig.json` maps `@/*` →
   `../*` `[VERIFIED: .wxt/tsconfig.json]`. Every canonical code sample in PRODUCT_SPEC §5.4/§5.5 and
   Appendix M imports `@/core/…` / `@/components/…`, which resolves to the *wrong* directory today.
   Repointing `@` to `src/` is a prerequisite, not a nicety.

2. **`entrypoints/content/core.content.ts` matches no WXT entrypoint glob and is silently not
   built.** I read WXT 0.20.27's own glob table and proved the mismatch with a probe:
   content-script globs are `content.[jt]s?(x)`, `content/index.[jt]s?(x)`, `*.content.[jt]s?(x)`,
   `*.content/index.[jt]s?(x)` `[VERIFIED: node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs:279-282]`,
   and `picomatch('*.content.[jt]s?(x)')('content/core.content.ts')` returns **`NO MATCH`**
   `[VERIFIED: probe]`. The generated manifest confirms the consequence — no `content_scripts` key
   `[VERIFIED: .output/chrome-mv3/manifest.json]`. Moving the file to
   `src/entrypoints/content/core.content.ts` (the canonical §5.1/§18 path) **does not fix it**.
   The migration itself does not fix this; a rename or an explicit WXT entrypoint registration is
   required, and §5.1 vs. WXT's discovery rules must be reconciled by the operator.

3. **`KeymapRegistry` cannot match `Cmd+K` on macOS at all.** The matcher compares
   `meta === e.metaKey` where `meta` is only true for the literal token `Meta`
   `[VERIFIED: src/core/input/KeymapRegistry.ts:11-24]`. Probe output: `Cmd+K` on macOS →
   `NO MATCH`, `Control+K` on macOS → `NO MATCH`, `Meta+K` on macOS → `NO MATCH`; only Windows
   `Ctrl+K` matches `[VERIFIED: probe]`. FLOW-8/SP-09/SA-09 are the requirements that depend on it.
   The registry must be fixed (or replaced) *before* the ad-hoc listeners are removed, or the
   palette stops opening on the primary development platform.

4. **`np_theme` has two writers in two formats**, exactly as `CONCERNS.md` predicted, and the
   prototype's own tests codify the wrong one. `ThemeStore` persists a zustand JSON blob under
   `np_theme` `[VERIFIED: src/core/theme/ThemeStore.ts:128-138]` while `applyThemeToSync` writes the
   **raw string** `'auto' | 'light' | 'dark'` to the same key
   `[VERIFIED: src/core/theme/ThemeSync.ts:102-119]`, and `startThemeOnChangedSync` casts whatever
   arrives straight to `ThemeMode` `[VERIFIED: src/core/theme/ThemeSync.ts:142-148]`. Both writers
   are live on both surfaces today `[VERIFIED: entrypoints/sidepanel/main.tsx:74-84]`.
   APPR-03 ("single source of truth") is therefore currently *false*, and the phase must pick one
   representation and delete the other — with a two-surface simulation test against the real blob.

5. **`getAntdConfig({ mode, pack, compact })` does not exist.** There is no `src/core/theme/antdConfig.ts`
   `[VERIFIED: probe — `ls src/core/theme/` returns only `chromeStorageAdapter.ts ThemeConfig.ts
   ThemeStore.ts ThemeSync.ts`]`, and the only theme factories are `getLightTheme`/`getDarkTheme`,
   which ignore their `colorThemeId` argument and both return the Claude-Warm-flavoured pack
   `[VERIFIED: src/theme/index.ts:11-19]`. `ThemeProvider` also violates §5.5 by nesting
   `ConfigProvider` **inside** `XProvider`'s sibling position and passing the same object twice
   `[VERIFIED: src/components/ThemeProvider.tsx:38-44]`.

Two further structural facts shape planning. First, the **canonical file layout is internally
inconsistent in PRODUCT_SPEC**: §5.1, §18 Phase 1 and the §6.2 glossary all use
`src/entrypoints/standalone/`, but §8.5's file-structure block uses `src/entrypoints/app/`
`[CITED: .planning/product/PRODUCT_SPEC.md §5.1, §8.5, §18]`. The phase decisions and UI-SPEC both
say `standalone/`, so `standalone/` wins — but the planner should record the divergence rather than
silently choose. Second, **`options.html` must not survive**: §5.1 lists no options entrypoint,
Options renders inside the Standalone shell at `standalone.html?page=options`
`[CITED: PRODUCT_SPEC §5.4]`, and WXT's `options` entrypoint type is what silently forces
`"options_ui":{"open_in_tab":false}` into the generated manifest, overriding the intent declared in
`wxt.config.ts:56` `[VERIFIED: .output/chrome-mv3/manifest.json]`.

**Primary recommendation:** Sequence the phase as **eight plans** anchored on D-03's migration
sequence — (i) freeze `01-MIGRATION-INVENTORY.md`; (ii) land `srcDir: "src"` + alias/tsconfig/vitest/
WXT-module plumbing as a pure **move-only** plan whose acceptance is "tests, typecheck and
`build:ext` are green **and** the manifest is byte-identical except for paths"; then (iii) theme,
(iv) workspace+handoff, (v) keymap+palette, (vi) onboarding+credential strip, (vii) fixture/deferred
marking + page disposition, (viii) dev-shell removal + `verify:phase-1` realignment. Do **not**
interleave the mechanical move with behavioural changes — the move-only plan is what makes D-03's
step 7 ("verify no extension code imports the deleted shell") checkable at all.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| MV3 manifest, permissions, entrypoint discovery | Build config (`wxt.config.ts`) | — | Manifest is generated by WXT from config + discovered entrypoint files; nothing at runtime can add a permission (§16.4, D-19a). |
| Background router + `chrome.runtime.onMessage` listener registration | Background service worker | — | Must attach synchronously at module top level on every SW wake; a listener registered inside an async callback is lost after the 30 s idle termination `[CITED: developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle]`. |
| Side Panel opening (action click) | Background SW | — | `setPanelBehavior({openPanelOnActionClick:true})` is called from `onInstalled`/`onStartup`; it is not a runtime UI responsibility. |
| "Focus Side Panel" (SA-10) | Standalone UI (user-gesture stack) | Background (not used) | `sidePanel.open()` may only be called in response to a user action `[CITED: developer.chrome.com/docs/extensions/reference/api/sidePanel]`; routing it through the SW would break the gesture. |
| Standalone tab open / focus / dedupe | Extension UI surface (Side Panel) | `chrome.tabs` API | Dedupe is a UI-initiated navigation decision; the background is explicitly *not* the ordinary navigation broker (D-11/D-12). |
| Workspace state authoring | Both UI surfaces (`WorkspaceStore`) | — | D-11: extension-owned UI surfaces are the writers; the background serialises identity/epoch only, and that is Phase 2. |
| Handoff readiness/transfer/ack protocol | Extension UI surfaces over `BroadcastBus` | — | D-13. `BroadcastBus` is transport, never storage (D-14). |
| URL bootstrap identifiers | Standalone entrypoint (read on mount) | Side Panel (write on open) | Parameters are validated on read; the URL is an identifier channel, never a state transport (D-13). |
| Theme source of truth (`np_theme`) | `chrome.storage.sync` | Both surfaces (read) | APPR-03; each surface re-derives `getAntdConfig` locally rather than receiving a theme object. |
| Theme derivation (`getAntdConfig`) | Shared core (`src/core/theme/antdConfig.ts`) | Surface roots (one `XProvider` each) | §5.5: exactly one provider per surface; density is a per-surface constant, not user state (APPR-05). |
| Global keyboard binding (`Cmd+K`) | Surface React root via `KeymapRegistry` | — | FLOW-8; the registry owns the single `document` keydown listener and the `preventDefault`. |
| Command registry semantics | Shared core (`CommandRegistry`) | Both surfaces (render only) | D-09: the palette renders whatever the registry holds, so later phases register without palette redesign. |
| Onboarding shell + flow controller | Shared `src/components/onboarding/**` (surface-independent) | Surface adapters (navigation/lifecycle) | D-06: no Chrome APIs in the shared module; each surface injects typed ports only. |
| Fixture-backed provider validation | Typed `ProviderValidationPort` adapter | Fixture module (deterministic) | D-05; no provider endpoint, SDK or generated backend may be reached. |
| Legacy plaintext credential cleanup | Background SW startup (idempotent) | Sanitised write via storage adapter | D-07: runs once on startup, removes only recognised secret fields, records a redacted result. |
| Fixture / deferred marking | Presentation (`DeferredNotice` in `src/components/common/`) | DOM attribute `data-np-backing` on region roots | UI-SPEC § Fixture-Backed & Deferred Marking Convention; D-16 fixes per-page disposition. |
| Content-script extraction stubs | Content script (ISOLATED, extraction-only) | Background (advisory handlers) | §5.6: no UI, no `fetch(`, no Shadow DOM, no host-page writes; isolation gate greps for it. |

## Standard Stack

### Core

Versions below are what is **installed and lockfile-resolved today**, verified with `npm view` +
`node -e require(…)/package.json` this session `[VERIFIED: probe]`.

| Library | Version (installed / registry latest) | Purpose | Why Standard |
|---|---|---|---|
| `wxt` | `0.20.27` / `0.21.4` | Extension framework: entrypoint discovery, manifest generation, dev server, `.wxt/` types | Canonical per §7.1 and Appendix G; the only build path for the extension after D-03. |
| `@wxt-dev/module-react` | **not installed** / `1.2.2` | React Fast Refresh + JSX plugin inside WXT | Appendix G names `modules: ['@wxt-dev/module-react']` `[CITED: PRODUCT_SPEC Appendix G]`. WXT has **no** React auto-detection — I grepped its dist for plugin-react/react wiring and found none `[VERIFIED: probe]`. Without it, TSX still compiles (esbuild handles the transform) but D-03's "WXT dev mode/HMR" promise is unmet. |
| `antd` | `6.5.2` / `6.6.5` | Primary design system | §7.2, §5.5; `theme.compactAlgorithm` + mode algorithm per surface. |
| `@ant-design/x` | `2.9.0` / `2.9.0` | `XProvider` (the single root provider per surface) + presentation components | §5.5: `XProvider` extends `ConfigProvider`; never nest both. |
| `@ant-design/x-markdown` | `2.9.0` / `2.9.0` | `XMarkdown` for `PortableMarkdown` | Already the canonical markdown stack. |
| `@ant-design/icons` | installed (UI-SPEC pins `6.3.2`) / `6.3.4` | The **only** icon system | UI-SPEC pins `@ant-design/icons@6.3.2`; `lucide-react` is a banned second icon system. |
| `react` / `react-dom` | `19.2.8` | UI runtime | §7.2 (React 19); AntD v6 requires ≥18. |
| `zustand` | `5.0.14` / `5.0.15` | Persisted stores (`ThemeStore`, `WorkspaceStore`, `useExtensionStore`) | §7.3; canonical store shape (CONVENTIONS § Module Design). |
| `immer` | `11.1.18` | `zustand/middleware/immer` | Existing convention. |
| `zod` | `4.4.3` / `4.6.5` | Runtime validation at public boundaries | §0.3 requires a Zod schema + fixture test on every public module boundary. Installed but **zero imports** today `[VERIFIED: probe]`. `WorkspaceState` validation (D-11) and RuntimeEnvelope payload validation are the Phase 1 boundaries that should introduce it. |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@vitejs/plugin-react` | `6.1.0` | Vite React plugin (dev-shell today) | Retained only as the transitive mechanism behind `@wxt-dev/module-react`; the standalone `vite.config.ts` is REMOVEd by D-03. |
| `vitest` | `3.2.7` | Test runner | All suites; jsdom env + `tests/setup.ts` mocks. |
| `jsdom` | `25.0.1` | DOM environment | Required for AntD + `BroadcastChannel` mock. |
| `@testing-library/react` | `16.3.2` | DOM rendering | Component suites (`tests/components/**`). |
| `typescript` | `5.8.3` (declared `~5.8.2`) | The only linter (`tsc --noEmit`) | Every `verify:*` script starts with it. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `@wxt-dev/module-react` | `@vitejs/plugin-react` added directly in `wxt.config.ts` `vite: () => ({ plugins: [react()] })` | No new dependency, but diverges from Appendix G and loses WXT's React-specific defaults. Recommend Appendix G's module. |
| `chrome.storage.session` for handoff state | `BroadcastBus` only | D-14 forbids a temporary persistent store; `session` is also cleared on extension reload/update `[CITED: developer.chrome.com/docs/extensions/reference/api/storage]`, which makes it a trap for handoff. Do not use it. |
| Zod schemas for `WorkspaceState` | Hand-written type guards | Zod is already installed and §0.3 mandates it; hand-rolled guards are the thing the spec explicitly forbids. |
| Pinning exact versions | Keeping `^` ranges | A fresh `pnpm install` today resolves `antd` to `6.6.5` and `@ant-design/icons` to `6.3.4` — **not** the `6.5.2`/`6.3.2` the UI-SPEC enumerated. `CONCERNS.md` already flags unpinned AntD/X peer ranges as a risk. Decide explicitly; see Open Question 4. |

**Installation (only new package required for Phase 1):**

```bash
pnpm add -D @wxt-dev/module-react@^1.2.2
```

**Removals (D-01/D-03, UI-SPEC):** `lucide-react` (single importer:
`src/components/options/PromptIcon.tsx:43` `[VERIFIED: probe]`), `vite` + `@vitejs/plugin-react` +
`vite.config.ts` + root `index.html` + `src/main.tsx` (the dev shell), and `options.html` plumbing.
`motion` and `zod` are declared-but-unimported `[VERIFIED: probe — `grep -rn` finds zero imports]`;
`motion` is *permitted* (DESIGN_SYSTEM §11) so keep it, `zod` is *required* by §0.3 so keep and use it.

**Version verification performed this session:**

```bash
npm view wxt version                       # 0.21.4
npm view @wxt-dev/module-react version     # 1.2.2
npm view @wxt-dev/module-react scripts.postinstall   # (empty)
npm view antd version                      # 6.6.5
npm view @ant-design/x version             # 2.9.0
npm view zod version                       # 4.6.5
node -e "…require('./node_modules/antd/package.json').version"   # 6.5.2 installed
```

## Package Legitimacy Audit

Gate run this session: `gsd-tools query package-legitimacy check --ecosystem npm …`.

| Package | Registry | Age signal | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `wxt` | npm | latest 2026-08-11 | 428k/wk | github.com/wxt-dev/wxt | OK | Approved |
| `@wxt-dev/module-react` | npm | latest 2026-03-14 | 240k/wk | github.com/wxt-dev/wxt | OK | Approved — **the only new install**; no `postinstall` |
| `@ant-design/x` | npm | latest 2026-07-28 | 67k/wk | github.com/ant-design/x | OK | Approved (already installed) |
| `@ant-design/x-markdown` | npm | latest 2026-07-28 | 23k/wk | github.com/ant-design/x | OK | Approved (already installed) |
| `zustand` | npm | latest 2026-08-13 | 40M/wk | github.com/pmndrs/zustand | OK | Approved (already installed) |
| `immer` | npm | latest 2026-08-19 | 45M/wk | github.com/immerjs/immer | OK | Approved (already installed) |
| `antd` | npm | latest 2026-09-20 | 2.8M/wk | github.com/ant-design/ant-design | SUS (`too-new`) | Flagged — already installed and locked at `6.5.2`; the flag is the *latest release* recency heuristic, not package age. Keep the locked version; do not bump inside this phase without a checkpoint. |
| `@ant-design/icons` | npm | latest 2026-08-31 | 3.3M/wk | github.com/ant-design/ant-design-icons | SUS (`too-new`) | Flagged — same heuristic; UI-SPEC pinned `6.3.2`. Do not bump unplanned. |
| `zod` | npm | latest 2026-09-13 | 214M/wk | github.com/colinhacks/zod | SUS (`too-new`) | Flagged — same heuristic; keep `4.4.3`. |
| `motion` | npm | latest 2026-09-16 | 15M/wk | github.com/motiondivision/motion | SUS (`too-new`) | Flagged — same heuristic; permitted by DESIGN_SYSTEM §11. Leave pinned. |
| `vite` | npm | latest 2026-09-10 | 132M/wk | github.com/vitejs/vite | SUS (`too-new`) | Flagged — transitive/tooling; the direct dev-shell dependency is REMOVEd by D-03. |
| `vitest` | npm | latest 2026-09-15 | 75M/wk | github.com/vitest-dev/vitest | SUS (`too-new`) | Flagged — test tooling only, no runtime exposure. |
| `lucide-react` | npm | latest 2026-09-17 | 76M/wk | github.com/lucide-icons/lucide | SUS (`too-new`) | **REMOVED** by this phase anyway (UI-SPEC: banned second icon system). Delete the import in `src/components/options/PromptIcon.tsx:43`, swap to `@ant-design/icons`, then drop the dependency. |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** `antd`, `@ant-design/icons`, `zod`, `motion`, `vite`,
`vitest`, `lucide-react`. All seven are `too-new`-only verdicts on the *most recent published
version* of very-high-download packages with first-party source repos. None of them is a new
install in this phase, and none carries a `postinstall` script. No `checkpoint:human-verify` is
required for the existing pins; **do** add one before any version bump.

*No package in this list was discovered via WebSearch or training data; all were read out of the
repo's own `package.json` / `node_modules` this session. `@wxt-dev/module-react` is the one
package whose name came from PRODUCT_SPEC Appendix G (an authoritative in-repo source) and was
then confirmed `OK` by the legitimacy seam — it may be tagged `[VERIFIED: npm registry]`.*

## Architecture Patterns

### System Architecture Diagram

```text
                        ┌──────────────────────────────────────────────────────┐
   user action click ──►│ Background service worker (src/entrypoints/          │
   browser start    ──► │ background.ts)                                       │
                        │  • BackgroundRouter.register()  ← SYNCHRONOUS, top   │
                        │    level, every SW wake (MessageBus.init inside)     │
                        │  • sidePanel.setPanelBehavior({                      │
                        │      openPanelOnActionClick: true })                 │
                        │  • onInstalled → onboarding flag seed + legacy       │
                        │    plaintext-credential cleanup (idempotent)         │
                        └───────────────┬──────────────────────────────────────┘
                                        │ RuntimeEnvelope<T> over chrome.runtime
                                        ▼
   ┌────────────────────────────────────────────┐        ┌────────────────────────────────────┐
   │ SIDE PANEL  (src/entrypoints/sidepanel/)    │        │ STANDALONE  (src/entrypoints/       │
   │  one XProvider(compact:true) > AntdApp      │        │ standalone/)                        │
   │  SidePanelShell                             │        │  one XProvider(compact:false)       │
   │   ├ SidepanelChat (empty state only)        │        │   ├ StandaloneShell (Sider+Header)  │
   │   ├ Composer (input live, Send disabled)    │        │   ├ StandaloneRouter → page shells  │
   │   ├ Status bar (neutral dot, no provider)   │        │   │   fixture-preview | deferred    │
   │   └ CommandPalette (CommandRegistry)        │        │   └ CommandPalette (same registry)  │
   │  OnboardingFlow (shared module, ports)      │        │  OnboardingFlow (same module)       │
   └───────┬───────────────────────┬─────────────┘        └───────────┬────────────────────────┘
           │                       │                                  │
           │ 1. click "Switch to Full chat"                           │
           │ 2. mint handoffRequestId                                 │
           │ 3. tabs.query(url=standalone.html*) ──► focus existing ──┤
           │    else tabs.create(standalone.html?workspaceId…         │
           │       &conversationId…&handoff=<id>&hv=<schemaVersion>)  │
           │                       │                                  │
           │                       ▼                                  │
           │            ┌────────────────────────────────────┐        │
           │            │ BroadcastChannel 'np_workspace'    │◄───────┤ 4. subscribe on mount,
           │            │  (ephemeral; same extension origin)│        │    validate URL params
           │            └────────────────────────────────────┘        │
           │                       │                                  │
           │  5. ◄── {type: 'HANDOFF_READY', reqId, wsId, hdv} ───────┤
           │  6. ──► {type: 'WORKSPACE_HANDOFF', projection} ────────►│
           │                                  7. validate + apply     │
           │  8. ◄── {type: 'HANDOFF_ACK', reqId, ok|errorCode} ──────┤
           │  9. success toast ONLY after a validated ack             │
           │     else typed error + Retry; Side Panel stays writable  │
           │                                                          │
           │  ┌──────────────────────────────┐                        │
           └─►│ chrome.storage.sync.np_theme │◄───────────────────────┘
              └──────────────┬───────────────┘
                             │ chrome.storage.onChanged (area === 'sync')
                             ▼
              each surface: re-derive getAntdConfig({mode, pack, compact})
                            → new theme object on the SAME XProvider
                            → AntD v6 CSS variables swap; no remount
```

**Reading the diagram for the primary use case (success criterion 2):** follow
`Side Panel → mint request id → tabs.query/create → Standalone mount → 'np_workspace' →
HANDOFF_READY → WORKSPACE_HANDOFF → apply → HANDOFF_ACK → toast`. Every arrow after the tab is
created must be able to *fail independently* — the tab existing is not the handoff succeeding
(D-13 step 8).

### Recommended Project Structure

Per D-02/D-03 + §5.1 + §18 Phase 1 + UI-SPEC. This is the *target*; `01-MIGRATION-INVENTORY.md`
is the authoritative per-file map.

```text
nowpilot/
├── wxt.config.ts                       # srcDir: 'src', modules: ['@wxt-dev/module-react']
├── tsconfig.json                        # '@/*' → './src/*'; include drops root 'entrypoints/**'
├── vitest.config.ts                     # '@' → './src' (align with tsconfig + WXT)
├── .wxt/                                # generated; add to .gitignore (CONCERNS)
├── public/assets/icons/                 # unchanged
├── src/
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── sidepanel/{index.html,main.tsx}
│   │   ├── standalone/{index.html,main.tsx}
│   │   └── content/                     # extraction-only; see Pitfall 5 before trusting discovery
│   ├── core/
│   │   ├── theme/{ThemeStore.ts, antdConfig.ts, ThemeSync.ts, chromeStorageAdapter.ts}
│   │   ├── workspace/{WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts, handoff/*}
│   │   ├── runtime/{RuntimeEnvelope.ts, MessageType.ts, BroadcastBus.ts, OperationId.ts,
│   │   │            PortReader.ts, workerState.ts}
│   │   ├── messaging/{MessageBus.ts, BackgroundRouter.ts}
│   │   ├── events/EventBus.ts
│   │   ├── commands/{CommandRegistry.ts, registerWorkspaceCommands.ts}
│   │   ├── input/KeymapRegistry.ts
│   │   ├── registry/{Registry.ts, AddonRegistry.ts, AddonSettingsStore.ts, StandalonePageRegistry.ts}
│   │   ├── log/debugLog.ts · i18n/strings.ts · prompts/index.ts
│   │   └── components/{ErrorBoundary.tsx, PortableMarkdown.tsx}
│   ├── components/
│   │   ├── sidepanel/{SidePanelShell.tsx, SidePanelRouter.tsx}
│   │   ├── standalone/{StandaloneShell.tsx, StandaloneRouter.tsx}
│   │   ├── onboarding/OnboardingFlow.tsx        # shared, surface-independent (D-06)
│   │   ├── common/{CommandPalette.tsx, DeferredNotice.tsx, MirrorBanner.tsx, …}
│   │   └── pages/{ChatPage,AgentPage,NotesPage,OptionsPage}.tsx   # disposition per D-16
│   ├── services/                       # PersistentProviderConfig; no network, no secrets (D-07)
│   ├── types/{index.ts, workspace.ts, errors.ts}
│   └── theme/                          # token packs (pack-ready, Default only in Phase 1)
└── tests/
    ├── setup.ts
    ├── background/  components/  core/{runtime,events,workspace,theme,commands,storage,strict,store}
    └── isolation/
```

**No loose files directly under `src/entrypoints/`** — D-03 requires each entrypoint directory to
hold its HTML + main module + entrypoint-specific assets together, and WXT treats any
`src/entrypoints/<name>.<ext>` as an entrypoint (`*.[jt]s?(x)` → `unlisted-script`,
`*.html` → `unlisted-page`) `[VERIFIED: node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs:293-297]`.

### Pattern 1: `srcDir: "src"` migration as a move-only plan

**What:** Land `srcDir: 'src'`, move `entrypoints/**` → `src/entrypoints/**`, repoint every alias
and path-glob, regenerate `.wxt/`, and update the two test files that grep entrypoint paths — with
**zero behavioural change**.
**When to use:** First executable plan after the inventory. Everything else depends on it.
**Why move-only:** D-03 step 7 ("verify no extension code imports the deleted shell") and D-04's
verification ("target paths exist for completed KEEP/ADAPT/REPLACE") are only checkable if the move
is a single, revertible commit whose only diff is paths + relative-import depth.

The concrete mechanical deltas this phase must make (all probe-verified):

| Artifact | Current | Required |
|---|---|---|
| `wxt.config.ts` | no `srcDir` | `srcDir: 'src'`, plus `modules: ['@wxt-dev/module-react']`; `publicDir`/`modulesDir` only if `public/` or `modules/` move under `src/` `[CITED: wxt.dev/guide/resources/upgrading]` |
| `wxt.config.ts` manifest | `options_ui`/`options_page` keys, `content_security_policy` allowlist | `options_ui`/`options_page` REMOVEd (Options renders in Standalone); CSP reconciled with Appendix G's `connect-src *` **or** the narrower Phase-1 allowlist — a decision, see Open Question 5 |
| root `tsconfig.json` | `include: [..., "entrypoints/**/*", ...]` `[VERIFIED: tsconfig.json:27-35]` | drop the root `entrypoints/**/*` entry (`src/**/*` now covers it); decide `extends: ".wxt/tsconfig.json"` vs duplicate paths |
| root `tsconfig.json` paths | `'@/*': ['./*']` `[VERIFIED: tsconfig.json:22-25]` | `'@/*': ['./src/*']` — canonical samples import `@/core/…`, `@/components/…` |
| `.wxt/tsconfig.json` | `"@": [".."], "@/*": ["../*"]` `[VERIFIED: .wxt/tsconfig.json]` | regenerated by `wxt prepare` to `../src`-relative; **do not hand-edit**, regenerate |
| `vitest.config.ts` | `'@' → __dirname, '.'` `[VERIFIED: vitest.config.ts:10-14]` | `'@' → ./src` (or delete the alias and keep relative imports — but then canonical samples still typecheck under tsconfig, so align anyway) |
| `entrypoints/background.ts` | `import … from '../src/core/…'` `[VERIFIED: entrypoints/background.ts:2]` | `from '../core/…'` |
| `entrypoints/{sidepanel,standalone}/main.tsx` | `'../../src/…'` `[VERIFIED: entrypoints/sidepanel/main.tsx:4-14]` | `'../../core/…'` / `'../../components/…'` |
| `tests/isolation/cross-entrypoint-imports.test.ts` | greps `entrypoints/content/` `[VERIFIED: tests/isolation/cross-entrypoint-imports.test.ts:78]` | greps `src/entrypoints/content/` |
| `tests/core/strict/np-strict-ceiling.test.ts` | comments + git-grep over `src/` **and** `entrypoints/` `[VERIFIED: tests/core/strict/np-strict-ceiling.test.ts:13,18,49]` | single `src/` target |
| `scripts/verify-no-tailwind.sh` | `grep … src/ entrypoints/` on lines 20/23/32/36 `[VERIFIED: scripts/verify-no-tailwind.sh:20]` | `grep … src/` only — **and this is a hard break today**: after the move, the missing `entrypoints/` path makes grep emit an error line into `wc -l`, so `TOTAL` becomes ≥1 and the gate **fails**. Update it in the same commit as the move. |
| `vite.config.ts`, `index.html`, `src/main.tsx` | dev shell | REMOVE (D-03 step 6), after parity is verified |
| `.gitignore` | `.wxt/` absent `[VERIFIED: .gitignore]` | add `.wxt/` + `git rm -r --cached .wxt` (CONCERNS: stale generated types can mask entrypoint regressions) |
| `package.json` scripts | `dev`/`start`/`preview` → Vite; `build` → Vite; `dev:ext`/`build:ext` → WXT | `dev` → `wxt`, `build` → `wxt build`, `zip` → `wxt zip`; drop the Vite-only scripts |

### Pattern 2: BroadcastBus ready/transfer/ack handshake (D-13)

**What:** A three-message, request-correlated protocol on the `np_workspace` BroadcastChannel with
a bounded timeout, idempotent application and an explicit acknowledgement gate.
**When to use:** Every Side Panel → Standalone transition, warm **and** cold.
**Shape (uses the prototype's existing `publish`/`subscribe` signatures
`[VERIFIED: src/core/runtime/BroadcastBus.ts:43-62]`):**

```ts
// src/core/workspace/handoff/protocol.ts
export const HANDOFF_SCHEMA_VERSION = 1 as const;
export const HANDOFF_TIMEOUT_MS = 3000;      // bounded; no unbounded wait
export const HANDOFF_MAX_RETRIES = 2;        // bounded; total attempts = 3

export type HandoffEnvelope =
  | { type: 'HANDOFF_READY'; requestId: string; workspaceId: string;
      target: 'standalone'; supportedSchemaVersion: number }
  | { type: 'WORKSPACE_HANDOFF'; requestId: string; schemaVersion: number;
      projection: Phase1HandoffProjection }        // allowlist only — never full WorkspaceState
  | { type: 'HANDOFF_ACK'; requestId: string; appliedSchemaVersion: number;
      result: { ok: true } | { ok: false; code: WorkspaceHandoffErrorCode } };

/** D-13 Phase 1 projection allowlist — nothing else may be added without a decision. */
export interface Phase1HandoffProjection {
  workspaceId: string;
  conversationId: string | null;
  sourceSurface: 'sidepanel';
  targetSurface: 'standalone';
  activeRoute: string;
  composerDraft: string;      // ephemeral; NEVER in the URL, NEVER persisted
  requestId: string;
  schemaVersion: number;
}
```

**Rules the implementation must obey (each is a test from `01-CONTEXT.md` § Specifics):**

1. **Never send immediately after `tabs.create`.** A cold tab has not subscribed yet. Wait for
   `HANDOFF_READY` with the matching `requestId`. `BroadcastBus` messages are ephemeral — a message
   published before the listener exists is lost with no delivery receipt.
   `[VERIFIED: src/core/runtime/BroadcastBus.ts:55-62 — `publish` posts and returns `void`; there is
   no queueing or replay.]`
2. **Correlate on `requestId`.** Duplicate `READY`/`ACK` for an already-applied `requestId` must be
   ignored (idempotency), not re-applied.
3. **Ack-gate the success claim.** UI-SPEC § Handoff Interaction Contract: success is claimed *only*
   after a validated ack.
4. **Timeout preserves Side Panel state.** On no ack: typed `WORKSPACE_HANDOFF_FAILED` (canonical,
   §21.6 `[CITED: PRODUCT_SPEC §21.6]`), draft retained, `Retry` available, no `MirrorBanner`.
5. **Dedupe before create, every time.** `chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html') + '*' })`
   is the established shape `[VERIFIED: src/core/workspace/WorkspaceRouter.ts:40]`. Query patterns
   require the `tabs` permission, which Phase 1 already has
   `[VERIFIED: wxt.config.ts:36 — `permissions: ['sidePanel', 'storage', 'tabs'],`]`.
6. **`BroadcastBus` self-echo suppression already exists** via the `_sender` instance id
   `[VERIFIED: src/core/runtime/BroadcastBus.ts:27-29]` — but the handoff must still validate
   *content*, because any same-origin extension page can publish on the channel (CONCERNS:
   "BroadcastChannel messages are unauthenticated"). Validate `target`, `workspaceId` and
   `requestId` *before* applying.

### Pattern 3: Single-source theme with `getAntdConfig`

**What:** Resolve `np_theme` to exactly one representation, derive a fresh `ThemeConfig` per
surface, and let AntD's CSS-variable layer swap colours without a React remount.
**When to use:** APPR-03/04/05; every surface root.

```ts
// src/core/theme/antdConfig.ts  (NEW — §5.5, Appendix F)
import { theme, type ThemeConfig } from 'antd';
import { enUS } from 'antd/locale/en_US';

export function getAntdConfig(
  { mode, pack, compact }:
  { mode: 'light' | 'dark' | 'auto'; pack: 'default' | 'liquid-glass' | 'claude-warm'; compact: boolean },
): ThemeConfig {
  const resolved = mode === 'auto' ? resolveSystem() : mode;      // no persistence here
  const algorithms = [resolved === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (compact) algorithms.push(theme.compactAlgorithm);           // APPR-05: fixed per surface
  return {
    algorithm: algorithms,                                         // array form, per Context7
    token: { ...seedTokens(pack), ... },
    components: { ...componentTokens(pack) },
    cssVar: true,                                                  // v6 CSS-variable mode
    locale: enUS,                                                  // UI-SPEC: never AntD locale defaults
  };
}
```

- **Always return an object, never `undefined`.** Context7's FAQ is explicit: passing
  `theme={undefined}` vs an object changes the provider tree and **remounts children** — the exact
  "no remount" failure APPR-04 forbids `[CITED: antd customize-theme FAQ, via Context7]`.
- **`algorithm` accepts an array**, so `compactAlgorithm` composes with the mode algorithm
  `[CITED: antd customize-theme, via Context7]`.
- **One `XProvider` per surface**; `ConfigProvider` is never mounted separately (§5.5). The current
  `ThemeProvider` nests `ConfigProvider > XProvider` with the *same* object
  `[VERIFIED: src/components/ThemeProvider.tsx:38-44]` — REPLACE it with a per-surface provider root
  modelled on §5.5's `Root()` samples.
- **`cssVar`** is the v6 mechanism that makes mode switches a variable swap; v6 also offers
  `zeroRuntime` (6.0.0, opt-in, needs an extra stylesheet import) — do **not** enable it in Phase 1
  `[CITED: antd customize-theme Theme properties, via Context7]`.
- **Local-first on write failure** (UI-SPEC § Theme Contract): a failed `sync` write never rolls back
  the visible mode; surface `theme.syncFailed` + `theme.syncRetry`.
- **The `.dark`-class question is unresolved and must be decided explicitly.** `ThemeStore.setMode`
  toggles `document.documentElement.classList` `[VERIFIED: src/core/theme/ThemeStore.ts:59]` and
  `src/index.css` has ~15 `html.dark …` / `.dark …` rules `[VERIFIED: probe]`. UI-SPEC § Theme
  Contract says "**no `.dark` class manipulation**". Either (a) reinterpret that rule as
  "AntD components must never depend on `.dark`" and keep the class for hand-written CSS, or (b)
  migrate `src/index.css` to CSS custom properties driven by `getAntdConfig` tokens. (b) is the
  literal reading and the larger diff. See Open Question 2.

### Pattern 4: `KeymapRegistry` as the single global binding owner

**What:** One `document` keydown listener owned by the registry; commands are data, not listeners.
**When to use:** `Cmd+K` / `Ctrl+K` on both surfaces (FLOW-8/FLOW-10/SP-09/SA-09).

```ts
// src/entrypoints/sidepanel/main.tsx (root, once)
useEffect(() => KeymapRegistry.register({
  id: 'open-command-palette',
  keys: 'Cmd+K',                      // see the matcher fix below — this token MUST work on macOS
  description: 'Open the command palette',
  handler: () => setPaletteOpen((prev) => !prev),
}), []);
```

**The matcher must be repaired first.** Current predicate (verbatim
`[VERIFIED: src/core/input/KeymapRegistry.ts:11-24]`):

```ts
const ctrl = modifiers.includes('Control') || modifiers.includes('Cmd');
…
  ctrl === (e.ctrlKey || e.metaKey) &&
…
  meta === e.metaKey
```

Probe results `[VERIFIED: probe]`:

```text
Cmd+K      macOS Cmd+K                          NO MATCH
Cmd+K      Windows Ctrl+K                       MATCH
Control+K  macOS Cmd+K via Control spelling     NO MATCH
Control+K  Windows Ctrl+K via Control spelling  MATCH
Meta+K     macOS Cmd+K via Meta spelling        NO MATCH
```

Minimum fix: treat `Cmd`/`Meta`/`Command` as the platform-primary modifier and stop double-counting
it in the `meta` comparison — e.g. resolve to a single `primary: boolean` and compare
`primary === (e.metaKey || e.ctrlKey)`, keeping `Shift`/`Alt` as strict exact matches. Also make the
conflict **error code canonical**: the registry throws a raw `Error` today
`[VERIFIED: src/core/input/KeymapRegistry.ts:41]` while §21.6 defines `KEYMAP_CONFLICT`
`[CITED: PRODUCT_SPEC §21.6]`, and UI-SPEC says "A conflict throws (`KEYMAP_CONFLICT`)".
**This registry currently has zero consumers and no test file** `[VERIFIED: probe — no
tests/core/input suite exists]`, so the fix carries no regression risk and *must* ship with a new
`tests/core/input/KeymapRegistry.test.ts` that asserts the macOS `Cmd+K` case explicitly.

Removal target: the ad-hoc listeners at `entrypoints/sidepanel/main.tsx:95-104` and
`entrypoints/standalone/main.tsx:63-72` `[VERIFIED: …]`. Note the palette *itself* also binds
`window` keydown for `Escape`/`↑`/`↓`/`Enter`
`[VERIFIED: src/components/common/CommandPalette.tsx:39-64]` — that is intra-overlay handling, not a
global binding, so it may stay; but the plan must verify that `Cmd+K` while the palette is open
toggles it *closed* rather than re-registering or double-handling.

### Pattern 5: Fixture-backed onboarding behind typed ports (D-05/D-06/D-08)

**What:** One shared surface-independent `OnboardingFlow` + a state machine + two typed ports with
Phase-1 fixture adapters.
**When to use:** SA-08/FLOW-9, on whichever surface the user opens first.

```ts
// src/services/ports/providerValidationPort.ts   (typed Phase-3 port; fixture adapter in Phase 1)
export type ProviderValidationResult =
  | { ok: true }
  | { ok: false; code: 'PROVIDER_AUTH' | 'PROVIDER_5XX' | 'NETWORK' | 'PROVIDER_CHECK_FAILED' };

export interface ProviderValidationPort {
  validate(input: { providerId: ProviderId; credential: string; signal?: AbortSignal }):
    Promise<ProviderValidationResult>;
}

// src/services/ports/credentialStorePort.ts      (typed Phase-2 port; NO Phase 1 implementation)
export interface CredentialStorePort {
  isConfigured(providerId: ProviderId): Promise<boolean>;
  store(providerId: ProviderId, credential: string): Promise<{ ok: true } | { ok: false; code: string }>;
}
```

- Error codes above are the canonical §21.6 / Appendix C.2 strings (`PROVIDER_AUTH`,
  `PROVIDER_5XX`, `NETWORK`, `PROVIDER_CHECK_FAILED`) `[CITED: PRODUCT_SPEC §21.6 + Appendix C.2]`.
  Do **not** invent `PROVIDER_RUNTIME_NOT_READY`; D-05 says prefer the existing registry.
- `ProviderId` must be `'openai' | 'anthropic' | 'gemini' | 'ollama'`. The prototype uses
  `'claude'` `[VERIFIED: src/types/index.ts:1 — `export type ProviderType = 'openai' | 'gemini' | 'webapp' | 'claude';`]`
  and CONVENTIONS already flags the drift. UI-SPEC pins `'anthropic'` as the fix target and forbids a
  third spelling.
- **The fixture adapter is a plain module**, not a network client: it returns canned results keyed by
  a fixture selector. It imports no SDK and calls no `fetch`. The suite proves that with
  `vi.spyOn(globalThis, 'fetch')` and an assertion that it was never called (the existing
  `testProviderConnection` suite already establishes this spy pattern
  `[VERIFIED: tests/core/ai/testProviderConnection.test.ts:27-39]`).
- **Sentinel-secret discipline** is already the repo's idiom — reuse it verbatim:
  `const secretKey = 'sk-secret-DO-NOT-LEAK-XYZ123'` then assert absence across storage, serialised
  state, messages, logs and diagnostics `[VERIFIED: tests/core/ai/testProviderConnection.test.ts:84-109]`.

### Pattern 6: Legacy plaintext credential cleanup (D-07)

**What:** A single idempotent, redacted, throw-free migration that runs on Phase-1 startup.
**When to use:** Background `onInstalled`/`onStartup` (or the first surface mount) — once.

```ts
const LEGACY_SECRET_FIELDS = ['apiKey', 'token', 'accessToken', 'secret'] as const;
const CLEANUP_SCHEMA_VERSION = 1;

export function sanitizeLegacyProviderConfig(raw: unknown): {
  value: unknown; found: boolean; removedFields: string[];   // field NAMES only — never values
} { /* deep-walk `providers[*]` + top-level openAiKey/geminiKey; delete matched keys;
     return a redacted report; NEVER return, log, hash or copy a removed value */ }
```

Non-negotiable properties, each of which needs its own test:

| Property | Test shape |
|---|---|
| Idempotent | Run twice on the same blob → second run reports `removedFields: []`, `found: false`, output deep-equals first output. |
| Redacted result | The returned report and every `debugLog` call contain field **names** only; assert the sentinel value is absent from `JSON.stringify(report)` and from the log buffer. |
| Preserves non-secret metadata | `id`, `name`, `enabled`, `isConfigured`, `useCustomProxy`, non-secret `proxyUrl`, `models[]` survive unchanged. |
| Does not relocate the secret | Assert `np_store`, `chrome.storage.session`, `localStorage` and `sessionStorage` contain no occurrence of the sentinel after cleanup. |
| Records a version | Sanitised blob carries a plaintext-cleanup schema version so the migration is skippable on later runs. |
| Never throws | `expect(() => …).not.toThrow()` for `null`, `{}`, arrays, strings, cyclic-safe primitives — matching the existing "migrations are throw-free and total" convention `[VERIFIED: src/core/workspace/WorkspaceStore.ts:77-82]`. |

The user-visible output is one dismissible neutral notice with the D-07 verbatim string
`Provider credentials must be configured again after secure credential storage is available.`
(UI-SPEC key `provider.credentialsCleared`). It must **never** reveal whether a value was found.

Live call sites the strip must reach (`apiKey` occurrence counts this session
`[VERIFIED: probe]`): `src/services/aiProvider.ts` (15), `src/components/OnboardingModal.tsx` (9),
`src/store/useExtensionStore.ts` (4 — `openAiKey`, `geminiKey`, and the four `providers[*].apiKey`),
`src/components/options/OptionsPage.tsx` (4), `src/types/index.ts` (1 — `ProviderConfig.apiKey` at
line 108). `testProviderConnection` is imported by two files
(`src/components/OnboardingModal.tsx:20`, `src/components/options/OptionsPage.tsx:33`) and is the
named "do not call" symbol in D-05.

### Anti-Patterns to Avoid

- **Interleaving the mechanical move with behavioural change.** Deferring classification or
  changing types during the `srcDir` move makes the manifest/diff unreviewable and breaks D-04's
  per-row verification.
- **A second compatibility module "for now".** D-02 forbids parallel prototype and production
  implementations; temporary exports need an owner and a removal condition *in the inventory*.
- **Listening for `Cmd+K` in `window` again.** D-09 requires removal; two listeners means the palette
  toggles twice and `KeymapRegistry`'s conflict guard never protects anything.
- **Broadcasting `WorkspaceState`.** D-11/D-14 forbid it explicitly; an allowlist projection is the
  only permitted payload. The prototype's `WorkspaceSync` publishes handoff notices and the
  prototype `WorkspaceRouter` publishes on open `[VERIFIED: src/core/workspace/WorkspaceRouter.ts:33-38]`
  — that is a *notice*, not state, and must be replaced by the correlated protocol.
- **Writing `np_workspace_store`.** D-14 forbids Phase-1 `WorkspaceState` persistence and says not to
  create a temporary key Phase 2 must remove. The prototype persists to `np_workspace_store`
  `[VERIFIED: src/core/workspace/WorkspaceStore.ts:148 — `name: 'np_workspace_store',`]`. The
  canonical key is `np_workspace` §8.4 `[CITED: PRODUCT_SPEC §8.4]` — but Phase 1 must use **neither**.
- **Mounting `MirrorBanner` after a handoff.** D-12/UI-SPEC: preserve as an unmounted typed
  component with fixtures; never show it because Standalone opened.
- **A skeleton for deferred content.** D-16: "A skeleton is never used for deferred functionality."
- **Hard-coded hex or a CSS-variable fallback in a component.** UI-SPEC § Color: every colour must
  come from `theme.useToken()`. The palette violates this with
  `'var(--color-primary-bg, #e6f4ff)'` `[VERIFIED: src/components/common/CommandPalette.tsx:106]`.
- **Sub-12px type.** The palette's category label is `fontSize: 11`
  `[VERIFIED: src/components/common/CommandPalette.tsx:118]` — UI-SPEC calls this a defect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Cross-surface handoff transport | A custom `postMessage` bridge / polling loop | `BroadcastBus` (`src/core/runtime/BroadcastBus.ts`) + the D-13 protocol | Channel lifecycle, self-echo suppression and listener cleanup already exist and are tested; a new bridge duplicates the CONCERNS "unauthenticated broadcast" surface. |
| Tab dedupe / focus | A per-surface `tabs.query` + `find` | Extend the existing `WorkspaceRouter` shape `[VERIFIED: src/core/workspace/WorkspaceRouter.ts:20-75]` | The prototype already handles the cross-window focus case and the `lastError` paths; a second implementation drifts (CONCERNS: "two dev/DOM shells … duplicated feature implementations"). |
| Theme algorithm composition | Manual token arithmetic | `theme.defaultAlgorithm` / `darkAlgorithm` / `compactAlgorithm` in an array | AntD derives ~500 alias tokens; hand-rolled overrides break AA contrast guarantees. |
| Modifier-key matching | A new ad-hoc keydown listener with `e.metaKey && e.key === 'k'` | The repaired `KeymapRegistry` | FLOW-8 names the registry as the canonical path; ad-hoc listeners are what D-09 removes. |
| Runtime validation of `WorkspaceState` / envelopes | Hand-written type guards | `zod` (already installed, §0.3 mandated) | Spec §0.3 requires a Zod schema + fixture test on every public boundary; `CONCERNS.md` lists its absence as a risk. |
| Theming primitives | A bespoke CSS-variable layer | AntD v6 `cssVar` + `theme.useToken()` | DESIGN_SYSTEM §7/§13; UI-SPEC forbids a parallel variable system. |
| Fixture/deferred marking | A second badge component or per-feature markers | The single `DeferredNotice` + `Phase1Backing` + `data-np-backing` | UI-SPEC: "One file, one type, one component. Do not create a parallel marker module." |
| Tab/URL bootstrap parameter parsing | Ad-hoc `window.location.search` string slicing | `URLSearchParams` + a Zod schema per D-13's "validate and normalise every parameter" | Malformed/oversized/unsupported-version parameters must fail through one canonical typed path. |

**Key insight:** in this phase the "hand-rolled" risk is not algorithmic — it is **duplication**.
The prototype already contains a working-but-contract-divergent implementation of nearly everything
Phase 1 needs, so a new bespoke implementation and the existing one will both exist (violating D-02)
and the tests will pass against whichever one they were written for. The mitigation is the
migration inventory: every row gets exactly one KEEP/ADAPT/REPLACE/REMOVE verdict, and no module is
left with two live implementations.

## Runtime State Inventory

> Required: this phase is a rename/refactor/migration phase (`srcDir` move + identifier drift + a
> schema-changing credential migration). A grep audit finds files; it does not find runtime state.
> The question: **after every file in the repo is updated, what runtime systems still have the old
> string cached, stored, or registered?**

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | (1) `chrome.storage.local.np_store` — the persisted blob contains `providers.{openai,gemini,ollama,claude}.apiKey`, top-level `openAiKey`, top-level `geminiKey`, `selectedModel: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx'`, `themeMode: 'Auto'` `[VERIFIED: src/store/useExtensionStore.ts:29,43,53,63,69,71,72,74]`. (2) `chrome.storage.local.np_workspace_store` `[VERIFIED: src/core/workspace/WorkspaceStore.ts:148]` — canonical key is `np_workspace`; Phase 1 must persist **neither** (D-14). (3) `chrome.storage.sync.np_theme` — currently **two incompatible shapes** depending on which writer ran last `[VERIFIED: src/core/theme/ThemeStore.ts:128-138]` + `[VERIFIED: src/core/theme/ThemeSync.ts:108-112]`. (4) `chrome.storage.sync.np_theme_pack` — raw pack string `[VERIFIED: src/core/theme/ThemeStore.ts:113]`. (5) `chrome.storage.local.onboardingComplete` boolean `[VERIFIED: entrypoints/background.ts:43-45]`. | **Data migration:** (1) D-07 credential cleanup (below). Also remove the fictional `selectedModel` default and `config.themeMode` (APPR-03 forbids a second theme source). (2) Remove the `np_workspace_store` persist wiring and **do not** introduce `np_workspace` (D-14); delete the stale key on startup so Phase 2 does not inherit a zombie blob. (3)–(4) Pick one `np_theme` representation and migrate the **other** existing shape so installed prototypes are not stuck. (5) Make the boolean the only source — see Pitfall 7. |
| **Live service config** | **None — verified.** No server component, no n8n/Datadog/Tailscale/Cloudflare-style external registration, no CI/CD config. The only external touchpoints are the ServiceNow `host_permissions` and the CSP allowlist `[VERIFIED: wxt.config.ts:37-40, 59-61]` — both repo-resident manifest config, not third-party state. | None. Phase 1 must not add any (least privilege, §16.4). |
| **OS-registered state** | **None — verified.** No pm2/launchd/systemd/Task Scheduler artifacts, no `ecosystem.config.*`, and WXT's web-ext runner is already disabled `[VERIFIED: wxt.config.ts:4-6]`. | None. |
| **Secrets and env vars** | (1) **Plaintext provider keys already written into `chrome.storage.local.np_store`** by the prototype's onboarding/Options flows — 5 write sites across `src/services/aiProvider.ts` (15 refs), `src/components/OnboardingModal.tsx` (9), `src/store/useExtensionStore.ts` (4), `src/components/options/OptionsPage.tsx` (4), `src/types/index.ts` (1) `[VERIFIED: probe]`. This is the D-07 target. (2) No `.env`/`.env.*` files exist and no secret is read from an env var — Phase 1 must not introduce one. (3) `localStorage.onboardingComplete` fallback in `src/components/chat/SidepanelChat.tsx:172,185` `[VERIFIED: probe]` — not a secret, but a second source of truth. | **Data migration (one-way, D-07):** delete the plaintext values in place; never copy, hash, log or relocate them. **Code edits:** delete every `apiKey` read/write path; replace `ProviderConfig.apiKey` `[VERIFIED: src/types/index.ts:108]` with `PersistedProviderConfig` (no secret field); remove the `testProviderConnection` import from both call sites (`OnboardingModal.tsx:20`, `OptionsPage.tsx:33`). |
| **Build artifacts / installed packages** | (1) `.output/chrome-mv3/**` contains `options.html`, which Phase 1 REMOVEs — stale artifacts mislead verification. (2) `dist` symlink → `.output/chrome-mv3` (gitignored). (3) `.wxt/types/paths.d.ts` — **tracked in git**, lists `/background.js`, `/options.html`, `/sidepanel.html`, `/standalone.html` and has **no content-script path** `[VERIFIED: .wxt/types/paths.d.ts]`. (4) `.wxt/tsconfig.json` — tracked, maps `@/*` → `../*` `[VERIFIED: .wxt/tsconfig.json]`; regenerating after `srcDir: 'src'` changes the alias target and a stale copy silently mis-resolves types. (5) `@wxt-dev/module-react` absent; `lucide-react` present. | **Code/build edits:** `git rm -r --cached .wxt` + add `.wxt/` to `.gitignore` (CONCERNS). Delete `.output/` before the post-migration build so manifest inspection reads the new build. `pnpm add -D @wxt-dev/module-react`; `pnpm remove lucide-react` after the import swap. |
| **Cross-context channel names** *(extra row — this stack has a fifth state category)* | `BroadcastChannel` names outlive a source rename: `'np_theme'` `[VERIFIED: src/core/theme/ThemeStore.ts:88]` and `'np_workspace'` `[VERIFIED: src/core/workspace/WorkspaceRouter.ts:5,33]`. A tab still running pre-migration code keeps publishing on the old name *and the old payload shape*. | **Code edit only** — both names are already canonical `np_*` and are reused; the **payload shapes** change (theme blob-vs-string; workspace notice-vs-correlated protocol). Mismatched shapes across a dev reload are a real failure mode → Pitfall 8. |

**Canonical answer:** after every file is updated, the runtime systems still holding old state are
`chrome.storage.local.np_store` (secret fields + fictional model id + `themeMode`),
`chrome.storage.local.np_workspace_store` (a Phase-2 key Phase 1 must delete, not inherit),
`chrome.storage.sync.np_theme` in whichever of its two incompatible shapes the user last wrote,
`.wxt/**` generated types (tracked and stale), `.output/chrome-mv3/**` (contains the removed
`options.html`), and any still-open extension page holding the pre-migration BroadcastChannel
payload shape.

## Common Pitfalls

### Pitfall 1: `np_theme` has two writers in two formats — and the tests pin the wrong one

**What goes wrong:** Toggling the theme on one surface flips the other back ~300 ms later; on some
shutdown paths the persisted theme resets to defaults and `colorTheme`/`pack` are lost. APPR-03
("single source of truth") is unmet.
**Why it happens:** `ThemeStore`'s zustand `persist` writes
`{"state":{mode,colorTheme,pack},"version":1}` through `syncStorageAdapter` to `np_theme`
`[VERIFIED: src/core/theme/ThemeStore.ts:128-138]`, while `applyThemeToSync` writes the **bare
string** `'dark'` to the same key `[VERIFIED: src/core/theme/ThemeSync.ts:108-116]`, and
`startThemeOnChangedSync` casts `changes.np_theme.newValue as ThemeMode` unconditionally
`[VERIFIED: src/core/theme/ThemeSync.ts:142-148]`. Both writers are invoked on both surfaces
`[VERIFIED: entrypoints/sidepanel/main.tsx:74-84]`. Hydration then `JSON.parse`s a bare string,
zustand swallows the failure, and defaults win.
**How to avoid:** Choose one representation for `np_theme` (recommend the zustand JSON blob — zustand
owns the key), funnel **all** writes through `ThemeStore`, make the `onChanged` handler
*shape-detect* (string **or** blob) and ignore what it cannot recognise, and add a two-surface
simulation test that drives the real persisted shape.
**Warning signs:** `ThemeSync.test.tsx` codifies the raw-string contract
`[CITED: .planning/codebase/CONCERNS.md § Fragile Areas]` — a green `ThemeStore`+`ThemeSync` suite is
**not** evidence this works. Assert the *cross-surface round trip*.
**Bonus quota trap:** `chrome.storage.sync` allows `MAX_WRITE_OPERATIONS_PER_MINUTE = 120`
`[CITED: developer.chrome.com/docs/extensions/reference/api/storage]`. Rapid `Toggle theme` presses
plus the debounced persist can approach that ceiling — exactly the failure the UI-SPEC expects
`theme.syncFailed` / `Retry sync` to surface. Make it testable by mocking a rejected `sync.set`, as
the existing suite already does `[VERIFIED: tests/core/theme/ThemeSync.test.tsx:189-202]`.

### Pitfall 2: `Cmd+K` never fires on macOS with the current `KeymapRegistry`

**What goes wrong:** FLOW-8/SP-09/SA-09 fail on the primary development platform. The palette opens on
Windows/Linux and silently does nothing on macOS — and removing the ad-hoc listeners (D-09) turns a
working prototype into a broken one.
**Why it happens:** the predicate compares `meta === e.metaKey` while `meta` is only true for the
literal token `Meta`; `Cmd` sets `ctrl = true` but leaves `meta = false`
`[VERIFIED: src/core/input/KeymapRegistry.ts:11-24]`. Probe: `Cmd+K` macOS → `NO MATCH`;
`Control+K` macOS → `NO MATCH`; `Meta+K` macOS → `NO MATCH` `[VERIFIED: probe]`.
**How to avoid:** repair the predicate (single platform-primary modifier) **before** deleting the
ad-hoc listeners, and land `tests/core/input/KeymapRegistry.test.ts` asserting the macOS case
explicitly plus the `KEYMAP_CONFLICT` path.
**Warning signs:** the registry has **zero consumers and no test file** today
`[VERIFIED: probe — no tests/core/input/ directory]`; nothing else will catch this.

### Pitfall 3: Handoff race — sending before the cold tab is listening

**What goes wrong:** Standalone opens, the payload is published immediately, the tab boots a few
hundred ms later and never receives it. The user sees an empty Standalone view while the Side Panel
reports success.
**Why it happens:** `BroadcastChannel.postMessage` has **no delivery receipt and no replay**
`[VERIFIED: src/core/runtime/BroadcastBus.ts:55-62]`. A message published before the target's
`onmessage` exists is simply gone, and `chrome.tabs.create` resolves when the tab is *created*, not
when its JS has run.
**How to avoid:** never transfer immediately. Implement D-13's ready→transfer→ack handshake with
`requestId` correlation, a bounded timeout (~3 s), bounded retries (≤2), and idempotent application
keyed on `requestId`. On timeout, do not claim success; keep the Side Panel writable and the draft
preserved.
**Warning signs:** a test that only exercises the *warm* tab path passes while cold handoff is broken.
`01-CONTEXT.md` § Specifics lists "cold Standalone tab announces readiness before transfer" as a
required test — write it first.

### Pitfall 4: Losing the user gesture before `chrome.sidePanel.open()`

**What goes wrong:** `Focus Side Panel` (SA-10) throws "may only be called in response to a user
action" and fails intermittently.
**Why it happens:** `sidePanel.open()` is Chrome-116+ and gesture-gated
`[CITED: developer.chrome.com/docs/extensions/reference/api/sidePanel]`. The prototype's handler
awaits `chrome.windows.getCurrent()` *before* calling `open()`
`[VERIFIED: entrypoints/standalone/main.tsx:18-27]`.
**How to avoid:** call `open()` as early as possible in the gesture stack; prefer the `tabId` variant
over an awaited window lookup. Record the outcome as a **manual** Chrome evidence item — a green
jsdom test proves nothing because `chrome.sidePanel` is mocked. This needs a
`checkpoint:human-verify` task.
**Warning signs:** treat any claim of SA-10 success without a real Chrome run as unverified.

### Pitfall 5: The content script is silently excluded from the build (and the move does not fix it)

**What goes wrong:** `build:ext` succeeds, the manifest has no `content_scripts` key, and content
messages can never be produced by a real install.
**Why it happens:** WXT globs `PATH_GLOB_TO_TYPE_MAP` with `cwd: entrypointsDir` and
`expandDirectories: false` `[VERIFIED: node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs:28-31]`.
Content-script globs are `"content.[jt]s?(x)"`, `"content/index.[jt]s?(x)"`, `"*.content.[jt]s?(x)"`,
`"*.content/index.[jt]s?(x)"` `[VERIFIED: …find-entrypoints.mjs:279-282]`, and `*` does not cross `/`.
Probe: `"content/core.content.ts" -> NO MATCH` `[VERIFIED: probe]`; the manifest confirms it
`[VERIFIED: .output/chrome-mv3/manifest.json]`. **Moving the file to
`src/entrypoints/content/core.content.ts` does NOT fix it.**
**How to avoid:** decide and document exactly one of — (a) `src/entrypoints/content.ts`
(matches `content.[jt]s?(x)`); (b) `src/entrypoints/content/index.ts` (matches
`content/index.[jt]s?(x)` **and** keeps the directory, closest to §5.1's intent); (c) keep the literal
canonical path and register the entrypoint explicitly. Then add a **build-inspection test** reading
`.output/chrome-mv3/manifest.json` and asserting `content_scripts` exists — `CONCERNS.md` names the
missing test as why this shipped silently.
**Warning signs:** every source-level test passes. Only the built artifact reveals it — matching the
`nowpilot-phase-verification` rule "Inspect generated artefacts, not source configuration alone".

### Pitfall 6: The `srcDir` move silently breaks three gates

**What goes wrong:** the move "succeeds" (`tsc` green, tests green) while the isolation gate, the
Tailwind gate and the strict-ceiling gate stop covering anything.
**Why it happens:** (i) `scripts/verify-no-tailwind.sh` greps `src/ entrypoints/`
`[VERIFIED: scripts/verify-no-tailwind.sh:20]`; after the move the missing `entrypoints/` path makes
grep emit an error line that `2>&1 | wc -l` counts, so `TOTAL ≥ 1` and the gate fails loudly — good,
but only if it is run. (ii) The isolation gate greps `entrypoints/content/`
`[VERIFIED: tests/isolation/cross-entrypoint-imports.test.ts:78]`; a nonexistent path yields zero
matches, so the `fetch(` gate passes **vacuously**. That file already carries a self-test block for
exactly this reason `[VERIFIED: tests/isolation/cross-entrypoint-imports.test.ts:84-124]` — extend the
self-test, do not merely repoint the path. (iii) `np-strict-ceiling.test.ts` git-greps `src/` **and**
`entrypoints/` `[VERIFIED: tests/core/strict/np-strict-ceiling.test.ts:49]`.
**How to avoid:** update all three in the **same commit** as the move; then deliberately introduce a
violation in a scratch file, confirm each gate goes red, and remove it.
**Warning signs:** gates that pass faster than before, or stderr containing `No such file or directory`.

### Pitfall 7: Two `onboardingComplete` sources of truth, and a boolean that cannot express D-06

**What goes wrong:** onboarding re-triggers forever, or the two surfaces disagree about completion.
**Why it happens:** the background seeds `chrome.storage.local.onboardingComplete`
`[VERIFIED: entrypoints/background.ts:43-45]` while `SidepanelChat` reads/writes the same key *and*
falls back to `localStorage.getItem('onboardingComplete')`
`[VERIFIED: src/components/chat/SidepanelChat.tsx:172,185]`. D-06 needs persona, provider id, schema
version and a fixture marker — none expressible by a boolean.
**How to avoid:** one typed non-secret `OnboardingState` record under one key, with a throw-free
migration mapping the legacy boolean → `{ uiComplete }`, tolerant of missing/garbage/schema-incompatible
input (D-06: "false/unknown/missing/schema-incompatible"), and a `partialize` that excludes everything
transient. Delete the `localStorage` fallback path in extension contexts.
**Warning signs:** a fresh-install test that only seeds `chrome.storage.local` passes while a
`localStorage`-only install loops.

### Pitfall 8: Development-time cross-version message skew

**What goes wrong:** during WXT HMR the Side Panel reloads but the already-open Standalone tab does
not, so the two ends disagree about the handoff payload shape or the `np_theme` representation and the
handoff fails mysteriously.
**Why it happens:** `BroadcastChannel` is scoped to the extension origin and is **not** version-aware;
the handshake carries a schema version (D-13) precisely for this.
**How to avoid:** validate `schemaVersion` on every received message and fail closed with the canonical
typed error rather than half-applying. Add a manual evidence step that reloads the extension (which
re-creates both surfaces) before signing off the handoff criterion.
**Warning signs:** "works on first open, fails after an edit" is this pitfall, not a logic bug.

## Code Examples

### 1. Per-surface provider root — the shape §5.5 mandates

```tsx
// Source: PRODUCT_SPEC §5.5 (verbatim structure), adapted to the Phase-1 density rule (APPR-05)
// src/entrypoints/sidepanel/main.tsx
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

function Root() {
  const mode = useThemeStore((s) => s.mode);
  const pack = useThemeStore((s) => s.pack);
  const cfg = getAntdConfig({ mode, pack, compact: true });   // Side Panel = compact (APPR-05)
  return (
    <XProvider {...cfg}>                       {/* one provider per surface; ⊃ ConfigProvider */}
      <AntdApp>
        <ErrorBoundary>                        {/* CONCERNS: ErrorBoundary is currently never mounted */}
          <SidePanelShell />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

The current equivalent nests `ConfigProvider` outside `XProvider` with the same object
`[VERIFIED: src/components/ThemeProvider.tsx:38-44]` — that is the P0 change.

### 2. Theme write funnel (one writer, one shape)

```ts
// Source: D-15 + Pitfall 1 resolution. ThemeStore owns np_theme; nothing else writes it.
// src/core/theme/ThemeSync.ts
export function startThemeOnChangedSync(): () => void {
  if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'sync') return;
    const raw = changes['np_theme']?.newValue;
    const next = readThemeValue(raw);          // accepts BOTH legacy string and blob; else null
    if (next === null) return;                 // unknown shape → ignore, never cast
    if (useThemeStore.getState().mode !== next.mode) useThemeStore.getState().setMode(next.mode);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/** Tolerant reader: legacy raw mode string OR zustand persist blob. Returns null on anything else. */
export function readThemeValue(raw: unknown): { mode: ThemeMode; pack: string } | null {
  if (typeof raw === 'string' && (raw === 'auto' || raw === 'light' || raw === 'dark')) {
    return { mode: raw, pack: 'default' };
  }
  if (raw && typeof raw === 'object' && 'state' in raw) {
    const st = (raw as { state?: { mode?: unknown; pack?: unknown } }).state;
    if (st && (st.mode === 'auto' || st.mode === 'light' || st.mode === 'dark')) {
      return { mode: st.mode, pack: typeof st.pack === 'string' ? st.pack : 'default' };
    }
  }
  return null;
}
```

### 3. Repaired key matcher (FLOW-8)

```ts
// Source: repair of src/core/input/KeymapRegistry.ts:11-24 (probe-confirmed defect)
// A single platform-primary modifier; Shift/Alt stay strict exact matches.
const PRIMARY_TOKENS = new Set(['Control', 'Cmd', 'Command', 'Meta']);
function matchesKeymap(keys: string, e: KeyboardEvent): boolean {
  const parts = keys.split('+');
  const key = parts.pop()?.toLowerCase();
  const primary = parts.some((p) => PRIMARY_TOKENS.has(p));
  const shift = parts.includes('Shift');
  const alt = parts.includes('Alt');
  return key === e.key.toLowerCase()
    && primary === (e.metaKey || e.ctrlKey)
    && shift === e.shiftKey
    && alt === e.altKey;
}
// conflict must carry the canonical code: throw a typed error whose code is 'KEYMAP_CONFLICT' (§21.6)
```

### 4. Build-inspection test (catches Pitfalls 5 and the `options_ui` drift)

```ts
// Source: CONCERNS.md § "Manifest/build output is untested" — the missing test it names
// tests/isolation/generated-manifest.test.ts   (Wave 0; requires a prior `wxt build`)
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('generated MV3 manifest (Phase 1)', () => {
  const path = '.output/chrome-mv3/manifest.json';
  const manifest = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;

  it('exists (run `pnpm build` first)', () => { expect(manifest).not.toBeNull(); });
  it('declares exactly the least-privilege permission set', () => {
    expect(manifest.permissions.sort()).toEqual(['sidePanel', 'storage', 'tabs']);
  });
  it('has no options_ui / options_page key (Options lives in the Standalone shell)', () => {
    expect('options_ui' in manifest).toBe(false);
    expect('options_page' in manifest).toBe(false);
  });
  it('points the side panel at sidepanel.html', () => {
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
  });
});
```

**Note on the content-script assertion:** do **not** add an
`expect(manifest.content_scripts).toBeDefined()` assertion until the Pitfall-5 rename is decided and
applied — as written today it would fail the phase. Sequence it with the rename (or with the explicit
registration decision), and make the rename the plan that flips this test on.

### 5. Fixture-backed validation port + sentinel-absence test

```ts
// Source: D-05/D-08 + the repo's existing sentinel idiom (tests/core/ai/testProviderConnection.test.ts:84-109)
// tests/components/OnboardingFlow.test.tsx
const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';

it('never lets the sentinel reach storage, messages, logs or the DOM', async () => {
  renderWithProviders(<OnboardingFlow ports={makeFixturePorts('invalid-credential')} />);
  fireEvent.change(screen.getByLabelText(/API key/i), { target: { value: SENTINEL } });
  fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  await waitFor(() => expect(screen.getByText(/Connection failed/)).toBeTruthy());

  const persisted = JSON.stringify(Object.fromEntries(__chromeStorageMap));
  expect(persisted).not.toContain(SENTINEL);
  expect(document.body.textContent).not.toContain(SENTINEL);
  expect(JSON.stringify(debugLog.snapshot())).not.toContain(SENTINEL);
  expect(postedBroadcasts).not.toContain(SENTINEL);   // spy on BroadcastBus.publish
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Root-level `entrypoints/` next to `src/` | `srcDir: 'src'` with `src/entrypoints/` | WXT has supported `srcDir` since well before 0.20; PRODUCT_SPEC Appendix G pins it | One alias root (`@/*` → `src/*`) instead of two competing alias maps; content-script relative-import depth drops by one. |
| `ConfigProvider` + `XProvider` nested | **One** `XProvider` per surface | §5.5 (v0.2 revision) | Removes double theme/locale/icon context and a known remount hazard. |
| AntD `hashed` CSS-in-JS with runtime style injection | `theme.cssVar` CSS-variable mode | AntD v6 (project pinned `6.5.2`) | Live theme switch without remount; v6 also offers `zeroRuntime` (opt-in, needs an extra stylesheet import) — **not** used in Phase 1. |
| `chrome.storage.local` for everything | Split by sensitivity/lifetime: `local` (10 MB), `sync` (100 KB / 8 KB per item / 120 writes-min), `session` (in-memory, cleared on reload) | Chrome 102+ for `session` | `sync` is only viable because the theme payload is tiny; `session` is unusable for the handoff because an extension reload clears it `[CITED: developer.chrome.com/docs/extensions/reference/api/storage]`. |
| Manifest V2 background pages | MV3 service worker, terminated after ~30 s idle | MV3 | Listeners must be registered synchronously at module load on **every** wake; global variables are lost `[CITED: …/service-workers/lifecycle]`. |
| `@wxt-dev/module-react` not used; `@vitejs/plugin-react` in `vite.config.ts` | `modules: ['@wxt-dev/module-react']` in `wxt.config.ts` | Appendix G | The module supplies React Fast Refresh inside WXT; without it TSX still builds but D-03's HMR promise is unmet. |

**Deprecated/outdated in this repo, to be removed by this phase:**
- Root `index.html` + `src/main.tsx` Vite dev shell, and `vite.config.ts`'s multi-entry `rollupOptions.input` (D-03).
- `entrypoints/options/**` and the `options_ui`/`options_page` manifest keys — §5.1 lists no options entrypoint; Options renders at `standalone.html?page=options` `[CITED: PRODUCT_SPEC §5.4]`.
- `lucide-react` and `src/components/options/PromptIcon.tsx`'s import of it (banned second icon system).
- `src/components/pages/**` duplicates — `ChatPage`/`AgentPage`/`NotesPage`/`OptionsPage` exist both there and under their live surface directories (`CONCERNS.md`: "two `OptionsPage.tsx` files"). D-16 assigns each exactly one disposition.
- `src/theme/tailwindEquivalents.ts` — an orphan module whose name advertises a banned system.

## Assumptions Log

> Every claim tagged `[ASSUMED]` in this research. The planner and discuss-phase use this table to
> identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pnpm add -D @wxt-dev/module-react` is sufficient to enable React Fast Refresh in WXT dev mode, with no additional `wxt.config.ts` `vite.plugins` entry required. | Standard Stack; Pattern 1 | If wrong, WXT dev mode either fails to compile TSX or silently loses HMR — D-03's "preserve fast iteration through WXT dev mode/HMR" is unmet and the whole dev workflow regresses. **Confirmation checkpoint:** install it, run `pnpm dev`, edit a component, observe a hot update with no full reload. |
| A2 | Renaming/relocating the content script to a WXT-discoverable name is authorised by Phase 1 even though PRODUCT_SPEC §5.1/§18 literally name `src/entrypoints/content/core.content.ts`. | Pitfall 5; Open Question 1 | If the operator insists on the literal path, an explicit-entrypoint registration mechanism must be found — which may not exist in WXT 0.20 without a custom `entrypoints:found` hook. **Confirmation checkpoint:** operator decision required. |
| A3 | `standalone/` (not `app/`) is the correct entrypoint directory name, resolving the PRODUCT_SPEC internal inconsistency. | Summary; Pattern 1 | Wrong choice bakes a non-canonical path into every later phase and every URL/`chrome.runtime.getURL` call site. **Confirmation checkpoint:** operator ack of the §5.1/§18-vs-§8.5 divergence. |
| A4 | Phase 1 keeps the current 3-permission set `['sidePanel','storage','tabs']` and does **not** adopt Appendix G's 8-permission manifest. | Runtime State Inventory; Standard Stack | Appendix G is the "complete `wxt.config.ts`" reference, so a spec-compliance reviewer could flag the narrower set as a deviation. **Confirmation checkpoint:** operator ack that D-19a's least-privilege rule (already encoded in `wxt.config.ts:29-35`) outranks Appendix G. |
| A5 | Replacing the CSP allowlist with the narrower Phase-1 set (removing `http://localhost:*` and the three provider hosts, since no provider runtime exists in Phase 1) is the correct reading of D-05/D-07, rather than adopting Appendix G's `connect-src *`. | Pattern 1; Open Question 5 | Too-narrow CSP breaks a later phase's provider call in a confusing way; too-wide CSP weakens the security posture §16.3 requires. **Confirmation checkpoint:** operator decision required. |
| A6 | `getAntdConfig` should live at `src/core/theme/antdConfig.ts` (the §5.5/§8.5 path) rather than being folded into the existing `src/theme/index.ts`. | Theme contract | If the barrel is preferred, every §5.5 sample import in later phases is wrong. Low impact (one import path) but cheap to confirm. |
| A7 | The `KeymapRegistry` matcher fix belongs in Phase 1 rather than being deferred behind a compatibility shim, and `Cmd+K` (not `Ctrl+K`) is the intended token for both macOS and Windows. | Pitfall 2; Pattern 4 | If `Ctrl+K`-only is intended, the fix is smaller but the product is broken on macOS — which contradicts FLOW-8/SP-09 and the UI-SPEC's `⌘K` copy. **Confirmation checkpoint:** confirm `Cmd+K` on macOS and `Ctrl+K` on Windows/Linux is the requirement. |
| A8 | `@ant-design/icons` must be pinned to the UI-SPEC's `6.3.2` and `antd` to `6.5.2`, i.e. the phase pins exact versions rather than letting `^` ranges resolve to `6.3.4`/`6.6.5`. | Standard Stack; Alternatives | The UI-SPEC's component enumeration and 847-icon count were taken against the pinned versions; a silent minor bump can change default tokens and XMarkdown sanitisation (CONCERNS flags this explicitly). **Confirmation checkpoint:** operator decision required. |
| A9 | `motion` (declared, unimported) stays in `package.json` and is NOT added to the banned-import grep in Phase 1, because DESIGN_SYSTEM §11 permits `motion` and only bans `framer-motion`. | Standard Stack; success criterion 5 | If the phase's banned-import grep is widened to reject `motion` too, an approved library becomes unusable for Phase 15's motion contract. **Confirmation checkpoint:** confirm the grep list is exactly the three success-criterion-5 patterns. |
| A10 | The 3-second handoff timeout and ≤2 retries are acceptable defaults; they are not pinned by any locked artifact. | Pattern 2 | Too short → spurious failures on slow cold starts; too long → a user-visible stall before the error path. **Confirmation checkpoint:** confirm the values during planning, or make them named exported constants with a test that pins them. |
| A11 | `chrome.storage.session` is deliberately unused in Phase 1 (D-14 forbids a temporary persistent store, and `session` is cleared on extension reload anyway). | Standard Stack `Alternatives`; Pitfall 1 | If a reviewer expects `session` for the handoff, they will flag its absence. Document the rationale rather than leaving it implicit. |

**If this table is empty:** it is not — see above. Items A2, A3, A4, A5, A8 and A11 are
**operator-confirmation items** (contract interpretation or version policy). Items A1, A6, A7,
A9 and A10 are **implementation checkpoints** that a single focused test or one dev run can settle.

## Open Questions (RESOLVED — 2026-09-21)

> **Status: all seven resolved.** Each question below carries an inline `RESOLVED` marker naming the decision and
> the artifact or plan that executes it. The decision ledger is `01-01-PLAN.md` Task 2's
> `## Resolved hand-off decisions` section, which records the eight Planner-Handoff-Checklist items plus OQ3–OQ7
> (OQ1 and OQ2 are cross-referenced to checklist items 1 and 3). No question here is carried forward as unresolved.

| # | Question | Resolution | Decided in | Executed by |
|---|----------|------------|------------|-------------|
| OQ1 | Content-script entrypoint path | Keep the directory and use `src/entrypoints/content/index.ts`, which matches WXT's `content/index.[jt]s?(x)` glob while preserving §5.1's directory intent; the §5.1 divergence is recorded in the inventory | `01-01` Task 2 item 1; `01-03` Task 2 (operator checkpoint, blocking) | `01-02` Task 1 (relocation), `01-03` Tasks 2–3 (injection scope + assertion) |
| OQ2 | Scope of the no-`.dark`-class rule | Scoped to AntD: AntD components must never depend on the class; `src/index.css`'s hand-written selectors follow whichever option the inventory records | `01-01` Task 2 item 3 | `01-05` Tasks 2–3 |
| OQ3 | `schemaVersion` vs `version` vs `updatedAt` | Include all three — `schemaVersion` for the shape, `version` for the Phase-2 monotonic write counter, `updatedAt` for staleness — and document the distinction in the type's JSDoc | `01-01` Task 2 (OQ3 row) | `01-07` Task 1 |
| OQ4 | Exact-version pinning vs `^` ranges | Pin exactly for `antd`, `@ant-design/x`, `@ant-design/x-markdown` and `@ant-design/icons` for the duration of Phase 1; **no bump is performed in Phase 1**, and any bump needs its own blocking checkpoint | `01-01` Task 2 item 5 and OQ4 row | `01-02` Task 1 (asserts no version change), `01-13` Task 1 (dependency manifest gate) |
| OQ5 | CSP content for Phase 1 | Narrow to the Phase-1 no-network value `script-src 'self'; object-src 'self'; connect-src 'none'` — no Phase 1 code path performs a network request, so any reachable host is pure attack surface | `01-01` Task 2 item 6 and OQ5 row | `01-02` Task 1 (sets it), `01-03` Task 1 (asserts it by string equality) |
| OQ6 | Handoff message-type naming and module home | The ready/transfer/acknowledgement messages ride a **separate** `HandoffEnvelope` union on `BroadcastBus` in `src/core/workspace/handoff/protocol.ts` and are **not** added to `MessageType`, because §20.1 scopes the runtime envelope to cross-context `chrome.runtime` traffic | `01-01` Task 2 (OQ6 row) | `01-07` Task 2 |
| OQ7 | Runtime-envelope literal realignment | Rename to the canonical `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` inside an Appendix-E-shaped `MessageType` const object and move the five scaffold-local literals into a separate `ScaffoldMessageType` export that Phases 6 and 17 claim; the rename moves together with `BackgroundRouter` and `tests/background/**` | `01-01` Task 2 (OQ7 row) | `01-06` Tasks 1–2 |

1. **Which resolution for the content-script entrypoint path?** — **RESOLVED (OQ1):** `src/entrypoints/content/index.ts`; injection scope decided by the operator checkpoint in `01-03`, executed by `01-02` Task 1 and `01-03` Tasks 2–3.
   - *What we know:* §5.1 and §18 Phase 1 both name `src/entrypoints/content/core.content.ts`; WXT
     0.20.27's content-script globs cannot match that path (probe-verified), and the generated manifest
     has no `content_scripts` key today.
   - *What's unclear:* whether the operator prefers a rename that diverges from the literal spec path
     (`content.ts` or `content/index.ts`), or keeping the literal path and finding an explicit
     registration mechanism.
   - *Recommendation:* `src/entrypoints/content/index.ts` — it matches
     `content/index.[jt]s?(x)` **and** preserves the directory §5.1 describes, so it is the smallest
     divergence in *intent*. Record the deviation in `01-MIGRATION-INVENTORY.md` with reason and
     affected requirements, per D-04's "material deviations are documented before implementation".
     Phase 1 itself does not depend on the content script running; the point is to stop the silent
     defect and to land the manifest-inspection test.

2. **Does "no `.dark` class manipulation" (UI-SPEC § Theme Contract) apply to `src/index.css`?** — **RESOLVED (OQ2):** scoped to AntD; executed by `01-05` Tasks 2–3 per the inventory's recorded option.
   - *What we know:* `ThemeStore.setMode` toggles `document.documentElement.classList` for `dark`
     `[VERIFIED: src/core/theme/ThemeStore.ts:59]` and `src/index.css` has ~15 `html.dark …` /
     `.dark …` selectors `[VERIFIED: probe]`. UI-SPEC's rule was written about AntD components
     ("The switch is real-time through AntD v6 pure CSS variables — no remount, no `.dark` class
     manipulation").
   - *What's unclear:* whether the rule is scoped to AntD (class may remain for hand-written CSS) or
     global (class must go, CSS must become token-driven).
   - *Recommendation:* treat it as scoped to AntD for Phase 1 (AntD must not depend on `.dark`), keep
     the class for `src/index.css`, and record the interpretation explicitly. The global migration is
     a real refactor with no Phase-1 acceptance value and can be scheduled when the CSS is next
     touched. **This is a decision, not a preference — make it visible in the plan.**

3. **How is `schemaVersion` reconciled with §21.5's `version` + `updatedAt`?** — **RESOLVED (OQ3):** all three fields, distinguished in the type's JSDoc; executed by `01-07` Task 1.
   - *What we know:* D-11 (locked) requires `schemaVersion` in the frozen `WorkspaceState`; §21.5's
     canonical interface has `version: number` and `updatedAt: number` and **no** `schemaVersion`
     `[CITED: PRODUCT_SPEC §21.5]`. §8.4's prose lists neither
     `[CITED: PRODUCT_SPEC §8.4]`.
   - *What's unclear:* whether `schemaVersion` replaces `version`, coexists with it, or whether
     `version` is the write-epoch counter Phase 2 needs.
   - *Recommendation:* include **all three** — `schemaVersion` for the shape, `version` for the
     monotonic write counter Phase 2's election will need, `updatedAt` for staleness — and document
     the three-way distinction in the type's JSDoc. Adding a field the spec already implies is
     cheaper than removing one Phase 2 expects.

4. **Exact-version pinning vs `^` ranges (A8).** — **RESOLVED (OQ4):** pin exactly for the four AntD/X packages and perform no bump in Phase 1; recorded by `01-01` Task 2, asserted by `01-02` Task 1 and `01-13` Task 1.
   - *What we know:* `package.json` uses `^`; the UI-SPEC's inventory was enumerated against
     `antd@6.5.2` / `@ant-design/icons@6.3.2`; registry latest is `6.6.5` / `6.3.4`.
   - *What's unclear:* whether the project wants exact pins (CONCERNS recommends it for AntD/X).
   - *Recommendation:* pin exactly for `antd`, `@ant-design/x`, `@ant-design/x-markdown`,
     `@ant-design/icons` for the duration of Phase 1 (or add `pnpm.overrides`), and record the pin
     in the inventory's "package scripts + dependencies" coverage row. Re-visit at Phase 15 when the
     RICH components are actually consumed.

5. **CSP content for Phase 1 (A5).** — **RESOLVED (OQ5):** `script-src 'self'; object-src 'self'; connect-src 'none'`; set by `01-02` Task 1 and pinned by `01-03` Task 1.
   - *What we know:* the current CSP allowlists `http://localhost:*` plus three provider hosts
     `[VERIFIED: wxt.config.ts:60]`; Appendix G specifies `connect-src *`
     `[CITED: PRODUCT_SPEC Appendix G]`.
   - *What's unclear:* whether Phase 1 should (a) keep the current allowlist, (b) adopt Appendix G's
     permissive value, or (c) narrow to `'none'`/`'self'` since no provider call exists.
   - *Recommendation:* (c) or (a) — Phase 1 makes **no** network request (D-05 forbids provider calls,
     D-08 forbids secrets leaving memory, the fixture adapter is local). A permissive `connect-src *`
     in a phase that never fetches is pure attack surface. Whatever is chosen, add it to the
     manifest-inspection test so it cannot drift silently.

6. **Where does the handoff protocol module live, and how are the new message-type literals named?** — **RESOLVED (OQ6):** `src/core/workspace/handoff/protocol.ts` with a separate `HandoffEnvelope` union on `BroadcastBus`, deliberately outside `MessageType`; executed by `01-07` Task 2.
   - *What we know:* `01-CONTEXT.md` leaves message-type naming to the agent's discretion and says to
     use existing canonical `MessageTypeValues` literals where defined. Appendix E's registry has
     `WORKSPACE_HANDOFF` and `WORKSPACE_UPDATED` but **no** ready/ack types
     `[CITED: PRODUCT_SPEC Appendix E]`.
   - *What's unclear:* whether the three handoff messages ride on `BroadcastBus` as a separate
     discriminated union (recommended — they are not `chrome.runtime` messages) or are added to
     `MessageTypeValues` (which is described as the `chrome.runtime` envelope registry).
   - *Recommendation:* keep them a **separate** `HandoffEnvelope` union on `BroadcastBus` and do not
     pollute `MessageTypeValues`; `BroadcastBus` payloads are not `RuntimeEnvelope`s and §20.1 scopes
     the envelope to cross-context `chrome.runtime` traffic. Note that D-14 calls `BroadcastBus` a
     "transport adapter" — a separate union matches that framing.

7. **Does the prototype's `RuntimeEnvelope.MessageTypeValues` get realigned to Appendix E in Phase 1?** — **RESOLVED (OQ7):** yes — canonical literals in a `MessageType` const object, scaffold-local five separated; executed by `01-06` Tasks 1–2.
   - *What we know:* Appendix E defines `OPEN_STANDALONE` and `OPEN_SIDE_PANEL`; the prototype has
     `STANDALONE_OPEN` and `SIDE_PANEL_OPEN` `[VERIFIED: src/core/runtime/RuntimeEnvelope.ts:5-6]` vs
     `[CITED: PRODUCT_SPEC Appendix E]`. The prototype also carries five non-canonical literals
     (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION`, `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`,
     `PAGE_HTML_PAYLOAD`) that the file's own comments mark as scaffold-local.
   - *What's unclear:* the migration scope — the RENAME is cheap, but `BackgroundRouter` registers
     handlers by literal `[VERIFIED: src/core/messaging/BackgroundRouter.ts:38-52]` and
     `tests/background/*` asserts them.
   - *Recommendation:* rename to the canonical literals **and** move them into the Appendix-E-shaped
     `MessageType` object (`export const MessageType = {…} as const`) in the same plan that touches
     `RuntimeEnvelope`, keeping the scaffold-local five as a clearly separated second export until
     Phase 6/17 claim them. Success criterion 4 ("RuntimeEnvelope fixtures parse") is the natural
     home for the regression test.

## Environment Availability

Probed this session on the development machine.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | WXT 0.20 / Vite 8 / Vitest 3 | ✓ | v24.21.0 | — (no `engines` field or `.nvmrc` pin exists; consider adding one) |
| pnpm | `packageManager: pnpm@11.22.0` | ✓ | 11.22.0 | — (corepack not configured; `pnpm-workspace.yaml` exists only for `allowBuilds`) |
| npm | Registry verification, `npm view` | ✓ | 11.19.0 | — |
| git | D-04 inventory verification, `git grep` gates | ✓ | 2.54.0 | — |
| Google Chrome (desktop) | Manual evidence for Side Panel, Standalone, handoff, `Cmd+K`, `sidePanel.open()` gesture | ✓ | 152.0.7977.76 | — |
| Chromium (separate binary) | WXT's default `web-ext` runner | ✗ | — | `webExt: { disabled: true }` is already set `[VERIFIED: wxt.config.ts:4-6]`; load `.output/chrome-mv3` unpacked in Chrome manually. **No action needed.** |
| Playwright / Puppeteer | Automated browser evidence | ✗ | — | None installed and `TESTING.md` records "No Playwright/Puppeteer/WXT e2e setup". Phase 1's browser criteria are **manual Chrome evidence** per `nowpilot-phase-verification`. Do not add a browser-automation dependency in this phase without an explicit decision. |
| `@vitest/coverage-v8` | Coverage reporting | ✗ | — | No coverage requirement exists (`vitest.config.ts` has none). Do not add it — `TESTING.md` says "do not silently add it". |
| `@wxt-dev/module-react` | React Fast Refresh in WXT dev mode (post-migration) | ✗ | — | Install with `pnpm add -D @wxt-dev/module-react@^1.2.2` (legitimacy verdict OK). Fallback if refused: keep TSX compiling via esbuild but accept no React HMR, which weakens D-03. |

**Missing dependencies with no fallback:** none that block execution. The only hard prerequisite is
installing `@wxt-dev/module-react` (or explicitly deciding not to).

**Missing dependencies with fallback:** Chromium (use installed Chrome unpacked), Playwright
(manual evidence), coverage (not required).

## Validation Architecture

`workflow.nyquist_validation` is **absent** from `.planning/config.json` — that file does not exist
at all `[VERIFIED: probe — `ls .planning/*.json` → no matches]`, so per the workflow rule the
section is **enabled** and included.

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 3.2.7 (jsdom 25.0.1, `globals: true`) |
| Config file | `vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']` `[VERIFIED: vitest.config.ts:4-9]` |
| Quick run command | `npx vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` (the §24 Phase-1 minimum) |
| Full suite command | `npx vitest run` — baseline **18 files / 166 tests / 6.22 s, all green** `[VERIFIED: probe]` |
| Phase gate | `pnpm run verify:phase-1` (currently `tsc --noEmit && vitest run tests/core tests/background tests/components tests/isolation && bash scripts/verify-no-tailwind.sh` `[VERIFIED: package.json:18]`) |
| Typecheck | `npx tsc --noEmit` — baseline **exit 0** `[VERIFIED: probe]` |
| Build inspection | `pnpm run build:ext` then read `.output/chrome-mv3/manifest.json` (no automated test exists yet — that is a Wave 0 gap) |

**Baseline facts the planner should treat as the floor, not the target:** 166 tests currently pass,
so "tests are green" is not evidence of progress. Every new suite must be *added* to
`verify:phase-1`'s path list or it will not run in the gate.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| CORE-01 | Both surfaces render through WXT with one provider each | component | `npx vitest run tests/components/SidePanelShell.test.tsx tests/components/StandaloneShell.test.tsx` | ❌ Wave 0 |
| CORE-01 | Generated manifest is the authorised shape (permissions, side_panel, no `options_ui`) | build-inspection | `pnpm run build:ext && npx vitest run tests/isolation/generated-manifest.test.ts` | ❌ Wave 0 |
| CORE-01 | Background listeners attach synchronously on a cold SW | integration | `npx vitest run tests/background` (exists — extend for the canonical message-type rename) | ✅ (extend) |
| SP-02 | Side Panel → Standalone opens, focuses an existing tab, never duplicates | integration | `npx vitest run tests/core/workspace/WorkspaceRouter.test.ts` | ✅ (extend) |
| SP-02 | Cold-tab handshake: READY precedes transfer; ACK gates success | unit | `npx vitest run tests/core/workspace/WorkspaceHandoff.test.ts` | ❌ Wave 0 |
| SP-08 | `np_theme` written by exactly one writer, read by both surfaces | unit + integration | `npx vitest run tests/core/theme` (extend `ThemeSync.test.tsx` with a two-surface case) | ✅ (extend) |
| SP-08 | `Toggle theme` cycles Auto→Light→Dark and writes `np_theme` | unit | `npx vitest run tests/core/commands/registerWorkspaceCommands.test.ts` | ✅ (extend) |
| SP-09 / SA-09 | `Cmd+K` opens the palette on macOS **and** Windows/Linux | unit | `npx vitest run tests/core/input/KeymapRegistry.test.ts` | ❌ Wave 0 (directory does not exist) |
| SP-09 / SA-09 | Palette renders exactly the Phase-1 command set; `reload-extension` absent in production builds | component | `npx vitest run tests/components/CommandPalette.test.tsx` | ❌ Wave 0 |
| SA-08 | Onboarding appears when completion state is false/unknown/missing/schema-incompatible | component | `npx vitest run tests/components/OnboardingFlow.test.tsx` | ❌ Wave 0 |
| SA-08 | Fixture adapter conforms to `ProviderValidationPort`; no network; no SDK | unit | same suite, with `vi.spyOn(globalThis,'fetch')` | ❌ Wave 0 |
| SA-10 | `Focus Side Panel` calls `sidePanel.open()` inside the gesture stack | unit (mock) + **manual** | unit: `npx vitest run tests/core/commands`; manual: real Chrome evidence | ⚠️ manual gap |
| APPR-03 | No `themeMode` on the persisted preference blob | unit | `npx vitest run tests/core/store/useExtensionStore.test.ts` | ✅ (extend) |
| APPR-03 | Legacy raw-string `np_theme` migrates to the single representation | unit | `npx vitest run tests/core/theme/ThemeStore.test.ts` | ✅ (extend) |
| APPR-04 | `getAntdConfig({mode,pack,compact})` returns an object (never `undefined`) and correct algorithms | unit | `npx vitest run tests/core/theme/antdConfig.test.ts` | ❌ Wave 0 |
| APPR-04 | Mode change updates the provider theme without remount | component | same suite + a remount-spy assertion | ❌ Wave 0 |
| APPR-05 | Side Panel gets `compactAlgorithm`; Standalone does not | unit | `npx vitest run tests/core/theme/antdConfig.test.ts` | ❌ Wave 0 |
| FLOW-8 | Global keydown → handler → `preventDefault`; no ad-hoc listeners remain | unit + source-grep | `npx vitest run tests/core/input` + a grep assertion over `src/entrypoints` | ❌ Wave 0 |
| FLOW-9 | 4 steps render; validation states; Skip vs Finish semantics | component | `npx vitest run tests/components/OnboardingFlow.test.tsx` | ❌ Wave 0 |
| FLOW-10 | Palette filters, keyboard-navigates, zero-results state holds height | component | `npx vitest run tests/components/CommandPalette.test.tsx` | ❌ Wave 0 |
| FLOW-11 | URL carries only bootstrap ids; draft never in URL; secret never in URL or broadcast | unit | `npx vitest run tests/core/workspace/WorkspaceHandoff.test.ts` | ❌ Wave 0 |
| D-07 | Legacy plaintext cleanup: idempotent, redacted, metadata preserved | unit | `npx vitest run tests/core/storage/legacyCredentialCleanup.test.ts` | ❌ Wave 0 |
| D-07/D-08 | Sentinel secret absent from storage/serialised state/messages/logs/DOM | unit + component | `npx vitest run tests/core/storage tests/components/OnboardingFlow.test.tsx` | ❌ Wave 0 |
| D-11 | `WorkspaceState` shape, safe defaults, only authorised producers, validation rejects unknown fields | unit | `npx vitest run tests/core/workspace/WorkspaceState.test.ts` | ❌ Wave 0 |
| D-14 | No Phase-1 code writes `np_workspace` / `np_workspace_store` | unit (source-scan + store assertion) | `npx vitest run tests/core/workspace` | ✅ (extend) |
| D-16 | Every non-Phase-1 page carries `data-np-backing` `fixture` or `deferred`; no perpetual skeleton | component + DOM | `npx vitest run tests/components/pages` | ❌ Wave 0 |
| §24 | Banned imports zero: `innerHTML`/`dangerouslySetInnerHTML`, `tailwind`/`shadcn`/`@radix-ui`, `framer-motion` | source-grep gate | `bash scripts/verify-no-tailwind.sh` + a new grep gate for the other two patterns | ⚠️ partial (Tailwind only) |

### Sampling Rate

- **Per task commit:** the narrowest suite the task touches, plus `npx tsc --noEmit`. For the
  `srcDir` move plan specifically: `npx tsc --noEmit && npx vitest run && bash scripts/verify-no-tailwind.sh`.
- **Per wave merge:** `npx vitest run` (full 166+ suite) + `pnpm run build:ext` + manifest inspection.
- **Phase gate:** `pnpm run verify:phase-1` green, **plus** the freshly built extension loaded
  unpacked in real Chrome for the manual criteria (Side Panel opens, onboarding on fresh install,
  `Cmd+K` on both surfaces, Standalone handoff + focus-existing, theme applies to both surfaces with
  no reload, `Focus Side Panel` gesture). Recording the observed result is mandatory — the
  `nowpilot-phase-verification` skill forbids "a screenshot without an observed-result record".

### Wave 0 Gaps

- [ ] `tests/core/input/KeymapRegistry.test.ts` — covers FLOW-8/SP-09/SA-09; asserts the **macOS**
      `Cmd+K` case (Pitfall 2) and the `KEYMAP_CONFLICT` path. **The directory does not exist.**
- [ ] `tests/core/theme/antdConfig.test.ts` — covers APPR-04/APPR-05, including "never returns
      `undefined`" and the compact/default algorithm split.
- [ ] `tests/core/workspace/WorkspaceHandoff.test.ts` — the D-13 protocol: cold ready-before-transfer,
      warm path, duplicate request id, timeout, retry, ack gate, malformed URL params, unsupported
      schema version, invalid source/target, draft never in URL, secret never in the broadcast.
- [ ] `tests/core/workspace/WorkspaceState.test.ts` — D-11 shape, safe defaults, producer allowlist,
      inert later-phase fields, unknown-field rejection, no `np_workspace` write (D-14).
- [ ] `tests/core/storage/legacyCredentialCleanup.test.ts` — D-07 idempotence, redaction, metadata
      preservation, no relocation, sentinel absence.
- [ ] `tests/components/OnboardingFlow.test.tsx` — D-05/D-06/D-08 across both surface presentations.
- [ ] `tests/components/CommandPalette.test.tsx` — the pinned Phase-1 command set, zero-results, dev-only
      `reload-extension`, 12 px floor, token-derived selected-row background.
- [ ] `tests/components/DeferredNotice.test.tsx` + `tests/components/pages/*.test.tsx` — D-16
      presence/absence of `data-np-backing` and the no-perpetual-skeleton rule.
- [ ] `tests/isolation/generated-manifest.test.ts` — reads `.output/chrome-mv3/manifest.json`;
      the single highest-value gap (CONCERNS names it as the reason two defects shipped).
- [ ] A repo-level banned-import gate covering `innerHTML`/`dangerouslySetInnerHTML` and
      `framer-motion` (the Tailwind gate exists; the other two success-criterion-5 patterns have no
      script today).
- [ ] Update `tests/isolation/cross-entrypoint-imports.test.ts` and
      `tests/core/strict/np-strict-ceiling.test.ts` for the new `src/entrypoints` paths, and extend
      the isolation self-test so the new path cannot pass vacuously (Pitfall 6).
- [ ] Update `package.json` `verify:phase-1` to include every new suite (`tests/core/input`,
      the new component suites, `tests/isolation/generated-manifest.test.ts`) while keeping the §24
      minimum (`tests/core/runtime tests/core/events tests/core/workspace tests/core/theme`) and the
      existing `tests/background tests/components tests/isolation` sets.

## Security Domain

`security_enforcement` is not disabled (no `.planning/config.json` exists), so this section is
required. Phase 1 is a **security-substantive** phase: it deletes plaintext credentials, establishes
the trust boundaries every later phase inherits, and defines what may cross contexts.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V1 Architecture / Threat modelling | **yes** | Trust-boundary documentation lives in D-11/D-12/D-13/D-14; the responsibility map above records the tier ownership. Add the same table to the phase plan so the boundary cannot drift. |
| V2 Authentication | **no** (this phase) | No auth surface exists; D-05 forbids real provider auth. The **typed port** (`CredentialStorePort`) must exist with *no* Phase-1 implementation. |
| V3 Session Management | **no** (this phase) | `chrome.storage.session` is deliberately unused (A11). ServiceNow session tokens are Phase 17. |
| V4 Access Control | **partial** | The `data-np-backing` fixture/deferred marking is an *access-control claim* in UI form: D-16 requires that no fixture page invokes later-phase services and no deferred page has misleading enabled actions. Enforce with DOM presence/absence tests. |
| V5 Input Validation | **yes — primary** | Zod at every new boundary: URL bootstrap params (D-13), `WorkspaceState` (D-11), `HandoffEnvelope` payloads (D-13), and `chrome.storage.onChanged` values (Pitfall 1). `zod@4.4.3` is installed and currently unimported `[VERIFIED: probe]`. |
| V6 Cryptography | **no** (this phase) | AES-GCM / KeyVault are Phase 2 (D-07). Phase 1 must NOT introduce any crypto: no hashing, no fingerprints, no encryption of the removed values. |
| V7 Error handling & logging | **yes** | `debugLog('SCREAMING_SNAKE', …)` with canonical codes; the D-07 cleanup must log field **names** only. `PREVIEW`/`fixture` state must be excluded from production diagnostics and exports (D-16). |
| V8 Data protection | **yes** | The credential strip; the URL and BroadcastBus allowlists; "no fixture data reaches a persistent store" (D-16 hard rule 4). |
| V12 File / resource | **no** (this phase) | Filesystem sync is Phase 9. |
| V14 Configuration | **yes** | Manifest least privilege (A4) and the CSP decision (A5/Open Question 5). Both are asserted by the new manifest-inspection test. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| **Any same-origin extension page can publish on `np_workspace` and drive the handoff** (CONCERNS: "BroadcastChannel messages are unauthenticated") | Spoofing / Elevation | Validate `target`, `workspaceId`, `requestId` and `schemaVersion` on **every** received message before applying anything; fail closed; never apply a projection whose `workspaceId` differs from the URL bootstrap; add the D-13 negative tests ("invalid source/target surfaces rejected", "unsupported schema versions fail safely"). |
| **Plaintext API keys in `chrome.storage.local`** (the D-07 target; any code with the `storage` permission can read them) | Information disclosure | Delete in place; never copy/hash/relocate; assert sentinel absence across storage, serialised state, messages, logs and exports. |
| **Secret exfiltration through the URL or a broadcast** | Information disclosure | Two allowlists (URL bootstrap ids; BroadcastBus projection). Test that the composer draft is in the broadcast but never in the URL, and that a sentinel credential appears in neither. |
| **Secret in logs / diagnostics** | Information disclosure | `debugLog` field-name-only reports; no `console.*` of raw values; `CONCERNS.md` already flags the missing `TraceRedactor` as a repo-wide gap — Phase 1 must not add new logging of raw values. |
| **`innerHTML` / `dangerouslySetInnerHTML` XSS in a shell** | Tampering / Injection | Zero occurrences today `[VERIFIED: probe]`; add the grep gate so it stays zero (success criterion 5). Markdown rendering goes through `PortableMarkdown`/`XMarkdown` only. |
| **Message spoofing via `chrome.runtime.onMessage`** — any extension context can `sendMessage` | Spoofing | §16.2/Appendix E: `if (sender.id !== chrome.runtime.id) return false;` `[CITED: PRODUCT_SPEC Appendix E]`. The prototype's `MessageBus.init` registers the listener **without** the sender guard `[VERIFIED: src/core/messaging/MessageBus.ts:64-73]` and `isEnvelope` checks only four key names + type membership `[VERIFIED: src/core/runtime/RuntimeEnvelope.ts:70-79]`. Phase 1 should add the guard now — the `nowpilot-wxt-mv3` skill lists "Sender/source/target validation tests for message changes" as a required check. |
| **Malformed / oversized / version-skewed bootstrap params** | Tampering | Zod-validate and normalise every URL parameter; reject unknown/oversized/unsupported-version through one typed error (D-13). |
| **CSP that is broader than the phase needs** | Elevation | Open Question 5; assert the chosen CSP in the manifest test. |
| **Add-on/third-party code reaching workspace authority** | Elevation | Phase 1 registers zero add-ons; `AddonRegistry`/`StandalonePageRegistry` stay inert but contract-correct (D-01). The Sider Add-ons group must **not render** with zero registrations (UI-SPEC § zero-one-many). |

**Acceptance evidence the security review will ask for** (`nowpilot-security-review` skill): manifest
permission diff (before/after, in the manifest-inspection test), sender-validation test for any
message-path change, redaction test for the D-07 cleanup, sentinel-absence tests, and a statement of
which trust boundaries are *inactive* in Phase 1 (mirroring/election, provider runtime, MCP,
filesystem) so no UI claims them.

## Sources

### Primary (HIGH confidence — opened/run this session, quoted inline)

- In-repo source files, read directly and quoted verbatim with line ranges: `wxt.config.ts`,
  `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `.wxt/tsconfig.json`,
  `.wxt/types/paths.d.ts`, `.gitignore`, `package.json`, `scripts/verify-no-tailwind.sh`,
  `tests/setup.ts`, `tests/isolation/cross-entrypoint-imports.test.ts`,
  `src/core/runtime/RuntimeEnvelope.ts`, `src/core/runtime/BroadcastBus.ts`,
  `src/core/workspace/{WorkspaceStore,WorkspaceRouter}.ts`, `src/core/theme/{ThemeStore,ThemeSync,chromeStorageAdapter}.ts`,
  `src/core/input/KeymapRegistry.ts`, `src/core/commands/{CommandRegistry,registerWorkspaceCommands}.ts`,
  `src/core/messaging/{MessageBus,BackgroundRouter}.ts`, `src/core/i18n/strings.ts`,
  `src/components/ThemeProvider.tsx`, `src/components/common/{CommandPalette,MirrorBanner}.tsx`,
  `src/components/chat/SidepanelChat.tsx`, `src/store/useExtensionStore.ts`, `src/types/index.ts`,
  `src/theme/index.ts`, `entrypoints/{background,sidepanel/main,standalone/main}.ts*`.
- WXT 0.20.27 implementation source read directly:
  `node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs` (glob table + discovery mechanics).
- Generated build artifact: `.output/chrome-mv3/manifest.json`.
- Probes run this session: `npx vitest run` (18 files / 166 tests green), `npx tsc --noEmit` (exit 0),
  `bash scripts/verify-no-tailwind.sh` (exit 0), the `picomatch` entrypoint-glob probe,
  the `KeymapRegistry` matcher probe, `npm view` × 9, `gsd-tools query package-legitimacy check`,
  environment availability probes.
- Authoritative in-repo contracts: `01-CONTEXT.md`, `01-UI-SPEC.md` (Revision 2, approved),
  `.planning/product/PRODUCT_SPEC.md` (§0, §5, §6, §8, §9, §11, §17, §18, §20, §21, §24,
  Appendices B/C/E/F/G/M), `.planning/REQUIREMENTS.md`, `.planning/STATE.md`,
  `.planning/codebase/{ARCHITECTURE,CONVENTIONS,STRUCTURE,STACK,CONCERNS,INTEGRATIONS,TESTING}.md`,
  `.opencode/skills/nowpilot-{wxt-mv3,ant-design,security-review,spec-compliance,phase-verification,ui-ux-review,release-gate}/SKILL.md`.

### Secondary (MEDIUM confidence — official docs via Context7)

- `/websites/wxt_dev_guide` (WXT) — `srcDir` + `publicDir`/`modulesDir` configuration; entrypoint
  folder structure; "related files belong inside the entrypoint directory".
- `/ant-design/ant-design` (AntD) — `ThemeConfig` properties (`token`, `algorithm`, `components`,
  `cssVar`, `hashed`, `zeroRuntime`); `[darkAlgorithm, compactAlgorithm]` composition; nested-provider
  merge semantics; the "theme `undefined` → object remounts children" FAQ; dynamic themes via
  `ConfigProvider.theme`.

### Tertiary (LOW provider tier — official documentation via WebFetch)

- `developer.chrome.com/docs/extensions/reference/api/sidePanel` — `sidePanel.open()` gesture
  requirement, `setPanelBehavior`, `OpenOptions`, Chrome-version introductions.
- `developer.chrome.com/docs/extensions/reference/api/storage` — `local`/`sync`/`session` quotas and
  lifetimes, `onChanged` signature.
- `developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle` — SW termination
  timers, "persist data rather than using global variables", event-handler timing.
- `developer.chrome.com/docs/extensions/develop/concepts/service-workers/events` (consulted for the
  synchronous-registration rule stated in §5.2 and the `nowpilot-wxt-mv3` skill).

## Metadata

**Confidence breakdown**

- **Standard stack — HIGH for what is installed (read from `node_modules`), MEDIUM for what should
  be installed (Appendix G + registry):** every version in the Core table was verified against the
  registry and the installed tree this session; the one gap is the exact pinning policy (A8).
- **Architecture / migration mechanics — HIGH:** every claim about how the current code behaves, and
  about WXT's discovery rules, is either quoted from a file opened this session or backed by a paste
  probe. The `srcDir` mechanics are mechanical, not speculative.
- **Handoff protocol / theme rework / onboarding ports — MEDIUM:** the protocols are designed here
  against locked decisions (D-05…D-15) rather than copied from a reference implementation. The
  canonical "reference" (`Appendix M`) is explicitly **superseded for Phase 1** by D-13/D-14 and
  must not be implemented literally — it persists to `np_workspace`, broadcasts whole state and
  demotes the Side Panel to a mirror, all three of which Phase 1 forbids.
- **Pitfalls — HIGH for Pitfalls 1, 2, 3, 5, 6, 7 (each backed by a quoted file or a probe) and
  MEDIUM for Pitfalls 4 and 8** (Chrome gesture timing and dev-time version skew are behaviour
  claims that need a real browser to confirm).
- **Chrome-API claims — documentation-grade, not measurement-grade:** official docs were fetched
  via `webfetch`, whose seam tier is LOW. Treat side-panel gesture semantics and storage quota
  numbers as correct-but-reverify-on-device before they gate a plan.

**Research date:** 2026-09-21
**Valid until:** 2026-10-21 for the in-repo migration mechanics (they change only when the repo
does). **Re-verify within ~14 days** for: `wxt` (0.20.27 installed vs 0.21.4 published — a minor
bump may move entrypoint globs or `.wxt/` type generation), `antd` (6.5.2 installed vs 6.6.5
published) and the Chrome side-panel API (new methods landed in Chrome 140/141/142 and this machine
runs Chrome 152, so the docs trail the browser).

---

## Planner Handoff Checklist

Items this research cannot decide and the planner must surface (as `[ASSUMED]` confirmation
checkpoints or explicit decisions in the plan, never as silent defaults):

1. Content-script entrypoint path resolution (Open Question 1 / A2) — **blocks the manifest test.**
2. `standalone/` vs `app/` for the Standalone entrypoint directory (A3) — **blocks the move plan.**
3. `.dark`-class scope (Open Question 2) — **blocks the theme plan's definition of done.**
4. `schemaVersion` vs `version` vs `updatedAt` in `WorkspaceState` (Open Question 3) —
   **blocks the workspace plan.**
5. Exact-version pinning (A8) and CSP content (A5) — **block the config plan.**
6. Permission set: keep `['sidePanel','storage','tabs']` rather than Appendix G's eight (A4) —
   **must be stated explicitly so a spec-compliance review does not flag it.**
7. `Cmd+K` on macOS is the requirement (A7) — **blocks the keymap plan's tests.**
8. Handoff timeout/retry constants (A10) — fine to default, but name them as exported constants and
   pin them in tests rather than leaving magic numbers inline.

And the two artifacts that must exist before executable plans, per D-04:

- `01-MIGRATION-INVENTORY.md` — every prototype file classified KEEP/ADAPT/REPLACE/REMOVE with the
  D-04 column set, including the one-row-per-entrypoint rule and D-16's per-page disposition.
- A `verify:phase-1` composition that keeps the §24 minimum **and** every Wave 0 suite above
  (the agent's-discretion item "Verify script composition").
