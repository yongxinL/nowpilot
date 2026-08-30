---
phase: 07-trust-aware-context-and-receipts
plan: 01
subsystem: context-trust
tags: [trust-policy, prompt-injection, context-receipt, O3, CTX-01, CTX-02, CTX-03]

# Dependency graph
requires:
  - phase: 05-context-adaptive-execution
    provides: "assemble()/ContextOptimizerInput/OptimizedContext, ContextProvenanceManifest verbatim schema, A8 PromptSection, §2.4 degradation ladder with reserved rungs 1-2"
  - phase: 06-pagecontentservice-knowledge-acquisition
    provides: "PageContext canonical type (the untrusted CONTEXT item source, D-94)"
provides:
  - "C.1 trust types (TrustLevel/ContextItem/ContextReceiptEntry) verbatim in src/types/harness.ts — the spec-4838 canonical home O.3 imports from"
  - "O.3-verbatim TrustPolicy: AUTHORITY_BY_TRUST + applyTrustPolicy (wrap + force-strip + post-wrap recount) + structural guard raising CONTEXT_INSTRUCTION_INJECTION_BLOCKED"
  - "D-93 item pipeline inside assemble(): sources → D-94-tagged ContextItem[] → non-throwing applyTrustPolicy → A8 sections, with WorkingSection.originalTokens (D-96)"
  - "D-95 derived context receipt (entries + untrustedDataPresent L6 signal) attached additively to OptimizedContext — manifest/A8/section-order contracts untouched"
  - "D-97 rungs 1-2 activation for optional debugSections/secondaryNotes inputs"
  - "§18 test dirs: tests/core/context/trust/ (4 suites) + tests/security/prompt-injection/ (adversarial fixtures)"
affects: [07-02 (snapshots/metrics), 07-03 (disclosure + gate re-point), phase-08 (memory sources), phase-11 (PromptTrace/DiagnosticsSection), phase-15 (L6 disclosure UI)]

# Actuals (#2632) — pairs with the plan's `estimate` (60000 tokens) to calibrate future estimates.
actuals:
  tokens: 19700    # chars/4 over the realized diff (git diff base..HEAD | wc -c = 78914)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []  # zero new packages (Package Legitimacy Audit vacuous)
  patterns:
    - "D-93 item pipeline: sources → ContextItem[] (D-94 tags) → non-throwing applyTrustPolicy → A8 sections inside assemble"
    - "D-99 structural enforcement: closed authority map + <untrusted_data> wrap + typed guard — never content heuristics (P7)"
    - "D-95 derived receipt: separate module over the verbatim manifest, never manifest fields (D-77 additive-field precedent)"
    - "D-96 post-wrap token recount via countTokensHeuristic (the shipped accounting unit)"

key-files:
  created:
    - src/core/context/trust/TrustPolicy.ts
    - src/core/context/trust/contextItems.ts
    - src/core/context/trust/ContextReceipt.ts
    - tests/core/context/trust/TrustPolicy.test.ts
    - tests/core/context/trust/contextItems.test.ts
    - tests/core/context/trust/ContextReceipt.test.ts
    - tests/core/context/trust/assemble-trust.test.ts
    - tests/security/prompt-injection/policy-redefinition.test.ts
  modified:
    - src/types/harness.ts
    - src/core/context/ContextOptimizer.ts

key-decisions:
  - "Trust types live in @/types/harness verbatim (spec 4838 'Trust context' row; O.3 spec 6369 imports from there) — resolved the harness.ts vs trust/types.ts discretion (D-93/D-95)"
  - "buildContextItems always emits the five sourced items; the CONTEXT item falls back to sourceId 'context' when no pageContext, and assemble gates the CONTEXT section emission on input.pageContext (Phase-5 behavior byte-identical)"
  - "Rungs 1-2 dropped debug/notes keep their manifest record (truncated:true, tokens:0) via a WorkingSection.dropped flag; the section is excluded from output but the receipt derives omitReason from the record"
  - "assemble() calls only the non-throwing applyTrustPolicy; raiseIfPolicyRedefinitionAttempt stays the test/consumer seam (never-throw AssembleResult contract, RESEARCH Pitfall 2)"

patterns-established:
  - "Pattern 1 (item pipeline inside assemble): per-source ContextItem construction mirrors the sourceIdFor switch + per-source text builders; post-wrap recount keeps section tokens accurate"
  - "Pattern 2 (derived receipt): deriveContextReceipt maps manifest + originalTokens + sections + items into C.1 ContextReceiptEntry[] — no schema edits"
  - "Pattern 3 (structural guard): field-combination detection trust∈{retrieved,untrusted} ∧ instructionAuthority===true, closed-set literal, no content regexes"
  - "Pattern 4 (no barrel): src/core/context/trust/ uses direct path imports (src/core/ai flat convention)"

requirements-completed: [CTX-01, CTX-02, CTX-03]

# Coverage metadata (#1602) — one entry per shipped deliverable (all proven by passing unit suites; full suite 599 passed).
coverage:
  - id: D1
    description: "C.1 trust types (TrustLevel/ContextItem/ContextReceiptEntry) verbatim in src/types/harness.ts — the spec-4838 canonical home O.3 imports from (D-93/D-95, CTX-01)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/contextItems.test.ts#buildContextItems — D-94 per-source trust map"
        status: pass
    human_judgment: false
  - id: D2
    description: "O.3-verbatim TrustPolicy: AUTHORITY_BY_TRUST + applyTrustPolicy (wrap + force-strip + D-96 post-wrap recount) + structural guard raising CONTEXT_INSTRUCTION_INJECTION_BLOCKED (D-99, CTX-02)"
    requirement: CTX-02
    verification:
      - kind: unit
        ref: "tests/core/context/trust/TrustPolicy.test.ts#applyTrustPolicy — O.3 wrap + force-strip"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-93 item pipeline inside assemble(): sources → D-94-tagged ContextItem[] → non-throwing applyTrustPolicy → A8 sections; WorkingSection.originalTokens retained (D-96, CTX-01)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/assemble-trust.test.ts#TRACER happy path — untrusted pageContext → items → policy → sections → manifest → receipt"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-95 derived context receipt: ContextReceiptEntry[] + untrustedDataPresent (L6 signal) attached additively to OptimizedContext; manifest/A8/section-order contracts byte-identical (CTX-03)"
    requirement: CTX-03
    verification:
      - kind: unit
        ref: "tests/core/context/trust/ContextReceipt.test.ts#deriveContextReceipt — UI-SPEC Contract C derivation rules"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-97 rungs 1-2 activation: optional debugSections/secondaryNotes ride CONTEXT-kind sections, dropped over budget with truncated manifest records + receipt omitReason"
    verification:
      - kind: unit
        ref: "tests/core/context/trust/assemble-trust.test.ts#TRACER rungs 1-2 — D-97 debug/notes caller seams"
        status: pass
    human_judgment: false
  - id: D6
    description: "§18 adversarial prompt-injection suite: malicious page / poisoned note / hostile tool-output fixtures prove fabricated authority raises CONTEXT_INSTRUCTION_INJECTION_BLOCKED and wrapped output never carries authority (CTX-02)"
    requirement: CTX-02
    verification:
      - kind: unit
        ref: "tests/security/prompt-injection/policy-redefinition.test.ts#CTX-02 guard — fabricated authority raises CONTEXT_INSTRUCTION_INJECTION_BLOCKED"
        status: pass
    human_judgment: false

# Metrics
duration: 73min
completed: 2026-08-30
status: complete
---

# Phase 7 Plan 1: Trust Spine Tracer Summary

**C.1 trust types in their canonical harness.ts home, the O.3-verbatim TrustPolicy (authority map + `<untrusted_data>` wrap + structural guard), the D-93 item pipeline wired through the real `assemble()`, the D-95 derived context receipt with the L6 `untrustedDataPresent` signal, and the §18 adversarial prompt-injection fixtures — the full trust spine proven end-to-end by 82 trust/prompt-injection tests with the Phase-5 suite green and zero verbatim-contract edits.**

## Performance

- **Duration:** 73 min
- **Started:** 2026-08-30T03:27:33Z
- **Completed:** 2026-08-30T04:40:44Z
- **Tasks:** 3 (1 auto + 1 tracer + 1 auto)
- **Files modified:** 10 (2 modified, 8 created)

## Accomplishments

- **C.1 trust types verbatim in the canonical home** — `TrustLevel` / `ContextItem` / `ContextReceiptEntry` appended to `src/types/harness.ts` (spec 4879-4900; spec 4838 'Trust context' row; the only type-only `PromptSection` import the file needs, per O.3 spec 6369).
- **O.3-verbatim TrustPolicy** — `AUTHORITY_BY_TRUST` closed 5-entry map, `applyTrustPolicy` (wrap + force-strip + D-96 post-wrap token recount), and the structural `isPolicyRedefinitionAttempt` / `raiseIfPolicyRedefinitionAttempt` guard raising `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (spec 5093 closed set — no invented codes, D-38); zero content-matching calls (D-99/P7).
- **D-93 item pipeline inside `assemble()`** — `buildSourcedSections` now runs sources → D-94-tagged `ContextItem[]` (via `buildContextItems`) → non-throwing `applyTrustPolicy` → A8 sections; `WorkingSection.originalTokens` retained (D-96); `debugSections`/`secondaryNotes` additive inputs activate rungs 1-2 (D-97); receipt attached additively to `OptimizedContext` (D-77 precedent). All changes additive — the verbatim manifest schema, A8 `PromptSection`, and §1.3 canonical order are byte-identical (`git status` clean for those files).
- **D-95 derived context receipt** — `deriveContextReceipt` maps the verbatim manifest + D-96 original token counts + A8 stable flags + item trust into `ContextReceiptEntry[]` with `untrustedDataPresent` (UI-SPEC Contract A/C), per locked derivation rules.
- **§18 adversarial prompt-injection suite** — `tests/security/prompt-injection/policy-redefinition.test.ts` (spec 2650 dir) with three fixture classes (malicious page / poisoned note / hostile tool output tagged `trust:'untrusted'` per CTX-02 spec 3950) proving CTX-02: fabricated authority raises the typed code, wrapped output never carries authority, and TrustPolicy.ts contains no content-matching heuristics.
- **Full-suite green** — 65 files / 599 passed / 2 skipped (pre-existing Phase-6 built-bundle skips); Phase-5 regression suites (ContextOptimizer/ContextCompressor/TokenBudget) all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: C.1 trust types + O.3 TrustPolicy + D-94 item pipeline builder** - `13568e1` (feat)
2. **Task 2: TRACER — assemble() item-pipeline integration + ContextReceipt derivation** - `0ef5cf5` (feat)
3. **Task 3: Adversarial prompt-injection fixtures — malicious page / poisoned note / hostile tool output** - `1748804` (feat)

**Plan metadata:** pending (orchestrator-owned STATE.md/ROADMAP.md writes are skipped per sequential-executor contract; SUMMARY commit follows).

## Files Created/Modified

- `src/types/harness.ts` - Appended C.1 trust block: `TrustLevel` / `ContextItem` / `ContextReceiptEntry` verbatim (spec 4879-4900) + type-only `PromptSection` import (spec 6369)
- `src/core/context/trust/TrustPolicy.ts` - O.3-verbatim `AUTHORITY_BY_TRUST` + `applyTrustPolicy` (wrap + force-strip + post-wrap recount) + structural guard raising `CONTEXT_INSTRUCTION_INJECTION_BLOCKED`
- `src/core/context/trust/contextItems.ts` - `buildContextItems` — D-94 trust map, sourceIdFor-mirroring sourceIds, deterministic relevance/freshness/sensitivity
- `src/core/context/trust/ContextReceipt.ts` - `deriveContextReceipt` → `ContextReceiptSurface { entries, untrustedDataPresent }` (UI-SPEC Contract A/C)
- `src/core/context/ContextOptimizer.ts` - Additive: D-93 item pipeline in `buildSourcedSections`, `WorkingSection.originalTokens` (D-96), `debugSections`/`secondaryNotes` inputs + rungs 1-2 (D-97), additive `receipt` field (D-95/D-77)
- `tests/core/context/trust/TrustPolicy.test.ts` - 12 tests: wrap/strip, recount, guard semantics, closed map
- `tests/core/context/trust/contextItems.test.ts` - 7 tests: D-94 tags, sourceId mapping, deterministic metadata, no SYSTEM/TASK
- `tests/core/context/trust/ContextReceipt.test.ts` - 6 tests: Contract C derivation rules
- `tests/core/context/trust/assemble-trust.test.ts` - 7 tests: TRACER end-to-end (malicious page, rungs 1-2, structural containment, never-throw)
- `tests/security/prompt-injection/policy-redefinition.test.ts` - 10 tests: adversarial fixtures + code-level structural assertions

## Decisions Made

- **Trust types in `@/types/harness` verbatim** — resolved the CONTEXT.md discretion (harness.ts vs trust/types.ts): spec 4838 mandates harness.ts and O.3 imports from there (D-93/D-95).
- **`buildContextItems` always emits the five sourced items** — the CONTEXT item falls back to sourceId `'context'` when no pageContext (the locked sourceIdFor fallback); `assemble` gates the CONTEXT *section* emission on `input.pageContext` so Phase-5 output is byte-identical.
- **Rungs 1-2 drop via a `WorkingSection.dropped` flag** — the dropped debug/notes record stays in the manifest (truncated:true, tokens:0) as the receipt's `omitReason` source, while the section is excluded from output.
- **`assemble` calls only the non-throwing `applyTrustPolicy`** — the throwing guard stays exported in TrustPolicy.ts as the test/consumer seam (never-throw AssembleResult contract, RESEARCH Pitfall 2).
- **Receipt derivation keeps `included` = shipped-section semantics** — truncation ≠ omission (compressed sections stay included:true); system/task → `no-input-source`, dropped debug/notes → `debug-only`/`secondary-notes`.

## Deviations from Plan

None - plan executed exactly as written. All 11 locked decisions (D-93..D-99) implemented as specified; all prohibitions honored (verbatim contracts untouched, never-throw, no content heuristics, no new error codes, no new section kinds, no live pipeline adoption, zero NP-STRICT markers, no barrel index, USER PREFERENCES not flipped to stable).

## Issues Encountered

- **Acceptance-grep nuance (Task 1):** the plan's acceptance list greps `export type { PromptSection }` in harness.ts, but the correct type-only import is `import type { PromptSection } from '../core/ai/types';` (a re-export would not bring the type into scope for `ContextItem.kind`). The action text specified the import form; the automated `<verify>` does not include that grep — implemented the correct import, lint + tests green.
- **Acceptance-grep nuance (Task 1):** `git status --porcelain src/types/harness.ts src/core/context/trust/ | wc -l >= 5` counted 2 because git collapses untracked directories to one `??` row; with `--porcelain -uall` the count is exactly 5 (1 modified + 4 new files). All five files committed.
- **Multi-line import capture (Task 3):** the untouched-layers guard initially filtered import *lines* by `startsWith('import')`, which truncated the multi-line TrustPolicy import and failed the assertion. Fixed with a statement-level regex (`/import[^;]+;/gs`).

## Known Stubs

None - every deliverable is wired: the trust types feed TrustPolicy/contextItems/ContextReceipt; the receipt is attached to OptimizedContext; rungs 1-2 are active for supplied inputs; the adversarial fixtures run against the shipped guard. (D-69 create-only holds: nothing imports the trust layer from components/AI runtime — by design, `assemble` stays proven-by-tests until Phase 8.)

## User Setup Required

None - no external service configuration required (zero new packages, pure TypeScript phase).

## Next Phase Readiness

- Ready for **07-02** (ContextQualityMetrics CTX-06 aggregates + stable-prefix golden snapshots CTX-04 with `hashStableSections` FNV-1a cross-check) — the receipt surface and item pipeline it derives from now exist and are proven.
- Ready for **07-03** (SkillDisclosure CTX-05 + `verify:phase-7` gate re-point D-103 to `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection`) — both §18 dirs now exist with real test files, so the re-pointed gate will not hit vitest's "no tests found" on empty dirs (RESEARCH Pitfall 3).
- No blockers.

---
*Phase: 07-trust-aware-context-and-receipts*
*Completed: 2026-08-30*

## Self-Check: PASSED

All 10 created/modified files exist on disk (`[ -f ]` verified); all 4 commits (13568e1, 0ef5cf5, 1748804, 3e8f01d) verified in `git log`. Full suite: 65 files / 599 passed / 2 skipped (pre-existing Phase-6 built-bundle skips). Zero NP-STRICT markers; verbatim contracts untouched; throwing guard absent from ContextOptimizer.ts.