---
phase: 06-pagecontentservice-knowledge-acquisition
plan: 05
subsystem: testing
tags: [isolation-gate, verify-gate, adr, wxt, defuddle, vitest, grep]

requires:
  - phase: 06-01
    provides: DefuddleStrategy real-engine detached-doc tests (SPIKE-P6-01 evidence), PageContentService extraction stack
  - phase: 06-02
    provides: content-shell modules (AxDomWalker, PageContextBridge, ContentScriptHost, SPANavigationWatcher)
  - phase: 06-03
    provides: PageContentCache lifecycle
  - phase: 06-04
    provides: PageIndexBuilder + envelope producer wiring
provides:
  - tests/isolation/no-content-script-ui.test.ts — non-vacuous §24 isolation gate (source grep + built-bundle grep + <50 KB assertion + self-test)
  - verify:phase-6 re-pointed to the §18 required test dirs; stale phase-4a placeholder removed (D-92)
  - ADR-P6-01 flipped to Accepted with SPIKE-P6-01 outcome record (D-79)
  - GREEN phase gate: pnpm verify:phase-6 exits 0 (ROADMAP SC-7)
affects: [Phase 7 planner (verify:phase-7 mis-pointing + content-script entrypoint detection), ship gate (ROADMAP SC-2/SC-7)]

actuals:
  tokens: 4048        # chars/4 over the realized diff (16,194 chars across the 3 plan files)
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Non-vacuous grep gate: FORBIDDEN_RE + BUNDLE_FORBIDDEN_RE self-tested against planted violations (Pitfall 6 / #1479), comment-strip discipline, ERE group binding"
    - "Conditional built-bundle gate via describe.skipIf — the gate never depends on a build (RESEARCH Open Question 2)"

key-files:
  created:
    - tests/isolation/no-content-script-ui.test.ts
  modified:
    - package.json
    - .planning/adr/ADR-P6-01-defuddle-panel-side.md
    - .planning/phases/06-pagecontentservice-knowledge-acquisition/deferred-items.md

key-decisions:
  - "D-92 executed verbatim: verify:phase-6 = tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts; stale verify:phase-4a deleted; verify:phase-7 mis-pointing left for Phase-7's own reconciliation (RESEARCH Open Question 3)"
  - "D-79 executed: ADR-P6-01 → Accepted (2026-08-29) with SPIKE-P6-01 outcome recorded — guarded defaultView?.getComputedStyle in defuddle (nexus #329) + inline-only Readability _isProbablyVisible make detached-doc fidelity acceptable; no measurement pass"
  - "Built-bundle check uses manifest.json content_scripts[].js as the authoritative artifact list (WXT 0.20.27 .output/chrome-mv3 layout), with a content-scripts/*.js glob fallback"

patterns-established:
  - "Isolation gates reject the forbidden set as exact quoted module ids — never substring matches (no './react-ish' false positives)"
  - "Shell grep -E mirrors the JS regex with explicit grouping — ungrouped alternation (from\\s+|import\\s+|...) binds as top-level alternatives and matches ANY import (Rule 1 auto-fix during Task 1)"

requirements-completed: []  # infra plan — frontmatter `requirements: []` (ROADMAP Phase 6 note; acceptance = §18 DONE-when + D-79/D-92)

coverage:
  - id: D1
    description: "§18/§24 isolation gate test — FORBIDDEN_RE (React family, antd, defuddle + transitive mathml-to-latex/temml/turndown, yaml, File System Access API) greps content-script source AND the built bundle when present, asserts <50 KB, self-tests its own regex"
    verification:
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#no-content-script-ui isolation (D-92 / §24 rev 2026-08-12)"
        status: pass
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#no-content-script-ui self-test (proves the gate is not vacuous)"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify:phase-6 re-pointed to §18 test dirs + stale phase-4a removed (D-92)"
    verification:
      - kind: unit
        ref: "grep '\"verify:phase-6\"' package.json → tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts; phase-4a count 0; JSON.parse OK"
        status: pass
    human_judgment: false
  - id: D3
    description: "ADR-P6-01 flipped to Accepted with SPIKE-P6-01 outcome recorded (D-79) — evidence cited from DefuddleStrategy.test.ts"
    verification:
      - kind: unit
        ref: "grep 'Accepted' .planning/adr/ADR-P6-01-defuddle-panel-side.md; grep 'Spike Outcome' = 1; grep 'DefuddleStrategy.test.ts' present"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full phase gate GREEN — pnpm verify:phase-6 exits 0 (tsc + §18 dirs + isolation test; ROADMAP SC-7 / §24)"
    verification:
      - kind: unit
        ref: "pnpm verify:phase-6 → 9 files, 92 passed | 2 skipped (built-bundle skip mode), exit 0"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-08-30
status: complete
---

# Phase 6 Plan 5: Verification-surface closeout — §24 isolation gate, D-92 gate re-point, D-79 ADR flip

**Non-vacuous §24 isolation gate (source + built-bundle grep with self-test) shipped in tests/isolation/no-content-script-ui.test.ts, verify:phase-6 re-pointed to the §18 required test dirs with the stale phase-4a placeholder deleted (D-92), ADR-P6-01 flipped to Accepted with the SPIKE-P6-01 outcome recorded (D-79), and `pnpm verify:phase-6` GREEN end-to-end — the phase's definition of done (ROADMAP SC-2/SC-7).**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-30T00:22:57Z
- **Completed:** 2026-08-30T00:39:00Z
- **Tasks:** 3 (Task 1 = TDD: RED + GREEN commits)
- **Files modified:** 4 (3 plan files + deferred-items.md log)

## Accomplishments
- **§24 isolation gate (ROADMAP SC-2):** `tests/isolation/no-content-script-ui.test.ts` — `FORBIDDEN_RE` rejects the §24 rev 2026-08-12 forbidden set as exact-quoted import statements (react/react-dom/react-dom/client, antd, defuddle + defuddle/full, mathml-to-latex, temml, turndown, yaml) plus File System Access API pickers; source grep over `entrypoints/content/` + `src/core/content/` with comment-strip discipline; built-bundle grep + <50 KB assertion when artifacts exist (`manifest.json` `content_scripts[].js` as the authoritative list); 21 self-test assertions prove the regex non-vacuous (Pitfall 6 / #1479) and the legit RuntimeEnvelope/WXT imports stay unflagged. Zero NP-STRICT markers.
- **D-92 gate re-point:** `verify:phase-6` → `tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts`; stale `verify:phase-4a` placeholder deleted; `telemetry`/`DiagnosticsSection` no longer referenced by the gate.
- **D-79 ADR flip:** ADR-P6-01 Status → **Accepted (2026-08-29)**, with a `## Spike Outcome (SPIKE-P6-01)` section recording the guarded `defaultView?.getComputedStyle` (defuddle 0.19.x, nexus #329), Readability 0.6.0's inline-only `_isProbablyVisible` (Readability.js:2694-2707), the 06-01 tracer evidence (`DefuddleStrategy.test.ts` real-engine detached-doc tests), the accepted fidelity delta, and the conclusion: **no measurement pass**.
- **GREEN phase gate:** `pnpm verify:phase-6` exits 0 — 9 test files, 92 passed + 2 skipped (built-bundle checks in documented skip mode when no build artifact present).

## Task Commits

Each task was committed atomically:

1. **Task 1: no-content-script-ui.test.ts (§18/§24 isolation gate)** — `bb752b5` (test: RED gate — 13 failing self-tests against the stub regex) + `e491320` (feat: GREEN gate — full FORBIDDEN_RE, source + built-bundle greps, 25/25 green)
2. **Task 2: verify:phase-6 re-point + phase-4a removal (D-92)** — `eb66cbd` (chore)
3. **Task 3: ADR-P6-01 flip + full gate GREEN** — `eab8f36` (docs)

**Plan metadata:** pending final commit (docs: complete 06-05 plan)

## Files Created/Modified
- `tests/isolation/no-content-script-ui.test.ts` - The phase's §18/§24 isolation gate: FORBIDDEN_RE + BUNDLE_FORBIDDEN_RE, source grep (`entrypoints/content` + `src/core/content`), built-bundle grep + <50 KB assertion (skipIf when no artifact), 21 self-test assertions, zero NP-STRICT.
- `package.json` - verify:phase-6 re-pointed (D-92 verbatim); verify:phase-4a line deleted; verify:phase-7 untouched.
- `.planning/adr/ADR-P6-01-defuddle-panel-side.md` - Status → Accepted (2026-08-29) + `## Spike Outcome (SPIKE-P6-01)` section.
- `.planning/phases/06-pagecontentservice-knowledge-acquisition/deferred-items.md` - Out-of-scope discovery logged (content-script entrypoint detection, below).

## Decisions Made
- Executed D-92 and D-79 verbatim (see frontmatter key-decisions).
- Built-bundle artifact discovery: prefer `manifest.json` `content_scripts[].js` entries (authoritative across WXT layouts) over path globbing, with a `content-scripts/*.js` fallback.
- Kept the built-bundle checks behind `describe.skipIf(builtBundles.length === 0)` — the gate must stay fast and green without a build (RESEARCH Open Question 2 recommendation; the plan's automated verify passes without `pnpm build:ext`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shell grep -E alternation-precedence bug flagged every import**
- **Found during:** Task 1 (GREEN implementation, first test run)
- **Issue:** The shell ERE `from\s+|import\s+|require\(\s*['"](pkg)['"]` binds `from\s+`/`import\s+` as top-level alternatives (ERE has no non-capturing groups), so it matched ANY import statement — 11 false positives on legitimate RuntimeEnvelope/WXT imports. The JS regex (with `(?:...)`) was correct; only the shell mirror was wrong.
- **Fix:** Wrapped the prefix alternatives in an explicit ERE group: `(from\s+|import\s+|require\(\s*)['"](pkg)['"]` — documented in a code comment so a future edit doesn't reintroduce it.
- **Files modified:** tests/isolation/no-content-script-ui.test.ts
- **Verification:** `npx vitest run tests/isolation/no-content-script-ui.test.ts` → real source grep returns [] (2nd run: 23 passed); full gate green at Task 3.
- **Committed in:** e491320 (Task 1 GREEN)

**2. [Rule 1 - Bug] Comment-strip self-test format mismatch**
- **Found during:** Task 1 (GREEN implementation, first test run)
- **Issue:** The scratch comment-strip self-test piped a line to `grep -n` on stdin, which emits `1:// ...` (line number, no `path:` prefix) — the `grepForViolations` strip regex expects `path:line:` format, so the comment line wasn't stripped and tripped the gate.
- **Fix:** Added `-H --label=scratch` to the scratch grep so stdin output matches the real file-scan format (`scratch:1:...`) the strip regex handles.
- **Files modified:** tests/isolation/no-content-script-ui.test.ts
- **Verification:** self-test passes (25/25 with built bundle present, 23/25 in skip mode).
- **Committed in:** e491320 (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug, in the new test file itself). No scope creep — both were defects in the gate's own mechanics.

## Out-of-Scope Discovery (NOT fixed — plan prohibits module edits)

**`entrypoints/content/core.content.ts` is not a valid WXT 0.20.27 entrypoint — the content script is never built or registered in the extension manifest.** Verified with picomatch against WXT's `PATH_GLOB_TO_TYPE_MAP` (node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs:259): the D-07a "directory form" path matches none of the content-script globs (`content.[jt]s?(x)`, `content/index.[jt]s?(x)`, `*.content.[jt]s?(x)`, `*.content/index.[jt]s?(x)`). Consequence: the built-bundle isolation check skips permanently until fixed, and the extension ships without a content script (D-84 producer wiring is dead at build level). This is a **pre-existing issue** (the stale pre-Phase-6 `.output` also had no content_scripts) caused by the owning plans' entrypoint shape, not by 06-05 changes — logged to `deferred-items.md` for the Phase 7 planner / Phase-1 entrypoint owner (D-07a area). Fix options: rename to `entrypoints/content/index.ts` (re-export core.content.ts) or move to `entrypoints/content.core.content.ts`.

**Evidence from a transient scratch experiment (no committed changes):** a temporary `entrypoints/content/index.ts` re-export built the content script cleanly — `.output/chrome-mv3/content-scripts/content.js` at **9.51 kB** (well under the 50 KB target), manifest registered it with `world: ISOLATED`, and the isolation gate passed **25/25** including both built-bundle checks (zero forbidden module ids). This proves the Phase-6 content modules are clean and the only defect is the entrypoint shape. The scratch file was removed and the build restored to its pristine state immediately after.

## Issues Encountered
- The TDD RED run (13 failing self-tests against the stub regex) and the two Rule-1 fixes above — all resolved within Task 1; no remaining issues.
- **Flag for Phase 7 planner (RESEARCH Open Question 3, NOT fixed per plan):** `verify:phase-7` (package.json:25) still mis-points at Phase-15 dirs (`tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes`) — Phase-7's own gate reconciliation must re-point it to `tests/core/context/trust tests/security/prompt-injection`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **Phase 6 DONE-when met:** `pnpm verify:phase-6` is GREEN (§24 / ROADMAP SC-7); the isolation gate enforces SC-2 at the source level today and at the built-bundle level as soon as the entrypoint detection defect is fixed.
- **Blockers/concerns for successors:** (1) the content-script entrypoint detection issue (deferred-items.md) must be resolved before the built-bundle check can exercise in CI; (2) `verify:phase-7` mis-pointing is Phase-7's to fix; (3) the ADR-P6-01 accepted fidelity delta (stylesheet-driven `display:none` inert on detached docs) is documented for any future extraction-fidelity work.

---
*Phase: 06-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-30*

## Self-Check: PASSED

- Created files verified on disk: `tests/isolation/no-content-script-ui.test.ts`, `06-05-SUMMARY.md`
- All 4 task commits verified in git log: `bb752b5` (RED), `e491320` (GREEN), `eb66cbd` (Task 2), `eab8f36` (Task 3)
- Gate verification: `pnpm verify:phase-6` exits 0 (9 files, 92 passed + 2 documented skips)