---
phase: 09-llm-wiki-filesystem-sync
plan: 02
subsystem: notes, ai, search
tags: [llm, wiki, rag, qa, chat, converter, citations, minisearch, memory]

requires:
  - phase: 09-llm-wiki-filesystem-sync
    plan: 01
    provides: NoteQAResultSchema, NoteDraftSchema, gateSuggestions, MemoryEngine.assemble/upsert
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: StructuredOutput.requestJson, TierResolver.resolveTier, ProviderRegistry
  - phase: 08-knowledge-base-memory-minisearch-notes
    provides: MiniSearchIndex.query, MemoryEngine.retrieveMemoryHints, LinkParser.parseLinks, NotesDB
provides:
  - NoteQA service (RAG "Ask notes" with citations, balanced-tier synthesis, keyword-only fallback)
  - NoteChatConverter service (chat-to-note draft with memory context + wikilink extraction)
  - AI-enhanced rerank (LLM-WIKI-05): fast-tier rerank when <3 results or aiSearch flag set
affects: [phase-15-workspace-ui, phase-10-memory-governance]

actuals:
  tokens: 95000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Object-form namespace export (NoteQA, NoteChatConverter) per established pattern"
    - "resolveTier('balanced'|'fast') for tier-gated AI calls with fallback"
    - "requestJson with callProviderJsonMode seam for testability"
    - "MemoryEngine.assemble() for NMEM-03 memory context in chat conversion"

key-files:
  created:
    - src/core/notes/NoteQA.ts
    - src/core/notes/NoteChatConverter.ts
  modified: []
  tests:
    - tests/core/notes/NoteQA.test.ts
    - tests/core/notes/NoteChatConverter.test.ts

truths-verified:
  - "NoteQA.ask() retrieves MiniSearch top-5 + MemoryEngine facts, returns balanced-tier synthesis with per-statement citations"
  - "NoteQA tiny mode falls back to plain MiniSearch results when balanced tier unavailable (no LLM synthesis)"
  - "NoteChatConverter.draftFromChat() produces NoteDraft with memory context + wikilink extraction"
  - "AI rerank activates on <3 results or aiSearch flag; fast-tier call reorders citations"

deviations:
  - "None — implementation matches plan exactly"

decisions:
  - "NoteQA returns NoteQAServiceResult (extended NoteQAResult with mode/fallback/rerank metadata) for UI consumption"
  - "NoteChatConverter NEVER auto-saves — draft is user-gated per LLM-WIKI-07"
  - "Rerank uses RerankResultSchema (order[] only) — minimal fast-tier payload"
