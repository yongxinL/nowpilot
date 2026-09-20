---
name: nowpilot-wxt-mv3
description: Implement or review NowPilot WXT and Chrome MV3 code, entrypoints, permissions, messaging, service-worker lifecycle, Side Panel, Standalone, and bundle isolation.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: architecture
---
# NowPilot WXT and MV3

## Use when
Use for WXT configuration, manifest changes, entrypoints, Chrome APIs, background logic, Side Panel, Standalone, messaging, permissions, or bundle boundaries.

## Read first
1. `AGENTS.md`
2. Active phase contract and acceptance criteria
3. `PRODUCT_SPEC_v0_2.md`
4. Accepted ADRs referenced by the phase

## Rules
- WXT + React + TypeScript strict is canonical.
- Side Panel is Chat-only.
- Use `standalone` as the canonical full-workspace stem.
- Register background listeners synchronously.
- Background may serialise writer-election changes but is not the workspace writer or ordinary mutation broker.
- Provider/MCP streaming runs only in extension-owned UI contexts.
- Content scripts are extraction-only and render no UI.
- Cross-context messages use the canonical validated envelope.
- Manifest permissions remain least privilege. Never add one silently.
- No remote code, `eval`, unsafe HTML, or secrets in the bundle.

## Required checks
- Typecheck and focused tests.
- Generated Manifest V3 inspection.
- Background and content-bundle isolation inspection.
- Sender/source/target validation tests for message changes.
- Manual Chrome evidence for browser-chrome surfaces when required.

Return `PASS` or `BLOCKED` with exact file, symbol, violated rule, and required correction.
