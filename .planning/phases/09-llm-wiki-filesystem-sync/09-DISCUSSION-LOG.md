# Phase 9: LLM-Wiki & Filesystem Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 9-LLM-Wiki & Filesystem Sync
**Areas discussed:** NoteTagger LLM wiring, NoteQA RAG architecture, NoteChatConverter, NoteFileSync handle/frontmatter, NoteMaintenance scope, Memory↔Notes routing, categoryPath + Note.type handoff, v4 migration

---

## NoteTagger LLM Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase-3 AI runtime (ProviderRouter fast tier, temp-0, single structured JSON call) | Leverages existing ProviderRouter/ILLMProvider; single call returns tags+category+summary+memoryFacts | ✓ |
| Build a new standalone LLM pipeline | New provider seam just for notes | |
| Use AgentOrchestrator wrapper | Heavier; adds observability but more coupling | |

**[auto] Selected: Reuse Phase-3 AI runtime** (recommended default — D-01/D-07, additive, reversible).

---

## NoteQA RAG Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Balanced-tier synthesis + per-statement citations, tiny mode falls back to plain MiniSearch | LLM-WIKI-06 + §524; ephemeral Bubble with citation Tags | ✓ |
| Fast-tier synthesis everywhere | Lower quality, not recommended for synthesis per D-07 | |
| Embeddings/vector store | Out of scope per §3.2 | |

**[auto] Selected: Balanced-tier synthesis + citations** (recommended — D-07, spec-verbatim).

---

## NoteFileSync Handle + Frontmatter

| Option | Description | Selected |
|--------|-------------|----------|
| showDirectoryPicker() Standalone-only; handle in notes_backup_config IDB store; OKF v0.2 YAML frontmatter (yaml ^2) | SYNC-01/04 verbatim; non-serializable handle → IDB | ✓ |
| chrome.storage.local for handle | Impossible — handles non-serializable | |
| Custom frontmatter format | Breaks OKF compatibility (D-02a) | |

**[auto] Selected: IDB handle store + OKF v0.2 YAML frontmatter** (recommended — SYNC-01/04 verbatim).

---

## Memory↔Notes (NMEM-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Same LLM call extracts facts → routed through MemoryEngine, primary surface only | D-05 Notes→Memory only; §13 single-writer gate | ✓ |
| Separate extraction call | Redundant; D-01 single-call spine | |
| Bidirectional sync | Out of scope (D-05) | |

**[auto] Selected: Same-call extraction → MemoryEngine, primary surface** (recommended — D-05/§13).

---

## categoryPath + Note.type Handoff

| Option | Description | Selected |
|--------|-------------|----------|
| Populate + serialize in Phase 9 (declared Phase 8) | D-108 handoff; categoryPath from LLM + user edit; type default 'Note' | ✓ |
| Defer population | Breaks SYNC-04 frontmatter requirement | |

**[auto] Selected: Populate + serialize in Phase 9** (recommended — D-108 handoff).

---

## the agent's Discretion

- Exact NoteTagger→ProviderRouter invoke path (direct invoke() vs AgentOrchestrator wrapper).
- Whether NoteQA synthesis streams or returns one-shot.
- Whether NoteFileSync debounce is module-level or hook-scoped.
- Whether NoteMaintenance is one file or split.

## Deferred Ideas

- Memory governance (Phase 10), bidirectional sync (v0.2+), embeddings (deferred), LLM wikilink autocomplete (D-04), full NotesWorkspace UI (Phase 15), tool registration (Phase 18) — all noted in CONTEXT.md deferred section.
