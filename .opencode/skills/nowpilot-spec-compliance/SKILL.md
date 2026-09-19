---
name: nowpilot-spec-compliance
description: Review a NowPilot implementation against the approved phase design, executable plan, canonical architecture, file paths, contracts, and acceptance criteria.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: review
---

# NowPilot Specification Compliance Review

## Required input

Read:

1. `AGENTS.md`
2. Current phase `DESIGN.md`
3. Current phase `PLAN.md`
4. Changed files and tests
5. Relevant accepted decisions

## Review order

Check the implementation for:

1. Exact task scope
2. Allowed file paths
3. Canonical identifiers and types
4. Approved dependencies
5. Required Zod boundaries
6. Required fixture tests
7. Error-code compliance
8. Security and privacy invariants
9. Acceptance criteria
10. Deferred-feature violations

## Severity

- Critical: security, privacy, data loss, or trust-boundary violation
- High: incorrect architecture, missing acceptance criterion, or invented contract
- Medium: incomplete test, maintainability issue, or unclear behaviour
- Low: minor clarity or consistency issue

## Output

Return:

- task reviewed
- files reviewed
- acceptance-criteria mapping
- findings grouped by severity
- exact file and symbol for each finding
- required correction
- final result: PASS or BLOCKED

Do not perform a general code-quality review until specification compliance passes.
