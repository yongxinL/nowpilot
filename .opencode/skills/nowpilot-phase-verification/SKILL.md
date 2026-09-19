---
name: nowpilot-phase-verification
description: Verify a NowPilot task or phase using fresh commands, acceptance-criterion mapping, Git evidence, manual checks, and the required evidence-directory structure.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: verification
---

# NowPilot Phase Verification

## Mandatory process

1. Read the current phase design and plan.
2. Extract every acceptance criterion.
3. Map each criterion to an automated test or manual check.
4. Run focused tests.
5. Run the phase verification command.
6. Run relevant isolation, security, or performance tests.
7. Check Git status and task commits.
8. Record manual verification.
9. Save evidence.
10. Return PASS only when all required evidence exists.

## Evidence location

Use:

`.planning/evidence/phase-<NN>/`

Required records:

- `verification.txt`
- `review.md`
- `manual-checks.md`
- `screenshots/` when UI validation is required

## Prohibited behaviour

- Do not rely on previous command output.
- Do not declare completion with a dirty worktree.
- Do not ignore skipped tests.
- Do not treat manual checks as passed without recorded evidence.
- Do not advance when a critical or high finding remains.

## Output

Return:

- phase
- commit range
- commands and exit status
- acceptance-criterion coverage
- manual evidence
- unresolved findings
- final result: PASS or BLOCKED
