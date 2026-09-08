# NowPilot Decisions

## Purpose

This file records concise, ratified implementation decisions needed across agent sessions. The detailed rationale remains in §23 and other decision sections of `.planning/PRODUCT_SPEC_v0_1.md`.

## Decision Status

- `Ratified`: binding unless superseded by a later ratified decision.
- `Proposed`: not binding and must not be implemented as canonical.
- `Superseded`: retained for history but no longer active.

## Ratified Decisions

### DEC-001: Development harness neutrality

- **Status:** Ratified
- **Decision:** Codex, OpenCode, other repository-aware agents and human developers may implement the project. GSD is optional and is not a product dependency.
- **Execution record:** Git, tests, verification scripts and `.planning/` artefacts are authoritative.

### DEC-002: Cost-effective implementation-agent strategy

- **Status:** Ratified
- **Decision:** Cost-effective models may discuss, plan, execute and verify normal phase work when given bounded context and deterministic tasks.
- **Guardrail:** Modules marked `@implementation-tier: advanced` must be stubbed exactly as specified or explicitly routed to a stronger model.
- **Guardrail:** Use separate contexts for discussion, planning, execution and verification. Do not ask a small model to process the entire product specification for every task.

### DEC-003: v0.1 UI system

- **Status:** Ratified
- **Decision:** Use Ant Design v6 on extension-owned surfaces and Ant Design X 2.x presentation components for conversational UI.
- **Excluded:** `@ant-design/x-sdk`, `@ant-design/x-card`, Tailwind CSS, shadcn/ui and Radix UI in v0.1 extension-owned surfaces.

### DEC-004: Surface ownership

- **Status:** Ratified
- **Decision:** Side Panel is Chat only. Standalone owns Chat, Agent, Notes, Write, TeamGQM and Options.
- **Handoff:** Side Panel Chat may invoke registered skills or hand off to the applicable Standalone page.

### DEC-005: Canonical Standalone paths

- **Status:** Ratified
- **Decision:** Use `src/entrypoints/standalone/` and `src/components/standalone/`.
- **Excluded:** Do not create parallel `src/entrypoints/app/` or `src/components/app/` trees.

### DEC-006: Host-page isolation

- **Status:** Ratified
- **Decision:** Content scripts are extraction-only in v0.1. No host-page UI, Shadow DOM UI, trusted-event automation or field write-back.
- **Deferred:** Future injected UI requires a separately ratified addendum.

### DEC-007: AI runtime

- **Status:** Ratified
- **Decision:** Use the bounded Planner → Executor → Renderer runtime with ContextOptimizer and operator-configured `fast` and `balanced` runtime tiers.
- **Guardrail:** The runtime tier names are product contracts and must not be renamed to vendor model families.

### DEC-008: Agent platform

- **Status:** Ratified
- **Decision:** Single-agent execution is the default one-role CollaborationPlan. Multi-role collaboration is bounded, explicitly activated and uses the same coordinator, tool, memory, evaluation and security model.

### DEC-009: Knowledge architecture

- **Status:** Ratified
- **Decision:** Use atomic notes, UUID identity, wikilinks, tags, path-based categories, MiniSearch and one-way app-to-filesystem backup with additive restore.
- **Boundary:** Notes may feed memory through governed extraction. Memory does not automatically write notes.

### DEC-010: Verification and completion

- **Status:** Ratified
- **Decision:** A phase is complete only after:
  1. Verification passes (`verify:phase-N` exits 0).
  2. The verified implementation SHA is recorded.
  3. The evidence-only SHA is recorded.
  4. The implementation commit and the evidence commit are merged into the canonical integration branch.
- **Status before merge:** `Verified, awaiting merge`.
- **Guardrail:** Any subsequent code change invalidates the prior verification.
- **Merge guardrail:** If the merged application tree differs from the verified implementation tree, re-run `verify:phase-1` against the merged result.

### DEC-011: Canonical planning directory

- **Status:** Ratified
- **Decision:** All NowPilot product specifications, planning artefacts, operator prompts, phase records, ADRs and verification attachments live under `.planning/`.
- **Exception:** `AGENTS.md` remains at the repository root so repository-aware coding agents can discover the project instructions.
- **Canonical paths:**
  - `.planning/PRODUCT_SPEC_v0_1.md`
  - `.planning/STATUS.md`
  - `.planning/ROADMAP.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/DECISIONS.md`
  - `.planning/prompts/`
  - `.planning/phases/`
  - `.planning/adr/`
  - `.planning/evidence/`
- **Guardrail:** Do not create parallel copies under `.project/`, `docs/`, `prompts/`, or the repository root.
- **Migration rule:** Every path move must update all inbound references in the same commit.

### DEC-012: Branch strategy — start fresh on sapphire

- **Status:** Ratified
- **Phase:** Phase 1
- **Context:** The `sapphire` branch has only planning documents. The `alaska` branch already has Phases 1–10 implemented and verified. Starting Phase 1 on `sapphire` without merging `alaska` means prior implementation work is ignored.
- **Decision:** Begin Phase 1 implementation on `sapphire` as a fresh start. Do not merge or reuse code from `alaska`. The `alaska` branch is retained for reference but is not the active implementation branch.
- **Consequences:** All Phase 1–19 files are created from scratch on `sapphire`. ~112k lines of verified implementation on `alaska` will not be carried forward. No conflict with existing code since none exists on `sapphire`.

### DEC-013: Command registry, keymap registry, shared palette + content-script entrypoint

- **Status:** Ratified
- **Phase:** Phase 1
- **Context:** The product specification defines `KeymapRegistry` (Appendix C), `SlashCommandRegistry` (§14.2), and Flow 10 (§17) but does not assign canonical paths for the command registry, keymap registry, or command palette surface. The Phase 1 create list (§18) and directory tree (§8) omit them. Without explicit paths, implementers may duplicate palette UI per surface or blur registry responsibilities. Additionally, older spec references listed `src/entrypoints/content/core.content.ts` but WXT auto-discovers from `src/entrypoints/` with `srcDir: 'src'` — the canonical path must be `src/entrypoints/core.content.ts`.
- **Decision:**
  - **Command registry:** `src/core/commands/CommandRegistry.ts`
  - **Keymap registry:** `src/core/input/KeymapRegistry.ts`
  - **Shared palette:** `src/components/CommandPalette.tsx`
  - **Content script:** `src/entrypoints/core.content.ts` with `defineContentScript({ matches: ['<all_urls>'], runAt: 'document_idle', world: 'ISOLATED' })`. `srcDir: 'src'` in `wxt.config.ts`.
- **Responsibility boundaries:**
  - `CommandRegistry` owns command IDs, labels, availability and handlers.
  - `KeymapRegistry` maps keyboard combinations to command IDs.
  - `CommandPalette` reads visible commands from `CommandRegistry`.
  - `KeymapRegistry` must not own or register command definitions.
- **Integration contract:** `CommandPalette` receives no props; it reads visible commands from `CommandRegistry`. Each shell mounts `<CommandPalette />` in its overlay layer. Cmd+K is registered in `KeymapRegistry` with `when: 'always'`. Minimum Flow 10 command set: Open Standalone view, Focus Side Panel, Open Options. Renders as AntD Modal with Input + filtered list (Flow 10, §17).
- **Required tests:**
  - `tests/core/commands/CommandRegistry.test.ts` — verifies command registration, lookup, availability, handler invocation.
  - `tests/core/input/KeymapRegistry.test.ts` — verifies combo registration, combo-to-command resolution, `when` clause evaluation.
  - `tests/components/CommandPalette.test.tsx` — verifies render, Cmd+K trigger, command list, selection.
- **Content-script supersession:** This decision supersedes all active references to `src/entrypoints/content/core.content.ts`. The sole canonical content-script path is `src/entrypoints/core.content.ts`. Update every inbound reference in the same commit.
- **Additional test paths:**
  - `tests/isolation/no-content-script-ui.test.ts` — greps `src/entrypoints/core.content.ts` bundle for banned imports.
- **Consequences:** One palette component serves both surfaces. Command and keymap concerns are separated into distinct registries with strict ownership. Content script path is flat under `src/entrypoints/`. No `src/entrypoints/content/` directory.

### DEC-014: Phase 1 command IDs

- **Status:** Ratified
- **Phase:** Phase 1
- **Context:** DEC-013 specifies the minimum Flow 10 command set ("Open Standalone view", "Focus Side Panel", "Open Options") and assigns command-ID ownership to `CommandRegistry`, but does not define canonical string IDs. The product specification Flow 10 (§11) also defines only human-facing labels. Implementer-chosen IDs (`open-standalone`, `focus-side-panel`, `open-options`) are used consistently across `CommandRegistry`, `KeymapRegistry`, and `CommandPalette`.
- **Decision:** Ratify the following canonical command IDs for the minimum Flow 10 set:
  - `open-standalone` — opens or focuses the Standalone view (handler: `WorkspaceRouter.openStandalone()`)
  - `focus-side-panel` — opens the Side Panel for the current tab (handler: `WorkspaceRouter.focusSidePanel()`)
  - `open-options` — opens the Options page in the Standalone view (handler: `WorkspaceRouter.openStandalone({ page: 'options' })`)
- **ID convention:** kebab-case verb-namespace. Future command IDs follow the same convention.
- **Consequences:** `CommandRegistry.ts`, `KeymapRegistry.ts`, `CommandPalette.tsx` are consistent with ratified IDs. No change to runtime behaviour.

### DEC-015: Phase 1 internal error codes

- **Status:** Ratified
- **Phase:** Phase 1
- **Context:** §0.3 requires every catch block to call `debugLog(code, …)` with a canonical error code from Appendix C.2. Two Phase 1 catch paths have no applicable C.2 code: (a) `EventBus.emit()` wrapping a handler that throws, and (b) `BackgroundRouter` default branch for valid-but-unhandled `MessageTypeValues`. The C.2 registry has no "internal event failure" or "unhandled message" code.
- **Decision:** Add the following two codes to the canonical error-code registry (Appendix C.2, under a new "Internal / runtime" group):
  - `EVENT_BUS_HANDLER_FAILED` — an EventBus subscriber handler threw during `emit`. The failing handler is isolated; other subscribers still run.
  - `UNHANDLED_MESSAGE` — a `RuntimeEnvelope` with a valid `MessageTypeValue` reached `BackgroundRouter.dispatch()` but no case handled it. Distinct from the register guard rejecting unknown types (which returns `false` and no response).
- **Consequences:** `EventBus.ts` and `background.ts` now use canonical codes. Appendix C.2 grows from 33 to 35 codes.

### DEC-016: WXT manualChunks compatibility deviation

- **Status:** Ratified
- **Phase:** Phase 1
- **Context:** Appendix G specifies `output.manualChunks` in `wxt.config.ts`. WXT 0.21 builds content-script/unlisted entrypoints as IIFE, which forces `output.inlineDynamicImports`. Rollup rejects `manualChunks` combined with `inlineDynamicImports` (`Invalid value for option "output.manualChunks"`). The manualChunks config also produced a circular-chunk warning (`ant-icons -> antd -> ant-icons`).
- **Decision:** Remove `manualChunks` from `wxt.config.ts`. Retain `target: 'chrome120'` and `sourcemap: 'inline'` from Appendix G. Manual chunking is a non-functional build optimization; its removal affects bundle layout only. Chunking may be revisited if a WXT 0.21-compatible approach is found.
- **Consequences:** `wxt.config.ts` deviates from Appendix G by omission of `manualChunks`. `antd` bundle is larger (~5.2 MB) as a single chunk. No runtime behaviour change.

## Open Decisions

None recorded. A phase discussion may add a proposed decision only when the product specification and repository evidence do not already determine the answer.

## Decision Template

    ### DEC-XXX: Title

    - **Status:** Proposed | Ratified | Superseded
    - **Phase:** Phase N
    - **Context:** Exact ambiguity or conflict.
    - **Decision:** Exact binding contract.
    - **Consequences:** Files, tests and behaviours affected.
    - **Supersedes:** DEC-XXX, if applicable.
