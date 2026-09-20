---
name: nowpilot-spec-compliance
description: Review NowPilot changes against the approved phase contract, product specification, ADRs, design system, file scope, identifiers, and acceptance criteria.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: review
---
# NowPilot Specification Compliance

## Precedence
1. Approved phase contract and acceptance criteria
2. `PRODUCT_SPEC_v0_2.md`
3. Accepted ADRs
4. `DESIGN_SYSTEM_v0_2.md` for visual rules
5. Approved UI references
6. Imported UI seed
7. Generated plan suggestions

## Check
- Exact task scope and authorised files.
- Canonical identifiers, registries, routes, messages, errors, storage keys, prompts, workflows, and tiers.
- No deferred or out-of-phase behaviour.
- No invented dependency, permission, model identifier, or contract.
- Public boundaries validated and fixture-tested.
- Every acceptance criterion maps to a test or recorded manual check.
- Material deviations are documented before implementation.

Return requirement-to-change mapping, findings by severity, and `PASS` or `BLOCKED`. Do not broaden the task during review.
