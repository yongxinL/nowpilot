# Execute NowPilot Phase

Follow `AGENTS.md`. Implement only the approved active phase plan.

## Phase

`.planning/phases/<PHASE_NUMBER> - <PHASE_NAME>`

## Inputs

- `.planning/PRODUCT_SPEC_v0_1.md`
- `AGENTS.md`
- `.planning/STATUS.md`
- `.planning/phases/<NN>-<phase-name>/PLAN.md`
- `.planning/phases/<NN>-<phase-name>/RESULT.md`
- `.planning/phases/<NN>-<phase-name>/ACCEPTANCE.md`
- applicable ADRs and decisions

## Instructions

1. Confirm the Git working tree and active branch before editing.
2. Read the complete approved phase plan and inspect all target files and relevant tests.
3. Execute tasks in dependency order.
4. Make surgical patches. Preserve existing contracts and structure.
5. Do not invent identifiers, paths, schemas, error codes, message types or public APIs.
6. Do not implement later-phase functionality.
7. After each task, run the narrowest applicable tests or type checks.
8. If repository evidence conflicts with the plan or product spec, stop that task and report the exact conflict. Do not improvise a new contract.
9. Update `.planning/phases/<NN>-<phase-name>/RESULT.md` as work progresses.
10. Do not mark the phase complete. Final completion is decided by the verify step.

## Required Result Record

Record:

- tasks completed;
- files changed;
- focused tests run and results;
- deviations from plan;
- unresolved blockers;
- remaining tasks;
- current Git diff summary.

## Final Response

Return a concise execution summary and the exact next prompt: `VERIFY_PHASE.md`.
