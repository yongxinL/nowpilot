---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 03
subsystem: testing
tags: [mv3, wxt, manifest-inspection, build-gate, content-script, least-privilege, option-c, operator-decision, csp, host-permissions, t-1-11, t-1-12, t-1-13, t-1-14]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-02's WXT `srcDir: 'src'` relocation, the authorised manifest shape (no options keys, `connect-src 'none'`, ServiceNow-only hosts) and the build observation that the relocated content script became discoverable (`content_scripts` with `<all_urls>`)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-01's frozen D-04 inventory, its `Resolved hand-off decisions` item 1 (H-1/OQ1) and the operator checkpoint this plan closes
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-06's canonical/scaffold message-type split — the content script's `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` literals stay scaffold-local and no Phase-1 handler depends on them
provides:
  - "`tests/isolation/generated-manifest.test.ts` — the read-only build-inspection gate (10 cases) that cannot pass without `pnpm run build:ext` and asserts the authorised manifest shape"
  - "The Option C content-script decision applied: the pilot entrypoint is kept at the canonical directory but staged as `src/entrypoints/content/core.content.ts`, a filename no WXT content glob matches — the Phase-1 manifest carries **no `content_scripts` key** and grants no host access through it"
  - "The declared content-script `matches` pinned to the already-authorised ServiceNow host set — never `<all_urls>` again — with a source-level assertion that a future restore cannot silently widen host access"
  - "The decision recorded in `01-MIGRATION-INVENTORY.md` with its affected requirement IDs, its owning plan (Phase 6) and its removal condition; broken-windows ledger id 1 closed"
affects: [01-11, 01-13, 06, 17]

actuals:
  tokens: 3985    # chars/4 over the realized src+tests diff (git diff -U0 e4de0255..HEAD -- src tests = 15,939 chars)
  tasks: 3
  commits: 3      # measured: git rev-list --count e4de0255..HEAD
  plan_head_before: e4de02559e6c1b3adf84c56d7b4268c26e4df2d7

tech-stack:
  added: []
  patterns:
    - "A build-inspection gate fails (never skips) when the artifact is absent, and every failure message names the exact build command that produces it"
    - "A decision that removes manifest surface is pinned twice — the artifact assertion (the key's absence) and a source assertion on the declared scope — so neither a rename nor a widened match can silently reintroduce it"
    - "An exclusion mechanic is chosen for structure, not procedure: a filename that matches no WXT glob cannot be defeated by hook ordering or a config merge, and the gate proves the exclusion is real"
    - "Deliberate-violation probes are chosen for the mechanic actually implemented: the discovery-switch flip (rename back to `index.ts`) proves the absence case, and a widened `matches` proves the source pin"

key-files:
  created:
    - tests/isolation/generated-manifest.test.ts
  modified:
    - src/entrypoints/content/core.content.ts (renamed from src/entrypoints/content/index.ts)
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md
    - .planning/WINDOWS.md
    - tests/isolation/cross-entrypoint-imports.test.ts (comment-only path correction)

key-decisions:
  - "Option C was applied with the rename mechanic, not a build hook: `src/entrypoints/content/core.content.ts` matches none of WXT's content-script globs (verified in WXT 0.20.27's `PATH_GLOB_TO_TYPE_MAP`, where `*` does not cross `/`), so the exclusion is structural — it cannot be defeated by hook ordering or a config merge — and the build emits no `content-scripts/` artifact at all."
  - "The declared `matches` was narrowed to the already-authorised ServiceNow host set while the file is excluded. Leaving the prototype's `<all_urls>` in place would have made the removal condition (Phase 6 restores `index.ts`) a silent host-access widening — exactly what the plan's must-have forbids and T-1-12 exists to prevent."
  - "The manifest gate asserts the `content_scripts` key's ABSENCE (case 9) and pins the staged source's declared `matches` (case 10). Together they make the decision real in both directions: flipping the discovery switch fails case 9, widening the declared scope fails case 10."
  - "The content-script row's `Target canonical path` cell keeps the canonical target (`src/entrypoints/content/index.ts`); the Phase-1 staged path is recorded in the row's status note and in H-1, because the canonical intent is unchanged and only the Phase-1 realisation is temporarily excluded."
  - "The removal condition names Phase 6 (PageContentService) as the owner, with Phase 17 as the secondary claimant of the scaffold literals; the manifest gate must be flipped from absence to its decided presence assertion in the same change that renames the file back."

patterns-established:
  - "A decision record carries its own removal condition: the exclusion is not 'temporary' until it names the owning plan, the exact change, and the test that must flip with it"
  - "An instrument whose wording assumes the rejected option is re-derived rather than skipped, and both readings are recorded (see Deviations 1)"
  - "A source scan asserts an inert declared value (a `matches` array on a build-excluded file) precisely because it becomes live the moment the exclusion is removed"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "A read-only build-inspection gate exists that reads `.output/chrome-mv3/manifest.json` and asserts the authorised Phase-1 shape (permissions, no options keys, `manifest_version`, `side_panel.default_path`, CSP by string equality, exact `host_permissions`)."
    requirement: "CORE-01"
    verification:
      - kind: integration
        ref: "pnpm run build:ext && npx vitest run tests/isolation/generated-manifest.test.ts (10 passed)"
        status: pass
      - kind: unit
        ref: "tests/isolation/generated-manifest.test.ts#1. exposes a built, parseable manifest — a missing artifact fails, it never skips"
        status: pass
      - kind: other
        ref: "deliberate missing-artifact run: mv .output .output.bak; npx vitest run tests/isolation/generated-manifest.test.ts → exit=1 with a message naming `pnpm run build:ext`; .output restored and rebuilt"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Phase-1 manifest carries no `content_scripts` key and no content-script artifact is emitted, while `permissions` and `host_permissions` are unchanged (Option C applied)."
    requirement: "CORE-01"
    verification:
      - kind: integration
        ref: "pnpm run build:ext → manifest.json 777 B with no `content_scripts` key, no `content-scripts/` output directory; permissions `[sidePanel,storage,tabs]`, host_permissions ServiceNow-only (read back from the artifact)"
        status: pass
      - kind: unit
        ref: "tests/isolation/generated-manifest.test.ts#9. carries no content_scripts key — the pilot entrypoint is excluded from the Phase-1 build"
        status: pass
      - kind: other
        ref: "deliberate discovery-switch probe: rename core.content.ts → index.ts, rebuild → case 9 fails; restored → 10/10 green"
        status: pass
    human_judgment: false
  - id: D3
    description: "The staged content script's declared `matches` equals the already-authorised host set and never `<all_urls>`, so a future restore cannot silently widen host access."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/isolation/generated-manifest.test.ts#10. declares no host match wider than the manifest already authorises"
        status: pass
      - kind: other
        ref: "deliberate scope probe: set matches: ['<all_urls>'] → case 10 fails (`expected [ '<all_urls>' ] to not include '<all_urls>'`); restored → green"
        status: pass
    human_judgment: false
  - id: D4
    description: "The injection-scope decision is recorded as a final resolution with affected requirement IDs, its owning plan and its removal condition; no `provisional`/`recommend` wording remains in item 1."
    requirement: "CORE-01"
    verification:
      - kind: other
        ref: "grep -n \"Resolved hand-off decisions\" -A 6 01-MIGRATION-INVENTORY.md | grep -ci \"provisional\\|recommend\" → 0"
        status: pass
      - kind: other
        ref: "git log --oneline -1 -- src/entrypoints/content/index.ts → 17ed16d1 (the plan's own commit; both readings of the instrument recorded in Deviations 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The rename and the assertion flip break nothing else: the full suite, the isolation gate and the strict-ceiling gate are green, and concurrent manifest inspections are stable."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "npx vitest run → 36 files / 459 tests passed (449 baseline + 10 new)"
        status: pass
      - kind: unit
        ref: "npx vitest run tests/isolation tests/core/strict → 3 files / 34 tests passed"
        status: pass
      - kind: other
        ref: "two concurrent runs of the manifest suite both pass 10/10 and leave the artifact byte-identical (md5 7c17db9c…, 777 B)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 03: Generated-Manifest Inspection Gate + Content-Script Injection-Scope Decision Summary

**The MV3 manifest is now locked under a ten-case build-inspection gate that cannot pass without the build, and the operator's Option C decision is applied — the pilot content entrypoint is kept but staged under a filename no WXT glob matches, so the Phase-1 manifest carries no `content_scripts` key and never requests `<all_urls>`**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-21T20:44:30Z
- **Completed:** 2026-09-21T20:51:30Z
- **Tasks:** 3
- **Files modified:** 6 tracked paths across 3 commits (296 insertions / 83 deletions)

## Accomplishments

- **The generated manifest is asserted, not eyeballed.** `tests/isolation/generated-manifest.test.ts` reads `.output/chrome-mv3/manifest.json` with `node:fs` and asserts, as ten separate cases, the sorted permission set `["sidePanel","storage","tabs"]`, the absence of both `options_ui` and `options_page`, `manifest_version: 3`, `side_panel.default_path: "sidepanel.html"`, the Phase-1 CSP by string equality, the exact `host_permissions` array, the `content_scripts` key's absence and the staged source's declared scope. It is read-only — it never builds, never writes and never mutates the artifact — so repeated and concurrent inspections return the same result.
- **The gate cannot pass without the build.** There is no `describe.skip`, no `it.skip`, no `it.todo` and no `if (!existsSync(...)) return`: a missing or unparseable artifact throws with a message naming `pnpm run build:ext`. Proven by the deliberate missing-artifact run, which printed `exit=1`.
- **The operator's Option C decision is applied with structural mechanics.** `src/entrypoints/content/index.ts` → `src/entrypoints/content/core.content.ts`. The name matches none of WXT 0.20.27's content-script globs (`content.[jt]s?(x)`, `content/index.[jt]s?(x)`, `*.content.[jt]s?(x)`, `*.content/index.[jt]s?(x)` — `*` does not cross `/`), so the build now emits **no `content-scripts/` artifact at all** and the manifest is 777 B with **no `content_scripts` key**; `permissions` and `host_permissions` are unchanged.
- **The prototype's `<all_urls>` is gone and cannot come back silently.** The staged file declares `matches: ['*://*.service-now.com/*', '*://support.servicenow.com/*']` — the hosts the manifest already authorises — and case 10 asserts the declared array, so restoring the file as a WXT entrypoint in Phase 6 cannot silently widen host access. The extraction-only comments, the `no fetch(.)` rule, `runAt: 'document_idle'`, `world: 'ISOLATED'` and the `CONTENT_SCRIPT_READY` send with its `.catch(() => {})` are all preserved.
- **Both gate directions have teeth, proved by deliberate-violation probes.** Renaming the file back to `index.ts` and rebuilding makes case 9 fail (`'content_scripts' in manifest` → true); widening `matches` to `<all_urls>` makes case 10 fail naming the mismatch. The restored tree is green (10/10) and the full suite is green (36 files / 459 tests).
- **The decision is recorded with its owner and its removal condition.** `01-MIGRATION-INVENTORY.md` § Resolved hand-off decisions item 1 (H-1, and its OQ1 cross-reference) now carries the final resolution — affected requirement IDs (CORE-01; owning plan Phase 6, secondary Phase 17), the reason, the explicit *decided rather than inherited* statement, and the removal condition (Phase 6 renames the file back to `index.ts` and flips cases 9–10 from absence to its decided presence assertion in the same change). The broken-windows ledger's entry id 1 (the 01-02 `content_scripts` deviation) is marked fixed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build-inspection gate — assert the generated MV3 manifest is the authorised shape** — `b8cd7392` (test)
2. **Task 2: Record the operator's Option C content-script exclusion decision** (checkpoint task, pre-resolved by the operator) — `c0a85d5f` (docs)
3. **Task 3: Apply the injection-scope decision, flip the `content_scripts` assertion, reconcile the inventory** — `17ed16d1` (fix)

**Plan metadata:** committed separately as `docs(01-03): complete … plan`.

## Files Created/Modified

- `tests/isolation/generated-manifest.test.ts` — **new**: the read-only build-inspection gate (10 cases). Task 1 landed cases 1–9 (case 9 encoding the then-observed `01-02` build); Task 3 flipped case 9 to the absence assertion and added the source pin as case 10.
- `src/entrypoints/content/core.content.ts` — **renamed** from `index.ts` and updated: the Option C decision comment (staging name, owning plan, removal condition), `matches` narrowed to the authorised ServiceNow hosts. No behavioural code changed.
- `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md` — H-1 and OQ1 replaced with the final resolution; the content-script row and the manifest-gate row carry `implemented`/`verified` plus their Option C status notes.
- `.planning/WINDOWS.md` — ledger id 1 marked fixed (`open_count` 11 → 10).
- `tests/isolation/cross-entrypoint-imports.test.ts` — comment-only correction: the two provenance comments that named `src/entrypoints/content/index.ts` now name the staged path (the gate itself is directory-scoped and followed the rename untouched).

## Decisions Made

- **Option C applied by renaming, not by a build hook.** WXT exposes an `entrypoints:found` hook that could filter the entrypoint out of the build, but that is procedural: a hook-ordering or config-merge change could silently reinstate the registration. A filename that matches no glob is structural — WXT never sees an entrypoint — and the absence assertion proves it on the artifact. The cost is that the canonical target path is temporarily unrealised, which is exactly what the recorded removal condition owns.
- **The declared `matches` was narrowed to the authorised host set** (see Deviations 2). Under Option C the value is inert, but it is what Phase 6 inherits on restore; leaving `<all_urls>` there would have converted the removal condition into a silent host-access widening, which the plan's must-have truth and T-1-12 both forbid.
- **The gate pins the decision twice.** Case 9 asserts the manifest key's absence (the realised Phase-1 state); case 10 asserts the declared source scope (the invariant that must hold when the exclusion is removed). Neither alone covers both the present and the removal condition.
- **The content-script row's `Target canonical path` cell keeps `src/entrypoints/content/index.ts`** — the canonical intent is unchanged and only the Phase-1 realisation is excluded. The staged path is stated explicitly in the row's status note and in H-1, so no cell lies about where the file actually is (both readings of the plan's path instrument are recorded in Deviations 1).
- **The broken-windows entry for this defect was closed in the same commit** as the fix rather than left for the phase sweep: the entry described a manifest state that no longer exists, and the ledger's `open_count` is what `/gsd-ship` gates on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Instrument] Task 3's literal instruments assume the rejected options; each was re-derived and both readings recorded**

- **Found during:** Task 3, before touching the tree (the checkpoint resolution pre-empted the plan's literal wording)
- **Issue:** three instruments in the plan assume a `matches`-value decision: (a) "set the `defineContentScript` `matches` value to exactly the decided scope" — under Option C the file is not built, so no manifest scope exists; (b) "`git log --oneline -1 -- src/entrypoints/content/index.ts` returns one commit" — that path is deleted by the rename; (c) "temporarily widen `matches` … rebuild, confirm the case fails" — a widened value on a build-excluded file changes no manifest, so the probe would have passed vacuously; (d) "the content-script row's `Target canonical path` matches the file's real on-disk path" — the canonical target is unchanged while the Phase-1 staging path differs.
- **Fix:** (a) the decision was applied through the exclusion mechanic, and the declared scope was still set deliberately (see Deviation 2); (b) `git log --oneline -1 -- src/entrypoints/content/index.ts` prints `17ed16d1` — the deletion side of the rename, i.e. the plan's own commit — and `git log --oneline -1 -- src/entrypoints/content/core.content.ts` prints the same hash: **both readings pass** (non-empty either way); (c) the probes were re-derived for the implemented mechanic — the discovery-switch flip (rename back to `index.ts` + rebuild) fails case 9, and a widened declared `matches` fails case 10; (d) the target cell keeps the canonical path and the staged path is recorded in the row's status note and H-1.
- **Files modified:** `src/entrypoints/content/core.content.ts`, `tests/isolation/generated-manifest.test.ts`, `01-MIGRATION-INVENTORY.md`
- **Verification:** probe (c) readings: rename-back → `1 failed` on case 9 naming `content_scripts`; widened `matches` → `expected [ '<all_urls>' ] to not include '<all_urls>'`; restored tree 10/10 green and the full suite 459/459.
- **Committed in:** `17ed16d1` (Task 3 commit)

**2. [Rule 2 - Least privilege] The staged file's declared `matches` narrowed from `<all_urls>` to the already-authorised host set**

- **Found during:** Task 3, applying Option C to the file
- **Issue:** Option C excludes the file from the build but says nothing about the value it carries. Leaving the prototype's `matches: ['<all_urls>']` in place would mean that the recorded removal condition — Phase 6 renames the file back to `index.ts` — silently reinstates an all-URLs host match, contradicting the plan's must-have truth ("never widened silently by a path fix"), T-1-12 and `CONCERNS.md` §157 (which recommends ServiceNow-scoped matches for v0.1 and a test asserting the approved match set).
- **Fix:** `matches` now equals the two ServiceNow patterns the manifest already declares in `host_permissions` — no new host access is introduced, and the manifest gate's case 10 pins the declared array so it cannot drift wider.
- **Files modified:** `src/entrypoints/content/core.content.ts`, `tests/isolation/generated-manifest.test.ts`
- **Verification:** case 10 passes; the deliberate widening probe fails it; `host_permissions` read back from the built manifest is unchanged (ServiceNow-only).
- **Committed in:** `17ed16d1` (Task 3 commit)

**3. [Rule 1 - Bug] Two provenance comments in the isolation gate named the pre-rename path**

- **Found during:** Task 3, after the rename
- **Issue:** `tests/isolation/cross-entrypoint-imports.test.ts` referred to `src/entrypoints/content/index.ts` in two comments explaining the `fetch(` gate's comment-strip. The rename made both references stale, and the gate's own doctrine is that a comment must not lie about what is being scanned.
- **Fix:** the two comments now name the staged path and state that the grep is directory-scoped (so it followed the rename without a code change).
- **Files modified:** `tests/isolation/cross-entrypoint-imports.test.ts` (comment-only; no assertion changed)
- **Verification:** `npx vitest run tests/isolation` → 22/22 cases pass, unchanged.
- **Committed in:** `17ed16d1` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 instrument re-derivation, 1 least-privilege narrowing, 1 stale-comment correction)
**Impact on plan:** No scope creep: no dependency added or bumped, no later-phase capability implemented, and no file another plan owns was changed beyond two comment lines in the isolation gate (whose subject is the tree this plan moved). Deviation 2 is the only behavioural difference from a literal reading of Option C, and it is strictly narrowing.

### Checkpoint resolution (Task 2)

Task 2 is a `checkpoint:decision` with `gate="blocking"`. It was **pre-resolved by the operator** before this run: **Option C — keep the entrypoint but exclude it from the build for Phase 1.** The resolution is recorded exactly as the task's acceptance criteria require (final resolution, affected requirement IDs, reason, and the *decided rather than inherited* statement) in `01-MIGRATION-INVENTORY.md` § Resolved hand-off decisions item 1, and the run continued directly to Task 3 rather than stopping at the checkpoint.

## Issues Encountered

- **Probe hygiene: the artifact is state.** The first run of the widening probe read a manifest left over from the discovery-switch probe (the file had been renamed back and rebuilt), so case 9 failed for the *previous* probe's reason while case 10 failed for the widening. Both readings were kept — case 10's failure is the probe's evidence — and the tree was rebuilt before the final green run. The manifest suite itself never writes, so this is a probe-ordering hazard, not a test defect; the recorded probe commands rebuild before they assert.
- **A renamed path cannot be `git add`-ed.** After `git mv`, `git add src/entrypoints/content/index.ts` fails ("pathspec did not match") because the path no longer exists in the worktree; the rename was already staged, so only the surviving paths were re-added. Recorded so the next rename-heavy task does not repeat it.
- **`git log -- <renamed path>` reads as a deletion.** `git log --oneline -1 -- src/entrypoints/content/index.ts` returns the Task 3 commit because that commit deleted the path; the same instrument against the staged path returns the same hash. Both readings are recorded in Deviations 1 rather than presented as a single clean pass.

## Known Stubs

None — this plan introduced no placeholder, empty collection or unwired data source. The one deliberately inert value (`matches` on a build-excluded file) is pinned by an assertion and has a named owner and removal condition, so it is a recorded decision rather than a stub.

**Broken-windows ledger:** entry id 1 marked **fixed** (the 01-02 `content_scripts` deviation this plan resolves). No new entries.

## Threat Flags

None — this plan **removes** manifest surface rather than adding it. The `threat_flag: content_script_registration` recorded by `01-02` (a `content_scripts` entry matching `<all_urls>`) is closed: the key is absent, the artifact no longer exists, and the declared scope is pinned to the already-authorised hosts. T-1-11 (permission set), T-1-12 (injection scope), T-1-13 (CSP) and T-1-14 (gate cannot pass without an artifact) each now have a passing assertion, and T-1-SC is untouched (no install occurred in this plan).

## User Setup Required

None — no external service configuration, no dependency installed or bumped, and no version change.

## Next Phase Readiness

- **`01-13` (gates)** can extend the manifest suite: the banned-import/dependency gate and the dependency-pin gate are its declared work, and this suite is the natural home for any further build-artifact assertion (`verify:phase-1` already runs `tests/isolation`).
- **Phase 6 (PageContentService)** owns the removal condition: rename `src/entrypoints/content/core.content.ts` back to `index.ts`, set the extraction scope through its own recorded decision, and flip manifest-gate cases 9–10 from absence to the decided presence assertion in the same change. The file's own doc comment states this.
- **Phase 17** remains the secondary claimant of the scaffold literals (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION`), which are still declared but unhandled in `RuntimeEnvelope.ts`.
- **The phase's manifest posture is now fully asserted**: no options keys, no `content_scripts`, ServiceNow-only hosts, `connect-src 'none'` — the exact shape `01-11`'s teardown and the phase acceptance review can read back from the artifact.
- **Remaining unverified surface is browser-observed only** (unchanged from `01-02`/`01-12`): HMR application and the visual-parity rows stay with `01-13` item 6.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (1 of 1): `tests/isolation/generated-manifest.test.ts`.
- File renamed (1 of 1): `src/entrypoints/content/core.content.ts` present; `src/entrypoints/content/index.ts` absent.
- Commits present: `b8cd7392`, `c0a85d5f`, `17ed16d1` (3 of 3, measured with `git rev-list --count e4de0255..HEAD`).
- Fresh verification on the committed tree: `npx tsc --noEmit` exit 0; `pnpm run build:ext` exit 0 with no `content_scripts` key and no `content-scripts/` artifact; `npx vitest run tests/isolation/generated-manifest.test.ts` 10/10; `npx vitest run` 36 files / 459 tests passed; the missing-artifact probe prints `exit=1`; the inventory instrument reads 0.
