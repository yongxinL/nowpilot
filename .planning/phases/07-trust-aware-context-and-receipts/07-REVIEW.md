---
phase: 07-trust-aware-context-and-receipts
reviewed: 2026-08-30T15:10:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - package.json
  - src/core/context/ContextOptimizer.ts
  - src/core/context/trust/ContextQualityMetrics.ts
  - src/core/context/trust/ContextReceipt.ts
  - src/core/context/trust/SkillDisclosure.ts
  - src/core/context/trust/TrustPolicy.ts
  - src/core/context/trust/contextItems.ts
  - src/types/harness.ts
  - tests/core/context/trust/ContextQualityMetrics.test.ts
  - tests/core/context/trust/ContextReceipt.test.ts
  - tests/core/context/trust/SkillDisclosure.test.ts
  - tests/core/context/trust/TrustPolicy.test.ts
  - tests/core/context/trust/assemble-trust.test.ts
  - tests/core/context/trust/contextItems.test.ts
  - tests/core/context/trust/fixtures/stable-prefix.golden.txt
  - tests/core/context/trust/stable-prefix.snapshot.test.ts
  - tests/security/prompt-injection/policy-redefinition.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-30T15:10:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase-7 trust-aware context + receipts implementation (CTX-01..06): the C.1 trust types (`harness.ts`), O.3 TrustPolicy (wrap + strip + structural guard), D-94 item-pipeline builder, D-95/D-96 receipt derivation, D-102 quality metrics, D-101 SkillDisclosure, D-97 debug/notes ladder rungs, the trust wiring inside `assemble()`, the `verify:phase-7` gate re-point, and all 8 test suites (64 tests) + 1 golden fixture.

**Verification performed:** `tsc --noEmit` passes clean with zero NP-STRICT markers in the new code; all 64 phase-7 tests pass; the golden FNV-1a hash `6832adbf` independently recomputed and matches; the `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` literal follows the closed-set precedent (spec 5093, no registry edit); the no-raw-text D-102 boundary and the no-content-heuristic D-99/P7 guards are honored (verified by source inspection + the code-level structural test).

**Key concerns:** (1) a confirmed sourceId-collision bug — user-derived sourceIds (`debug`/`notes`) can collide with the synthetic debug/notes section sourceIds, inverting the rungs-1-2 ladder behavior and corrupting receipt entries; (2) the structural redefinition guard is narrower than the closed authority map — a `tool`-trusted item fabricating authority silently passes `isPolicyRedefinitionAttempt` while `AUTHORITY_BY_TRUST` marks tool authority as disallowed. No BLOCKER-level security bypass found: the wrap+strip enforcement in `applyTrustPolicy` is complete and correctly non-throwing in `assemble`.

## Warnings

### WR-01: sourceId collision between user-derived sourceIds and the reserved 'debug'/'notes' strings inverts the rungs 1-2 ladder and corrupts the receipt

**File:** `src/core/context/ContextOptimizer.ts:248-264` (rungs 1-2), `src/core/context/trust/ContextReceipt.ts:46-67` (isIncluded/omitReasonFor), `src/core/context/trust/contextItems.ts:73,100` (sourceId construction)
**Issue:** The omission semantics (`isIncluded`, `omitReasonFor`) and the ladder rungs 1-2 key on the raw `sourceId` string equality (`sourceId === 'debug'` / `'notes'`). But `sourceId` is user-derived: MEMORY sourceId = hint ids joined, TOOL SCHEMAS sourceId = tool names joined, CONTEXT sourceId = page URL. A memory hint (or tool) whose id is literally `debug` or `notes` collides with the synthetic D-97 sections.

**Empirically confirmed** with a scratch test (since removed): input with `memoryHints: [{ id: 'debug', content: 'x'.repeat(100000) }]` + `debugSections: [...]`, over budget →
- Rung 1 `working.find(w => w.record.sourceId === 'debug')` finds the **MEMORY** record (it precedes the debug-extra item in the working order) and **drops the 25k-token MEMORY section** instead of the debug noise;
- the actual **debug section ships in full** (`kind: 'context', sourceId: 'debug', truncated: false`) — the exact inverse of the rung intent;
- the receipt reports the shipped MEMORY record as `included: false, omitReason: 'debug-only'`, and `originalTokens` for it is 45 (the debug item's count) because `originalTokensBySourceId['debug']` was overwritten last-write-wins (ContextOptimizer.ts:388).

Same collision mislabels the metrics (`truncationCount`/`omissionCount`) and `truncatedSources`. `'system'`/`'task'` have the same structural fragility (a tool named `system` would produce a `tool_schemas` record excluded from `truncationCount` and mislabeled in the receipt).

**Fix:** Namespace the synthetic sourceIds so they cannot collide with user data — e.g. emit `np:debug` / `np:notes` in `extraContextItem` (ContextOptimizer.ts:405-418) and update the four `'debug'`/`'notes'` string comparisons accordingly — or, more defensively, key the omission semantics on the **kind + sourceId pair** (`record.kind === 'context' && record.sourceId === 'debug'`) in `ContextReceipt.isIncluded`/`omitReasonFor` and in rungs 1-2, so a `memory` record named `debug` can never be mistaken for a dropped debug section:

```typescript
// ContextReceipt.ts
function isIncluded(record: ManifestSectionRecord): boolean {
  if (record.kind === 'system' || record.kind === 'task') return false;
  if (record.kind === 'context' && (record.sourceId === 'debug' || record.sourceId === 'notes')) {
    return !record.truncated;
  }
  return true;
}
```

### WR-02: `isPolicyRedefinitionAttempt` is narrower than the closed authority map — a 'tool'-trusted item fabricating authority is invisible to the guard

**File:** `src/core/context/trust/TrustPolicy.ts:62-67` (and test comment `tests/core/context/trust/TrustPolicy.test.ts:108-112`)
**Issue:** `AUTHORITY_BY_TRUST` maps `tool: false` (spec 6371 — only system/user may carry authority), and `applyTrustPolicy` correctly wraps a tool-trusted item claiming authority. But the structural guard only checks `trust ∈ {retrieved, untrusted}`:

```typescript
return (
  (item.trust === 'retrieved' || item.trust === 'untrusted') &&
  item.instructionAuthority === true
);
```

A `tool`-trusted item with `instructionAuthority: true` therefore passes `isPolicyRedefinitionAttempt` and `raiseIfPolicyRedefinitionAttempt` raises nothing — the `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` typed signal never fires for the third disallowed trust level. The test at TrustPolicy.test.ts:108-112 even asserts this with the comment "(authority is allowed there)" — which contradicts the closed map it sits next to (`tool: false`). The security suite's hostile-tool-output fixture works around this by deliberately tagging `trust:'untrusted'` and documents that `'tool'` would be "unreachable by the structural guard" — a documented latent gap in the L5 seam. Today `buildContextItems` emits no tool-trusted items (only Phase 18 will), so the wrap still contains the attempt — but the guard, which is the typed consumer/alerting seam, stays silent.

**Fix:** Derive the predicate from the map so the guard and the enforcement can never drift apart:

```typescript
export function isPolicyRedefinitionAttempt(item: ContextItem): boolean {
  return !AUTHORITY_BY_TRUST[item.trust] && item.instructionAuthority === true;
}
```

(and correct the misleading test comment — `tool` authority is *not* allowed per the closed map).

## Info

### IN-01: metrics `trustMix` / `untrustedDataPresent` count items whose sections were dropped by the ladder

**File:** `src/core/context/ContextOptimizer.ts:202-204` + `src/core/context/trust/ContextQualityMetrics.ts:71-73`
**Issue:** `assemble` captures `items` (shippedItems) *before* the ladder runs; rungs 1-2 drop debug/notes sections by mutating the `working` array only. `deriveContextQualityMetrics` and `deriveContextReceipt` therefore count dropped debug/notes items in `trustMix` and `untrustedDataPresent` even though those sections never ship. `untrustedDataPresent` is arguably correct ("present in the assembly"), but `trustMix` describes a UI composition metric that no longer matches the shipped sections — inconsistent with `sectionCount`/`truncationCount`, which describe the shipped manifest.
**Fix:** If the metrics are meant to describe the shipped context, filter `items` by the same dropped-sourceIds before deriving (`items.filter(it => !droppedSourceIds.has(it.sourceId))`); otherwise document the "assembly-time item set" semantics in the interface doc.

### IN-02: `ContextReceiptEntry.omitReason` is a loose `string` instead of the closed 3-value union

**File:** `src/types/harness.ts:101`
**Issue:** The C.1 spec (spec 4892-4900) shape is `omitReason?: string`, but this repo's own discipline (D-38, closed literal unions — "make illegal states unrepresentable", harness.ts:18) and the module's own contract define exactly three reasons. `ContextReceipt.omitReasonFor` can also return `undefined` from its `default` branch for an omitted record with an unrecognized sourceId — an omitted entry with no reason (unreachable today, but only because WR-01's collision is the sole path that could produce it).
**Fix:** Type the union: `omitReason?: 'no-input-source' | 'debug-only' | 'secondary-notes'` in `harness.ts`, keeping the verbatim shape otherwise.

### IN-03: duplicated `working.filter(...)` computation in `assemble`

**File:** `src/core/context/ContextOptimizer.ts:202` and `:215`
**Issue:** `working.filter((w) => !w.dropped).map((w) => w.section)` is computed twice (once for the receipt, once for `context.sections`). Trivial, but the two call sites can drift if one is edited without the other (e.g., a future filter change).
**Fix:** Hoist to a local: `const shippedSections = working.filter((w) => !w.dropped).map((w) => w.section);` and use it in both places.

---

## Notes on invariants verified (no findings)

- **Strict TS zero NP-STRICT:** confirmed — no suppression markers in any reviewed file; `tsc --noEmit` clean.
- **Closed §21.6 set:** `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` follows the `CONTEXT_TOO_LARGE` literal precedent (spec 5093); no registry edit (D-38).
- **Verbatim contracts untouched:** manifest schema, A8 `PromptSection`, `CANONICAL_SECTION_ORDER`, and the golden fixture are byte-identical; golden FNV-1a `6832adbf` independently recomputed and matches.
- **`assemble` never throws:** the throwing guard is exported but unreachable from `assemble`; wrap+strip is the sole enforcement on the happy path — verified over the malicious-page/poisoned-note fixtures.
- **No content heuristics:** `TrustPolicy.ts` contains no `.text.match/includes/search` calls (test-asserted and source-verified); the D-102 metrics boundary is text-free (marker test passes).
- **D-69 create-only:** SkillDisclosure is standalone with zero imports from `assemble`; debug/notes rungs are additive no-ops when inputs are absent.
- **Golden snapshot discipline:** `stable-prefix.snapshot.test.ts` pins the packed prompt and independently cross-checks the FNV-1a hash; both pass.

---

_Reviewed: 2026-08-30T15:10:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_