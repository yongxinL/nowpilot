# NowPilot Status

This file is the append-only status record required by `AGENTS.md` Section 16.
Update only the designated current-state section or append a dated entry. Do not
rewrite or delete prior history.

## Current state

- **Current phase:** Phase 01 — Runtime, Shells, and Workspace
- **Design status:** Approved
- **Plan status:** Approved
- **Implementation status:** In progress — T01 accepted
- **Planning baseline branch:** `phoenix`
- **Implementation branch:** `phoenix`
- **Historical approved planning baseline commit:** `bd6ac44d6f562722c18f0d07e6910634e549c713`
- **Approved planning baseline commit:** `3fb619730c8032d4aa121c5b8aa9649901b45f5f`
- **Current task:** T01 — pnpm and WXT Project Bootstrap (accepted)
- **Last commit:** `TASK_01_SHA_PLACEHOLDER` (`chore(phase-01): bootstrap pnpm WXT project`)
- **Verification result:** Pass — Task 01 Step 10 focused block all exit 0; WXT 0.21.4 build succeeded; `.output/chrome-mv3/manifest.json` produced
- **Next task:** T02
- **Blockers:** None
- **Evidence path:** `.planning/evidence/phase-01/verification.txt` (Task 01 section)
- **Evidence status:** Task 01 verification recorded

## History

### 2026-09-19

- Governance baseline initialised.
- Phase 01 design approved at `phases/01-runtime-shells-workspace/DESIGN.md`.
- No implementation tasks executed. No plan created. No evidence recorded.
- Phase 01 `PLAN.md` drafted using the writing-plans skill at
  `phases/01-runtime-shells-workspace/PLAN.md` (28 tasks; T01–T28). Plan is
  awaiting operator approval. No production code, worktree, branch, dependency
  install, or evidence directory was created. No commit was made.
- Operator approved the four planning interpretations: (1) closed typed
  `MESSAGE_TYPE_ALLOWED_SOURCES` registry validated at every runtime boundary;
  (2) `instanceId`/`writerType` on `WorkspaceRehydrateRequestPayload` and
  `createWorkspaceCoordinator` as the Phase 01 orchestration boundary;
  (3) single closed mutation kind `workspace.metadata.set`; (4) separate
  `unit`/`manifest`/`isolation` Vitest projects with the approved aggregate
  order. Phase 01 `PLAN.md` is approved as authoritative and the interpretations
  are recorded in `PLAN.md`. No commit was made; no implementation started.
- Phase 01 approved-plan commit recorded as `approvedPlanningBaselineCommit` =
  `bd6ac44d6f562722c18f0d07e6910634e549c713` (`docs(phase-01): approve runtime
  implementation plan`), which contains the approved `DESIGN.md` and `PLAN.md`.
  Implementation branch `phase/01-phoenix`; implementation not started; next task
  T01. No production code, worktree, branch, dependency install, or evidence was
  created. No commit was made.
- Workflow amendment (operator decision 2026-09-19): Phase 01 implementation
  occurs directly on the single sequential `phoenix` branch. The separate
  `phase/01-phoenix` implementation branch and the linked worktree are
  superseded and retained as decision history only. Branch checks now require
  the current branch to be exactly `phoenix`, a clean working tree before each
  task, `HEAD` containing the approved planning commit and the status commit
  that records `approvedPlanningBaselineCommit`, and
  `approvedPlanningBaselineCommit` remaining an ancestor of `HEAD`. Direct-branch
  safeguards added: sequential execution; one implementation agent at a time;
  parallel task execution prohibited; same repository root and branch for
  subagents; commit branch verified before and after every task; no push,
  force-push, merge, rebase, squash, amend, reset, or history rewriting;
  recovery by new corrective commit or operator-approved `git revert`. Amended
  files: `AGENTS.md`, `DESIGN.md`, `PLAN.md`, `STATUS.md`, and
  `EXECUTION_PROTOCOL.md`. Planning baseline
  `bd6ac44d6f562722c18f0d07e6910634e549c713` and governance status commit
  `937961ae720188f0e83cc93dbe726d6811f810aa` remain in history. No production
  code changed; no dependency installed; T01 not started; no commit made.
- Direct-phoenix amendment follow-up (operator decision 2026-09-19):
  `.planning/DECISIONS.md` decision 20 is marked superseded and a replacement
  decision 25 records the direct-branch model. Because `PLAN.md` changed after
  `bd6ac44d6f562722c18f0d07e6910634e549c713`, that SHA is retained as the
  historical pre-amendment approved-plan baseline; `approvedPlanningBaselineCommit`
  is pending refresh to the direct-phoenix amendment commit. Blockers: baseline
  refresh pending. No production code changed; no dependency installed; T01 not
  started; no commit made.
- Baseline refresh (2026-09-19): direct-phoenix amendment commit
  `3fb619730c8032d4aa121c5b8aa9649901b45f5f` (`docs(phase-01): adopt direct
  phoenix implementation model`) is recorded as the current
  `approvedPlanningBaselineCommit`. It contains the amended `AGENTS.md`,
  `DESIGN.md`, `PLAN.md`, `DECISIONS.md`, `STATUS.md`, and
  `EXECUTION_PROTOCOL.md`. The previous
  `bd6ac44d6f562722c18f0d07e6910634e549c713` is retained as the historical
  pre-amendment approved-plan baseline. Implementation branch `phoenix`;
  implementation status not started; current task none; next task T01;
  blockers none; evidence status not started. This baseline-refresh record is
  committed separately from the baseline commit so the pre-implementation
  gate's status-record assertion is satisfied. No production code changed; no
  dependency installed; implementation not started.
- Task 01 (pnpm and WXT Project Bootstrap) executed on `phoenix` in the repository
  root. Pre-implementation baseline gate passed (branch `phoenix`; tree clean;
  `approvedPlanningBaselineCommit` = `3fb619730c8032d4aa121c5b8aa9649901b45f5f`;
  base commit `b54b01d18d3fdbdc8faaabf0dcc3239ff420c962`). Created `package.json`
  (exact pins), `.npmrc` (`engine-strict=true`, `save-exact=true`), `wxt.config.ts`
  (permissions exactly `sidePanel` + `storage`), `tsconfig.json`,
  `src/entrypoints/background.ts`, and `public/icon/{16,32,48,128}.png`; removed
  the orphan `package-lock.json`; generated `pnpm-lock.yaml` with
  `pnpm install` (`postinstall` ran `wxt prepare`). Task 01 Step 10 focused
  verification passed (all exit 0); `pnpm run build` produced WXT 0.21.4
  chrome-mv3 output and `.output/chrome-mv3/manifest.json`. Phase 01 verification
  applicable now: none (toolchain scripts do not exist until T02). Task commit
  `chore(phase-01): bootstrap pnpm WXT project`. Note: pnpm 12.4.2 auto-created an
  untracked `pnpm-workspace.yaml` during initial resolution; it is forbidden by
  Global Constraint 2 and not required (`pnpm install --frozen-lockfile` passes
  without it, lockfile hash unchanged), so it was removed and not committed.
  Current task T01 accepted; next task T02; verification recorded in
  `.planning/evidence/phase-01/verification.txt`.
