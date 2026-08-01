---
phase: 05
slug: knowledge-base
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-01
---

# Phase 05 — UI Design Contract

> **Phase type: Persistence / Infrastructure.** This phase builds the NotesDB, MemoryEngine, MiniSearch index, and note graph — core data modules with NO direct UI components. This document specifies data-type contracts and visual patterns that downstream UI phases (Phase 5a LLM-Wiki, Phase 7 Workspace Experience) must implement. Every UI decision here comes from CONTEXT.md decisions already locked.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Ant Design v6 + Tailwind CSS v4, no shadcn per PROJECT.md) |
| Preset | not applicable |
| Component library | antd ^6, @ant-design/x ^2, @ant-design/x-markdown ^2 |
| Icon library | @ant-design/icons ^6 |
| Font | Ant Design default system font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto) |

**Foundation**: The project uses Ant Design v6 for components, Tailwind CSS v4 for utility styling, and @ant-design/icons for icons. No shadcn/ui, no @radix-ui/react-*, no @ant-design/x-sdk. The `shadcn_initialized` flag is `false` because this project chose Ant Design over shadcn at Phase 1 — this is a locked decision.

---

## Spacing Scale

> Source: Ant Design v6 default 8px grid. Declared here for downstream Phase 7 UI consumers.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none for this phase.

---

## Typography

> Source: Ant Design v6 token defaults. Declared for Phase 7 Notes UI consumption.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 (regular) | 1.5 |
| Label | 12px | 400 (regular) | 1.3 |
| Heading | 20px | 600 (semibold) | 1.2 |
| Display | 28px | 600 (semibold) | 1.1 |

---

## Color

> Source: Ant Design v6 token system. This phase introduces no new color contracts. Downstream UI inherits from the existing theme (light/dark) that was established in Phase 1. The accent color is Ant Design's blue-6 (#1677ff). Destructive color is Ant Design's red-6 (#ff4d4f) for delete actions defined in this phase's copywriting contract.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | Ant Design `--color-bg-container` (light: #ffffff, dark: #141414) | Page backgrounds, surfaces |
| Secondary (30%) | Ant Design `--color-fill-quaternary` (light: #f5f5f5, dark: #1f1f1f) | Sidebar, nav, card containers |
| Accent (10%) | Ant Design blue-6 (#1677ff) | Primary buttons, selected states, wikilink underline |
| Destructive | Ant Design red-6 (#ff4d4f) | Delete buttons, confirmation dialogs, irreversible action warnings |

Accent reserved for: primary CTA buttons, selected nav items, active wikilinks (resolved), focused input borders. Never used for decorative elements, badges, or non-interactive text.

---

## Copywriting Contract

> All copy follows the existing `src/core/i18n/strings.ts` pattern. New `t()` keys listed below for this phase's data-layer operations.

| Element | Key | Copy |
|---------|-----|------|
| Notes empty state | `notes.empty` | No notes yet. Press + to create one. |
| Notes loading | `notes.loading` | Loading notes... |
| Notes error | `notes.error` | Failed to load notes. Check your connection and try again. |
| Notes save success | `notes.saved` | Note saved |
| Notes delete confirmation | `notes.deleteConfirm` | Delete this note? This cannot be undone. |
| Notes delete action label | `notes.deleteAction` | Delete Note |
| Notes search empty | `notes.searchEmpty` | No notes match your search. Try different keywords. |
| Memory retrieval error | `memory.retrievalError` | Memory retrieval failed. Continuing without context. |
| Memory write conflict | `memory.writeConflict` | Memory write unavailable — another surface is active. Changes are read-only here. |
| Conversation summary error | `memory.summaryError` | Failed to summarize conversation. Full history preserved. |
| Unresolved wikilink tooltip | `wikilink.unresolved` | Note doesn't exist yet — click to create |
| Unresolved wikilink create CTA | `wikilink.create` | Create Note "{title}" |
| Note created from wikilink | `wikilink.created` | Note created — link resolved |
| LinkParser error | `linkparser.error` | Failed to parse wikilinks in note content |
| NoteGraph compute error | `notegraph.error` | Failed to compute note relationships |

Primary CTA labels (for downstream Phase 7, declared here as contract):

| Context | Key | Label |
|---------|-----|-------|
| Create new note | `notes.createNew` | New Note |
| Save edited note | `notes.save` | Save Note |
| Search notes | `notes.search` | Search notes |
| Create note from unresolved wikilink | `wikilink.createAction` | Create Note |

Destructive actions in this phase: **Note deletion** (NotesDB.remove). Confirmation approach: Ant Design `Modal.confirm` with title "Delete this note?" and content "This cannot be undone." — actions: "Cancel" / "Delete Note" (danger button).

---

## UI Considerations

> **This phase has NO UI surfaces.** All state considerations below are for the data modules exposed to downstream phases. Empty/error states exist at the data-retrieval level and propagate as returned types, not visual components in this phase.

Applicable state considerations resolved: 3 covered, 0 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | NotesDB (no notes) | ✅ covered | NotesDB.getAll() returns `[]`; UI renders `notes.empty` copy |
| empty | MemoryEngine (no memories of type) | ✅ covered | MemoryEngine.retrieve() returns `{ facts: [], summary: null }`; consumer renders appropriate empty state |
| error | Storage write failures (IndexedDB, quota) | ✅ covered | All write operations return discriminated union types (`{ success: true } | { success: false, error: string }`); downstream UI displays `notes.error` or `memory.retrievalError` |

---

## Data-Type Contracts for Downstream UI

> These are the shape contracts that Phase 7 (Notes UI) and Phase 5a (LLM-Wiki) must consume. They are NOT visual specs — they define what data the UI receives.

### Note (Phase 7 consumer)

```typescript
// src/core/notes/types.ts (this phase creates)
interface Note {
  id: string;                  // UUID, immutable identity (D-02)
  title: string;               // Display metadata, may change
  content: string;             // Single source of truth — raw markdown with [[wikilinks]] (D-01)
  tags: string[];              // Display and filter metadata
  categoryPath: string;        // Folder-like path for organization
  createdAt: number;           // Unix timestamp ms
  updatedAt: number;           // Unix timestamp ms
  version: number;             // Incremented on each save (D-17)
  provenance: NoteProvenance;  // Source tracking (D-16)
  links: string[];             // Derived on save — resolved note IDs (NOT titles), empty if none (D-01)
  unresolvedLinks: string[];   // Derived on save — [[titles]] with no matching note (D-03)
}

interface NoteProvenance {
  source: 'user-created' | 'import' | 'chat-conversion' | 'ai-generated';  // D-16
  importedAt?: number;
  originalPath?: string;
  conversationId?: string;
  importSessionId?: string;
}

// Downstream UI contract: links[] contains note IDs, not titles.
// To display a linked note's title, UI must look up `notes.find(n => n.id === linkId)?.title`.
// unresolvedLinks[] contains raw [[title]] strings — UI renders with dashed underline pattern (D-03).

interface NoteSearchResult {
  noteId: string;
  score: number;               // BM25 relevance score from MiniSearch
  matchedFields: ('title' | 'content' | 'tags' | 'wikilinkTargets')[];
  snippet: string;             // MiniSearch snippet with terms highlighted (marked by MiniSearch's default <mark> wrapping)
}
```

### Note Graph (Phase 7 consumer)

```typescript
interface NoteGraphEdge {
  sourceNoteId: string;
  targetNoteId: string;
  edgeType: 'wikilink' | 'backlink';   // wikilink = explicit [[link]], backlink = reverse of links[]
  strength: number;                      // 1.0 for wikilinks, 0.0–1.0 for similarity-based related notes
}

interface RelatedNote {
  noteId: string;
  score: number;                         // Hybrid: 50% linkOverlap + 20% tagOverlap + 30% contentCosine (D-13)
  sharedLinks: number;
  sharedTags: number;
}
```

### Memory Record (Phase 7 memory panel consumer)

```typescript
// src/core/memory/types.ts (this phase creates)
interface MemoryRecord {
  id: string;
  memoryType: 'working' | 'episodic' | 'semantic' | 'preference' | 'procedural'; // D-04
  source: 'user-action' | 'conversation-summary' | 'verified-state' | 'inferred'; // D-07
  confidence: number;          // 0.0–1.0, immutable after creation (D-07): explicit-user=1.0, verified-state=0.8, previous-explicit=0.7, inferred=0.5
  content: string;             // Human-readable fact or summary text
  createdAt: number;
  updatedAt: number;
  useCount: number;            // Incremented each retrieval, for ranking (D-07)
  sensitivity: 'public' | 'private' | 'secret'; // Inherits from ContextItem contract (Phase 4b D-09)
  tags: string[];
}

interface ConversationSummary {
  id: string;
  conversationId: string;
  summary: string;             // 2-3 sentences: decisions + goals + preferences + facts + open tasks (D-10)
  messageRange: { start: number; end: number }; // Which messages this summary covers
  createdAt: number;
}

interface RetrievedMemory {
  record: MemoryRecord;
  retrievalScore: number;      // keywordMatch 35% + tagMatch 25% + recency 20% + confidence 10% + useCount 10% (D-08)
  relevanceReasons: string[];  // Why this was matched (e.g., ["keyword-match: 'theme'", "tag-match: 'preferences'"])
}
```

### Retrieval Contract (Phase 7 designer must know)

- **Tier-gated counts** (D-09): top-3 for tiny models, top-5 for small/medium/large. Count is a MAXIMUM, not a guarantee.
- **Minimum score threshold**: 0.30 — facts below this are excluded even within top-K (D-09).
- **Scoring formula** (D-08): `keywordMatch(35%) + tagMatch(25%) + recency(20%) + confidence(10%) + useCount(10%)`. Relevance factors dominate (60%).
- **Confidence is immutable** (D-07): assigned at creation, never modified by retrieval frequency. Display confidence as a trust badge, not a score that changes.

---

## Visual Contract: Unresolved Wikilinks

> **Locked by CONTEXT.md D-03.** This is the ONLY visual pattern pre-specified by this phase. Phase 7 must render unresolved wikilinks exactly as follows:

| Property | Value |
|----------|-------|
| Text style | Dashed bottom border (`border-bottom: 1px dashed`), normal font weight |
| Color | Ant Design `--color-text-tertiary` (muted gray, e.g., #8c8c8c in light mode) |
| Cursor | `pointer` (clickable) |
| Tooltip | On hover: "Note doesn't exist yet — click to create" (key: `wikilink.unresolved`) |
| Click action | Open "Create Note" dialog pre-filled with the wikilink title as the note title |
| Post-create | After note created, trigger `note:saved` EventBus event → LinkParser re-resolves → previously unresolved link now renders as resolved (standard Ant Design Link blue, solid underline) |
| Edge case | Unresolved wikilinks must NOT create graph edges — they exist only in `unresolvedLinks[]` until target note is created |

**Resolved wikilinks** render as standard Ant Design `<Typography.Link>` (blue-6, solid underline, `cursor: pointer`) and navigate to the linked note on click.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — project uses Ant Design, not shadcn |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
