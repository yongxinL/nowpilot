---
name: nowpilot-release-gate
description: Execute the NowPilot release gate, including verification, isolation, performance, manifest review, bundle inspection, smoke tests, packaging, checksums, and rollback readiness.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: release
---

# NowPilot Release Gate

## Required references

Read:

1. `AGENTS.md`
2. `DEPLOYMENT.md`
3. Current release plan
4. Latest migration decisions
5. Previous release record

## Automated gates

Run the scripts defined by the repository for:

- complete verification
- isolation tests
- performance tests
- production build
- packaging

Do not invent a missing package or release command. Create it through an approved plan.

## Inspection gates

Check:

- Manifest V3
- approved permissions only
- correct Side Panel entry point
- `standalone.html` exists
- prohibited dependencies absent from content bundle
- no secrets, local paths, test tokens, or raw customer fixtures
- migrations and restore paths verified
- release artefact reproducible

## Manual gates

Verify:

- fresh-install onboarding
- Chat-only Side Panel
- Standalone deduplication and handoff
- provider configuration
- stream abort
- extraction privacy
- Notes and filesystem round trip
- diagnostics redaction
- safe failure behaviour

## Release result

Return PASS only when:

- all commands pass
- manual evidence is complete
- no blocking review finding remains
- checksums are verified
- the previous release artefact is available for rollback
