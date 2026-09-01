---
phase: 09-llm-wiki-filesystem-sync
plan: 04
subsystem: notes, maintenance, ui-spec
tags: [llm, wiki, maintenance, staleness, orphan, bulk, reanalyze, ui-spec]

requires:
  - phase: 09-llm-wiki-filesystem-sync
    plan: 01
    provides: NoteTagger.analyze, Note type with summaryGeneratedAt/tagsGeneratedAt
  - phase: 08-knowledge-base-memory-minisearch-notes
    provides: NoteGraph.computeBacklinks, Note type
provides:
  - NoteMaintenance service (detectStaleness, detectOrphans, reanalyzeAllNotes)
  - NotesLLMFeatures type + NP_NOTES_LLM_FEATURES_KEY chrome.storage.local contract
  - REANALYZE_PROGRESS_EVENT for UI progress reporting
  - verify:phase-9 gate re-pointed to spec §24 scope
affects: [phase-15-workspace-ui]

actuals:
  tokens: 80000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "UI-SPEC data contracts (StalenessResult, OrphanResult, ReanalyzeProgress)"
    - "LLM-WIKI-02 feature gating via chrome.storage.local np_notes_llm_features"
    - "Pure-logic service — no background jobs (D-06), user-triggered only"
    - "NoteTagger.analyze reuse for bulk re-analyze"

key-files:
  created:
    - src/core/notes/NoteMaintenance.ts
  modified:
    - package.json
  tests:
    - tests/core/notes/NoteMaintenance.test.ts

truths-verified:
  - "Staleness detection: note.updated > max(summaryGeneratedAt, tagsGeneratedAt) (LLM-WIKI-08)"
  - "Orphan detection: 0 links + 0 backlinks, algorithmic via NoteGraph.computeBacklinks (LLM-WIKI-09)"
  - "Bulk re-analyze: sequential, user-initiated, progress events, abortSignal support (LLM-WIKI-10)"
  - "LLM-WIKI-02 gating: all features false → skip NoteTagger entirely"
  - "verify:phase-9 re-pointed to spec §24 test scope"

deviations:
  - "None — implementation matches plan exactly"

decisions:
  - "detectStaleness returns StalenessResult (not just boolean) for UI rendering"
  - "reanalyzeAllNotes emits REANALYZE_PROGRESS_EVENT via EventBus for UI progress bar"
  - "BulkAnalysisStats tracks tagged/categorized/summarized/errors separately for diagnostics"
  - "NotesLLMFeatures defaults all true (UI-SPEC default per LLM-WIKI-02)"
