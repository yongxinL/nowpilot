---
name: nowpilot-release-gate
description: Execute the NowPilot release gate for reproducible WXT packaging, manifest and bundle review, migrations, smoke tests, checksums, evidence, and rollback readiness.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: release
---
# NowPilot Release Gate

Read the approved release plan and deployment guide. Run only repository-defined commands.

Verify:
- clean tagged commit and locked toolchain;
- complete verification, isolation, security, performance, migration and build gates;
- generated Manifest V3 and approved permissions;
- prohibited dependencies absent from restricted bundles;
- no secret, source-only artefact, local path, test token, raw customer fixture, or private browser state;
- fresh install, Side Panel, Standalone, workflow routing, provider settings, abort, extraction privacy, Notes/storage round-trip, diagnostics redaction, and safe failures;
- versioned ZIP, checksum verification, release notes, evidence, previous artefact, and rollback instructions.

Do not publish, upload, tag, merge, or deploy without operator approval. Return `READY`, `BLOCKED`, or `FAILED`.
