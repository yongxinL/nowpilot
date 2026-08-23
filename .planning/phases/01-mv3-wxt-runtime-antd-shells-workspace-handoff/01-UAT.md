---
status: complete
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md, 01-07-SUMMARY.md, 01-08-SUMMARY.md
started: 2026-08-23T00:00:00Z
updated: 2026-08-23T00:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Run `pnpm build:ext`. Build completes without errors. Load `.output/chrome-mv3` as an unpacked extension in Chrome (chrome://extensions → Load unpacked). The extension loads cleanly, the background service worker starts without red errors, and no build/runtime errors appear on load.
result: pass

### 2. Fresh Install Empty State
expected: After clearing extension storage (chrome://extensions → Details → Clear storage) and reopening the Side Panel, there is NO demo content: no fake ServiceNow conversations, no pre-seeded notes or write-history entries. Lists start empty.
result: pass

### 3. Onboarding Modal — Fresh Install Trigger + Skip Re-trigger
expected: On the cleared/fresh install, opening the Side Panel auto-opens the OnboardingModal at Step 1 "Meet NowPilot". Clicking "Skip for now" closes the modal WITHOUT marking onboarding complete — closing and reopening the Side Panel makes the modal appear again.
result: pass

### 4. Onboarding Connection Failure Honesty + Key Privacy
expected: In the modal, pick a provider, enter an INVALID API key, click "Connect Provider" on Step 4. A real error is shown ("Connection failed: [actual reason]") — not an automatic success. "Edit key" returns to Step 3 with the key preserved for retry. While doing this with DevTools open (console + network), the raw API key never appears in logs or error strings.
result: pass

### 5. Standalone Light + Dark Visual Pass
expected: Open standalone.html from the loaded extension. Sidebar is ~72px collapsed / ~240px expanded, workspace card has rounded corners + border, spacing/typography look consistent (no unstyled Tailwind gaps). Toggle dark mode: token-based dark colors apply cleanly, layout does not break.
result: pass

### 6. Theme Toggle + Cross-Surface Propagation + Restart Persistence
expected: A Segmented theme control (Auto/Light/Dark) is visible on BOTH surfaces (Side Panel header + Standalone sidebar). Changing it in one surface immediately updates the other surface. Setting Dark, closing and reopening Chrome, the theme is still Dark (persisted via chrome.storage.sync).
result: pass

### 7. Command Palette (Cmd+K) Flow-10 Base Set
expected: Pressing Cmd+K / Ctrl+K on either surface opens a command palette listing the base commands (focus-side-panel, open-options, toggle-theme, reload-extension). Selecting each performs its action; reload-extension only runs when explicitly selected.
result: pass

### 8. Open in Standalone Handoff + Tab Dedup
expected: From the Side Panel, triggering "Open in Standalone" opens the Standalone view in a new tab. Triggering it again focuses the EXISTING standalone tab instead of creating a duplicate — including when the existing tab lives in another browser window (that window comes to front).
result: issue
reported: "when clicking on 'Open in standalone', the new tab did not open and failed in chrome console. Failed to load resource: the server responded with a status of 401 (Unauthorized); sidepanel-BPEP9L5S.js:1 Uncaught TypeError: n.loading is not a function"
severity: major

### 9. Mirror Banner Read-Only Composer
expected: With the same workspace open on both surfaces, when the other surface is the active editor, the Side Panel shows a mirror banner indicating mirrored/read-only state instead of allowing silent concurrent edits.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0

## Gaps

- gap_id: G-01-8
  truth: "From the Side Panel, 'Open in Standalone' opens the Standalone view (or focuses the existing standalone tab without duplicates)"
  status: failed
  reason: "User reported: when clicking on 'Open in standalone', the new tab did not open and failed in chrome console. Failed to load resource: the server responded with a status of 401 (Unauthorized); sidepanel-BPEP9L5S.js Uncaught TypeError: n.loading is not a function"
  severity: major
  test: 8
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
