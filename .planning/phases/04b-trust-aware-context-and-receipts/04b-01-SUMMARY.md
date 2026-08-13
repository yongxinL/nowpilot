---
phase: 04b-trust-aware-context-and-receipts
plan: 01
subsystem: types
tags: [trust, zod, harness, chrome-storage, context, error-codes, verify-script]

# Dependency graph
requires:
  - phase: 03a-agent-reliability-and-evidence
    provides: co-located Zod boundary schema pattern (D-3a-20) + harness.ts in-place extension template
affects:
  - 04b-02 (applyTrustPolicy consumes TrustLevel/ContextItem; CONTEXT_INSTRUCTION_INJECTION_BLOCKED typed carrier)
  - 04b-03 (injectionScreener feeds TrustOmitReason 'prompt_injection')
  - 04b-04 (ContextOptimizerInput.trustPrefs consumes TrustPrefs shape)
  - 04b-05 (TrustSettingsStore writes the np_trust shape locked here)
  - 04b-06 (verify:phase-4b is the phase gate)
  - Phase 8 (skills land on the CTX-05 disclosureReady seam)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - C.1 trust types land verbatim in harness.ts with co-located Zod boundary schemas (GR-4, D-3a-20)
    - CTX-01 MUST-be-false invariant enforced at the Zod boundary refine
    - kind-lockstep union parity: ContextItem.kind mirrors PromptSection['kind'] incl. 'tool_result'
    - storage-registry row + Zod-gated accessor with never-throws all-true fallback (personaConfig precedent)
    - canonical error code with W-1 spec-mirror doc comment (Phase-1/04 precedent)

key-files:
  created:
    - src/core/preferences/trustConfig.ts
    - tests/core/context/trust/TrustTypes.test.ts
  modified:
    - src/types/harness.ts
    - src/core/error/errorCodes.ts
    - src/core/storage/Setting.ts
    - package.json

key-decisions:
  - "Trust types land IN PLACE in harness.ts (R-1) with co-located Zod schemas; ContextItem.kind typed as PromptSection['kind'] via type import — never re-declared"
  - "CTX-01 enforced at the Zod boundary: ContextItemSchema refine rejects instructionAuthority:true for tool/retrieved/untrusted trust"
  - "CTX-05 disclosureReady?: boolean seam added as optional type-level field only (D-4b-13); no logic in 4b"
  - "TrustOmitReason = z.enum(['prompt_injection','trust_disabled']) — Open Q3 structured omit reasons, no new C.2 codes"
  - "np_trust shape { page, notes, memory, tool_result } all-boolean, area 'local' (A4 discretion D-4b-07); all-true safe default"
  - "verify:phase-4b = §24 chain verbatim (eslint + prettier + tsc + wxt build + vitest run), A8"

patterns-established:
  - "Trust boundary schema pattern: interface + co-located Zod object + refine invariant + enum options parity test"
  - "Storage accessor pattern: registry row (Pitfall 4) + settingRead + safeParse + debugLog fallback, never throws"

requirements-completed: [TRUST-01, TRUST-03]

coverage:
  - id: D1
    description: "C.1 trust types (TrustLevel/ContextItem/ContextReceiptEntry) + co-located Zod schemas with CTX-01 boundary refine and CTX-05 disclosureReady seam in harness.ts"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/TrustTypes.test.ts#ContextItemSchema / ContextReceiptEntrySchema (GR-4 Zod boundary)"
        status: pass
      - kind: unit
        ref: "tests/core/context/trust/TrustTypes.test.ts#CTX-01 MUST-be-false invariant (boundary refine)"
        status: pass
      - kind: unit
        ref: "tests/core/context/trust/TrustTypes.test.ts#D-04-18 kind-lockstep guard (runtime union parity)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONTEXT_INSTRUCTION_INJECTION_BLOCKED canonical ERROR_CODES member (O.3, GR-9) with W-1 spec-mirror doc comment"
    verification:
      - kind: other
        ref: "grep -c CONTEXT_INSTRUCTION_INJECTION_BLOCKED src/core/error/errorCodes.ts == 1 + pnpm exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "np_trust registered in Setting.ts STORAGE_KEY_REGISTRY as { area: 'local' } (Pitfall 4 closed)"
    verification:
      - kind: other
        ref: "grep -c \"np_trust: { area: 'local' },\" src/core/storage/Setting.ts == 1 + pnpm exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D4
    description: "trustConfig.ts accessor — NP_TRUST_KEY, TrustPrefsSchema, DEFAULT_TRUST_PREFS all-true, readTrustPrefs() Zod-gated never-throws with STORE_READ debugLog fallback"
    requirement: TRUST-03
    verification:
      - kind: other
        ref: "pnpm exec tsc --noEmit (compiles) + grep: no throw statement, imports ERROR_CODES.STORE_READ"
        status: pass
    human_judgment: false
  - id: D5
    description: "verify:phase-4b script in package.json (§24 chain: eslint + prettier --check + tsc --noEmit + wxt build + vitest run)"
    verification:
      - kind: other
        ref: "node -e package.json scripts assertion + pnpm run verify:phase-4b (full gate green: 79 files / 693 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-08-13
status: complete
---

# Phase 04b Plan 01: Trust Type Foundation Summary

**C.1 trust types (TrustLevel/ContextItem/ContextReceiptEntry) landed verbatim in harness.ts with co-located Zod boundary schemas, the CTX-01 instruction-authority invariant, the canonical CONTEXT_INSTRUCTION_INJECTION_BLOCKED error code, the np_trust storage-registry row + Zod-gated accessor, and the verify:phase-4b gate script**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-13T14:31:00Z
- **Completed:** 2026-08-13T14:45:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- TrustLevel, ContextItem, and ContextReceiptEntry declared verbatim from spec Appendix C.1 (L4877-4899) in `src/types/harness.ts` — the R-1 home the header declared as the ContextItem extension point; `ContextItem.kind` typed as `PromptSection['kind']` via type import (never re-declared; 8-member union incl. 'tool_result')
- Co-located Zod boundary schemas (GR-4, D-3a-20 precedent): `TrustLevelSchema`, `ContextItemSchema` with the CTX-01 refine (rejects `instructionAuthority:true` for tool/retrieved/untrusted trust), `ContextReceiptEntrySchema`, `TrustOmitReasonSchema`/`TrustOmitReason` (Open Q3: `prompt_injection` | `trust_disabled`), plus the CTX-05 `disclosureReady?: boolean` seam (D-4b-13, type-level only)
- `ERROR_CODES.CONTEXT_INSTRUCTION_INJECTION_BLOCKED` added canonically (O.3, GR-9) with a W-1 spec-mirror doc comment; `np_trust: { area: 'local' }` registered in Setting.ts (Pitfall 4 closed)
- `trustConfig.ts` accessor created (personaConfig structural copy): `NP_TRUST_KEY`, `TrustPrefsSchema` `{ page, notes, memory, tool_result }`, `DEFAULT_TRUST_PREFS` all-true, `readTrustPrefs()` Zod-gated, never throws, STORE_READ debugLog on invalid
- `verify:phase-4b` script added (byte-identical §24 chain to the 6 existing verify scripts); existing verify keys untouched
- Full §24 gate passes green: 79 test files / 693 tests, eslint + prettier + tsc + wxt build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Land C.1 trust types + co-located Zod schemas in harness.ts** - `ea12d7f` (feat)
2. **Task 2: Add the O.3 canonical error code + np_trust storage registry row** - `a589ed4` (feat)
3. **Task 3: trustConfig.ts accessor + verify:phase-4b script** - `058e36c` (feat)

**Plan metadata:** `1e8cff1` (docs: complete plan — final amended metadata commit)

## Files Created/Modified

- `src/types/harness.ts` - Added Phase-4b block: TrustLevel, ContextItem (kind = PromptSection['kind'], disclosureReady seam), ContextReceiptEntry, TrustLevelSchema, ContextItemSchema (CTX-01 refine), ContextReceiptEntrySchema, TrustOmitReasonSchema + TrustOmitReason; Phase-3a block untouched (R-1 in-place)
- `src/core/error/errorCodes.ts` - CONTEXT_INSTRUCTION_INJECTION_BLOCKED canonical member (O.3, GR-9), count == 1 in file
- `src/core/storage/Setting.ts` - STORAGE_KEY_REGISTRY.np_trust = { area: 'local' } (new registration, not a migration)
- `src/core/preferences/trustConfig.ts` (NEW) - NP_TRUST_KEY, TrustPrefsSchema, TrustPrefs type, DEFAULT_TRUST_PREFS, readTrustPrefs()
- `package.json` - scripts.verify:phase-4b added; verify:phase-1..4a byte-unchanged
- `tests/core/context/trust/TrustTypes.test.ts` (NEW, new `tests/core/context/trust/` dir) - 16 tests: positive/negative Zod gates, CTX-01 invariant (it.each for tool/retrieved/untrusted), CTX-05 seam, D-04-18 union parity, TrustOmitReason enum

## Decisions Made

- Trust types land in place in harness.ts per R-1; consumers (04b-02/03/04/05) import from here, never re-declare
- CTX-01 enforced at the Zod boundary (schema refine) — the boundary schema is the first gate; applyTrustPolicy (04b-02) is the second, runtime layer
- CTX-05 seam shipped type-level only (optional boolean) with zero logic in 4b (skills land Phase 8)
- np_trust shape { page, notes, memory, tool_result } (A4 discretion D-4b-07); all-true defaults so no source is silently excluded (D-4b-08, T-4b-06)
- verify:phase-4b mirrors the repo's actual §24 chain form (A8); the spec's scoped form is satisfied as a subset
- `ContextItemSchema.innerType().shape.kind.options` used for union parity (the refine wraps the object in ZodEffects — `.shape` is not directly accessible)

## Deviations from Plan

None - plan executed exactly as written. (One operational note: the prettier gate in verify:phase-4b reformatted the Task 1 files after their initial commit; the formatting fix was folded into the introducing commits via a clean re-commit — no semantic change, history is clean 3-commit shape.)

## Issues Encountered

- None. The prettier --check gate flagged 2 files (harness.ts, TrustTypes.test.ts) on the first gate run; fixed with `prettier --write`, re-committed, gate green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04b-02 (TrustPolicy) — imports TrustLevel/ContextItem from harness.ts and the CONTEXT_INSTRUCTION_INJECTION_BLOCKED code
- Ready for 04b-03 (injectionScreener) — TrustOmitReason 'prompt_injection' vocabulary locked
- Ready for 04b-04 (ContextOptimizer trust stage) — TrustPrefs shape + defaults locked; ContextOptimizerInput.trustPrefs wires against it
- Ready for 04b-05 (TrustSettingsStore) — np_trust key + shape locked; Setting.ts registry row in place
- verify:phase-4b is the phase gate every later 4b plan's final wave seals against (04b-06)

---
*Phase: 04b-trust-aware-context-and-receipts*
*Completed: 2026-08-13*

## Self-Check: PASSED

- All 6 key files exist on disk (harness.ts, errorCodes.ts, Setting.ts, trustConfig.ts, TrustTypes.test.ts, SUMMARY.md)
- All 3 task commits found in git log: `ea12d7f`, `a589ed4`, `058e36c`
- Plan-level verification: `pnpm run verify:phase-4b` green — 79 test files / 693 tests, eslint + prettier + tsc + wxt build clean
