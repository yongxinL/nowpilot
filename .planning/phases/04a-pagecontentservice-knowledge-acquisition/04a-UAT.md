---
status: testing
phase: 04a-pagecontentservice-knowledge-acquisition
source: [04a-VERIFICATION.md]
started: 2026-08-13T07:58:00Z
updated: 2026-08-13T07:58:00Z
---

## Current Test

number: 1
name: Real-browser SPA navigation smoke
expected: |
  Load a real SPA (e.g. a GitHub repo page or Gmail) in the extension's dev build and
  trigger an in-app navigation (a link that does NOT reload the page). Confirm the extracted
  content in the side panel/standalone reflects the NEW page after navigation.
  wxt's location-watcher dispatches the namespaced `wxt:locationchange` event in a real SPA;
  the watcher fires, the host rebuilds the live context, and the panel cache is invalidated —
  a subscribed surface re-extracts the new page.
awaiting: user response

## Tests

### 1. Real-browser SPA navigation smoke
expected: Load a real SPA in the dev build, trigger an in-app navigation (no page reload), and confirm extracted content reflects the NEW page after navigation.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
