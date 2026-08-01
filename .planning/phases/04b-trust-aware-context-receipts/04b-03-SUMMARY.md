---
phase: 04b-trust-aware-context-receipts
plan: 03
subsystem: context-pipeline
tags: [tools, redaction, tdd, tool-result-shaper, provenance, immutability, tol-04, d-05]

# Dependency graph
requires:
  - phase: 04b-01
    provides: ContextItem contract + ContextItemSchema (D-01, D-09), ContextTrustPolicy.assess() authority (D-06), isValidSourceId (D-18)
  - phase: 03
    provides: redactSensitive() TraceRedactor patterns (JWT, sk-, api_key, Bearer, JSESSIONID, sysparm_ck), ToolExecutionResult type
provides:
  - ToolResultShaper standalone boundary service — ToolExecutionResult → redacted/truncated immutable ContextItem (TOL-04, D-05)
  - tools.builtin.{toolName} dot-separated provenance sourceId, valid per isValidSourceId (D-18)
  - Secret redaction guaranteed BEFORE any context re-entry (T-04b-09 mitigate), trust never self-assigned (T-04b-12 mitigate)
  - 12 fixture tests: provenance, JSON serialization, 6 secret patterns (sk-/JWT/Bearer/JSESSIONID + api_key/sysparm_ck via shared redactSensitive), 32K size limit, immutability, empty output, policy trust
affects: [04b-04, 04b-05, 04b-06, phase-05, phase-06, phase-08a]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redaction-first shaping: redactSensitive() is the FIRST processing step on raw tool output — nothing else touches unredacted text (T-04b-09)"
    - "Provenance from tool name: sourceId = tools.builtin.{toolName} — dot-separated per D-18, resolvable by ContextTrustPolicy's tools.* branch (D-07)"
    - "Trust from policy only: shape() calls contextTrustPolicy.assess(sourceId, 'context') and copies the verdict — the shaper never self-assigns (D-06, T-04b-12)"
    - "Immutability by construction: strings pass by value, objects serialize via JSON.stringify — shape() returns a brand-new ContextItem, input never written (D-05)"
    - "MAX_TOOL_RESULT_CHARS 32,000 module-level constant with '\n[truncated]' marker appended after slice"

key-files:
  created:
    - src/core/ai/ToolResultShaper.ts
    - tests/core/ai/ToolResultShaper.test.ts
  modified: []

key-decisions:
  - "Redaction runs on the JSON-serialized text, not per-field: JSON.stringify produces one string so all six redactSensitive() patterns apply uniformly to string and object outputs alike"
  - "Truncation applies AFTER redaction: a 40K output whose secret tail is redacted still gets the 32K marker — size enforcement operates on the text that actually enters the pipeline"
  - "D-09 guard implemented as the policy-verdict check (sensitivity === 'secret' → null): with current policy redaction already strips secrets (placeholders remain, sensitivity 'private'), so the guard is a future-policy defense, exactly as the plan directs"
  - "tokens uses the project-standard char/4 estimator (D-10), consistent with TokenBudget — empty output → 0 tokens"
  - "No REFACTOR commit needed: minimal GREEN implementation already satisfies lint/tsc and all 12 tests — nothing to clean up"

patterns-established:
  - "Boundary service shape: validate → redact → size-limit → provenance → policy trust → immutable item — the canonical ordering for anything entering the context pipeline from untrusted producers"
  - "buildResult(overrides) fixture builder with defaults (toolName get-page-content, toolCallId, durationMs) — same pattern as ContextTrustPolicy.test.ts makeItem()"
  - "structuredClone for immutability assertions on object outputs — deep equality against a pre-shape snapshot"

requirements-completed: [TOL-04]

coverage:
  - id: D1
    description: "Secret redaction at the boundary — sk- API keys, JWTs, Bearer tokens, and JSESSIONID session tokens replaced with ***REDACTED*** markers before any ContextItem creation; api_key/sysparm_ck covered by the same shared redactSensitive() call; raw secrets never reach the context pipeline (TOL-04, T-04b-09)"
    requirement: TOL-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#sk- API key is redacted with ***REDACTED*** markers — raw key never present"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#JWT is replaced with ***REDACTED_JWT*** — raw JWT never present"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#Bearer token is replaced with ***REDACTED*** — raw token never present"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#JSESSIONID session token is replaced with ***REDACTED*** — raw ID never present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Max output size enforcement — outputs longer than 32,000 chars truncated to 32,000 + '\\n[truncated]' marker (total ≤ 33,000 chars) before context re-entry (TOL-04)"
    requirement: TOL-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#output longer than 32,000 chars is truncated to 32,000 + \"\\n[truncated]\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Provenance + trust assignment — sourceId tools.builtin.{toolName} (dot-separated, valid per isValidSourceId, D-18), trust 0.9 / sensitivity private / authority data sourced exclusively from ContextTrustPolicy.assess(), never self-assigned (D-06, T-04b-12)"
    requirement: TOL-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#simple string output → context item with tools.builtin.{toolName} sourceId and data authority"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#assigns trust 0.9 / sensitivity private / data authority via contextTrustPolicy.assess()"
        status: pass
    human_judgment: false
  - id: D4
    description: "Immutability contract (D-05) — shape() returns a new immutable ContextItem; original ToolExecutionResult.output unchanged for both string and object outputs; object outputs serialized via JSON.stringify with deep-equality assertion against a structuredClone snapshot"
    verification:
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#does NOT mutate the original ToolExecutionResult for object output"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#does NOT mutate the original ToolExecutionResult for string output"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edge cases — object outputs JSON-serialized into item text; empty output yields empty text with 0 tokens; returned item satisfies the ContextItemSchema contract (kind 'context', bounded trust, non-negative tokens)"
    verification:
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#object output → JSON.stringify text carried in the context item"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ToolResultShaper.test.ts#empty output → empty text and zero tokens"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-08-01
status: complete
---

# Phase 04b Plan 03: ToolResultShaper Summary

**Standalone ToolResultShaper boundary service — every tool result is redacted (6 secret patterns), size-limited (32K + truncation marker), provenance-tagged (tools.builtin.{name}), policy-trusted (0.9/private/data), and re-enters the context pipeline as an immutable ContextItem (TOL-04, D-05)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-01T11:08:07Z
- **Completed:** 2026-08-01T11:09:34Z
- **Tasks:** 1 (2 commits — TDD RED/GREEN pair)
- **Files modified:** 2 (1 created source, 1 created test)

## Accomplishments

- **Redaction-first boundary (TOL-04, T-04b-09):** `ToolResultShaper.shape()` calls `redactSensitive()` as its FIRST processing step on raw tool output — sk- keys, JWTs, Bearer tokens, JSESSIONID/sysparm_ck session tokens are replaced with `***REDACTED***` markers before any ContextItem exists. No raw, unshaped tool output can reach ContextOptimizer. Objects serialize via `JSON.stringify` first so the same six patterns apply uniformly to string and object outputs.
- **Size enforcement (TOL-04):** `MAX_TOOL_RESULT_CHARS = 32_000` — outputs longer than 32K chars are sliced and appended with `'\n[truncated]'` (total ≤ 33,000 chars), applied AFTER redaction so the limit governs exactly the text entering the pipeline.
- **Provenance + policy trust (D-06, D-18, T-04b-12):** sourceId = `tools.builtin.{toolName}` — dot-separated hierarchical per D-18, verified valid via `isValidSourceId`. Trust (0.9), sensitivity (private), and instruction authority (data) come exclusively from `contextTrustPolicy.assess()` — the shaper never self-assigns trust. The D-09 guard returns `null` if a future policy verdict ever classifies the source as `secret`.
- **Immutability (D-05):** `shape()` returns a brand-new `ContextItem` (`kind: 'context'`, char/4 token estimate, `stable: false`, `relevance/freshness: 1.0`, `createdAt`). Strings pass by value; objects are serialized read-only. The original `ToolExecutionResult` is never written to — proven by deep-equality assertions against `structuredClone` snapshots.
- **Fixture suite:** 12 tests using the `buildResult()` builder pattern — 10 plan behavior tests (provenance, JSON serialization, 4 explicit secret-pattern redactions, 32K truncation, string+object immutability, empty output, policy trust) plus 2 supporting assertions (ContextItemSchema contract validity, string-immutability).

## Task Commits

Each task was committed atomically with TDD RED/GREEN pairs:

1. **Task 1: Build ToolResultShaper — redaction, size limit, provenance, immutability (D-05, TOL-04)** — `1627198` (test), `5a8324c` (feat)

**Plan metadata:** pending `docs(04b-03)` commit (this file).

**Verification:** `npx vitest run tests/core/ai/ToolResultShaper.test.ts --reporter=verbose` → 12/12 pass; `npx tsc --noEmit` clean; `npx vitest run tests/core/context` → 109/109 pass (no regressions); `isValidSourceId('tools.builtin.get-page-content')` → true.

## Files Created/Modified

- `src/core/ai/ToolResultShaper.ts` - New: `MAX_TOOL_RESULT_CHARS` constant, `ToolResultShaper.shape()` (convert → redact → truncate → provenance → policy trust → D-09 guard → immutable ContextItem), `toolResultShaper` singleton
- `tests/core/ai/ToolResultShaper.test.ts` - New: 12 tests — provenance assignment, JSON serialization, sk-/JWT/Bearer/JSESSIONID redaction, 32K truncation with marker, string+object immutability via structuredClone, empty-output edge, policy trust, schema contract

## Decisions Made

- **Redact the serialized text, not per-field:** `JSON.stringify` produces one string, so all six `redactSensitive()` patterns apply uniformly — object outputs get the same secret coverage as strings with no per-field analysis.
- **Truncate after redaction:** size enforcement operates on the exact text that enters the pipeline; a truncated-but-redacted output is strictly safer than the reverse order.
- **D-09 guard as policy-verdict check:** `sensitivity === 'secret' → null` per the plan's step f — with the current policy, redaction already neutralizes secrets (placeholders remain, item is `private`), so the guard is a future-policy defense. Matches the plan's must-have ("returns null when…sensitivity would be 'secret'").
- **No REFACTOR commit:** the minimal GREEN implementation already satisfies tsc and all tests; no cleanup warranted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None. The pre-existing Phase 03 provider-SDK failures (`StreamAdapter.test.ts` 2, `ProviderAdapter.test.ts` 4) remain out of scope and untouched (documented in 04b-01-SUMMARY.md + WINDOWS.md).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04b-04** can wire `toolResultShaper.shape()` into ExecutorService's execute loop (the plan's documented integration point: validated ToolExecutionResult → shape() → ContextItem → ContextOptimizer.optimizeFromItems()) — the shaper is a drop-in boundary with a `ContextItem | null` contract the optimizer already validates.
- **04b-05** (omission receipts) can treat the shaper's truncation marker as the receipt's `truncated` signal; **04b-06** can fixture the injected-source handling for shaped tool items (`tools.builtin.*` → data authority sections).
- **Phase 8a** manifest work can extend `tools.builtin.{toolName}` provenance with capability metadata without touching the shaper's contract.

---

*Phase: 04b-trust-aware-context-receipts*
*Completed: 2026-08-01*

## Self-Check: PASSED

- Both files present on disk: `src/core/ai/ToolResultShaper.ts`, `tests/core/ai/ToolResultShaper.test.ts`
- Both task commits verified in git history (1627198 RED, 5a8324c GREEN)
- Plan verify command: 12/12 pass; tsc clean; context suite 109/109 pass
- SUMMARY.md written to the phase directory
