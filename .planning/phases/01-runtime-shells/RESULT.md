# Phase 1 — Execution Result

## Status

- **Tasks attempted:** T1–T19
- **Tasks completed:** T19
- **Implementation commits:** Complete
- **T20:** Ready
- **T21:** Not started
- **Phase status:** Implementation committed, awaiting independent verification
- **Branch:** `sapphire`
- **Execution date:** 2026-09-08
- **Final application commit SHA:** `7da04855add36769001a1a83bd82021b2151ee5b`
- **Candidate verification SHA:** `7da04855add36769001a1a83bd82021b2151ee5b`
- **Verified SHA:** Not yet recorded

## Task Completion

| Task | Scope | State |
|---:|---|---|
| T1 | Project scaffold + toolchain | Done |
| T2 | Background SW + runtime messaging | Done |
| T3 | Extraction-only content script | Done |
| T4 | Theme system | Done |
| T5 | Side Panel shell | Done |
| T6 | Standalone shell | Done |
| T7 | Workspace state/routing | Done |
| T8 | Messaging/events/registries | Done |
| T9 | Command/keymap/palette | Done |
| T10 | Onboarding shell | Done |
| T11 | Cross-surface handoff | Done |
| T12 | Test setup | Done |
| T13 | Runtime tests | Done |
| T14 | Workspace/theme tests | Done |
| T15 | Messaging/registry/input tests | Done |
| T16 | Event bus + isolation tests | Done |
| T17 | Component render tests | Done |
| T18 | Security grep scripts | Done |
| T19 | Onboarding secret-handling test | Done |

## Task-to-Commit Mapping

| Commit | Message | Tasks | Focused check | Result |
|---|---|---|---|---|
| `3fc3cd8` | `docs(01): ratify Phase 1 command IDs and error codes` | — | — | Planning only |
| `e782f74` | `docs(01): update Phase 1 visual evidence contract` | — | — | Planning only |
| `186afdb` | `chore(01): initialise WXT toolchain` | T1 | `pnpm install` + `tsc --noEmit` | pass |
| `9d48243` | `feat(01): add typed runtime messaging and workspace` | T2, T7, T11, T13, T14 | `tsc --noEmit` | pass |
| `3cb0d27` | `feat(01): add extraction-only content entrypoint` | T3, T16 (isolation) | `tsc --noEmit` | pass |
| `5662ccd` | `feat(01): add synchronised theme infrastructure` | T4, T14 | `tsc --noEmit` | pass |
| `be5843d` | `feat(01): add messaging events and registries` | T8, T15, T16 | `tsc --noEmit` | pass |
| `22cfd31` | `feat(01): add command registry and shared palette` | T9, T15, T17 | `tsc --noEmit` | pass |
| `fc9d97e` | `feat(01): add Chat-only Side Panel shell` | T5, T17 | `tsc --noEmit` | pass |
| `35c6cd1` | `feat(01): add Standalone workspace shell` | T6, T17 | `tsc --noEmit` | pass |
| `2c8b8f6` | `feat(01): add onboarding shell safeguards` | T10, T17, T19 | `tsc --noEmit` | pass |
| `7da0485` | `test(01): add Phase 1 isolation and security gates` | T12, T18, remaining | `vitest run` | 18 files, 53 tests passed |

**Grouping rationale:** T2+T7+T11 combined because they share `background.ts` — the background router, workspace store, and handoff message types are mutually dependent. T13-T19 tests co-located with their implementation per the atomic commit protocol. T12 (test setup) included in the final test commit because `tests/setup.ts` is a prerequisite for all test files.

## Files Created, Modified and Deleted

### Config / toolchain (created)
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `wxt.config.ts`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

### Source (created)
- `src/entrypoints/background.ts`
- `src/entrypoints/core.content.ts`
- `src/entrypoints/sidepanel/index.html`
- `src/entrypoints/sidepanel/main.tsx`
- `src/entrypoints/standalone/index.html`
- `src/entrypoints/standalone/main.tsx`
- `src/core/ai/types.ts`
- `src/core/commands/CommandRegistry.ts`
- `src/core/components/ErrorBoundary.tsx`
- `src/core/components/PortableMarkdown.tsx`
- `src/core/content/PageContext.ts`
- `src/core/events/EventBus.ts`
- `src/core/i18n/strings.ts`
- `src/core/input/KeymapRegistry.ts`
- `src/core/log/debugLog.ts`
- `src/core/messaging/MessageBus.ts`
- `src/core/prompts/index.ts`
- `src/core/prompts/types.ts`
- `src/core/registry/AddonRegistry.ts`
- `src/core/registry/AddonSettingsStore.ts`
- `src/core/registry/Registry.ts`
- `src/core/registry/SidePanelPageRegistry.ts`
- `src/core/registry/StandalonePageRegistry.ts`
- `src/core/runtime/BroadcastBus.ts`
- `src/core/runtime/MessageType.ts`
- `src/core/runtime/OperationId.ts`
- `src/core/runtime/PortReader.ts`
- `src/core/runtime/RuntimeEnvelope.ts`
- `src/core/runtime/workerState.ts`
- `src/core/theme/ThemeStore.ts`
- `src/core/theme/antdConfig.ts`
- `src/core/workspace/WorkspaceRouter.ts`
- `src/core/workspace/WorkspaceStore.ts`
- `src/core/workspace/WorkspaceSync.ts`
- `src/components/CommandPalette.tsx`
- `src/components/OnboardingModal.tsx`
- `src/components/pages/AgentPage.tsx`
- `src/components/pages/ChatPage.tsx`
- `src/components/pages/NotesPage.tsx`
- `src/components/pages/OptionsPage.tsx`
- `src/components/sidepanel/SidePanelRouter.tsx`
- `src/components/sidepanel/SidePanelShell.tsx`
- `src/components/standalone/StandaloneRouter.tsx`
- `src/components/standalone/StandaloneShell.tsx`
- `src/types/addon.ts`

### Tests (created)
- `tests/setup.ts`
- `tests/core/runtime/RuntimeEnvelope.test.ts`
- `tests/core/runtime/OperationId.test.ts`
- `tests/core/runtime/BroadcastBus.test.ts`
- `tests/core/runtime/PortReader.test.ts`
- `tests/core/workspace/WorkspaceStore.test.ts`
- `tests/core/workspace/WorkspaceRouter.test.ts`
- `tests/core/theme/ThemeStore.test.ts`
- `tests/core/messaging/MessageBus.test.ts`
- `tests/core/registry/Registry.test.ts`
- `tests/core/registry/PageRegistry.test.ts`
- `tests/core/commands/CommandRegistry.test.ts`
- `tests/core/input/KeymapRegistry.test.ts`
- `tests/core/events/EventBus.test.ts`
- `tests/isolation/no-content-script-ui.test.ts`
- `tests/components/sidepanel/SidePanelShell.test.tsx`
- `tests/components/standalone/StandaloneShell.test.tsx`
- `tests/components/CommandPalette.test.tsx`
- `tests/components/OnboardingModal.test.tsx`

### Scripts (created)
- `scripts/verify-no-tailwind.sh`
- `scripts/verify-no-framer-motion.sh`
- `scripts/verify-no-dangerous-html.sh`

### Deleted
- `package-lock.json` (stale npm lockfile; replaced by `pnpm-lock.yaml`)

## Execution-Time Smoke Checks

These checks demonstrate execution readiness only. T20 must rerun the complete
`pnpm run verify:phase-1` command against the recorded candidate verification
SHA in a separate verification context.

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` | pass (exit 0) |
| `pnpm exec vitest run` | 18 files passed, 53 tests passed |
| `bash scripts/verify-no-tailwind.sh` | pass |
| `bash scripts/verify-no-framer-motion.sh` | pass |
| `bash scripts/verify-no-dangerous-html.sh` | pass |
| `pnpm run build:ext` | pass (WXT 0.21.4 builds `background`, `sidepanel`, `standalone`, `content-scripts/core.js`) |

### verify:phase-1 command

```
tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace
tests/core/theme tests/core/messaging tests/core/registry tests/core/commands
tests/core/input tests/components/sidepanel tests/components/standalone
tests/components/CommandPalette.test.tsx tests/components/OnboardingModal.test.tsx
tests/isolation && bash scripts/verify-no-tailwind.sh && bash scripts/verify-no-framer-motion.sh
&& bash scripts/verify-no-dangerous-html.sh && pnpm run build:ext
```

Local assembly result: **exit 0**.

## Canonical Contract Reconciliation

### Command IDs

| ID | Status | Source | Reconciliation commit |
|---|---|---|---|
| `open-standalone` | Ratified canonical | DEC-014 in `.planning/DECISIONS.md` | `3fc3cd8` |
| `focus-side-panel` | Ratified canonical | DEC-014 in `.planning/DECISIONS.md` | `3fc3cd8` |
| `open-options` | Ratified canonical | DEC-014 in `.planning/DECISIONS.md` | `3fc3cd8` |

DEC-013 specified the command set but not the string IDs. DEC-014 ratifies the implementer-chosen IDs as canonical. No product-spec change required.

### Error Codes

| Code | Status | Source | Reconciliation commit |
|---|---|---|---|
| `EVENT_BUS_HANDLER_FAILED` | Added to canonical registry | DEC-015 + Appendix C.2 amendment in `.planning/PRODUCT_SPEC_v0_1.md` | `3fc3cd8` |
| `UNHANDLED_MESSAGE` | Added to canonical registry | DEC-015 + Appendix C.2 amendment in `.planning/PRODUCT_SPEC_v0_1.md` | `3fc3cd8` |

Appendix C.2 grew from 33 to 35 codes. Both codes are now present in the canonical error-code registry under a new "Internal / runtime" group.

### WXT Version

| Aspect | Value |
|---|---|
| Installed WXT version | `0.21.4` (from lockfile) |
| `package.json` constraint | `"wxt": "^0.21"` |
| `@wxt-dev/module-react` constraint | `"@wxt-dev/module-react": "^1"` |
| Product specification (§7.1) | `^0.21 (≥ 0.21.4)` |
| Ratified ADR | None (no ADR directory exists) |
| Compatibility | **Compatible** — installed version satisfies spec constraint |

**Note:** PLAN.md line 760 still references "WXT 0.20" as a compatibility risk. This is a stale planning reference; the actual implementation uses WXT 0.21.4 which is the canonical version per §7.1. The PLAN.md correction is included in the uncommitted planning changes.

## Deviations from Plan

| Deviation | Files | Authority | Commit | Classification |
|---|---|---|---|---|
| `manualChunks` removed from `wxt.config.ts` | `wxt.config.ts` | DEC-016 | `186afdb` | Ratified |
| Only Phase 1 dependencies installed (not full §7 stack) | `package.json` | §7 (subset for Phase 1) | `186afdb` | Implementation-compatible |
| `pnpm-workspace.yaml` created | `pnpm-workspace.yaml` | pnpm 11 build approval requirement | `186afdb` | Implementation-compatible |
| Additive Zod schemas in `RuntimeEnvelope.ts` | `src/core/runtime/RuntimeEnvelope.ts` | §0.3 (Zod schema per boundary) | `9d48243` | Implementation-compatible |
| Canonical type homes created (`ProviderId`, `PageContext`, `Addon`) | `src/core/ai/types.ts`, `src/core/content/PageContext.ts`, `src/types/addon.ts` | §C.1/§8.5 canonical paths | `9d48243` | Implementation-compatible |
| `Addon` type is Phase-1 subset (no `contextExtractor`/`skills`) | `src/types/addon.ts` | Phase 6/17 deferred | `9d48243` | Implementation-compatible |
| Security grep scripts use dependency-key check | `scripts/verify-no-tailwind.sh`, `scripts/verify-no-framer-motion.sh` | Avoids false-positive on script name | `7da0485` | Implementation-compatible |
| `vitest.config.ts` sets `resolve.mainFields: ['module', 'main']` | `vitest.config.ts` | vitest-chrome@0.1.0 CJS/vitest 3 incompatibility | `186afdb` | Implementation-compatible |
| ThemeStore extends Appendix F.1 with chrome.storage.sync + onChanged | `src/core/theme/ThemeStore.ts` | §17.1a APPR-03/04 | `5662ccd` | Implementation-compatible |
| Flow 10 command IDs chosen by implementer | `src/core/commands/CommandRegistry.ts` | DEC-014 (ratified) | `3fc3cd8`, `22cfd31` | Ratified |
| Content script is minimal extraction-only stub | `src/entrypoints/core.content.ts` | Phase 6 deferred | `3cb0d27` | Implementation-compatible |
| `EventBus` catch uses `EVENT_BUS_HANDLER_FAILED` | `src/core/events/EventBus.ts` | DEC-015 (ratified) | `3fc3cd8`, `be5843d` | Ratified |
| `BackgroundRouter` default uses `UNHANDLED_MESSAGE` | `src/entrypoints/background.ts` | DEC-015 (ratified) | `3fc3cd8`, `9d48243` | Ratified |
| WXT version is 0.21.4 (plan risk section mentioned 0.20) | `package.json` | §7.1 (`^0.21 ≥ 0.21.4`) | `186afdb` | Ratified (DEC-016) |

## Known Issues

- **jsdom + antd stderr noise.** Shell component tests emit `Not implemented: window.getComputedStyle(elt, pseudoElt)` (jsdom limitation) and `act(...)` warnings. Non-fatal; all tests pass. No production code affected.
- **antd bundle chunk is large (~5.2 MB)** because `manualChunks` was removed. Expected for Phase 1; chunking can be revisited if a WXT-compatible approach is found.
- **`package.json` contains the word "tailwind"** only inside the `verify:phase-1` script name; the `verify-no-tailwind.sh` dependency-key check does not false-positive.

## Pre-Verification Git State

- **Final application commit SHA:** `7da04855add36769001a1a83bd82021b2151ee5b`
- **Current HEAD:** `7da04855add36769001a1a83bd82021b2151ee5b`
- **Candidate verification SHA:** `7da04855add36769001a1a83bd82021b2151ee5b`
- **Uncommitted application changes:** None
- **Uncommitted test changes:** None
- **Uncommitted script/configuration changes:** None
- **Uncommitted planning changes:** `AGENTS.md`, `.planning/phases/01-runtime-shells/PLAN.md`
- **Untracked files:** `.planning/phases/01-runtime-shells/RESULT.md`
- **Working tree clean:** No (documentation-only changes pending)

## Remaining Tasks

### T20

- Verify the committed candidate SHA (`7da04855add36769001a1a83bd82021b2151ee5b`).
- Record the command, timestamp, result and verified SHA.
- Create atomic fix commits and reverify if required.

### T21

- Perform manual acceptance.
- Capture required evidence.
- Finalise RESULT.md.
- Create ACCEPTANCE.md.
- Update STATUS.md.
- Create the evidence-only commit.

## Ready for Independent Verification

- [x] T1–T19 complete
- [x] Atomic task commits created
- [x] Every task maps to a commit
- [x] Command IDs reconciled (DEC-014)
- [x] Error codes reconciled (DEC-015 + Appendix C.2)
- [x] WXT version reconciled (0.21.4, spec §7.1)
- [x] AGENTS.md and PLAN.md workflow corrections ready for documentation commit
- [x] No application, test, script, or configuration changes remain uncommitted
- [x] Candidate verification SHA recorded

**Verdict: READY**

**Blockers:** None.

**Exact next action:** Commit the pre-verification documentation (`AGENTS.md`, `PLAN.md`, `RESULT.md`), confirm clean HEAD, then proceed to `.planning/prompts/VERIFY_PHASE.md`.
