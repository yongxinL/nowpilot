# NowPilot — Doc Ingest Synthesis

Single entry point for downstream consumers (e.g. `gsd-roadmapper`). Mode: **new** (net-new bootstrap). Date: 2026-09-20.

## Corpus

- Docs synthesized: **3** — 2 SPEC, 1 DOC (0 ADR, 0 PRD, 0 UNKNOWN).
- Classification confidence: all `medium`; no manifest overrides; no doc marked `locked`.
- Sources (repo-relative; absolute paths are `/Users/george.li/Documents/workspaces/nowpilot/<path>`):
  - SPEC — `.planning/product/PRODUCT_SPEC.md` (PRODUCT_SPEC_v0_2.md; §0–§30 + Appendices A–O)
  - SPEC — `.planning/design/DESIGN_SYSTEM.md` (design companion v0.2; defers to the product spec on functional rules)
  - DOC — `.planning/design/NOWPILOT_DETAILED_UI_UX_LAYOUT_GSD_GUIDE.html` (UI/UX guide + GSD hand-off; UI seed + embedded workflow-selector decision)

## Decisions

- **Locked: 0.** No ADR-classified docs and nothing marked locked, so no hard LOCKED-vs-LOCKED or LOCKED-vs-locked-context gates apply.
- **Proposed (12 entries in `intel/decisions.md`):** embedded decisions surfaced from the classified docs — PRODUCT_SPEC §23 tech-stack/AI-platform decisions (DEC-SPEC-01…09), §27.8 D-01…D-08 (DEC-SPEC-10), §17.7.5 R1/R2 reconciliations (DEC-SPEC-11), and the HTML embedded workflow-selector decision (DEC-HTML-01, corroborated by both SPECs).
- Note: PRODUCT_SPEC §23 is titled "Key Technology Decisions (ADRs)" but the document is SPEC-classified; entries are recorded as `proposed` for roadmapper awareness, not as locked ADRs.

## Requirements

- **PRD-classified docs: 0** — no `requirements.md` was generated (per-type mapping: PRDs → requirements.md).
- Requirement ID families from the SPECs are preserved with provenance in `intel/constraints.md`:
  RICH-R/I/C/H (60: 17 P0 / 22 P1 / 21 P2) · AGT-01…04 · CTX-01…06 · MEM-01…05 + KNW-01 · TOL-01…07 · EVAL-01…07 · EVO-01…06 · PROP-01…06 · MM-01…07 · COLLAB-01…13 · CAT-01…05 · LLM-WIKI-01…11 · SYNC-01…11 · NMEM-01…03 · WIKI-ID-01…04 · OKF-WIKI-01…04 · APPR-01…06 · NOTES-COL-01…03 · Flows 1–19 · §9 P0/P1 feature tables · §18 Phases 1–19.

## Constraints

- **42 SPEC constraint entries** in `intel/constraints.md` — 32 from PRODUCT_SPEC, 10 from DESIGN_SYSTEM.
- Type breakdown: **api-contract 7 · schema 11 · nfr 18 · protocol 6.**
- Key anchors: runtime pipeline + tier caps; context tiers/budgets; memory architecture; storage keys/encryption; security/permissions; UI/UX + appearance; RICH; 19-phase sequence; verification commands; PageContentService; LLM-Wiki/OKF; agent-harness requirements; Appendices A–O canonical constants; design tokens/blueprints/motion/accessibility.

## Context (DOC topics)

- **10 topics** in `intel/context.md`, all from the HTML guide: model-selector decision · Side Panel layout · Standalone chat layout · Notes workspace · Options IA · Workflow routing page · Provider modal · interaction/state standards · accessibility standards · Google AI Studio + OpenCode/GSD hand-off instructions.

## Conflicts

- **0 blockers · 0 open warnings (all six operator-resolved 2026-09-20) · 11 auto-resolved INFO.**
- Full detail and per-warning resolutions: `.planning/INGEST-CONFLICTS.md`.
- Operator decisions applied to the source documents (authoritative for downstream planning):
  - **W1 — Side Panel is Chat-only.** Agent/Notes/Write/Tools/TeamGQM/Options/Diagnostics are Standalone-only surfaces; add-ons register Standalone pages and Side Panel chat-safe entry actions — never Side Panel pages or a nav rail.
  - **W2 — No snip/screenshot composer control.** Canonical composer toolbar: workflow selector (left) · Attach · Chat history · New chat (right); screenshot/region-capture is deferred beyond v0.2.
  - **W3 — Standalone Sider:** Chat · Agent · Note · Write · Tools; Add-ons group (TeamGQM, flag-gated, future approved add-ons); bottom Settings (Diagnostics reached via Settings); user-facing label `Note`.
  - **W4 — Message actions:** Side Panel assistant 7 (Copy · Save to note · Like · Dislike · Regenerate · Share · Read aloud); Standalone assistant 8 (+ Quote); Standalone user 4 (Edit · Copy · Share · Read aloud); no Expand message action.
  - **W5 — Current release label is v0.2.** Active spec text updated; "v0.2+" deferrals rewritten to "later release" phrasing.
  - **W6 — Visual references live under `.planning/design/references/{sidepanel,standalone,notes,options,themes}/`; `.planning/mockup/` is not used.**
- The only cross-ref cycle (`PRODUCT_SPEC.md ⇄ DESIGN_SYSTEM.md`) is resolved by the docs' own declared functional/visual precedence (INFO I1); synthesis proceeded on all three docs.

## Not ingested / external references

- PRODUCT_SPEC cross-refs `RESEARCH-RECONCILIATION.md`, `STACK.md`, `DECISIONS.md`, `DESIGN.md`, `NOWPILOT_ADDITIONAL_REQUIREMENTS_AGENT_HARNESS.md` — not in the ingest set; §28.1 states the harness contract is self-contained.
- `.planning/codebase/*.md` is the generated codebase map (reference only, not a source doc).
- Design reference art exists at `.planning/design/references/{sidepanel,standalone,notes,options}/*.png` (W6 resolved — canonical location).

## Intel files

- `.planning/intel/constraints.md` — 42 SPEC constraints
- `.planning/intel/decisions.md` — 12 proposed decisions (0 locked)
- `.planning/intel/context.md` — 10 DOC topics
- `.planning/INGEST-CONFLICTS.md` — conflict report (3 buckets)
