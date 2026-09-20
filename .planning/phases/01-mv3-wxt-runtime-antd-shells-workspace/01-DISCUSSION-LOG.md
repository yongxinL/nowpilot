# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 1-MV3/WXT Runtime + AntD Shells + Workspace
**Areas discussed:** Prototype conversion, Onboarding depth, Cmd+K scope, Handoff scope

---

## Prototype conversion

| Option | Description | Selected |
|--------|-------------|----------|
| Convert in place | Keep working core modules, bring them up to the spec contract, delete/trim prototype UI outside Phase 1 scope. Smallest diff, tests already green. | ✓ |
| Rebuild per spec list | Implement the spec's Create list as new files by the spec's names/paths, porting behavior over. Cleaner traceability, much larger diff, more risk. | |
| Hybrid: core new, UI adapted | Rebuild core runtime/messaging/theme to spec names, keep prototype component composition. | |

**User's choice:** Convert in place, with canonical-contract validation — plus a detailed classification protocol (KEEP/ADAPT/REPLACE/REMOVE per module), canonical WXT structure adoption, rich-UI preservation rules, and a mandatory file-level migration inventory.

**Notes:**
- Canonical specs/ADRs override prototype names and behaviour; no parallel prototype + production implementations; temporary compatibility exports must be removed before acceptance unless documented.
- Preserve approved visuals/components/tokens/packs/fixtures/a11y states; do not delete NotesWorkspace/OptionsPage/Agent/Write/Tools presentation work merely because functionality belongs to later phases; keep later-phase services disconnected and mark fixture-backed/deferred functionality.
- Phase 1 must not implement later-phase persistence, provider runtime, MCP, memory, filesystem, extraction or production AI services.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep dev shell, adapt paths | Adapt Vite dev-shell entries to the new layout; keep as dev-only artifact. | |
| Drop dev shell (WXT only) | Delete `index.html`, `src/main.tsx`, dev-shell wiring and Vite-app-only scripts; WXT is the only runtime. | ✓ |
| You decide | Defer to the migration inventory classification pass. | |

**User's choice:** Drop the standalone Vite browser dev shell; WXT becomes the single authoritative application and development runtime.

**Notes:** Scripts become `pnpm dev` → WXT dev, `pnpm build` → WXT production build, `pnpm zip` → WXT packaging when authorised. Eight-step migration sequence (establish WXT entrypoints → port providers/theme/UI → verify both surfaces → fixture parity → redirect scripts → remove obsolete shell → verify no imports → verify bundle contains only authorised entrypoints). Fast iteration preserved via WXT HMR, fixtures, tests, browser automation, screenshot fixtures.

| Option | Description | Selected |
|--------|-------------|----------|
| Phase artifact, planner-owned | Committed `01-MIGRATION-INVENTORY.md`, produced before implementation plans. | ✓ |
| Inline in PLAN.md | Embed the inventory table inside the plan. | |
| You decide | Planner chooses the artifact shape. | |

**User's choice:** Committed planner-owned `01-MIGRATION-INVENTORY.md` as the authoritative conversion map.

**Notes:** Full column set mandated (current path, target canonical path, classification, responsibilities, reason, requirement IDs, governing contract, dependencies/consumers, required tests, migration steps, adapter removal timing, assigned plan, implementation + verification status). Verifier checks completeness, assignment, target paths, REMOVE exclusion from production builds, adapter owners, no unclassified prototype infrastructure. Classification changes during implementation must be recorded; material architecture changes need operator review.

---

## Onboarding depth

| Option | Description | Selected |
|--------|-------------|----------|
| Flow shell, no secrets | Full interaction shell with typed deferred validation; no secret persistence; fixture-backed. | ✓ |
| Functional validation now | Call providers directly and persist keys now; encrypt in Phase 2. Violates the AES-GCM key rule. | |
| Trigger + persona only | Only the entry trigger + persona card; provider/key/validate flow built later. | |

**User's choice:** Flow shell, no secrets.

**Notes:** Complete interaction shell (trigger → persona → provider → key entry → validating → success/failure → complete); typed deferred provider contract (`PROVIDER_RUNTIME_NOT_READY` / `PROVIDER_VALIDATION_DEFERRED` or existing canonical id); deterministic fixtures for success/invalid credential/provider unavailable/network unavailable/cancelled/unexpected failure; UI clearly labels fixture-backed Phase 1 behaviour; key stays component-memory only; Phase 2 owns KeyVault/AES-GCM; Phase 3 owns Requester/ProviderRouter/real validation.

| Option | Description | Selected |
|--------|-------------|----------|
| Both surfaces, Side Panel first | Shared flow in both surfaces; Side Panel preferred; Standalone supports the same flow. | ✓ |
| Side Panel only | Side Panel auto-shows on fresh install; Standalone links later. | |
| Standalone only | Only Standalone exposes onboarding per SA-08 wording. | |

**User's choice:** Present the shared onboarding shell in both surfaces, with no automatic surface opening after install.

**Notes:** One shared surface-independent flow controller (e.g. `src/components/onboarding/OnboardingFlow.tsx`) with typed ports; no surface-to-surface imports; no Chrome APIs in the shared module; Side Panel compact layout with "Switch to Full setup"; Standalone same steps/state machine/copy; concurrent surfaces prevent duplicate flows and synchronise only non-secret status; re-entry from setup affordance, Settings/AI access, typed provider-not-configured action.

| Option | Description | Selected |
|--------|-------------|----------|
| Strip secrets now | Classify credential path ADAPT/REPLACE; strip `apiKey` from persisted schemas; safe migration removes legacy plaintext. | ✓ |
| Defer to Phase 2 | Leave prototype persistence as-is; fix when KeyVault lands. Ships a plaintext-key window. | |

**User's choice:** Strip secrets now.

**Notes:** Non-secret metadata only persisted; separate `PersistedProviderConfig` / `TransientCredentialInput` / `CredentialStorePort` (Phase 2) / `ProviderValidationPort` (Phase 3) types; idempotent legacy plaintext cleanup with redacted result logging and a neutral re-entry notice; sentinel-value tests only; repository/bundle scans prove no active plaintext persistence path.

---

## Cmd+K scope

| Option | Description | Selected |
|--------|-------------|----------|
| Shell/navigation set only | Palette renders `CommandRegistry`; Phase 1 registers shell/navigation commands; later phases add theirs. | ✓ |
| Add chat-shell commands | Also register New chat / Open chat history as typed stubs. | |
| Full set with placeholders | Full advertised Flow-10 list with disabled later-phase entries. | |

**User's choice:** Shell/navigation set only.

**Notes:** Open Standalone view (both surfaces), Focus Side Panel (Standalone-only per DEC-OP-01), Open Options, Toggle theme. Cmd+K binding must move to `KeymapRegistry` (FLOW-8); ad-hoc window keydown listeners in both entrypoint mains are removed.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep, explicit-only | Keep `reload-extension` in both surfaces, explicit-only, no partial-match auto-run. | |
| Dev-only | Exclude from production palette; expose only in dev builds. | ✓ |
| Remove | Drop entirely. | |

**User's choice:** Dev-only.

**Notes:** Never reachable by production users; never auto-run on partial match.

---

## Handoff scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full canonical shape now | Freeze §8.4 `WorkspaceState` with later-phase fields typed + inert. | ✓ |
| Prototype subset only | Migrate current prototype fields; add §8.4 fields when their phases land. | |

**User's choice:** Freeze the full canonical §8.4 contract in Phase 1 with later-phase fields typed, safely defaulted, inert and producer-free.

**Notes:** `schemaVersion` added; `activeProvider`/`selectedModel` are resolved runtime metadata (workflow → tier → provider → model later), default `null`, no UI writes them, no raw model selector; Phase 1 producers limited to `schemaVersion`, `workspaceId`, fixture-backed `conversationId`, `activeSurface`, `openedStandaloneTabId`, approved handoff metadata; validate at every boundary; explicit allowlist for persistence/broadcast (never the complete state object); writer ownership: UI surfaces are writers, background serialises identity/epoch only, stale-writer mutations fail closed.

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror contract now | Implement Flow 11 demotion + `MirrorBanner` + refocus handback now. | |
| Defer mirror to Phase 2 | Phase 1 does open/focus/dedupe/handoff; mirror + election + persistence in Phase 2. | ✓ |

**User's choice:** Defer active read-only mirroring to Phase 2.

**Notes:** Freeze typed writer-state/mirror contracts but keep them inactive; Phase 1 adapter must not fabricate election success, epoch, writer identity, persistence ack, demotion or mirroring; `MirrorBanner` preserved as an unmounted typed component with fixtures, no Chrome/BroadcastBus/WorkspaceStore dependency; UI must not claim a boundary the runtime cannot enforce.

| Option | Description | Selected |
|--------|-------------|----------|
| URL + BroadcastBus only | URL bootstrap ids + validated ready/transfer/ack handshake; no persistence. | ✓ |
| Add storage persistence now | Also write `WorkspaceState` to `chrome.storage.local` now. Crosses Phase 2 ownership. | |

**User's choice:** URL bootstrap identifiers + validated BroadcastBus ready/transfer/acknowledgement handshake; no `WorkspaceState` persistence in Phase 1.

**Notes:** URL carries only workspaceId/conversationId/route/request-id/schema-version; draft travels only via ephemeral BroadcastBus; eight-step cold-tab protocol with bounded timeout/retry, idempotent duplicate handling, typed recoverable failures, no success without acknowledgement; existing tab focused with workspace/schema verification; Phase 2 owns `np_workspace`, election, epochs, mirror activation, restart restoration.

---

## the agent's Discretion

- Inventory table formatting, plan row cross-referencing and status-update mechanics.
- Concrete fixture/deferred marking convention (consistent, greppable, non-misleading).
- `verify:phase-1` composition (keep green; align toward §24 minimum while retaining phase-owned suites).
- Test file placement for new suites (follow `tests/<area>/` mirroring).
- Message-type naming for new envelope types (reuse canonical literals where defined).
- Surface shell routing internals within the design system.

## Deferred Ideas

- Read-only mirror activation + writer election → Phase 2.
- Durable `WorkspaceState` persistence (`np_workspace`) → Phase 2.
- Real provider validation/runtime → Phase 3.
- Secure credential persistence (KeyVault) + credential re-entry UX → Phase 2.
- Chat/notes/tools/diagnostics palette commands → Phases 15/11/18.
- Theme pack selector UI → Phase 15.
- Persona runtime beyond the Phase 1 onboarding shell → Phase 3/15.
- Full Options/Notes/Agent/Write/Tools functionality → Phases 15/17.
- Browser-only preview harness (only if later justified) — constrained per D-03.
