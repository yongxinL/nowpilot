---
name: nowpilot-wxt-mv3
description: Implement or review NowPilot WXT and Chrome MV3 code while enforcing service-worker, content-script, messaging, bundle-isolation, and canonical-path constraints.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: architecture
---

# NowPilot WXT and MV3 Rules

## Use this skill when

Use this skill for tasks involving:

- WXT entry points
- Chrome Manifest V3
- background service workers
- content scripts
- Side Panel
- Standalone view
- Chrome messaging
- manifest permissions
- extension bundle isolation

## Required references

Read these files before making changes:

1. `AGENTS.md`
2. `PRODUCT_SPEC.md`
3. `ARCHITECTURE.md`
4. Current phase `DESIGN.md`
5. Current phase `PLAN.md`

## Mandatory rules

- Use `standalone` as the canonical path and symbol stem.
- The Side Panel is Chat-only.
- Register background listeners synchronously.
- Do not run AI-provider or MCP streams in the background service worker.
- Do not access IndexedDB from the background service worker.
- Use `chrome.alarms`, never `setInterval`, for background scheduling.
- Content scripts are extraction-only.
- Do not render React or Ant Design from content scripts.
- Do not modify host-page UI.
- Do not perform host-page write-back.
- Do not bundle React, Ant Design, Defuddle, YAML, Turndown, Temml, or MathML conversion packages into content scripts.
- Every cross-context message must use the canonical RuntimeEnvelope.
- Do not invent message types, paths, permissions, or storage keys.

## Completion checks

Before completing the task:

1. Run the focused tests.
2. Run the current phase verification command.
3. Run the content-script isolation test when bundles are affected.
4. Inspect manifest permission changes.
5. Record evidence in the current phase evidence directory.
