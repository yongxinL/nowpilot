---
name: nowpilot-phase-verification
description: Verify a NowPilot GSD task or phase with fresh commands, acceptance mapping, Git evidence, UI/manual checks, and clean completion boundaries.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: verification
---
# NowPilot Phase Verification

1. Read the active phase contract, plan, state, and acceptance criteria.
2. Map every criterion to automated or manual evidence.
3. Run fresh focused and cumulative commands.
4. Run typecheck, lint, tests, build, manifest, isolation, security, performance, UI, and accessibility gates when applicable.
5. Inspect generated artefacts, not source configuration alone.
6. Verify task commits, authorised paths, clean tree, and no skipped tests.
7. Validate screenshots are real, non-sensitive, correctly named, and prove the criterion.
8. Preserve historical failures and corrections.

Do not declare completion from old output, a source scan when build inspection is required, or a screenshot without an observed-result record.

Return commands and exits, criterion coverage, evidence paths, unresolved findings, and `PASS`, `BLOCKED`, or `FAILED`.
