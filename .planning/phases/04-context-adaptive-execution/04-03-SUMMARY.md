---
phase: 04-context-adaptive-execution
plan: 03
subsystem: ai-context
tags: [context-provenance-manifest, zod-boundary, kind-lockstep, provenance, deterministic]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: ModelContextTier (04-01 tier/window types), TokenBudget counter authority (04-01), the D-08 deterministic §2.3 fixture builder (03-03), PromptSection kind union incl. 'tool_result' (03a-01)
provides:
  - ContextProvenanceManifest extended IN PLACE with the full D-04-17 enumeration (tier, model, window, counterMethod, stepsFired) — a faithful, PromptInspector-ready provenance record
  - ContextProvenanceManifestSchema — the GR-4 Zod boundary gate that rejects unknown kinds (T-04-13), co-located ProviderConfigSchema-style
  - The D-04-18 kind-lockstep guard: runtime union-parity test pinning manifest.sections[].kind to PromptSection['kind'] incl. 'tool_result' (03a-01 precedent) — a new kind without a schema update fails CI
  - LADDER_STEP_NAMES/LadderStepName — the 8-step §2.4 ladder vocabulary (D-04-12) shared with ContextCompressor.LADDER_STEPS (04-02)
  - Synced producers: D-08 fixture provenance builder (deterministic constants) + contextHelper.ts placeholder stamp (04-06 deletion target)
affects: [04-04 ContextOptimizer (stamps + Zod-validates the manifest on every OptimizedContext), 04-06 contextHelper deletion, 04-07/04-05 manifest consumers, Phase 4b context receipt]

# Tech tracking
tech-stack:
  added: [] # nothing new — zod already on the approved stack (R-9)
  patterns:
    - "Co-located Zod boundary schema (GR-4): the interface stays the canonical declaration; the schema is its runtime validator, exported from the SAME module (ProviderConfigSchema precedent)"
    - "Runtime union-parity lockstep test: manifest kind enum SET vs PromptSection kind union SET — order-independent, fails CI on any drift (D-04-18, 03a-01 precedent)"
    - "Deep-linked fixture constants: the fixture manifest's `window` reads FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL] — never a second hardcoded value"

key-files:
  created:
    - tests/core/context/ContextProvenanceManifest.test.ts
  modified:
    - src/core/context/ContextProvenanceManifest.ts
    - src/core/ai/contextHelper.ts
    - tests/fixtures/optimizedContext.ts

key-decisions:
  - "FIXED_MODEL retargeted from 'claude-3-5-haiku-latest' to the canonical 'claude-haiku-4-latest' (Rule 3): the plan's deep-link FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL] resolves to undefined for the old value (not a map key; TokenBudget.test.ts pins exactly 5 keys so adding one was not an option) — retargeting keeps the deep-link deterministic and green"
  - "stepsFired fixture value is [] (empty — no degradation in the default fixture); counterMethod: 'heuristic' (D-04-10: provider-native counter absent in ai@4.3.19, 'native' reserved)"
  - "LadderStepName declared once in the manifest module with a const tuple (LADDER_STEP_NAMES) — the schema's stepsFired enum derives from the same tuple, so interface + schema cannot drift on steps"

patterns-established:
  - "Manifest lifetime invariant (D-04-19): the manifest is in-memory per-turn, redacted via TraceRedactor if ever logged, never persisted — noted in the module header"
  - "Placeholder-stamp pattern for deletion targets: a doomed producer (contextHelper, 04-06) stamps deterministic placeholders so REQUIRED interface fields never break typecheck at any boundary"

requirements-completed: [CTX-01]

coverage:
  - id: D1
    description: "ContextProvenanceManifest extended IN PLACE with the D-04-17 enumeration (tier: ModelContextTier, model, window, counterMethod: 'native'|'heuristic', stepsFired: ReadonlyArray<LadderStepName>) keeping the seed sections[]/totalTokens/minimalMode/workspaceId/activeSurface contract incl. the 03a-01 'tool_result' kind member byte-compatible (R-1, P-3b never re-declared)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#parses the fixture provenance for every tier override
        status: pass
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#accepts a hand-built manifest with fired ladder steps
        status: pass
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#rejects a manifest whose section kind is not in the union (unknown kind)
        status: pass
    human_judgment: false
  - id: D2
    description: "ContextProvenanceManifestSchema — co-located GR-4 Zod boundary gate mirroring every field (sections kind z.enum of all 8 PromptSection kinds incl. 'tool_result', int nonnegative tokens, optional compressionApplied, totalTokens, minimalMode, workspaceId, activeSurface, tier, model, window, counterMethod z.enum, stepsFired z.array(z.enum(LADDER_STEP_NAMES)))"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#manifest kind union mirrors PromptSection kind union (incl. tool_result)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#the schema kind enum lists exactly the 8 PromptSection kinds
        status: pass
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#schema stepsFired enum options match the literal 8-step ladder vocabulary
        status: pass
      - kind: unit
        ref: tests/core/context/ContextProvenanceManifest.test.ts#rejects a manifest with a non-integer / negative token count
        status: pass
    human_judgment: false
  - id: D3
    description: "Both surviving producers synced in the same task so the REQUIRED fields never break typecheck: the D-08 fixture provenance builder emits tier/model/FIXED_MODEL + window deep-linked from FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL] + counterMethod 'heuristic' + stepsFired [] (deterministic constants, all fixture consumers compile); contextHelper.ts stamps placeholder values (model '', window 0, counterMethod 'heuristic', stepsFired []) with a 04-06 deletion comment (D-04-08)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: pnpm typecheck (tsc --noEmit)
        status: pass
      - kind: unit
        ref: tests/fixtures/fixtures.test.ts#tests/fixtures — determinism (D-20/D-21)
        status: pass
      - kind: unit
        ref: tests/core/ai/AgentOrchestrator.test.ts (fixture consumer, 04-01 budget suites)
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 03: Context Provenance Manifest Contract Summary

**The seeded ContextProvenanceManifest extended IN PLACE with the full D-04-17 provenance enumeration (tier/model/window/counterMethod/stepsFired) plus a co-located GR-4 Zod boundary schema, with the D-04-18 kind-lockstep guard shipped as a runtime union-parity test and both surviving producers synced so the required fields never break typecheck — the stamping/validation half completes in 04-04**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-12T05:54:15Z
- **Completed:** 2026-08-12T05:59:39Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `ContextProvenanceManifest.ts` extended IN PLACE (R-1 — P-3b seed never re-declared, every existing field byte-compatible): `tier: ModelContextTier`, `model: string`, `window: number`, `counterMethod: 'native' | 'heuristic'`, `stepsFired: ReadonlyArray<LadderStepName>`. `LadderStepName`/`LADDER_STEP_NAMES` is the 8-step §2.4 ladder vocabulary (drop-debug → too-large, D-04-12), mirroring `ContextCompressor.LADDER_STEPS` (04-02) so the manifest and the ladder stay in lockstep. `ContextProvenanceManifestSchema` co-located below the interface (GR-4, ProviderConfigSchema precedent): sections `kind` as `z.enum` of all 8 `PromptSection` kinds **including the 03a-01 `'tool_result'` member**, int-nonnegative tokens, optional `compressionApplied`, full field mirror incl. `tier`/`counterMethod` enums and `stepsFired` derived from the same `LADDER_STEP_NAMES` tuple. Header documents §2.6 source + D-04-17/18/19 + the 03a-01 note.
- `tests/core/context/ContextProvenanceManifest.test.ts` (8 deterministic tests): Zod round-trip — the fixture provenance parses for tiny/small/medium/large; a hand-built manifest with an invented `'history'` kind fails `safeParse` with the error pinned to `sections.0.kind` (T-04-13); negative/fractional tokens rejected; fired steps accepted. **D-04-18 lockstep guard** verbatim per RESEARCH L369-377 — SET equality between the schema's kind enum options and the 8 `PromptSection` kinds (order-independent, `'tool_result'` on both sides), plus an exact-length/exact-membership assertion. stepsFired vocabulary pinned against the literal 8-step array (no 04-02 import — same-wave parallel safe).
- Both surviving producers synced IN THE SAME TASK (the new fields are REQUIRED): the D-08 fixture provenance builder emits `tier` (the fixture's tier), `model: FIXED_MODEL`, `window: FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL]` (deep-linked, never a second value), `counterMethod: 'heuristic'`, `stepsFired: []`; `contextHelper.ts` stamps deterministic placeholders (`model: ''`, `window: 0`, `counterMethod: 'heuristic'`, `stepsFired: []`) with a "DELETED in 04-06 (D-04-08)" comment so the Phase-3 module compiles until its deletion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the manifest IN PLACE + co-locate the Zod schema + sync the D-08 fixture** - `45b67ce` (feat)
2. **Task 2: Write ContextProvenanceManifest.test.ts — Zod round-trip + lockstep guard** - `1f4a05a` (test)

**Plan metadata:** (pending — `docs(04-03): complete …`)

## Files Created/Modified

- `src/core/context/ContextProvenanceManifest.ts` - MODIFIED: D-04-17 fields + `LADDER_STEP_NAMES`/`LadderStepName` + co-located `ContextProvenanceManifestSchema` (GR-4); seed contract untouched (R-1)
- `src/core/ai/contextHelper.ts` - MODIFIED: provenance literal stamped with deterministic placeholder values (04-06 deletion target, D-04-08)
- `tests/fixtures/optimizedContext.ts` - MODIFIED: provenance builder emits the new required fields (deterministic constants); `FIXED_MODEL` retargeted to canonical key (see Deviations)
- `tests/core/context/ContextProvenanceManifest.test.ts` - NEW: 8 deterministic tests — Zod round-trip (4), D-04-18 lockstep guard (2), stepsFired vocabulary (2)

## Decisions Made

- **FIXED_MODEL retargeted to `'claude-haiku-4-latest'` (Rule 3 deviation):** the plan's deep-link `FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL]` yields `undefined` at runtime because the fixture's original model ('claude-3-5-haiku-latest') is not a key of the map, and `TokenBudget.test.ts` L232 pins exactly 5 keys (adding one was not an option). Retargeting `FIXED_MODEL` to the canonical haiku key (200K) keeps the deep-link deterministic, matches the haiku-tier fixture persona, and no test imports `FIXED_MODEL`. Documented in the fixture.
- **stepsFired fixture default `[]`** (no degradation in the default §2.3 fixture); fired steps are exercised in the test via a hand-built manifest. `counterMethod: 'heuristic'` everywhere (D-04-10 — provider-native counter does not exist in ai@4.3.19; `'native'` reserved in the enum for a future SDK surface).
- **`LadderStepName` single-declaration:** a const tuple (`LADDER_STEP_NAMES`) in the manifest module feeds both the interface type and the schema's `stepsFired` enum — the two can never drift on steps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FIXED_MODEL retargeted so the fixture `window` deep-link resolves**
- **Found during:** Task 1 (fixture provenance builder sync)
- **Issue:** The plan's literal instruction `window: FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL]` with `FIXED_MODEL = 'claude-3-5-haiku-latest'` evaluates to `undefined` at runtime — that model is not a key of `FIXED_MODEL_CONTEXT_WINDOWS` (which mirrors the five canonical `MODEL_CONTEXT_WINDOWS` keys), and `TokenBudget.test.ts` L232 asserts exactly 5 keys so the map could not gain a sixth entry. An `undefined` window would fail the Task-2 Zod round-trip and the determinism deep-equal contract.
- **Fix:** Retargeted `FIXED_MODEL` to `'claude-haiku-4-latest'` (the canonical haiku map key, 200K) with a comment explaining the 04-03 deep-link requirement. Verified `FIXED_MODEL` is imported by no test (only used inside the fixture module itself).
- **Files modified:** tests/fixtures/optimizedContext.ts
- **Verification:** `pnpm typecheck` clean; fixture manifest parses for all four tiers; full suite 68 files / 588 tests green.
- **Committed in:** `45b67ce` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal — one fixture constant retargeted to a canonical key; no scope creep, no interface/schema change, no test semantics altered.

## Issues Encountered

- The opencode LSP produced persistent stale "Cannot find module '@/core/context/TokenBudget'/'ContextPack'/'ContextCompressor'" diagnostics on pre-existing files (same spurious LSP-cache pattern documented in 04-01/04-02 summaries). The actual gates (`tsc --noEmit`, `vitest run`, `eslint`) were all clean; the LSP cache is not a build-state signal.
- Prettier flagged formatting on the new test file — fixed with `prettier --write` before commit (same pattern as 04-02's Task 3).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Success criterion 4's contract is in place:** every `OptimizedContext` carries a `ContextProvenanceManifest` rich enough for PromptInspector; the GR-4 schema + D-04-18 lockstep guard close the 03a-01 drift failure mode permanently (a new `PromptSection` kind without a schema update now fails CI).
- `ContextOptimizer` (04-04) stamps the real D-04-17 values (`stepsFired`, `counterMethod`) and Zod-validates each manifest at the boundary — the fixture + schema are ready for it.
- The 04-06 deletion of `contextHelper.ts` has no typecheck hazard: its provenance literal already carries placeholder stamps.
- CTX-01 remains an unresolved spec-less probe (#1110) by design until the phase gate seals it.

## Threat Flags

None — no new surface outside the plan's threat model: the manifest is a pure in-memory type + Zod schema (no endpoints, no auth paths, no I/O). T-04-11 mitigated (D-04-18 lockstep test green), T-04-12 documented (D-04-19 lifetime note in the module header; redaction enforced in 04-04/04-06), T-04-13 mitigated (schema rejects unknown kinds — tested), T-04-14 no-op (no packages installed).

---

## Self-Check

- `src/core/context/ContextProvenanceManifest.ts` — FOUND (D-04-17 fields + schema exported)
- `src/core/ai/contextHelper.ts` — FOUND (placeholder stamp present)
- `tests/fixtures/optimizedContext.ts` — FOUND (new fields in provenance builder)
- `tests/core/context/ContextProvenanceManifest.test.ts` — FOUND (8 tests, green)
- Commits: `45b67ce` ✓ `1f4a05a` ✓
- Verification: `pnpm typecheck` → clean; `pnpm vitest run tests/core/context/ContextProvenanceManifest.test.ts` → 8 passed; plan-level trio (manifest + AgentOrchestrator + fixtures suites) → 33 passed; full suite 68 files / 588 tests → green (was 67/580 in 04-02); eslint → clean; prettier --check → clean; grep gates (no 04-02 module import in the test, no second kind declaration, no extra fields beyond the locked D-04-17 list) → CLEAN

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
