---
name: nowpilot-ui-ux-review
description: Review NowPilot Side Panel, Standalone, Notes, Options, themes, workflow UI, responsive states, and visual evidence against the approved design system.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: design
---
# NowPilot UI/UX Review

## Authority
Read `DESIGN_SYSTEM_v0_2.md`, the active phase UI contract, and approved reference captures. Product behaviour comes from `PRODUCT_SPEC_v0_2.md`.

## Review
- Side Panel remains Chat-only.
- Chat uses a Workflow selector, not a raw model selector.
- Resolved provider/model is read-only in Activity or Diagnostics.
- Standalone navigation, Notes columns, Options information architecture, overlays, responsive behaviour, and all required states match the approved contract.
- Inspect empty, loading, streaming, stopped, success, error, offline, disabled, permission, long-text, narrow-width, dark-theme, reduced-motion, and reduced-transparency states.
- Verify visible focus, keyboard flow, accessible names, overlay focus restore, contrast, text alternatives, and non-colour status cues.
- Check token use, spacing, density, typography, icon consistency, overflow, clipping, and layout stability.

## Evidence
Use actual implementation screenshots or browser output. Do not infer a visual pass from source code alone. Real Chrome Side Panel evidence must use the actual browser Side Panel where the phase requires it.

Return findings grouped as Critical, High, Medium, Low, then `PASS` or `BLOCKED`.
