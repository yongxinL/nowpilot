---
phase: 07-trust-aware-context-and-receipts
plan: 02
subsystem: context-trust
tags: [context-quality-metrics, CTX-06, stable-prefix-snapshot, CTX-04, D-100, D-102, FNV-1a, golden-fixture]

# Dependency graph
requires:
  - phase: 07-trust-aware-context-and-receipts
    plan: 01
    provides: "Trust spine: D-93 item pipeline inside assemble (ContextItem[]), D-95 derived receipt (ContextReceiptSurface), D-96 original token counts — the manifest/receipt/items surfaces deriveContextQualityMetrics and the snapshot test's canonical fixture run through"
provides:
  - "CTX-06 derived aggregate metrics surface: deriveContextQualityMetrics(manifest, receipt, items) → ContextQualityMetrics { sectionCount, trustMix, truncationCount, omissionCount, compressionCount, tokenUtilizationRatio, minimalMode } — aggregates only, no raw text (D-102/UI-SPEC Contract B)"
  - "CTX-04 stable-prefix release block: committed golden fixture + awaited toMatchFileSnapshot byte-identity + hashStableSections FNV-1a golden hash cross-check — any system-prompt diff fails the test and blocks verify:phase-7 (gated in 07-03 by D-103)"
  - "Additive metrics attach on OptimizedContext (D-77 pattern — same as the 07-01 receipt attach); assemble stays never-throw; verbatim manifest/A8/section-order contracts untouched"
affects: [07-03 (gate re-point runs these suites), phase-11 (PromptTrace/DiagnosticsSection lifts the metrics surface additively; UI-SPEC copy seeds), phase-15 (persona/SYSTEM extends the golden — RESEARCH reconciliation 3)]

# Actuals (#2632) — pairs with the plan's `estimate` (40000 tokens) to calibrate future estimates.
actuals:
  tokens: 5980    # chars/4 over the realized diff (git diff 5dcb716..HEAD | wc -c = 23922)
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []  # zero new packages (Package Legitimacy Audit vacuous)
  patterns:
    - "Aggregate-only derived metrics (D-102): filter/map/reduce over manifest records + receipt entries + item trust — never section bodies (mirrors manifestTruncatedSources ContextOptimizer.ts:441-445)"
    - "Committed golden snapshot (D-100): vitest toMatchFileSnapshot (async — awaited) on the deterministic packed output; golden regeneration is a deliberate fixture update documented in the test header, never a silent refresh"
    - "FNV-1a cache-contract cross-check: hashStableSections golden hash pins the §1.3 stable set independently of byte identity (spec 5747+; only TOOL SCHEMAS is stable:true)"

key-files:
  created:
    - src/core/context/trust/ContextQualityMetrics.ts
    - tests/core/context/trust/ContextQualityMetrics.test.ts
    - tests/core/context/trust/stable-prefix.snapshot.test.ts
    - tests/core/context/trust/fixtures/stable-prefix.golden.txt
  modified:
    - src/core/context/ContextOptimizer.ts

key-decisions:
  - "USER PREFERENCES is included in the packed golden because prefsCompact renders deterministically for a fixed input, NOT because it is cache-stable — the flag stays stable:false (RESEARCH reconciliation 3; no Phase-5/PromptCacheManager cache-semantics change); the FNV-1a cross-check pins only the genuinely stable sections"
  - "Golden hash hard-coded as the committed oracle (6832adbf) from the first deterministic run — same commit discipline as the golden file; regeneration path documented (delete golden + rerun + review + commit on INTENTIONAL prompt change)"
  - "truncationCount excludes the by-design system/task omission records (the manifestTruncatedSources filter precedent) so truncation metrics count degradation events, not absence-of-input-source records"
  - "tokenUtilizationRatio is Σ final / Σ original over receipt entries, rounded to 4dp, with 1 (never NaN) for an empty receipt — the zero-divisor guard makes the aggregate safe for degenerate manifests"

patterns-established:
  - "Pattern 1 (additive metrics attach): assemble derives metrics from manifest + receipt + items after the receipt derivation and adds the field to the OptimizedContext literal — the exact D-77/07-01 receipt precedent; no signature change, existing callers compile"
  - "Pattern 2 (no-raw-text boundary proven twice): grep-asserted zero `.text` reads in ContextQualityMetrics.ts AND a SECRET_PAGE_BODY_XYZ marker test asserting JSON.stringify(metrics) lacks fixture body text — belt-and-braces D-102/Contract B"
  - "Pattern 3 (snapshot discipline): canonical fixture documented in the test header (medium tier, name-sorted tools, deterministic prefs); golden reviewed for correctness (TOOL SCHEMAS text + CONTEXT URL line) before commit; hash cross-check independent of byte identity"

requirements-completed: [CTX-04, CTX-06]

# Coverage metadata (#1602) — one entry per shipped deliverable (all proven by passing unit suites; full suite 612 passed).
coverage:
  - id: D1
    description: "CTX-06 derived aggregate metrics — deriveContextQualityMetrics(manifest, receipt, items) → ContextQualityMetrics (sectionCount, trustMix with all five TrustLevel keys, truncationCount excluding system/task omissions, omissionCount, compressionCount, tokenUtilizationRatio 4dp/1-for-empty, minimalMode); aggregates ONLY — no section bodies, no raw sensitive text (D-102/UI-SPEC Contract B); attached additively to OptimizedContext (D-77 precedent)"
    requirement: CTX-06
    verification:
      - kind: unit
        ref: "tests/core/context/trust/ContextQualityMetrics.test.ts#deriveContextQualityMetrics — 11 tests: trust mix map, truncation filter, omission/compression counts, ratio 400/500 → 0.8 + empty-receipt 1, minimalMode mirror, SECRET_PAGE_BODY_XYZ no-leak boundary, empty-items all-zero shape"
        status: pass
      - kind: unit
        ref: "pnpm run lint (tsc --noEmit) — strict-clean, zero NP-STRICT markers; grep 'section.text|\\.text' on ContextQualityMetrics.ts = 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "CTX-04 stable-prefix release block — committed golden fixture (tests/core/context/trust/fixtures/stable-prefix.golden.txt) byte-identical to the deterministic packed output of the canonical fixture (awaited toMatchFileSnapshot), cross-checked against the hashStableSections FNV-1a golden hash 6832adbf (spec 5747+); a system-prompt diff fails the test and blocks release via verify:phase-7 (re-pointed in 07-03, D-103)"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: "tests/core/context/trust/stable-prefix.snapshot.test.ts#stable-prefix golden snapshot — packed stable prefix byte-identical to committed golden (async toMatchFileSnapshot) + FNV-1a hash matches golden"
        status: pass
      - kind: unit
        ref: "git status --porcelain on ContextOptimizer/ContextPack/PromptCacheAdapter/ai types/ContextProvenanceManifest = 0 (snapshot only observes); golden non-empty (test -s); golden contains TOOL SCHEMAS text + CONTEXT URL line"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-30
status: complete
---

# Phase 7 Plan 2: Context Quality Metrics + Stable-Prefix Golden Snapshots Summary

**The CTX-06 derived aggregate metrics surface (`deriveContextQualityMetrics` — section count, full five-key trust mix, truncation/omission/compression counts, token utilization ratio, minimalMode) attached additively to `OptimizedContext` with a test-proven no-raw-text boundary (D-102/Contract B), plus the CTX-04 committed golden snapshot of the deterministic packed output cross-checked against the `hashStableSections` FNV-1a golden hash — a system-prompt diff now fails the test and blocks release.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-30T04:45:13Z
- **Completed:** 2026-08-30T04:48:20Z
- **Tasks:** 2 (2 auto)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- **CTX-06 derived aggregate metrics (D-102/UI-SPEC Contract B)** — `deriveContextQualityMetrics(manifest, receipt, items)` returns `ContextQualityMetrics`: `sectionCount`, `trustMix` (all five `TrustLevel` keys, 0 for absent levels), `truncationCount` (excluding the by-design system/task omission records — the `manifestTruncatedSources` filter precedent), `omissionCount`, `compressionCount`, `tokenUtilizationRatio` (Σ final / Σ original, rounded to 4dp, `1` for an empty receipt — zero-divisor guarded, never NaN), `minimalMode`. Aggregates computed by iterating records/entries/items — a section's text is never read into the shape (grep-asserted zero `.text` reads).
- **No-raw-text boundary proven twice** — the module's zero section-body reads (grep gate) AND the test's `SECRET_PAGE_BODY_XYZ` marker placed in the fixture page content asserting `JSON.stringify(metrics)` never contains it (D-102 hard boundary, mirrored from the D-77 trace-surface discipline).
- **Additive `metrics` attach on `OptimizedContext`** — `assemble` computes the metrics from the manifest + derived receipt + item trust mix after the receipt derivation and adds the field to the context literal (the exact D-77/07-01 receipt precedent). No signature change, no throw path, existing callers compile; the verbatim manifest schema, A8 `PromptSection`, and §1.3 canonical order stay byte-identical.
- **CTX-04 stable-prefix release block** — committed golden fixture `tests/core/context/trust/fixtures/stable-prefix.golden.txt` is the deterministic packed output (`pack().prompt`, `\n\n`-joined in §1.3 order: TOOL SCHEMAS → USER PREFERENCES → MEMORY → CONTEXT → USER INPUT) of a documented canonical fixture (medium tier 131072, 3 name-sorted tool schemas, 2 memory hints, preferences with both model fields + personaOverrides). The byte-identity test uses vitest's `toMatchFileSnapshot` — the repo's first file-snapshot use, correctly awaited (PATTERNS no-analog note). Any system-prompt change (tool-schema rendering, `prefsCompact`, separators, ordering) diffs the golden → test fails → `verify:phase-7` (re-pointed in 07-03 by D-103) blocks release.
- **FNV-1a cache-contract cross-check** — `hashStableSections(result.context.sections)` equals the committed golden hash `6832adbf` (computed from the first deterministic run). Only TOOL SCHEMAS is `stable:true` in the shipped emission, so the hash independently pins the §1.3 cache contract (spec 5747+).
- **USER PREFERENCES reconciliation honored** — the packed golden includes the USER PREFERENCES text because `prefsCompact` renders deterministically for a fixed input, NOT because it is cache-stable; the flag stays `stable:false` (RESEARCH reconciliation 3 — no Phase-5/PromptCacheManager cache-semantics change, T-7-07 mitigated). Regeneration path documented in the test header: intentional prompt change → delete golden + rerun + review + commit, never a silent refresh.
- **Full-suite green** — 67 files / 612 passed / 2 skipped (pre-existing Phase-6 built-bundle skips); 13 new tests (11 metrics + 2 snapshot) over the 07-01 baseline; Phase-5 regression suites (ContextOptimizer/ContextCompressor/TokenBudget) all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: ContextQualityMetrics — derived aggregates with a no-raw-text boundary (CTX-06)** - `f85a904` (feat)
2. **Task 2: Stable-prefix golden snapshots + FNV-1a hash cross-check (CTX-04)** - `e7ecf2d` (test)

**Plan metadata:** pending (orchestrator-owned STATE.md/ROADMAP.md writes are skipped per sequential-executor contract; SUMMARY commit follows).

## Files Created/Modified

- `src/core/context/trust/ContextQualityMetrics.ts` - `deriveContextQualityMetrics` → `ContextQualityMetrics` aggregate interface (D-102/Contract B); header cites D-102 + UI-SPEC Contract B + the D-77 trace-surface precedent
- `src/core/context/ContextOptimizer.ts` - Additive: `deriveContextQualityMetrics` import, `metrics: ContextQualityMetrics` on `OptimizedContext`, metrics derivation + attach in `assemble` after the receipt (D-77 precedent; never-throw preserved)
- `tests/core/context/trust/ContextQualityMetrics.test.ts` - 11 tests: trustMix map (1 system + 1 user + 2 retrieved + 1 untrusted + 0 tool), truncation filter, omission/compression counts, ratio 400/500 → 0.8 + empty-receipt 1, minimalMode mirror, `SECRET_PAGE_BODY_XYZ` no-leak boundary, empty-items all-zero shape, exact Contract B key set
- `tests/core/context/trust/stable-prefix.snapshot.test.ts` - 2 tests: awaited `toMatchFileSnapshot` byte-identity vs the committed golden + `hashStableSections` FNV-1a golden hash cross-check; canonical fixture + USER PREFERENCES reconciliation + regeneration path documented in the header
- `tests/core/context/trust/fixtures/stable-prefix.golden.txt` - 18-line committed golden: the deterministic packed output for the canonical fixture (TOOL SCHEMAS / prefsCompact / MEMORY / CONTEXT URL+TITLE+body / USER INPUT)

## Decisions Made

- **USER PREFERENCES in the golden, flag untouched** — the packed output includes USER PREFERENCES because rendering is deterministic for a fixed input; the `stable:false` flag is NOT flipped (RESEARCH reconciliation 3 — flipping would change Phase-5/PromptCacheManager cache semantics). The FNV-1a cross-check pins only the genuinely stable sections.
- **Golden hash committed as the oracle** — `6832adbf` hard-coded from the first deterministic run; regeneration is a deliberate fixture update (delete golden + rerun + review + commit) on an intentional prompt change.
- **`truncationCount` excludes system/task omission records** — truncation metrics count genuine degradation events, mirroring `manifestTruncatedSources` (ContextOptimizer.ts:441-445); the receipt's `included:false` drives `omissionCount` separately.
- **`tokenUtilizationRatio` guards the zero divisor** — empty receipt → `1`, never NaN; ratio rounded to 4dp so diagnostics render a stable, finite value.

## Deviations from Plan

None - plan executed exactly as written. All prohibitions honored: USER PREFERENCES not flipped to `stable:true`; no section bodies in the metrics shape (grep-asserted + marker-tested); no edits to the manifest schema / A8 `PromptSection` / `CANONICAL_SECTION_ORDER`; `assemble` stays never-throw; zero NP-STRICT markers in all new/modified files; no snapshot library (vitest's built-in `toMatchFileSnapshot`); the golden file is committed (test -s gate); Task 2 made zero source edits (git status assertion).

## Issues Encountered

- **Golden-hash first-run flow (expected snapshot semantics)** — on the first snapshot run the byte-identity test wrote the golden and passed, while the FNV-1a cross-check failed with the as-yet-uncommitted hash; the actual value `6832adbf` was read from the failure output and hard-coded as the golden oracle, then both tests re-ran green. This is the documented two-phase golden establishment (write golden → review → commit hash), not a defect.

## Known Stubs

None - every deliverable is wired: `metrics` is attached to `OptimizedContext` in `assemble`; the snapshot test runs against the shipped pipeline (07-01 integrated the trust layer); the golden is the committed release-block artifact. (D-69 create-only holds: nothing imports the metrics/snapshot surfaces from components/AI runtime — by design, `assemble` stays proven-by-tests until Phase 8; Phase 11 lifts the metrics into PromptTrace/DiagnosticsSection additively.)

## User Setup Required

None - no external service configuration required (zero new packages, pure TypeScript phase).

## Next Phase Readiness

- Ready for **07-03** (SkillDisclosure CTX-05 + `verify:phase-7` gate re-point D-103 to `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection`) — the trust dir now holds 6 suites (45 tests) including the CTX-04 snapshot, so the re-pointed gate will run the release block; the gate's D-103 wiring is 07-03's Task 2 per the plan.
- Ready for **Phase 11** (PromptTrace/DiagnosticsSection) — the `metrics` surface on `OptimizedContext` is the D-102 additive seam with UI-SPEC copy seeds pre-locked.
- Ready for **Phase 15** (persona/SYSTEM) — when SYSTEM arrives, the golden extends deliberately (documented regeneration path).
- No blockers.

---
*Phase: 07-trust-aware-context-and-receipts*
*Completed: 2026-08-30*