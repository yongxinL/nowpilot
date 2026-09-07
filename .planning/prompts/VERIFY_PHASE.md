# Verify NowPilot Phase

Follow `AGENTS.md`. Verification must be independent, evidence-based and scoped to the active phase.

## Phase

`.planning/phases/<PHASE_NUMBER> - <PHASE_NAME>`

## Instructions

1. Read the product-spec phase, approved `PLAN.md`, current `RESULT.md`, applicable decisions and acceptance criteria.
2. Inspect the complete Git diff against the phase base commit.
3. Verify every requirement and decision maps to implemented code and a test or manual acceptance check.
4. Confirm no unrelated files, future-phase features, invented contracts, weakened tests, or banned dependencies were introduced.
5. Run focused tests for changed behaviour.
6. Run the exact `pnpm run verify:phase-<N>` command.
7. Run any additional isolation, lint, type, security, performance or visual checks required by the phase.
8. Record the exact commands, UTC timestamp, exit status and concise output summary.
9. If verification fails, classify each issue as blocker, warning or information and identify the exact file and required fix.
10. Do not modify production code during verification. Produce a fix list and return to execution if blockers exist.
11. If all gates pass, update:
    - `.planning/phases/<NN>-<phase-name>/RESULT.md`
    - `.planning/phases/<NN>-<phase-name>/ACCEPTANCE.md`
    - `.planning/STATUS.md`
12. Record the verified Git commit SHA. If the work is not committed, state that the phase is verified but not complete and require a commit plus verification against that commit.

## Required Output

### Verdict

`PASS | FAIL | PASS WITH WARNINGS`

### Findings

- Blockers: `<count>`
- Warnings: `<count>`
- Information: `<count>`

### Evidence

- commands run;
- results;
- requirement coverage;
- acceptance evidence;
- verified commit SHA;
- scope and diff audit.

### Next Action

- On PASS: identify the next phase and recommend `DISCUSS_PHASE.md` only if necessary, otherwise `PLAN_PHASE.md`.
- On FAIL: provide a deterministic fix list for `EXECUTE_PHASE.md`.
