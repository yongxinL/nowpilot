# Phase 5a: LLM-Wiki & Filesystem Sync - Research

**Researched:** 2026-08-14
**Domain:** LLM enrichment over the Phase-5 note layer (NoteTagger/NoteQA/NoteChatConverter/NoteMaintenance) + one-way filesystem sync (NoteFileSync, YAML frontmatter, File System Access API, IndexedDB handle persistence)
**Confidence:** HIGH (spec-verbatim contracts + directly-verified codebase seams + npm-verified packages + official WICG/MDN/Chrome/yaml docs)

## Summary

Phase 5a builds five core services under `src/core/notes/` on **existing, verified seams**: the haiku-tier AI-call template (`MemoryExtractor` — PersonaInjector → `requestJson` → Zod + one repair → never throws), the persistent `MiniSearchIndex` (`searchNotes` → `{id, score}[]` normalized to [0,1]), `MemoryEngine` (`assemble()` for RAG context, `addFacts()` for NMEM-02 single-writer persistence), the `NotesDB` save pipeline (`parseLinks → resolveLinks → putNote → note:saved` in `NotesPage.handleSave`), the `@ant-design/x` Bubble/Sender chat surface, and the `OptionsPage` Card-section pattern. All five AI PROMPTS (`noteTagger`/`noteQA`/`noteChatConvert`/`memoryExtractor`/`repairJson`) are already seeded in `src/core/prompts/index.ts` with tier + cacheable flags, and all LLM-Wiki UI copy (`askPlaceholder`, `backupOn/Off/Error`, `restorePreview`, `externalChange`, `stale`, `orphan`, `taggerFailed`, `reanalyzeAll`) is already in `STR.notes`.

Two packages must be installed (both pre-approved in the spec's §7 stack, both pass the legitimacy gate, **neither is in `package.json` today**): `yaml@2.9.0` (frontmatter serialize/parse — no built-in frontmatter helper; wrap `stringify()` output in `---` delimiters) and `@types/wicg-file-system-access@2023.10.7` (**provably required**: TypeScript 5.9.3's `lib.dom` ships `FileSystemHandle`/`FileSystemDirectoryHandle`/`FileSystemWritableFileStream` but NOT `showDirectoryPicker()`/`queryPermission()`/`requestPermission()` — verified by tsc compile test, and the package merges cleanly with lib.dom via interface augmentation, no duplicate-identifier conflicts).

The critical platform facts for `NoteFileSync` (verified against the WICG spec + Chrome docs): `FileSystemHandle` is `[Serializable]` so **IndexedDB can store the directory handle directly** (structured clone — chrome.storage's JSON serialization cannot, which is exactly why D-08 mandates the `notes_backup_config` IndexedDB store); handles retrieved from IndexedDB "likely return `'prompt'`" from `queryPermission()`, so the mount-time permission check + Re-select banner (D-05a-16) is the correct no-reprompt flow, with Chrome 122+'s persistent-permissions three-way prompt available if `requestPermission()` is ever called on a stored handle; `showDirectoryPicker()` requires transient user activation and has **known failures in Chrome extension popup/side-panel contexts** (crbug 40240444, WICG issue #314) — this is the technical reason SYNC-01 is locked to the Standalone view, but the Standalone tab (`chrome-extension://` top-level window) still needs a one-time manual verification checkpoint.

**Primary recommendation:** Follow the §18 create-list paths verbatim (R-1); pattern-match each service on its verified template — NoteTagger/NoteChatConverter on `MemoryExtractor.ts` (add `noteTagger`/`noteQA`/`noteChatConvert` to PersonaInjector's `PipelineStage` union — a small core edit), NoteQA on `requestJson` with a structured `{answer, citations[]}` schema (the seeded plain-markdown `noteQA` prompt must be amended to the JSON contract so citations carry `noteId` for clickable Tags), NoteFileSync on the WICG handle API with plain-object FS-handle mocks in tests (fake-indexeddb cannot structured-clone a real handle), and the v4 migration on the `MemoryDB` `runMigrations` precedent (`userFactsV2Migration` guarded store creation; `openNotesDB` must route through `runMigrations` at the bumped version or the warm-open blocks the migration).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-05a-01 [inline suggestion bar in editor]:** Tag/category/summary suggestions surface as a dismissible suggestion bar/banner near the top of the note editor — clickable tag chips + proposed category path + summary snippet. Co-located with the user's editing context. Not a separate panel, not a notification.
- **D-05a-02 [per-item toggle + Accept all]:** Each suggested tag has its own accept/decline toggle, plus a one-click "Accept all" for the whole batch. Confidence-gated items below the LLM-WIKI-11 threshold (≥0.60, max 3 facts / 5 tags) are silently discarded before display — never shown.
- **D-05a-03 [category as inline path input + suggestion]:** The category field is an inline path input (segments joined by `/`, CAT-01 normalization). When NoteTagger returns a suggested categoryPath it pre-fills as a *proposed* value with accept / edit / dismiss controls; the user can freely edit segments. Invalid segments flagged per CAT-05 (AntD red border).
- **D-05a-04 [persist acceptance; re-suggest only on content change]:** Accepted tags/category/summary persist into the note (accepted items stored at their reported confidence). Rejected items are remembered per note (never re-suggested for the same `{noteId, version}`, LLM-WIKI-11). Staleness detection (summaryGeneratedAt/tagsGeneratedAt vs updated, LLM-WIKI-08) drives the "Content has changed — Regenerate tags/summary" hint, which re-triggers suggestions.
- **D-05a-05 [inline search box in Notes view]:** "Ask notes" lives as an inline search/ask input in the Notes page toolbar — not a dedicated page, not a chat preset. Co-located with the notes being referenced.
- **D-05a-06 [inline answer card + citation chips]:** Answers render as an ephemeral inline answer card under the search input — synthesized markdown (flash tier) with clickable citation Tags linking to source notes (click → open/navigate to the note). Dismissible. Matches the spec's @ant-design/x Bubble + citation Tags (Flow 13).
- **D-05a-07 [one merged input, AI-enhanced]:** A single search input runs MiniSearch; AI synthesis engages when the user asks a natural-language question, when hits < 3, or when "AI Search" is enabled (LLM-WIKI-05). No separate plain-vs-AI modes in the UI. Tiny mode falls back to plain MiniSearch (§18 3rd bullet, spec line 514).
- **D-05a-08 [zero hits = helpful message, no LLM call]:** Empty retrieval → a message like "No matching notes found" with NO provider call (matches ROADMAP SC #2 "zero hits yields a helpful message with no wasted LLM call").
- **D-05a-09 [per-message overflow action on assistant messages]:** "Save to note" is an action in each assistant message's overflow/hover menu (ChatMessage affordance) — not a chat toolbar button. This is the only Side-Panel entry point (§27 surfaces).
- **D-05a-10 [SaveToNoteDialog modal with preview]:** The LLM-drafted title/content/tags/wikilinks/categoryPath opens in a `SaveToNoteDialog` modal for review (edit-in-modal, then Save creates the note or Cancel). No navigation to the Notes editor.
- **D-05a-11 [page capture gets the same LLM-drafted dialog]:** The page→note flow also routes through `NoteChatConverter` → `SaveToNoteDialog`, drafting from the extracted `PageContext` (Phase 4a). Consistent drafting; user is the gatekeeper.
- **D-05a-12 [side panel drafts in-place]:** Side-panel saves open the dialog in the side panel (R-3 permits AI + IndexedDB there); no navigation jump to Standalone. The note then appears in Standalone via the existing note sync/refresh (note:saved event).
- **D-05a-13 [orphan "Find context" triggers RAG]:** The algorithmic orphan badge (LLM-WIKI-09, 0 wikilinks + 0 backlinks) offers "Find context", which triggers the NoteQA RAG path for that note.
- **D-05a-14 [folder picker in both Options + Notes toolbar]:** Primary config lives in Options → Notes (NotesSection backup config); the Notes toolbar carries a quick "Backup: on/off [Configure]" indicator + button (SYNC-07). `showDirectoryPicker()` runs Standalone-only; the `FileSystemDirectoryHandle` persists in the `notes_backup_config` IndexedDB store (SYNC-01, non-serializable → not chrome.storage).
- **D-05a-15 [status Tag + last-error tooltip]:** Green "Backup: On" / gray "Backup: Off" / red "Backup: Error" Tag in the Notes toolbar; hover tooltip shows the last sync error (SYNC-08). No notification spam on state changes.
- **D-05a-16 [permission-loss banner with Re-select + Dismiss]:** In-Notes banner "Backup folder not accessible [Re-select folder] [Dismiss]" when `queryPermission()` fails (SYNC-02); sync stays disabled until the folder is re-selected. No auto-reprompt on every mount.
- **D-05a-17 [restore lives in Options → Import/Export with count preview]:** "Restore from folder" sits in Options → Import/Export, opening the preview modal "Found N notes (X new, Y updated, Z unchanged)" with [Import] [Cancel] (SYNC-09/10). Additive upsert — local notes not in the folder are never deleted. No restore-history/undo feature (out of scope).

### Core Service Contracts (locked by spec — implementation discretion only)
- NoteTagger: ONE haiku-tier temperature-0 call per save (tags + categoryPath + summary + memoryFacts), non-blocking after the IndexedDB write; save never waits (§22.1, D-05-10). Toggle-gated by `np_notes_llm_features` (autoTag/autoCategorize/autoSummary/aiSearch, LLM-WIKI-02). Routes through PersonaInjector (GR-3) + `requestJson` one-repair (GR-4).
- NoteQA: flash-tier synthesis over MiniSearch top-5 + memory facts (NMEM-01); cited markdown output (LLM-WIKI-06). "Re-analyze all notes" is user-initiated + sequential with real-time stats (LLM-WIKI-10).
- NoteChatConverter: haiku-tier draft of {title, content, tags ≤5, categoryPath, wikilinks} using conversation messages AND `MemoryEngine.assemble()` (NMEM-03).
- NoteFileSync: fire-and-forget per-save write with 50 ms debounce (SYNC-03); YAML frontmatter `{id, created, updated, tags, categoryPath, summary}` (SYNC-04, `yaml ^2`); filename sanitization + collision suffixing (SYNC-04/05); external-change guard (2 s tolerance, default Skip, SYNC-06); delete-on-sync + empty-folder cleanup (SYNC-11).
- NoteMaintenance: staleness (timestamp comparison, LLM-WIKI-08) + orphan detection (algorithmic, no LLM, LLM-WIKI-09) + bulk re-analysis coordinator (LLM-WIKI-10).

### Security / Privacy (locked)
- TraceRedactor runs before indexing, logging, or writing to disk; password values never written to `.md`; filesystem paths + note content redacted from Diagnostics/exports (§27.6). RAG answers + page indexes are ephemeral (never persisted).

### the agent's Discretion
- Exact suggestion-bar component structure/placement inside the NotesPage layout (inline bar variant styling, dismiss persistence).
- Exact `np_notes_llm_features` setting shape + storage key + Zod schema (PreferenceMemoryStore precedent), and the exact `notes_backup_config` store schema beyond the handle field.
- Exact NoteTagger/NoteQA/NoteChatConverter public API surfaces (options, per-stage timeout/abort, tier defaults) following the `MemoryExtractor` precedent (operationId, providerId/model defaults, haiku tier).
- Exact NoteFileSync debounce/permission-check/write mechanics (50 ms debounce, permission re-check cadence, folder-tree walk).
- Exact v4 migration mechanics (idempotent upgrade path, new Note fields vs store) — spec line 2832 "v4 migration idempotent" is the contract.
- Exact `verify:phase-5a` script shape — spec line 3686 gives `tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`; follow the §24 chain template (eslint + prettier + tsc + wxt build + vitest run) consistent with prior phases.
- Whether the summary snippet appears in the NoteList secondary text (LLM-WIKI-03) inline or behind a hover.

### Deferred Ideas (OUT OF SCOPE)
- **Bidirectional filesystem sync / live folder watch** — v2, SYNC-03 (out of scope §27.9; correct-scope reason: requires polling/Native Messaging).
- **Embedding-based / vector retrieval** — v2, EMB-01 (MiniSearch remains v1 retrieval).
- **LLM wikilink autocomplete suggestions** — not in v0.1 (D-04, §27.7); NoteChatConverter still suggests wikilinks in drafted notes.
- **Restore history / undo of last import** — out of scope for the SYNC-09/10 additive restore; would add storage + UI.
- **Auto-create notes from chat unprompted** — explicitly out of scope (§27.9); chat→note is always user-initiated + gatekept.
- **Image/file attachments in notes** — out of scope (§27.9); Phase 7a multimodal territory.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LLM-WIKI-01 | Auto-tagging adds suggested tags to notes | `NoteTagger` patterned on verified `MemoryExtractor.ts` (PersonaInjector → requestJson → one repair → null); seeded `PROMPTS.noteTagger` JSON contract incl. `memoryFacts`; `Note` type already carries tags/summary/categoryPath/timestamps/version; save pipeline hook point verified (`NotesPage.handleSave` after `putNote`) |
| LLM-WIKI-02 | "Ask notes" RAG answers from note index (MiniSearch) | Verified `searchNotes` → `{id, score}[0..1]` (minisearch 7.2.0, no `limit` option — slice after search); `MemoryEngine.assemble()` for NMEM-01 facts; zero-hits → no LLM call (D-05a-08); tiny-mode fallback via tier check |
| LLM-WIKI-03 | NoteChatConverter converts chat into notes; title→LLM integration | Seeded `PROMPTS.noteChatConvert` {title, content, tags ≤5, categoryPath, wikilinks} + `MemoryEngine.assemble()` (NMEM-03); `PageContext` type verified for page flow; `SaveToNoteDialog` gatekeep pattern (D-05a-10/11) |
| SYNC-01 | Local-FS sync exports notes as .md (YAML frontmatter) to a user-chosen folder | `yaml@2.9.0` + `@types/wicg-file-system-access@2023.10.7` verified + required; `FileSystemHandle` `[Serializable]` → IndexedDB persistence verified; `showDirectoryPicker` Standalone-only (extension-context failures verified) |
| SYNC-02 | Baseline diff + restore-from-folder work one-way (export-first) | WICG `getFile()`/`lastModified` for external-change guard; `removeEntry` for delete-on-sync; frontmatter parse → upsert additive (never delete) — `ImportExport.ts` merge precedent verified |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM enrichment calls (NoteTagger/NoteQA/NoteChatConverter) | Core AI services (`src/core/notes/*` via `requestJson` + PersonaInjector) | — | Every AI call routes through the existing Stage/Persona machinery (GR-3/GR-4); core services stay pure-ish (injected `callProviderJsonMode`), surfaces never assemble prompts (Golden Rule 3) |
| Suggestion display + accept/reject + Ask-notes UI | Browser (NotesPage suggestion bar, answer card) | Core (NoteTagger/NoteQA results consumed) | The editor is the center of gravity (P5a-1); UI renders proposals, core owns the LLM contract and confidence gating (LLM-WIKI-11) |
| Memory-fact persistence (NMEM-02/01/03) | Core memory (MemoryEngine — single-writer D-05) | NoteTagger/NoteQA/NoteChatConverter (produce/consume) | `addFacts()`/`assemble()` are the ONLY memory surfaces (D-05-02); notes→memory only, never reversed (NMEM-02, §27.4) |
| Retrieval (Ask-notes + NoteChatConverter wikilinks) | Core (MiniSearchIndex — persistent notes index) | Browser (in-memory index rebuilt on mount) | MiniSearch is the ONLY retrieval (LLM-WIKI-05, §7.7 — no embeddings); index rebuilt on Notes-view mount (D-05-12) |
| One-way .md export + restore | Core (NoteFileSync — File System Access API) | Browser (Standalone view only: picker + handle persistence) | FS handles are structured-cloneable → IndexedDB (`notes_backup_config`); picker is Standalone-only (extension-context failures); background SW untouched (R-3) |
| Backup status/permission UX | Browser (Notes toolbar Tag + banner, Options NotesSection) | Core (NoteFileSync status/lastError) | Status Tag + tooltip (SYNC-08), permission-loss banner (SYNC-02/D-05a-16) are pure UI over core state |
| Staleness/orphan detection | Core (NoteMaintenance — pure timestamp/graph checks) | Browser (badges render derived state) | Algorithmic, no LLM (LLM-WIKI-09); passive timestamp comparison, no background jobs (D-06) |
| Storage schema (v4 migration) | Core data layer (NotesDB `notes_backup_config` store) | Browser (IndexedDB via idb) | `runMigrations` runner + guarded store creation (MemoryDB precedent); migration must not block existing connections |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yaml | ^2.9.0 | YAML frontmatter serialize (`stringify`) + parse for restore (SYNC-04/09) | Pre-approved §7 stack; 182M downloads/wk [VERIFIED: npm registry]; zero deps; the definitive YAML library; `stringify` always ends `\n`, `parseDocument` never throws |
| @types/wicg-file-system-access | ^2023.10.7 | Types for `showDirectoryPicker`/`queryPermission`/`requestPermission` (SYNC-01/02) | Pre-approved §7 stack; **required** — TS 5.9.3 lib.dom lacks these (tsc compile test: TS2304 without it, clean merge with it) [VERIFIED: npm registry + local compile test] |
| minisearch | ^7.2.0 (installed) | Ask-notes retrieval (LLM-WIKI-05/06) | Already in `package.json`; `searchNotes` seam verified (no `limit` search option — slice after search) [VERIFIED: codebase] |
| idb | ^8.0.3 (installed) | `notes_backup_config` store via `runMigrations` | Already in `package.json`; handles structured-clone into stores [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ant-design/x Bubble/Sender | ^2.9.0 (installed) | Ask-notes answer card + SaveToNoteDialog shell (D-05a-06/10) | Ephemeral RAG answer; `Bubble.List` role-map precedent in ChatPage |
| antd Tag/Modal/Popconfirm/Tooltip | ^6.5.3 (installed) | Backup status Tag (SYNC-08), accept/reject chips, restore preview modal, external-change confirm (SYNC-06) | All 5a modal/confirm surfaces follow the existing ChatPage/OptionsPage patterns |
| zod + zod-to-json-schema | ^3.25.76 / ^3.25.2 (installed) | GR-4 structured contracts for NoteTagger/NoteQA/NoteChatConverter | `requestJson` already consumes them (MemoryExtractor precedent) |
| fflate | ^0.8.3 (installed) | Not needed for 5a sync (plain .md files, no ZIP) | Restore reads individual files; ImportExport's ZIP path is unrelated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml` | `js-yaml` | js-yaml is fine but NOT on the approved §7 stack; yaml is zero-dep, maintains comments/AST, passes yaml-test-suite |
| `@types/wicg-file-system-access` | Rely on TS lib.dom only | **Not viable** — lib.dom lacks `showDirectoryPicker`/permission methods (proven TS2304); the types package is required |
| Structured `{answer, citations[]}` for NoteQA | Plain markdown with inline `[[Title]]` citations parsed post-hoc | Structured JSON is GR-4-compliant and gives `noteId` for clickable Tags; title-parsing is fragile (collisions, drift) and effectively hand-parsing |

**Installation:**
```bash
pnpm add yaml@^2.9.0
pnpm add -D @types/wicg-file-system-access@^2023.10.7
```

**Version verification (done 2026-08-14):** `npm view yaml version` → 2.9.0 (published 2026-05-11, 182.6M weekly downloads, no postinstall, repo github.com/eemeli/yaml); `npm view @types/wicg-file-system-access version` → 2023.10.7 (published 2025-10-03, 710K weekly downloads, DefinitelyTyped, no postinstall). Both pass `package-legitimacy check` with verdict OK.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| yaml | npm | 8+ yrs (2.9.0 published 2026-05-11) | 182.6M/wk | github.com/eemeli/yaml | OK | Approved — install `yaml@^2.9.0` |
| @types/wicg-file-system-access | npm | 2 yrs (2023.10.7, updated 2025-10-03) | 710K/wk | DefinitelyTyped | OK | Approved — install as devDependency |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Both packages were also verified on the correct ecosystem registry (`npm view`) and against authoritative documentation (eemeli.org/yaml, DefinitelyTyped source) — neither is a slopsquat.*

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────────────┐
                        │              NotesPage (Standalone tab)             │
                        │  ┌──────────────────────────────────────────────┐   │
   user writes+save     │  │ save pipeline (handleSave, verified):        │   │
 ───────────────────────▶ │  parseLinks → resolveLinks → putNote →        │   │
                        │  │  postcondition getNote → note:saved event    │   │
                        │  └──────┬───────────────────┬───────────────────┘   │
                        │         │ void (never await)│ void (never await)    │
                        │         ▼                   ▼                       │
                        │  ┌────────────┐      ┌───────────────┐              │
                        │  │ NoteTagger │      │ NoteFileSync  │              │
                        │  │ (haiku)    │      │ (debounce 50ms│              │
                        │  │ suggestions│      │  fire-forget) │              │
                        │  └──────┬─────┘      └──────┬────────┘              │
                        └─────────┼───────────────────┼───────────────────────┘
                                  │                   │
                ┌─────────────────▼───┐   ┌───────────▼───────────────┐
                │ requestJson (GR-4)  │   │ notes_backup_config store │
                │ + PersonaInjector   │   │ (IndexedDB — structured   │
                │ (GR-3) + PROMPTS    │   │  clone of FS handle)      │
                └─────────┬───────────┘   └───────────┬───────────────┘
                          │                           │  readwrite ops
                 ┌────────▼───────┐         ┌─────────▼──────────────┐
                 │ MemoryEngine   │         │ FileSystemDirectory    │
                 │ addFacts (NMEM │         │ Handle → getFileHandle │
                 │ -02) /assemble │         │ → createWritable →     │
                 └────────────────┘         │ close; removeEntry;    │
                                            │ getFile().lastModified │
                                            └─────────┬──────────────┘
                                                      │
                                            ┌─────────▼──────────────┐
                                            │  BackupFolder/          │
                                            │  {categoryPath}/{title}.md│
                                            └────────────────────────┘

   Ask-notes: input → searchNotes (MiniSearch) → top-5 + MemoryEngine.assemble()
     → [hits≥3? NL question? aiSearch?] → NoteQA (flash, requestJson {answer,
     citations[{noteId,title}]}) → Bubble + citation Tags → click → open note
     → zero hits → "No matching notes found" (NO LLM call)
     → tiny tier → plain MiniSearch results only

   Chat/page→note: ChatMessage "…" → Save to note → NoteChatConverter (haiku,
     conversation + assemble() facts) → SaveToNoteDialog (edit-in-modal)
     → Save → NotesDB.putNote → note:saved

   Restore: Options → Import/Export → showDirectoryPicker → walk tree →
     parse frontmatter → preview counts → additive upsert (never delete)
```

### Recommended Project Structure
```
src/core/notes/                          # §18 create-list (R-1, verbatim paths)
├── NoteTagger.ts                        # haiku: tags+categoryPath+summary+memoryFacts
├── NoteQA.ts                            # flash: RAG synthesis + citations
├── NoteChatConverter.ts                 # haiku: chat/page → structured draft
├── NoteFileSync.ts                      # one-way app→FS .md sync
└── NoteMaintenance.ts                   # staleness/orphan/bulk coordinator
src/core/storage/migrations/
└── v4_notes_backup_config.ts            # add notes_backup_config store (guarded)
src/components/notes/
└── SaveToNoteDialog.tsx                 # LLM draft + preview modal
src/components/options/
├── NotesSection.tsx                     # LLM toggles, backup config, re-analyze
└── ImportExportSection.tsx              # + "Restore from folder"
src/core/storage/NotesDB.ts              # MODIFIED: DB_VERSION→4, runMigrations route
src/core/ai/persona/PersonaInjector.ts   # MODIFIED: PipelineStage + 3 stages
src/core/prompts/index.ts                # MODIFIED: noteQA → JSON contract (citations)
src/core/storage/Setting.ts              # MODIFIED: register np_notes_llm_features
tests/core/notes/{NoteTagger,NoteQA,NoteChatConverter,NoteFileSync,NoteMaintenance}.test.ts
tests/core/storage/migrations/v4.test.ts
```

### Pattern 1: Haiku-Tier AI Service (NoteTagger/NoteChatConverter template)
**What:** The `MemoryExtractor.ts` shape verbatim: Zod schema → PersonaInjector.inject(stage) → PromptSection[] (system stable:true, input stable:false) → `requestJson` with haiku defaults → catch → `debugLog` canonical code + return null. Never throws.
**When to use:** Every NoteTagger/NoteChatConverter call; NoteQA uses the same machinery with flash defaults.
**Example (from verified `src/core/memory/MemoryExtractor.ts`):**
```typescript
// Source: src/core/memory/MemoryExtractor.ts (verified working code, Phase 5)
const system = PersonaInjector.inject('memoryExtractor', PROMPTS.memoryExtractor.system, {
  persona: opts.persona,
  prefs: opts.prefs,
});
const sections: PromptSection[] = [
  { kind: 'system', text: system, tokens: estimateTokens(system), stable: true, sourceId: 'memory-extractor' },
  { kind: 'user_input', text: turnsText, tokens: estimateTokens(turnsText), stable: false, sourceId: 'memory-extractor-input' },
];
try {
  const result = await requestJson(MemoryExtractorResultSchema, sections, {
    operationId: opts.operationId,
    providerId: opts.providerId ?? 'anthropic',
    model: opts.model ?? 'claude-haiku-4-latest',
    timeoutMs: opts.timeoutMs ?? 30_000,
    callProviderJsonMode,
    abortSignal: opts.abortSignal ?? new AbortController().signal,
  });
  return result.memories.map(/* … */);
} catch (err) {
  debugLog(ERROR_CODES.MEMORY_EXTRACT_FAILED, 'memory extraction failed', {
    module: 'MemoryExtractor', extra: { operationId: opts.operationId } }); // R-10: no raw output
  return null; // §22.1: never blocks the save
}
```
**Required core edit:** `PersonaInjector.PipelineStage` is `'planner'|'executor'|'renderer'|'memoryExtractor'` — add `'noteTagger'|'noteQA'|'noteChatConvert'` (verified union in `src/core/ai/persona/PersonaInjector.ts:27`).

### Pattern 2: File System Handle Lifecycle (NoteFileSync)
**What:** `showDirectoryPicker({mode:'readwrite'})` (Standalone, inside a click handler — transient activation) → `idb.put('notes_backup_config', handle)` → on mount `queryPermission({mode:'readwrite'})` → not granted → sync disabled + banner (D-05a-16, NO auto-reprompt) → Re-select re-runs the picker. Write: `getFileHandle(name,{create:true})` → `createWritable()` → `write(text)` → `close()` (flush on close). Delete: `removeEntry(name)` + empty-folder cleanup via `values()`. External-change guard: `(await fileHandle.getFile()).lastModified` vs last-sync time (2 s tolerance, default Skip).
**When to use:** All NoteFileSync read/write/delete; the handle object lives only in core + IndexedDB (never chrome.storage, never the background SW — R-3).
**Example (verified API surface — WICG spec §2.3/§3 + Chrome docs):**
```typescript
// Source: developer.chrome.com/docs/capabilities/web-apis/file-system-access (write/delete/enum)
async function writeFile(dirHandle: FileSystemDirectoryHandle, relPath: string[], contents: string): Promise<void> {
  let cur = dirHandle;
  for (const seg of relPath.slice(0, -1)) cur = await cur.getDirectoryHandle(seg, { create: true });
  const fileHandle = await cur.getFileHandle(relPath[relPath.length - 1], { create: true });
  const writable = await fileHandle.createWritable(); // throws DOMException if no write permission
  await writable.write(contents);
  await writable.close(); // changes are NOT on disk until close()
}
```

### Pattern 3: Versioned Non-Blocking Suggestions (LLM-WIKI-11)
**What:** NoteTagger runs `void analyze(noteId, version, content)` after `putNote`; results are stamped with the version they analyzed. The UI discards results whose `{noteId, version}` no longer matches the current draft (never applied to newer content). Display gates: confidence ≥ `NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60`, at most `NOTE_SUGGESTION_MAX_PER_SAVE = 3` memoryFacts / `5` tags, descending confidence; overflow dropped; rejected items remembered per `{noteId, version}`.
**When to use:** The suggestion bar accept/reject + "Accept all" flow (D-05a-02/04); staleness hint re-triggers (LLM-WIKI-08).

### Anti-Patterns to Avoid
- **Blocking the save on LLM or FS:** `handleSave` must `void`-fire NoteTagger and NoteFileSync AFTER the `putNote` postcondition (never `await` them) — §22.1 "save never waits", P5a-2. Failures degrade to a hint, never a blocking error.
- **requestPermission() on mount:** D-05a-16 locks "No auto-reprompt on every mount" — use the Re-select banner flow. (Calling `requestPermission()` on a stored handle CAN trigger Chrome's persistent-permission three-way prompt, but that's a UX decision, not a mount default.)
- **Persisting rejected/under-threshold suggestions:** LLM-WIKI-11 items below 0.60 are "silently discarded, not stored"; rejected items are remembered only as suppression markers per `{noteId, version}`.
- **Hand-parsing the noteQA answer:** GR-4 — if NoteQA returns citations, use a Zod schema via `requestJson`; never regex-parse markdown citation markers to build Tags.
- **Two token counters / joined-string prompt rebuild:** follow the `estimateTokens` + F-4 sections-in invariant (`StructuredOutput.ts` comment L37-43) — the repair appends a section, it never rebuilds the cached prefix.
- **Putting the FS handle in chrome.storage:** it is JSON-non-serializable → silent data loss; the `notes_backup_config` IndexedDB store is the D-08 mandate.
- **Warm-open blocking the migration:** `openNotesDB` must open at the NEW version (route through `runMigrations` like `openMemoryDB`); otherwise `openNotesDB` at v1 + migrator at v4 → `onblocked` (an open connection blocks the upgrade).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML serialization/parsing (frontmatter) | Regex/manual YAML writer | `yaml` (stringify/parse) | YAML quoting edge cases (titles with `:`, quotes, control chars); yaml-test-suite compliant; zero deps |
| File System Access API types | Manual `declare global` shims | `@types/wicg-file-system-access` | Full picker/permission/type surface; merges cleanly with TS 5.9 lib.dom; a hand shim would drift and duplicate |
| Structured LLM output | Regex JSON extraction | `requestJson` (zod + zod-to-json-schema, one repair) | GR-4 + Appendix L: exactly one repair, then STRUCTURED_OUTPUT_FAILED; never hand-parse |
| Prompt assembly / persona | Inline prompt strings in services | PersonaInjector + `PROMPTS` | GR-3: every AI call routes through a PersonaInjector stage; cache-stable [SYSTEM] |
| Memory persistence | Direct store writes from 5a services | `MemoryEngine.addFacts` / `assemble` | D-05 single-writer; surfaces never talk to individual stores (R-4) |
| Note search | Custom TF-IDF/embedding | `MiniSearchIndex.searchNotes` | MiniSearch is the locked v1 retrieval (§7.7, LLM-WIKI-05); embeddings are v2 (EMB-01) |
| IndexedDB migration plumbing | Hand-patching stores on open | `IndexedDBMigrator.runMigrations` | D-14 registry + D-12 degraded mode + atomic-abort semantics already proven |
| Filename sanitization | Full path-sanitization lib | Small inline regex (SYNC-04: `/ \ : * ? " < > |` → `_`) | Contract is a fixed 8-char set; a library is overkill and off-stack |

**Key insight:** Every "hard" problem in 5a already has a proven in-repo or in-stack solution — the phase is an exercise in *composition*, not invention. The only genuinely new platform surface is the File System Access API, and even there the hard parts (permissions, serialization, activation) are platform behavior, not something to re-implement.

## Runtime State Inventory

> This is a greenfield-extension phase over the Phase-5 note layer — the inventory covers the one storage-schema change (v4 migration).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NotesDB at `DB_VERSION = 1` with `notes`/`concepts` stores (no notes_backup_config store). `Note` rows ALREADY carry `summary`/`categoryPath`/`summaryGeneratedAt`/`tagsGeneratedAt`/`version` fields (§21.2 verbatim — verified in `src/core/storage/NotesDB.ts`) | v4 migration adds the `notes_backup_config` store only; NO data-carve on existing Note rows (fields already present, IndexedDB is schema-agnostic). Migration must be idempotent + guarded (fresh-install path creates all stores) |
| Live service config | `np_notes_llm_features` NOT in the `Setting.ts` permission registry (`STORAGE_KEY_REGISTRY`) — unregistered keys silently fall back (Pitfall 4) | Register `np_notes_llm_features: { area: 'local' }` (np_persona precedent, verified registry at Setting.ts L62-81) |
| OS-registered state | None — no OS-level registrations in 5a (FS handle is a browser-managed permission, not an OS registration) | None |
| Secrets/env vars | `np_notes_llm_features` is a new chrome.storage.local key (no secret); `notes_backup_config` handle is an IndexedDB store, NOT chrome.storage (D-08) | Code edit only; handle must never appear in chrome.storage or exports (EXCLUDED from ImportExport groups by construction — it lives in IndexedDB, not chrome.storage) |
| Build artifacts | `.planning` note: `tests/core/storage/migrations/` directory does NOT exist yet; `v4.test.ts` creates it (spec verify:phase-5a targets it) | New test directory is a create-list deliverable; no stale artifacts |

**Nothing found in category:** OS-registered state — none by design (no native processes, no scheduled tasks; sync is page-lifetime + IndexedDB).

## Common Pitfalls

### Pitfall 1: Picker blocked in extension contexts / broken on macOS
**What goes wrong:** `showDirectoryPicker()` throws `AbortError`/`SecurityError` or hangs when called from a Chrome extension popup or side panel — multiple confirmed reports (crbug 40240444 "showDirectoryPicker fails in extensions"; WICG/file-system-access#314 closed with the same failure; badlogic/chrome-extension-fs-crasher: "multiple issues when called from Chrome extension contexts (popup, side panel) on macOS").
**Why it happens:** The picker needs a top-level window with transient user activation; extension popup/side-panel contexts are unreliable in Chrome (macOS worst).
**How to avoid:** SYNC-01 locks `showDirectoryPicker()` to the **Standalone view only** (a `chrome-extension://` tab). Add a manual verification checkpoint in the plan: run the phase in a real Chrome, click "Set backup folder" in the Standalone Notes view, confirm the picker opens and the handle persists. **Warning signs:** AbortError immediately after picking a folder; picker never appears.

### Pitfall 2: Handle permission loss across sessions
**What goes wrong:** Sync silently fails after a browser restart — the IndexedDB handle still exists but `queryPermission({mode:'readwrite'})` returns `'prompt'` (spec: "a handle retrieved from IndexedDB is also likely to return 'prompt'"), so writes throw DOMException.
**Why it happens:** Write permission is not persisted across sessions by default; Chrome 122+ persistent permissions require a user choice on a three-way prompt.
**How to avoid:** SYNC-02 mount-time check → sync disabled + "Backup folder not accessible [Re-select folder] [Dismiss]" banner (D-05a-16 — never auto-reprompt); red "Backup: Error" Tag with tooltip (SYNC-08). **Warning signs:** green "Backup: On" Tag but no files on disk after restart.

### Pitfall 3: YAML frontmatter round-trip corruption
**What goes wrong:** Unquoted strings that look like YAML scalars (`yes`, `null`, `2026-01-01`, `3.14`) parse back as booleans/null/dates/numbers; titles with `: ` or quotes break naive splitting on `---`.
**Why it happens:** YAML 1.2 core schema resolves plain scalars; `yaml.stringify` handles quoting on write but a naive reader (or a hand-rolled splitter) doesn't.
**How to avoid:** Write via `stringify(meta)` wrapped in `---\n...\n---`; read via `parse()` on the extracted block and validate with a Zod schema per frontmatter field (id/created/updated/tags/categoryPath/summary) — invalid/missing frontmatter → treat as a new note (SYNC-09 "id missing → create"), never crash. **Warning signs:** restored note tags contain `true`/`null`; UUIDs parse as numbers.

### Pitfall 4: Suggestions applied to stale content
**What goes wrong:** User edits a note; the slow tagger response (haiku, ~1–2 s) arrives and overwrites the newer content's suggestions.
**Why it happens:** The non-blocking call races the editor.
**How to avoid:** Version-stamp the tagger call with `{noteId, version}`; discard responses whose version ≠ current draft version (LLM-WIKI-11). **Warning signs:** suggestion bar shows tags for text the user already deleted.

### Pitfall 5: Restore overwrites newer local notes
**What goes wrong:** Restore-from-folder upserts blindly, clobbering a locally-newer note with the folder's older copy.
**Why it happens:** "update if id exists" without a recency check.
**How to avoid:** SYNC-09 verbatim: "id exists → update (preserve updated if newer)" — compare `updated` timestamps; additive only, never delete local notes not in the folder (SYNC-10, ROADMAP SC#5). **Warning signs:** restored preview shows "unchanged" for notes the user edited after the last export.

### Pitfall 6: Sync/deletion of files the user edited externally
**What goes wrong:** A per-save write (or delete-on-sync) silently overwrites a note the user edited in another editor.
**Why it happens:** No external-change check.
**How to avoid:** SYNC-06: compare `fileHandle.getFile().lastModified` against the last-sync time with a 2 s tolerance → confirm "Overwrite with app version? [Overwrite] [Skip]" (default Skip); delete-on-sync checks the same before `removeEntry`. **Warning signs:** user reports lost edits in the backup folder.

### Pitfall 7: fake-indexeddb cannot clone real FS handles in tests
**What goes wrong:** A NoteFileSync test that puts a real `FileSystemDirectoryHandle` into IndexedDB fails or the mock silently degrades.
**Why it happens:** fake-indexeddb's structured-clone implementation doesn't know the platform handle class; tests run in Node/jsdom where the API doesn't exist.
**How to avoid:** Inject a **plain-object mock handle** (`{ kind, name, getFileHandle, getDirectoryHandle, removeEntry, values, queryPermission, getFile, createWritable }`) into NoteFileSync via structural DI (MemoryEngine precedent) and assert against a recorded in-memory tree. **Warning signs:** `DataCloneError` in tests.

## Code Examples

### Frontmatter write (SYNC-04)
```typescript
// Source: eemeli.org/yaml/v2 (parse/stringify) — API verified; composition pattern
import { stringify } from 'yaml';

function serializeNote(note: Note): string {
  const meta = {
    id: note.id,
    created: note.created,
    updated: note.updated,
    tags: note.tags,
    categoryPath: note.categoryPath, // optional — stringify omits undefined
    summary: note.summary,
  };
  return `---\n${stringify(meta)}---\n\n${note.content}`;
}
```
`stringify` always ends with `\n`; the trailing `---` on its own line terminates the frontmatter block.

### Frontmatter parse / restore (SYNC-09)
```typescript
// Source: eemeli.org/yaml/v2 — parseDocument never throws (errors array); zod validates
import { parseDocument } from 'yaml';
import { z } from 'zod';

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const MetaSchema = z.object({
  id: z.string().uuid().optional(),
  created: z.number().optional(),
  updated: z.number().optional(),
  tags: z.array(z.string()).default([]),
  categoryPath: z.string().optional(),
  summary: z.string().optional(),
});

function parseMarkdownNote(raw: string, folderCategory: string): { meta: Meta; body: string } {
  const match = FRONTMATTER.exec(raw);
  if (!match) return { meta: { tags: [], categoryPath: folderCategory }, body: raw }; // no frontmatter → new note
  const doc = parseDocument(match[1]); // never throws
  const parsed = MetaSchema.safeParse(doc.toJS());
  if (!parsed.success) return { meta: { tags: [], categoryPath: folderCategory }, body: raw };
  return { meta: { ...parsed.data, categoryPath: parsed.data.categoryPath ?? folderCategory }, body: raw.slice(match[0].length) };
}
```

### Permission check + re-select (SYNC-02, D-05a-16)
```typescript
// Source: MDN FileSystemHandle.queryPermission + Chrome persistent-permissions blog
async function ensureFolder(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  const state = await handle.queryPermission({ mode: 'readwrite' });
  // Locked UX (D-05a-16): NO auto-reprompt on mount. Re-select → showDirectoryPicker()
  // re-grants. (Optional: requestPermission() here would surface Chrome's persistent
  // three-way prompt — a UX decision, not the default.)
  return state;
}
// picker (Standalone only, inside a click handler — transient activation):
// const dir = await showDirectoryPicker({ mode: 'readwrite', id: 'nowpilot-backup' });
```

### External-change guard (SYNC-06)
```typescript
// Source: Chrome docs — fileHandle.getFile() → File.lastModified (epoch ms)
const file = await fileHandle.getFile();
const externallyModified = file.lastModified > lastSyncAt + 2_000; // 2 s tolerance
// externallyModified → confirm "Overwrite? [Overwrite] [Skip]", default Skip
```

### Haiku service wiring (NoteTagger, patterned on verified MemoryExtractor)
```typescript
// Source: src/core/memory/MemoryExtractor.ts (verified) — the shape NoteTagger follows
export const NoteTaggerResultSchema = z.object({
  tags: z.array(z.object({ value: z.string().min(1), confidence: z.number().min(0).max(1) })).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string().min(1),
  memoryFacts: z.array(z.object({ content: z.string().min(1), confidence: z.number().min(0).max(1) })).max(10),
});
// gating (LLM-WIKI-11): NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60;
//   at most 3 memoryFacts / 5 tags, descending confidence; below-threshold items dropped (not stored)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chrome re-prompts for FS write access every session | Persistent permissions (three-way prompt: "Allow this time / Allow on every visit / Don't allow") | Chrome 122 (Jan 2024) | A stored handle + `requestPermission()` can grant indefinite readwrite; the mount check still must handle `'prompt'` (SYNC-02 banner) |
| Handles could not cross sessions | Handles stored in IndexedDB (structured clone) | Chrome 86+ (2020) | The `notes_backup_config` store pattern is standard (VS Code does exactly this) |
| No frontmatter helper | `yaml` v2 `parseDocument` (never throws) | yaml 2.x | Robust restore parsing: errors land in `doc.errors` instead of throwing |
| Prompt-inlined AI services | PersonaInjector + `requestJson` + F-4 sections-in | Phase 3 (this repo) | Cache-stable [SYSTEM]; one repair; GR-3/GR-4 invariants already enforced — 5a services inherit them |

**Deprecated/outdated:**
- `chooseFileSystemEntries` (Chromium ≤ 85): replaced by `showOpenFilePicker`/`showDirectoryPicker`/`showSaveFilePicker` — do not use (the @types package marks it `@deprecated`).
- `fileHandle.isFile`/`isDirectory` booleans: deprecated in favor of `kind: 'file'|'directory'`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `showDirectoryPicker()` works in the Standalone `chrome-extension://` tab (vs the known popup/side-panel failures) | Common Pitfalls 1 | HIGH — if the picker is blocked in ALL extension pages, SYNC-01 needs a design change (e.g., open a regular `https` bridge page). Mitigation: manual verification checkpoint early in the phase. Evidence leans positive: SO 70294433 reports it working in a popup; failures concentrate on macOS side panels |
| A2 | `requestPermission()` on a stored handle (Chrome 122+) surfaces the persistent-permission prompt | State of the Art | LOW — we never call it by default (D-05a-16); documented for a possible future UX option |
| A3 | fake-indexeddb round-trips plain-object mock handles (it cannot clone real handles) | Pitfall 7 | LOW — structural DI keeps tests on mocks either way |
| A4 | The `Note` type needs no v4 data migration for "Note fields" (already shipped in Phase 5 §21.2 verbatim) | Runtime State Inventory | LOW — verified directly in `NotesDB.ts` (fields present); if a future phase adds indexes on the new fields, a migration would be needed then |
| A5 | `parseDocument`/`parseAllDocuments` "never throw" holds for any string input | Code Examples | LOW — stated in official yaml docs; `parse()` (throwing) is avoided on the restore path |
| A6 | EventBus needs no new event types for suggestions (component-local state suffices) | Architecture Patterns | LOW — `note:saved` exists; suggestion delivery is in-page state; cross-surface sync of suggestions is not required |

## Open Questions

1. **NoteQA output contract — structured JSON vs plain markdown?**
   - What we know: `PROMPTS.noteQA` (seeded, Appendix-A style) says "Return concise markdown with inline citations". D-05a-06 requires *clickable* citation Tags with note navigation — which needs `noteId` mapping. `requestJson` + Zod is the GR-4-mandated path for structured output.
   - What's unclear: whether to amend the seeded `noteQA` prompt to a JSON contract `{answer: string, citations: [{noteId, title}]}` (robust, clickable) or keep plain markdown and resolve `[[Title]]` cites post-hoc via MiniSearch title lookup (keeps the seed prompt byte-stable but fragile on title collisions/renames).
   - Recommendation: **structured JSON via `requestJson`** (amend `PROMPTS.noteQA` with the citations JSON contract — it is a Phase-5a-owned prompt, not a prior-phase artifact). Confirm with the user at discuss-time if prompt-seed stability is a concern.

2. **Tiny-mode detection for the Ask-notes fallback (SC #2)?**
   - What we know: "tiny mode falls back to plain MiniSearch" — tier resolution lives in `useStreamingLLM` via `classifyModelContext(resolvedInvocation.modelContextWindow)`; a flash invocation for a tiny window is pointless.
   - What's unclear: whether NoteQA's tier check should mirror the hook's `classifyModelContext` on the flash invocation, or check provider config directly (`TIER_TO_MODEL_CANDIDATES.flash` resolvable?).
   - Recommendation: resolve the flash tier via `getProviderRouter().createStageInvocation` (or `resolveTier`) and `classifyModelContext` on the window — same seam as `useStreamingLLM`; if tiny or no flash-capable provider → plain MiniSearch results.

3. **Picker reliability in the Standalone tab (A1) — needs a human checkpoint?**
   - What we know: locked Standalone-only; extension-context failures are documented; the Standalone tab is a top-level window.
   - What's unclear: whether this specific Chrome build grants the picker in `chrome-extension://` tabs (regression history is mixed).
   - Recommendation: add a `checkpoint:human-verify` task early (folder-picker smoke test in real Chrome) so a failure surfaces before the sync UI is fully built.

4. **Does NoteFileSync run on side-panel saves (SaveToNoteDialog)?**
   - What we know: side panel creates notes via the dialog (D-05a-12) and can hold IndexedDB (R-3); NoteFileSync hooks the NotesPage save pipeline (Standalone). The handle lives in the shared NotesDB.
   - What's unclear: whether a side-panel-created note should trigger an immediate .md write or wait for the Standalone pipeline/next save.
   - Recommendation: keep the sync trigger in the NotesPage save pipeline (Standalone) — per-save writes are Standalone-originated; the dialog's `putNote` fires `note:saved` and the Standalone surface's index/sync refresh picks it up on next interaction. Simpler and matches "surfaces affected: Standalone (all features)" (§27).

5. **LLM-WIKI-05 rerank folded into the Ask-notes flow — separate call or not?**
   - What we know: D-05a-07 merges the rerank into the single Ask-notes flow; D-05a-08 forbids a call on zero hits.
   - What's unclear: whether the "<3 hits or NL question" trigger should run a *separate* haiku rerank (LLM-WIKI-05) before the flash synthesis (LLM-WIKI-06) or skip straight to synthesis.
   - Recommendation: skip the separate rerank — flash synthesis over the MiniSearch top-5 already reorders by relevance in its answer; a second haiku call is a cost without a distinct consumer surface in v0.1. Flag as a phase-scope clarification.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test toolchain | ✓ | v24.18.1 | — |
| pnpm | package install (`pnpm add yaml ...`) | ✓ | 11.18.0 | npm (same registry) |
| Chrome (real browser) | `showDirectoryPicker` smoke test (A1) | ✓ (dev machine — manual) | — | Blocking if picker fails in extension tab; must be verified manually |
| wxt / vitest / eslint / prettier / tsc | verify:phase-5a chain | ✓ | wxt 0.19.29, vitest 4.1.10 | — |
| fake-indexeddb | v4 migration + NoteFileSync tests | ✓ (tests/setup.ts auto-import) | 6.2.5 | plain-object handle mocks |

**Missing dependencies with no fallback:**
- None — `yaml` + `@types/wicg-file-system-access` are installable immediately (legitimacy OK, versions verified).

**Missing dependencies with fallback:**
- Real-Chrome picker verification (A1): no automated fallback; covered by a manual `checkpoint:human-verify` task in the plan.

## Validation Architecture

> `workflow.nyquist_validation` is enabled (config.json absent → enabled default).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (threads pool, jsdom-align env default, node env for core AI tests via `@vitest-environment node`) |
| Config file | `vitest.config.ts` + `tests/setup.ts` (fake-indexeddb/auto, fakeBrowser, RTL cleanup) |
| Quick run command | `npx vitest run tests/core/notes tests/core/storage/migrations --bail=1` (use `--bail=1`; `-x` is unknown in vitest 4) |
| Full suite command | `pnpm run verify:phase-5a` → `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run` (the §24 chain, consistent with all prior phases; spec line 3686 defines the minimum `tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LLM-WIKI-01 | NoteTagger haiku call → tags/category/summary/memoryFacts; never throws; one repair; confidence gating ≥0.60; version-stale discard | unit (stub `callProviderJsonMode` — MemoryExtractor.test.ts precedent) | `vitest run tests/core/notes/NoteTagger.test.ts --bail=1` | ❌ Wave 0 |
| LLM-WIKI-02 | NoteQA retrieval: searchNotes top-5 + memory facts → structured answer + citations; zero hits → no call; tiny-mode fallback | unit (mock index + assemble; stub provider) | `vitest run tests/core/notes/NoteQA.test.ts --bail=1` | ❌ Wave 0 |
| LLM-WIKI-03 | NoteChatConverter chat/page → draft {title, content, tags≤5, categoryPath, wikilinks} | unit | `vitest run tests/core/notes/NoteChatConverter.test.ts --bail=1` | ❌ Wave 0 |
| SYNC-01 | NoteFileSync .md write: frontmatter, nested folders, collision suffix, sanitize, debounce, delete-on-sync + empty-folder cleanup, external guard | unit (mock FS handle tree via structural DI) | `vitest run tests/core/notes/NoteFileSync.test.ts --bail=1` | ❌ Wave 0 |
| SYNC-02 | Restore: walk tree → frontmatter parse → additive upsert (never delete); preview counts | unit (mock handle) | `vitest run tests/core/notes/NoteFileSync.test.ts --bail=1` (restore cases) | ❌ Wave 0 |
| — | NoteMaintenance staleness/orphan (pure timestamp + graph checks) | unit | `vitest run tests/core/notes/NoteMaintenance.test.ts --bail=1` | ❌ Wave 0 |
| — | v4 migration idempotent + fresh-install guarded store creation | unit (fake-indexeddb; raw-open runner — IndexedDBMigrator.test.ts precedent) | `vitest run tests/core/storage/migrations/v4.test.ts --bail=1` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/notes tests/core/storage/migrations --bail=1`
- **Per wave merge:** `pnpm run verify:phase-5a`
- **Phase gate:** Full `verify:phase-5a` green before `/gsd-verify-work` (Golden Rule 10)

### Wave 0 Gaps
- [ ] `tests/core/notes/NoteTagger.test.ts` — LLM-WIKI-01 (MemoryExtractor.test.ts as the template: 6-case shape incl. GR-4 one-repair, schema boundary, R-10 log hygiene)
- [ ] `tests/core/notes/NoteQA.test.ts` — LLM-WIKI-02
- [ ] `tests/core/notes/NoteChatConverter.test.ts` — LLM-WIKI-03
- [ ] `tests/core/notes/NoteFileSync.test.ts` — SYNC-01/02 (needs a shared mock-FS-handle fixture — suggest `tests/core/notes/fixtures/mockFsHandle.ts`)
- [ ] `tests/core/notes/NoteMaintenance.test.ts` — staleness/orphan
- [ ] `tests/core/storage/migrations/v4.test.ts` — v4 idempotency + fresh-install
- [ ] Packages install: `pnpm add yaml@^2.9.0 && pnpm add -D @types/wicg-file-system-access@^2023.10.7`
- [ ] `verify:phase-5a` script added to package.json (full §24 chain)

## Security Domain

> `security_enforcement` is enabled (config absent → enabled). ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in 5a; provider keys stay in the Phase-2/3 vault) |
| V3 Session Management | no | — (per-save sync is page-lifetime; no sessions) |
| V4 Access Control | yes (local filesystem) | File System Access permission model: pick-time grant + `queryPermission`/`requestPermission` re-check; sync disabled when not granted (SYNC-02, D-05a-16) |
| V5 Input Validation | yes | Zod schemas on every LLM structured output (GR-4 via `requestJson`); frontmatter parse validated with Zod before upsert (restore); CAT-01/05 categoryPath normalization + invalid-segment flagging; filename sanitization (SYNC-04) |
| V6 Cryptography | no | — (no new crypto; vault untouched) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via note/page content into tagger/QA | Tampering | Trust envelope (Phase 4b): retrieved data is `untrusted`/`instructionAuthority: false`; `UNTRUSTED_DATA_SEMANTICS` anchor already in `PROMPTS`; NoteQA prompt: "If the notes do not contain the answer, say so" + cite-only |
| Secrets leaked into backup `.md` files | Information Disclosure | §27.6 + R-10: TraceRedactor/`redactSensitive` before writing to disk; password values never written; filesystem paths + note content redacted from Diagnostics/exports |
| Raw LLM output / note bodies in logs | Information Disclosure | R-10: `debugLog` auto-routes through TraceRedactor; failure logs carry code + operationId only (MemoryExtractor precedent); never raw model output |
| Malicious/oversized YAML on restore | Tampering / DoS | `parseDocument` (never throws) + Zod validation; restore is additive + user-gated preview (SYNC-10); `maxAliasCount` alias-expansion guard exists in yaml options (default 100) |
| Delete-on-sync removing user files | Integrity | SYNC-06 external-change guard (2 s tolerance, default Skip) + restore is additive (never deletes local notes) |
| Path traversal via categoryPath segments | Tampering | CAT-01 normalization (no empty/`.`/`..` segments, trim) + filename sanitization (`/ \ : * ? " < > |` → `_`) — verified normalization contract in §27.1 |

## Sources

### Primary (HIGH confidence)
- [Codebase (direct read)] `src/core/memory/MemoryExtractor.ts`, `src/core/ai/StructuredOutput.ts`, `src/core/ai/persona/PersonaInjector.ts`, `src/core/ai/TierResolver.ts`, `src/core/search/MiniSearchIndex.ts`, `src/core/memory/MemoryEngine.ts`, `src/core/storage/NotesDB.ts`, `src/core/storage/MemoryDB.ts`, `src/core/storage/IndexedDBMigrator.ts`, `src/core/storage/ImportExport.ts`, `src/core/storage/Setting.ts`, `src/core/prompts/index.ts`, `src/core/events/EventBus.ts`, `src/components/pages/NotesPage.tsx`, `src/components/pages/ChatPage.tsx`, `src/components/pages/OptionsPage.tsx`, `src/components/pages/useStreamingLLM.ts`, `src/components/standalone/StandaloneShell.tsx`, `src/components/sidepanel/SidePanelShell.tsx`, `src/entrypoints/{sidepanel,standalone}/main.tsx`, `src/core/i18n/strings.ts`, `tests/core/memory/MemoryExtractor.test.ts`, `tests/isolation/no-content-script-ui.test.ts`, `vitest.config.ts`
- [npm registry (npm view + package-legitimacy OK)] `yaml@2.9.0`, `@types/wicg-file-system-access@2023.10.7` — existence, versions, downloads, no postinstall
- [Local compile test] `@types/wicg-file-system-access` merges cleanly with TypeScript 5.9.3 lib.dom; `showDirectoryPicker` TS2304 without it
- [node_modules] `minisearch/dist/es/index.d.ts` — SearchOptions has no `limit` (slice-after-search verified); `@ant-design/x` Bubble/Sources exports
- [Product spec] `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase 5a block (L2792–2833), §27 (L3818–3914), §22.1 (L3550–3572), §24 (L3671–3697), §15.1
- [CONTEXT.md] `.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md` (all D-05a-01..17 + service contracts)

### Secondary (MEDIUM confidence)
- [CITED: wicg.github.io/file-system-access] — FileSystemHandle `[Serializable]` (§2.3), queryPermission/requestPermission algorithms + transient-activation SecurityError, showDirectoryPicker `{mode:'readwrite'}`, permission-state semantics ("handle retrieved from IndexedDB likely 'prompt'")
- [CITED: developer.chrome.com/docs/capabilities/web-apis/file-system-access] — handles serializable → IndexedDB; write flow (createWritable/write/close); getDirectoryHandle({create:true}); removeEntry; getFile().lastModified; verifyPermission pattern; picker transient activation
- [CITED: developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api] — Chrome 122 three-way persistent-permission prompt; precondition = stored handle + requestPermission()
- [CITED: developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission + Window/showDirectoryPicker] — PermissionState semantics, exceptions (AbortError/SecurityError)
- [CITED: eemeli.org/yaml/v2] — parse/stringify API, parseDocument never throws, default YAML 1.2 core schema, options
- [CITED: unpkg.com/@types/wicg-file-system-access@2023.10.7/index.d.ts] — full type surface (pickers, permission methods, deprecated chooseFileSystemEntries)
- [CITED: issues.chromium.org/issues/40240444 + github.com/WICG/file-system-access/issues/314 + github.com/badlogic/chrome-extension-fs-crasher] — picker failures in Chrome extension popup/side-panel contexts (basis for A1 checkpoint)

### Tertiary (LOW confidence)
- [CITED: stackoverflow.com/questions/70294433] — anecdotal success running showDirectoryPicker from an extension popup (supports A1's lean-positive)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both packages verified on npm + legitimacy OK + local tsc compile proof; existing stack already in package.json
- Architecture: HIGH — every integration seam read directly in code (save pipeline, MemoryExtractor template, MiniSearch API, MemoryEngine surfaces, migration runner, STR copy, surface routers)
- Pitfalls: HIGH for code-verified pitfalls (stale suggestions, v4 open-block, fake-indexeddb, memory single-writer); MEDIUM for the platform-behavior pitfalls (extension picker, permission persistence) — flagged with checkpoints

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days — package versions and Chrome behavior are the fast-moving inputs; re-verify `npm view yaml version` and the picker-in-extension status if the phase starts later)
