---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 01
subsystem: extraction-dependencies
tags: [defuddle, readability, turndown, minisearch, pnpm, verify-script, package-legitimacy]

# Dependency graph
requires:
  - phase: 04a (research)
    provides: defuddle 0.19.2 useAsync API facts, version pins, package legitimacy audit
provides:
  - package.json deps: defuddle@^0.19.2 (0.19.2), @mozilla/readability@^0.5 (0.5.0), turndown@^7 (7.2.4), minisearch@^7 (7.2.0)
  - package.json devDeps: @types/turndown@^5 (5.0.6)
  - verify:phase-4a script (the §24 chain) — phase gate every later plan seals against
affects: [04a-03 (typecheck gate), 04a-04 (DefuddleStrategy MUST set useAsync:false), 04a-09 (isolation scan tokens), 04a-10 (phase gate)]

# Tech tracking
tech-stack:
  added: [defuddle 0.19.2, @mozilla/readability 0.5.0, turndown 7.2.4, minisearch 7.2.0, @types/turndown 5.0.6]
  patterns: [install-only wave (no imports), verify:phase-N §24 chain shape, blocking-human package-legitimacy gate]

key-files:
  created: []
  modified: [package.json, pnpm-lock.yaml, .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-01-PLAN.md]

key-decisions:
  - "defuddle installs at ^0.19 → 0.19.2 (USER DEVIATION from spec §7 ^0.6/0.6.6 pin, approved at the Task 1 gate); 0.19.2's useAsync option verified present — 04a-04 DefuddleStrategy MUST set useAsync:false (R-10 zero-network-call guarantee)"
  - "verify:phase-4a mirrors the §24 chain byte-identically to verify:phase-4; no test-count assertions (P-5); .mjs retirement deferred to 04a-09 (all six verify keys)"

patterns-established:
  - "Package-legitimacy gates: [SUS] verdicts never auto-approve — blocking-human checkpoint precedes install, user may amend the version scope"
  - "verify:phase-N scripts share one chain shape (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && isolation check)"

requirements-completed: [CAT-01]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Four extraction libraries + @types/turndown installed at pinned majors; defuddle resolves to exactly 0.19.2 (user-approved deviation from spec 0.6.6); useAsync option confirmed present in the 0.19.2 API surface"
    requirement: CAT-01
    verification:
      - kind: other
        ref: "pnpm ls defuddle @mozilla/readability turndown minisearch @types/turndown (defuddle@0.19.2, readability@0.5.0, turndown@7.2.4, minisearch@7.2.0, @types/turndown@5.0.6)"
        status: pass
      - kind: other
        ref: "node -p fs read node_modules/defuddle/package.json version -> 0.19.2"
        status: pass
      - kind: other
        ref: "grep useAsync node_modules/defuddle/dist/types.d.ts (useAsync?: boolean, defaults true) + README third-party fetch section"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify:phase-4a script added to package.json — §24 chain identical in shape to verify:phase-4, existing verify:phase-1..4 keys untouched"
    verification:
      - kind: other
        ref: "node -e \"const p=require('./package.json'); const s=p.scripts['verify:phase-4a']; if(!s||!s.includes('wxt build')||!s.includes('check-content-bundle.mjs')) process.exit(1)\""
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-12
status: complete
---

# Phase 04a Plan 01: Extraction Library Install + verify:phase-4a Gate Summary

**defuddle@0.19.2 (user-approved deviation from the spec §7 ^0.6 pin, with useAsync verified and flagged for `useAsync: false` in 04a-04) + @mozilla/readability@0.5.0 + turndown@7.2.4 + minisearch@7.2.0 + @types/turndown@5.0.6 installed; `verify:phase-4a` §24 gate script added to package.json**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-12T19:54:16Z
- **Completed:** 2026-08-12T20:00:34Z
- **Tasks:** 3 (1 blocking-human gate + 2 auto)
- **Files modified:** 3 (package.json, pnpm-lock.yaml, 04a-01-PLAN.md)

## Accomplishments
- Installed the four spec-§7-approved-but-uninstalled extraction libraries (R-9): defuddle@0.19.2, @mozilla/readability@0.5.0, turndown@7.2.4, minisearch@7.2.0 as dependencies, plus @types/turndown@5.0.6 (turndown 7 ships no bundled .d.ts) as a devDependency — the pipeline was dependency-blocked on these.
- Verified the 0.19.2 API surface exposes `useAsync?: boolean` (defaults `true`) with the README's documented third-party fetch fallback — this is the exact seam 04a-04's DefuddleStrategy must close with `useAsync: false` (R-10).
- Added `verify:phase-4a` mirroring the §24 chain byte-identically to verify:phase-4 (eslint → prettier --check → tsc --noEmit → wxt build → vitest run → isolation check), with existing verify:phase-1..4 keys untouched.
- Ran the blocking-human package-legitimacy gate before the install (never auto-approvable); the user approved with a version modification (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: Human verify — defuddle package legitimacy ([SUS] verdict)** — gate (no commit; user approved with modification)
2. **Task 2: Install the four approved extraction libraries + @types/turndown** - `c854702` (chore)
3. **Task 3: Add verify:phase-4a script (§24 chain)** - `118531e` (chore)

**Plan metadata:** pending (docs: complete plan commit follows)

_Note: Task 1 was the blocking-human package-legitimacy checkpoint that precedes the install; it produced no files. It was approved by the user with the defuddle version deviation recorded below._

## Files Created/Modified
- `package.json` - dependencies += { defuddle: ^0.19.2, @mozilla/readability: ^0.5.0, turndown: ^7.2.4, minisearch: ^7.2.0 }; devDependencies += { @types/turndown: ^5.0.6 }; scripts += { verify:phase-4a }
- `pnpm-lock.yaml` - lockfile updated for the five new packages
- `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-01-PLAN.md` - Task 2 action/acceptance/verify/done updated to ^0.19, flagged_assumptions A5 deviation note, threat T-4a-05 row, frontmatter truth + prohibition + verification + success criteria annotated

## Decisions Made
- **defuddle installed at ^0.19 → 0.19.2** (user decision at the Task 1 gate, overriding the spec-§7 ^0.6 → 0.6.6 pin). The install itself stays on an explicit range — never blind `latest`; all other four packages remain on their spec pins.
- **verify:phase-4a uses the §24 chain shape, no test-count assertions** (P-5 precedent from verify:phase-1..4); the `check-content-bundle.mjs` call stays until 04a-09 retires it across all six verify keys (D-4a-23).
- pnpm normalizes `^0.19` → `^0.19.2` and `^0.5` → `^0.5.0` in package.json — semantically identical ranges, consistent with the other pinned majors.

## Deviations from Plan

### User-Approved Deviation (gate decision)

**1. [Gate Decision - Package Version] defuddle upgraded 0.6.6 → 0.19.2 (user decision)**
- **Found during:** Task 1 (defuddle package-legitimacy checkpoint)
- **Issue:** The plan pinned `defuddle@^0.6` → 0.6.6 (spec §7 pin; RESEARCH: 0.6.6 has no useAsync → zero network calls, privacy-safe per R-10). At the blocking-human gate the user **approved with modification: install defuddle@0.19.2 (latest) instead**.
- **Fix:** Task 2 installed `defuddle@^0.19` → resolved 0.19.2. The plan was updated (Task 2 action/acceptance/verify/done, flagged_assumptions A5, prohibition, frontmatter truth, threat row T-4a-05, verification, success criteria) to record the deviation.
- **Follow-on requirement (recorded for 04a-04):** 0.19.2 adds the `useAsync` option (verified in `dist/types.d.ts`: `useAsync?: boolean`, defaults `true`) with a README-documented third-party fetch fallback (`parseAsync()` may fetch from third-party APIs when local HTML has no usable content). **DefuddleStrategy MUST set `useAsync: false`** to preserve the no-network-call privacy guarantee (R-10, research A5 — now ACTIVE, not a future upgrade note). Threat dispositions T-4a-SC/T-4a-05 unchanged: the blocking human gate covered 0.19.2 legitimacy at the user's direction.
- **Files modified:** package.json, pnpm-lock.yaml, 04a-01-PLAN.md
- **Verification:** `pnpm why defuddle` → defuddle@0.19.2 under dependencies; version read = 0.19.2; `useAsync` present in types + README.
- **Committed in:** c854702 (Task 2 commit)

### Auto-fixed Issues

**2. [Rule 3 - Blocking] defuddle@0.19.2 exports map blocks `require('defuddle/package.json')`**
- **Found during:** Task 2 (post-install version verification)
- **Issue:** The plan's `<verify>` command `node -p "require('defuddle/package.json').version"` throws `ERR_PACKAGE_PATH_NOT_EXPORTED` — the 0.19.2 package.json declares an `exports` map that does not expose `./package.json` (the pinned 0.6.6 had no exports map, so the command worked for the planned version).
- **Fix:** Verified the resolved version via `node -p "JSON.parse(require('fs').readFileSync('node_modules/defuddle/package.json','utf8')).version"` → 0.19.2. No production code affected (install-only plan).
- **Files modified:** none (verification-method adaptation only)
- **Verification:** fs-read version = 0.19.2 exactly; `pnpm why defuddle` confirms dependencies placement.
- **Committed in:** c854702 (part of Task 2 commit)

**3. [Rule 3 - Blocking] `pnpm vitest run tests/fixtures -x` fails: unknown option `-x` in vitest 4**
- **Found during:** Plan-level `<verification>` (fixtures smoke — owned by 04a-02, listed as a dependency note, not a 04a-01 gate)
- **Issue:** The plan's verification line invokes `-x`; vitest 4.1.10's CAC CLI rejects `Unknown option '-x'` (removed/renamed from the v4 CLI).
- **Fix:** Re-ran without `-x`: `pnpm vitest run tests/fixtures` → 1 file, 16 tests passed. Fixtures suite green, install broke nothing.
- **Files modified:** none (invocation adaptation only)
- **Verification:** 16/16 fixtures tests pass.
- **Committed in:** n/a (not a committed code change)

---

**Total deviations:** 1 user-approved gate decision (defuddle version) + 2 auto-fixed (verification-method adaptations)
**Impact on plan:** The defuddle version change carries a real follow-on (useAsync: false in 04a-04) — recorded in the plan and this SUMMARY so the DefuddleStrategy task cannot miss it. The two auto-fixes are verification-invocation adaptations with zero runtime impact. No scope creep; only the five approved-stack packages were installed.

## Issues Encountered
- **`-x` flag on vitest 4 CLI:** the plan's fixtures-smoke command uses a flag vitest 4 no longer accepts. Non-gate (04a-02 owns the fixtures suite); resolved by dropping `-x` — suite passes 16/16.
- **defuddle 0.19.2 `exports` map:** blocks package.json deep-require used by the plan's verify command. Resolved via fs read. Worth remembering for any later plan that reads `defuddle/package.json` through `require`/import.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **CAT-01 NOT marked complete** (deviation from mechanical `requirements mark-complete`, same precedent as 04a-02): the plan frontmatter lists `requirements: [CAT-01]`, but this plan delivers only the dependency install + gate script — CAT-01's full text ("content scripts extract `{title, url, text, metadata}` via defuddle (readability fallback, turndown APC-lite)") is realized by the strategy/service/content plans (04a-04, 04a-06, 04a-07, 04a-08) and sealed by the phase gate (04a-10). Marking it now would repeat the documented 03-01 mark-complete mistake (AI-01/AI-03 precedent: "a checkbox opens only when the FULL requirement text is realized"). REQUIREMENTS.md checkbox stays `[ ]`; traceability row stays `Pending` until the phase completes.
- **04a-03** (spec-verbatim types + PageContentSerializer): can now import turndown + its types (A1 assumption: @types/turndown@5.0.6 vs turndown 7.2.4 API verified at install; the 04a-03 typecheck gate is the final proof). Also can import minisearch.
- **04a-04** (DefuddleStrategy): MUST construct `new Defuddle(doc, { useAsync: false, ... })` — the 0.19.2 deviation makes this an active requirement, not a future note.
- **04a-09/04a-10:** isolation scan token list unchanged (defuddle already a forbidden content-side token); verify:phase-4a is the phase gate 04a-10 seals against.

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-12*

## Self-Check: PASSED

- package.json exists and contains defuddle ^0.19.2, @mozilla/readability ^0.5.0, turndown ^7.2.4, minisearch ^7.2.0, @types/turndown ^5.0.6, verify:phase-4a script — FOUND
- pnpm-lock.yaml updated — FOUND
- 04a-01-PLAN.md deviation annotations present (Task 2 action, A5 flagged_assumptions, T-4a-05 row) — FOUND
- Commit c854702 (chore(04a-01): install four extraction libraries + @types/turndown) — FOUND
- Commit 118531e (chore(04a-01): add verify:phase-4a script) — FOUND
