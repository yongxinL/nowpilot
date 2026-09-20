## Conflict Detection Report

Ingest mode: new (net-new bootstrap; no existing PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md / CONTEXT.md to merge against).
Ingested classifications: 2 SPEC (`PRODUCT_SPEC.md`, `DESIGN_SYSTEM.md`) + 1 DOC (`NOWPILOT_DETAILED_UI_UX_LAYOUT_GSD_GUIDE.html`). No ADR/PRD classifications; no UNKNOWN/low-confidence docs; no locked documents.
Cross-ref graph: 3 in-set nodes; mutual reference `PRODUCT_SPEC.md ⇄ DESIGN_SYSTEM.md` resolved by the docs' own declared precedence (INFO I1); max traversal depth 2 (cap 50).
Status (2026-09-20): all six WARNINGs resolved by operator decision; resolutions applied to the source documents. Clearing re-verified by sweep (see INFO I3–I5, I8 notes).

### BLOCKERS (0)

None detected. No LOCKED-vs-LOCKED contradictions (nothing is locked), no UNKNOWN/low-confidence classifications, no unresolved cross-ref cycle requiring synthesis to halt.

### WARNINGS (0 — all six operator-resolved 2026-09-20)

[RESOLVED] W1 — Side Panel surface scope: Chat-only
  Resolved: The Side Panel is Chat-only. Allowed capabilities: Chat; workflow selection; page context; attachments; chat history; new chat; Options action; Switch to Full chat; lightweight Save to note hand-off; Help and Feedback. The Side Panel renders no navigation rail, Agent, Notes, Write, Tools, TeamGQM, provider administration, diagnostics, filesystem settings, or any other deep-work page. Agent, Notes, Write, Tools, TeamGQM, Options and Diagnostics are Standalone-only surfaces. Phase 17 may implement Standalone add-on pages and Side Panel chat-safe entry actions but no Side Panel pages.
  Applied: PRODUCT_SPEC §5.3, §6.2–§6.5, §8.1 diagram, §8.2, §8.3, §8.5, §9.1, §9.2, §9.4, §9.5, §9.6, §9.7, §12 matrix, §17.2, §18 Phase 17, Appendix registry table + Addon interface; DESIGN_SYSTEM §2, §8.2.

[RESOLVED] W2 — Side Panel composer snip control
  Resolved: no screenshot/snip control in the Side Panel composer for the current release. Canonical toolbar — left: workflow selector; right: Attach, Chat history, New chat. ScissorOutlined/screenshot/snip requirements and acceptance criteria removed. Page extraction stays separate from screenshot capture; future screenshot/region-capture support is deferred and not in the current roadmap.
  Applied: PRODUCT_SPEC §6.2, §17.1; DESIGN_SYSTEM §10 icon map, §12 accessibility list.

[RESOLVED] W3 — Standalone Sider navigation set
  Resolved: canonical Standalone Sider — primary navigation: Chat, Agent, Note, Write, Tools; optional Add-ons group: TeamGQM (feature-gated) and future approved add-ons; bottom navigation: Settings (opens the Standalone Options workspace). Diagnostics is reached from Settings and may have a direct internal route but is not a primary Sider item. User-facing label is the singular `Note`; `Notes` remains acceptable in prose where grammatically appropriate.
  Applied: PRODUCT_SPEC §6.2, §6.5, §8.1 diagram, §8.3, §9.2, §17.2; DESIGN_SYSTEM §2, §8.2, §14. HTML guide already matched the canonical set (no change needed).

[RESOLVED] W4 — Message action sets
  Resolved: Side Panel assistant: Copy, Save to note, Like, Dislike, Regenerate, Share, Read aloud (7). Standalone assistant: Copy, Save to note, Like, Dislike, Regenerate, Quote, Share, Read aloud (8). Standalone user: Edit, Copy, Share, Read aloud (4). No Expand message action — Activity expansion is controlled by the Activity disclosure itself. RICH-C-09 follow-up/closure controls stay separate from message actions.
  Applied: PRODUCT_SPEC §17.1; DESIGN_SYSTEM §8.0 table, §8.8, §9, §14.

[RESOLVED] W5 — Release label
  Resolved: canonical current release label is v0.2. Active spec text updated v0.1 → v0.2 (69 occurrences); no historical, external-protocol or explicitly versioned-dependency references were affected (none existed in the spec). "deferred to v0.2+" statements rewritten to "deferred to a later release" / "deferred beyond the current v0.2 milestone"; §25.3/§25.6 headings and the §25.4 reintroduction plan relabeled accordingly. Document version v0.2; stable active filename remains `.planning/product/PRODUCT_SPEC.md`.
  Applied: PRODUCT_SPEC product-wide.

[RESOLVED] W6 — Visual reference paths
  Resolved: canonical location `.planning/design/references/` with subdirectories sidepanel/, standalone/, notes/, options/, themes/. Declared files: `sidepanel/sidepanel-chatPage.png`, `standalone/standalone-chatPage.png`, `notes/standalone-notePage.png`, `options/options-general.png`. `.planning/mockup/` must not be created or used.
  Applied: PRODUCT_SPEC §18 Phase 15/16; DESIGN_SYSTEM §8.0, changelog.

### INFO (11)

[INFO] Cross-ref cycle PRODUCT_SPEC.md ⇄ DESIGN_SYSTEM.md resolved by declared precedence
  Note: The two SPECs mutually reference each other. Both declare the split explicitly — DESIGN_SYSTEM.md §1: "Where the two ever disagree on a *functional rule*, the product spec wins"; §13: "Design system supplies values; spec supplies wiring"; PRODUCT_SPEC "UI Seed and Workflow Routing Authority": "Approved product requirements, ADRs, this specification, and `DESIGN_SYSTEM_v0_2.md` remain authoritative." Treated as a benign precedence-resolved companion cycle; synthesis proceeded on both docs. (Sources: `.planning/product/PRODUCT_SPEC.md`, `.planning/design/DESIGN_SYSTEM.md`)

[INFO] Auto-resolved: DOC (UI seed) vs SPEC on visual authority
  Note: `.planning/design/NOWPILOT_DETAILED_UI_UX_LAYOUT_GSD_GUIDE.html` asks to "Implement the exact example layouts", but PRODUCT_SPEC's "UI Seed and Workflow Routing Authority" classifies Google AI Studio output as a UI seed and names the spec + DESIGN_SYSTEM as authoritative (precedence SPEC > DOC). Where the DOC differs without SPEC/design corroboration (e.g. status bar showing "Auto · Ready" instead of the provider name; provider modal "Tier use" column; Options "English (UK)"), the SPEC/design wins; the DOC's corroborated content (workflow-selector decision, state/accessibility standards) is retained.

[INFO] Auto-resolved: Notes column toggle count — three vs four
  Note: PRODUCT_SPEC §17.2c text listed three segmented toggles (Directory · Notes · Inspector; Content persistent); DESIGN_SYSTEM §8.3 and PRODUCT_SPEC §18 Phase 15 visual-acceptance line specify four toggles (Directory · Notes · Content · Inspector, Content always-on). Resolved to four. Resolution applied to source documents 2026-09-20 (PRODUCT_SPEC §17.2c).

[INFO] Auto-resolved: Chat-history right drawer width — ~360–400 px vs 320 px
  Note: PRODUCT_SPEC §17.2b said "~360–400 px"; DESIGN_SYSTEM §8.5 and PRODUCT_SPEC §18 Phase 15 acceptance say 320 px. Resolved to 320 px. Resolution applied to source documents 2026-09-20 (PRODUCT_SPEC §17.2b).

[INFO] Auto-resolved: Side Panel header height — 44 px token vs 52 px
  Note: PRODUCT_SPEC §17.1 measures the header at ~52 px and DESIGN_SYSTEM §8.1 pins 52 px; PRODUCT_SPEC Appendix F set `Layout.headerHeight` to `compact ? 44 : 56`. Resolved to 52 px (side panel) / 56 px (standalone). Resolution applied to source documents 2026-09-20 (Appendix F compact value now 52).

[INFO] Auto-resolved: Typography — Appendix F font stack vs design system families
  Note: PRODUCT_SPEC Appendix F `fontFamily` was a system stack with no mono token; DESIGN_SYSTEM §5 mandates Inter (UI/body) and JetBrains Mono (code). Per DESIGN_SYSTEM §13 ("design supplies values; spec supplies wiring") and PRODUCT_SPEC APPR-06 (visual definitions live in the companion), the design families win. Resolution applied to source documents 2026-09-20: Appendix F now uses `Inter, system-ui, …` plus a `fontFamilyCode` JetBrains Mono token.

[INFO] Auto-resolved: Provider-dialog model list presentation
  Note: PRODUCT_SPEC §17.2d requires a model list with count + Update list + add custom + per-model enable; DESIGN_SYSTEM §8.7 specifies a 6-column table (Model name · Type · Context window · Source · Recommended · Enabled); the HTML DOC shows "Tier use" instead of Recommended. Resolved to the design's 6 columns (visual presentation) with the spec's functional requirements retained; the DOC variant is superseded per precedence SPEC > DOC.

[INFO] Auto-resolved: Design changelog's phase pointer ("PRODUCT_SPEC Phase 7/7a") is stale
  Note: DESIGN_SYSTEM changelog/§8.0 cited "`PRODUCT_SPEC` Phase 7/7a now point here for visual acceptance"; PRODUCT_SPEC §18 defines Phase 7 as "Trust-Aware Context and Receipts" and places UI visual acceptance in Phase 15 (Phase 16 for multimodal input). §18 is declared the sole implementation-sequencing authority, so the acceptance gate attaches to Phase 15/16. Resolution applied to source documents 2026-09-20 (DESIGN_SYSTEM changelog + §8.0).

[INFO] Auto-resolved: Options information architecture — flat section list vs grouped menu
  Note: PRODUCT_SPEC §9.3 lists 14 Options sections under a left-side Menu; DESIGN_SYSTEM §8.6/§8.6a and the HTML DOC group them as General · Notes · Advance (+ Help Center) and state the spec's sections live under the same shell (Advanced adds Workflows; AI access links Workflow routing). Compatible — grouping is visual IA; no section is dropped.

[INFO] Auto-resolved: "Side Panel must not expose a raw workflow selector" vs composer workflow control
  Note: PRODUCT_SPEC's authority section forbids a "raw workflow selector" in the Side Panel; §9.1 (Workflow selector P0), §17.1c (compact Workflow control, default Auto) and DESIGN_SYSTEM §8.1g + the HTML DOC all define a curated workflow control in the composer. Recorded interpretation: "raw" = uncurated workflow list / raw model IDs; the compact curated workflow control is required, and provider/model stays read-only.

[INFO] Referenced docs/artifacts not in the ingest set
  Note: PRODUCT_SPEC cross-refs RESEARCH-RECONCILIATION.md, STACK.md, DECISIONS.md, DESIGN.md and NOWPILOT_ADDITIONAL_REQUIREMENTS_AGENT_HARNESS.md; PRODUCT_SPEC §28.1 states the harness types are self-contained ("there is no external NOWPILOT_ADDITIONAL_REQUIREMENTS_AGENT_HARNESS.md"). `.planning/codebase/STACK.md` exists but is the generated codebase map, not the referenced source doc. None are blockers; a follow-up ingest may add them.
