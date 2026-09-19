# NowPilot Delivery Roadmap

## Rules

- Implement one phase at a time.
- Every phase requires approved `DESIGN.md` and `PLAN.md`.
- Every task is test-first and atomically committed.
- A phase advances only after automated verification, review, and manual evidence.

## Phase 1: Runtime, shells, and workspace

Deliver WXT/MV3 baseline, Chat-only Side Panel, Standalone shell, workspace handoff, canonical message envelopes, theme wiring, and skeleton pages.

## Phase 2: Storage and security

Deliver encrypted settings, IndexedDB foundations, migrations, write journal, redaction primitives, and workspace persistence.

## Phase 3: AI runtime

Deliver provider adapters, tier resolution, Planner/Executor/Renderer, bounded orchestration, structured output repair, streaming buffer, and persona injection.

## Phase 4: Reliability and evidence

Deliver trajectory state, postcondition verification, completion evidence, partial outcomes, deterministic retry limits, and abort behaviour.

## Phase 5: Context optimisation

Deliver model tiers, token budgets, degradation, minimal mode, and context provenance.

## Phase 6: Page extraction

Deliver on-demand Defuddle/Readability and APC-lite extraction, cache lifecycle, ephemeral page search, isolation tests, and privacy constraints.

## Phase 7: Trust-aware context

Deliver trust metadata, instruction-authority stripping, context receipts, stable-prefix tests, and prompt-injection fixtures.

## Phase 8: Knowledge base

Deliver notes, immutable IDs, wikilinks, backlinks, MiniSearch, conversation memory, user memory, preferences, and working memory.

## Phase 9: LLM-Wiki and backup

Deliver note enrichment, Ask Notes, chat/page conversion, suggestion gating, optional one-way filesystem backup, restore preview, and round-trip tests.

## Phase 10: Diagnostics and evaluation baseline

Deliver transaction traces, redaction, diagnostics, golden suites, deterministic validators, failure-layer reporting, and release-blocking security suites.

## Phase 11: Workspace experience

Deliver complete Chat, Agent, Notes, Write, Tools, Options, provider configuration, history, accessibility, and approved RICH P0 interaction patterns.

## Phase 12: Add-ons, hardening, and release

Deliver ServiceNow and approved global add-ons, right-click Ask AI, package isolation, performance gates, migration drills, release packaging, smoke tests, and rollback evidence.

## Post-MVP approval tracks

The following are not part of the default v0.1 schedule:

- multimodal image and voice input;
- bounded multi-role collaboration;
- verified continual evolution;
- host-page injection and write-back;
- browser automation;
- bidirectional filesystem sync.
