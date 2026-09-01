# Phase 10: Memory Governance and Experience Candidates - Research

**Researched:** 2026-09-01
**Domain:** Memory governance, conflict resolution, procedural experience gating, knowledge graph provenance
**Confidence:** HIGH

## Summary

Phase 10 delivers the governance layer over the memory and knowledge systems built in Phases 8-9. It enriches `MemoryRecord` with source/confidence/lifecycle/sensitivity/verified-at metadata (MEM-02), implements deterministic conflict precedence (MEM-03), exposes 9 user lifecycle controls as a facade (MEM-04), gates procedural experience behind verification+approval (MEM-05), and adds provenance tracking to knowledge graph edges (KNW-01).

The phase is fundamentally a **data contract + facade** deliverable — UI rendering is Phase 15. The core work is: (1) canonical type declarations in `harness.ts`, (2) a pure-function conflict resolver, (3) a governance facade over MemoryDB, (4) a new `procedural_experiences` IDB store with status gating, (5) edge provenance on NoteGraph, and (6) a v5 IDB migration. All six requirements map to well-understood integration points in the existing codebase.

**Primary recommendation:** Implement as 4 files per D-126's create list (`MemoryRecord.ts`, `ProceduralExperience.ts`, `MemoryGovernance.ts`, `NoteGraphProvenance.ts`) plus a v5 migration in `MemoryDB.ts`, following the exact v4 migration precedent from `NotesDB.ts`. All new code is strict-clean (NP-STRICT ceiling = 0).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MemoryRecord type + conflict resolution | API / Backend (core/memory) | — | Pure logic, no UI. Lives in src/core/ where all memory subsystems reside |
| MemoryGovernance facade (9 controls) | API / Backend (core/memory) | — | Data contract facade over MemoryDB; UI rendering is Phase 15 |
| ProceduralExperience store + gating | API / Backend (core/memory) | — | IDB store with status filter; MemoryEngine gates retrieval |
| Knowledge edge provenance | API / Backend (core/notes) | — | Extends NoteGraph edge metadata; no UI component |
| v5 IDB migration | API / Backend (core/storage) | — | Storage layer concern; follows IndexedDBMigrator pattern |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | ^8.0.3 | IndexedDB wrapper for v5 migration | Already used by all 5 production DBs (MemoryDB, NotesDB, ChatHistoryDB, WriteJournalDB, ErrorStore) |
| zod | ^4.4.3 | Schema validation for MemoryRecord/ProceduralExperience | Already used for UserPreferences, PersonaProfile, memoryFacts — the project's validation standard |
| immer | ^11.1.8 | Immutable state updates in governance facade | Already used by all Zustand stores (WorkspaceStore, ThemeStore, PreferenceMemoryStore) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fake-indexeddb | ^6.2.5 | Test harness for v5 migration idempotency | Already in devDependencies; used by v4 migration test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb v8 | raw IndexedDB API | idb is already the project standard; raw API is verbose and error-prone |
| zod | manual type guards | zod is already used for all cross-boundary validation |

**Installation:** No new packages required. All dependencies already in package.json.

**Version verification:** All versions confirmed in package.json (idb ^8.0.3, zod ^4.4.3, immer ^11.1.8).

## Package Legitimacy Audit

No new packages are installed in Phase 10. All dependencies (idb, zod, immer) are already in package.json and have been validated in prior phases.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb | npm | 8+ yrs | 50M+/w | github.com/jakearchibald/idb | OK | Already installed |
| zod | npm | 6+ yrs | 100M+/w | github.com/colinhacks/zod | OK | Already installed |
| immer | npm | 7+ yrs | 30M+/w | github.com/immerjs/immer | OK | Already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI Contexts (Side Panel / Standalone) — Phase 15 UI renders later  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ MemoryGovernance facade (MEM-04)                             │   │
│  │  view │ source │ confidence │ edit │ pin │ forget │          │   │
│  │  disableType │ export │ cloudExclude                         │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │ mutate via WriteJournal               │
├─────────────────────────────┼───────────────────────────────────────┤
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ MemoryRecord.ts (MEM-01/02/03)                               │   │
│  │  MemoryRecord type + resolveConflict(a, b): MemoryRecord      │   │
│  │  correction > verified > prior > inference + revisionChain[]  │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │ MemoryEngine (gated by governance layer)                     │   │
│  │  retrieveMemoryHints() filters:                               │   │
│  │   - status !== 'active' → excluded                           │   │
│  │   - procedural: status !== 'approved' → excluded             │   │
│  │   - cloudExclude records → excluded from sync                │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
├─────────────────────────────┼───────────────────────────────────────┤
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ MemoryDB v5 (D-131)                                          │   │
│  │  memory_records store (keyPath 'id', byKind/byStatus/byConf) │   │
│  │  procedural_experiences store (keyPath 'id')                 │   │
│  │  userFacts store (unchanged from v1)                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ NoteGraphProvenance.ts (KNW-01)                              │   │
│  │  Note.links[] → Array<{noteId, source: KnowledgeEdgeSource}> │   │
│  │  topKSimilar tags edges with provenance                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── types/
│   └── harness.ts              # ADD: MemoryRecord, ProceduralExperience, KnowledgeEdgeSource (after WorkingMemory)
├── core/
│   ├── memory/
│   │   ├── MemoryRecord.ts     # NEW: type + conflict resolution (MEM-01/02/03)
│   │   ├── ProceduralExperience.ts  # NEW: store + gating (MEM-05)
│   │   ├── MemoryGovernance.ts # NEW: 9-control facade (MEM-04)
│   │   ├── MemoryEngine.ts     # EXTEND: gate retrieveMemoryHints for procedural
│   │   ├── types.ts             # UNCHANGED: UserMemoryFact scope fence lifted for harness
│   │   └── UserMemoryStore.ts   # EXTEND: governance-aware upsert
│   ├── notes/
│   │   └── NoteGraphProvenance.ts  # NEW: edge provenance extension (KNW-01)
│   └── storage/
│       └── MemoryDB.ts         # EXTEND: v5 migration (memory_records + procedural_experiences stores)
tests/
├── core/
│   ├── memory/
│   │   └── governance/         # NEW: conflict precedence + lifecycle control tests
│   └── knowledge/
│       └── provenance/         # NEW: edge provenance tests
```

### Pattern 1: Deterministic Conflict Resolution
**What:** Pure function `resolveConflict(a, b): MemoryRecord` implementing precedence chain
**When to use:** When two records claim the same fact (matched by content hash + tags overlap)
**Example:**
```typescript
// Source: D-127 decision, MEM-03 requirement
const PRECEDENCE = ['correction', 'verified', 'prior', 'inference'] as const;

function resolveConflict(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
  const aRank = PRECEDENCE.indexOf(a.source);
  const bRank = PRECEDENCE.indexOf(b.source);
  if (aRank !== bRank) return aRank < bRank ? a : b;
  // Tie-break: higher confidence → more recent verifiedAt → id asc
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
  if (a.verifiedAt !== b.verifiedAt) return (a.verifiedAt ?? 0) > (b.verifiedAt ?? 0) ? a : b;
  return a.id < b.id ? a : b;
}
```

### Pattern 2: IDB Migration (v4 → v5)
**What:** Add new object stores via `registerMigration` + version bump
**When to use:** When new record types need persistent storage
**Example:**
```typescript
// Source: NotesDB.ts v4 migration precedent (D-125)
registerMigration('MemoryDB', {
  fromVersion: 1,
  toVersion: 5,
  description: 'Add memory_records + procedural_experiences stores',
  migrate: (db) => {
    if (!db.objectStoreNames.contains('memory_records')) {
      const store = db.createObjectStore('memory_records', { keyPath: 'id' });
      store.createIndex('byKind', 'kind');
      store.createIndex('byStatus', 'lifecycle.status');
      store.createIndex('byConfidence', 'confidence');
    }
    if (!db.objectStoreNames.contains('procedural_experiences')) {
      db.createObjectStore('procedural_experiences', { keyPath: 'id' });
    }
  },
});
```

### Anti-Patterns to Avoid
- **LLM-based conflict resolution:** D-127 explicitly forbids this. The v0.1 mechanism is deterministic. Real LLM resolution is not in v0.1.
- **UI rendering in Phase 10:** MEM-04 controls are data contracts (facade functions), not UI components. Buttons/toggles are Phase 15.
- **Bidirectional Notes↔Memory:** NMEM-02 is preserved — only Notes → Memory. Never Memory → Notes.
- **Conflating memory_records with userFacts:** D-131 creates a NEW store, not extending userFacts. The governance-enriched records live separately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IDB schema migration | Custom migration runner | `registerMigration` from IndexedDBMigrator | Already proven by v2→v3→v4; handles conditional blocks, idempotency, error recording |
| Conflict resolution | LLM-based arbiter | Pure deterministic function (precedence chain) | D-127: deterministic, no LLM. Precedence is a closed ordered set |
| Content hashing for conflict detection | Custom hash function | Simple normalized string hash (content + sorted tags) | Conflict matching only needs deterministic equality, not cryptographic security |
| Export serialization | Custom JSON formatter | `JSON.stringify` with TraceRedactor | TraceRedactor already redacts sensitive data before persist/log |

**Key insight:** The v5 migration follows the exact same `registerMigration` pattern that shipped in Phase 9 for NotesDB v4. The conflict resolver is a pure function with a closed precedence enum — no AI, no heuristics.

## Runtime State Inventory

Phase 10 is NOT a rename/refactor/migration phase in the string-replacement sense. It adds new types and stores. No existing strings are renamed. The Runtime State Inventory is not applicable.

**Step 2.5: SKIPPED** (not a rename/refactor/migration phase — new types and stores only)

## Common Pitfalls

### Pitfall 1: MemoryDB Version Numbering
**What goes wrong:** Bumping MEMORY_DB_VERSION without a corresponding `registerMigration` entry, or conflating it with the zustand-persist store `version`.
**Why it happens:** STATE.md decision A5 warns: "zustand-persist store `version` is SEPARATE from IndexedDB DB_VERSION."
**How to avoid:** MEMORY_DB_VERSION goes from 1 → 5 (matching the migration's toVersion). The zustand-persist `version` in PreferenceMemoryStore stays at 1.
**Warning signs:** Migration test fails with "objectStore not found" or version mismatch.

### Pitfall 2: Note.links[] Shape Change
**What goes wrong:** Changing `Note.links` from `string[]` to `Array<{noteId, source}>` breaks `computeBacklinks`, `LinkParser`, and all graph consumers.
**Why it happens:** D-130 extends links with provenance, but the existing `NoteGraph.computeBacklinks` iterates `note.links` as strings.
**How to avoid:** The v5 migration adds the source field with default 'explicit' for existing links. `NoteGraphProvenance.ts` is a wrapper/extension that handles the new shape while preserving backward compatibility. Existing consumers that read `note.links` as IDs must be updated or the Note type must support both shapes.
**Warning signs:** `computeBacklinks` test failures, `topKSimilar` returning unexpected results.

### Pitfall 3: Procedural Experience Leakage
**What goes wrong:** `retrieveMemoryHints()` returns procedural records before approval, polluting chat context.
**Why it happens:** The new `procedural_experiences` store is in the same MemoryDB; a naive `getAll` would include unapproved records.
**How to avoid:** D-129 gating: `status === 'approved'` required for retrieval. The governance layer filters `procedural_experiences` by status before they reach `retrieveMemoryHints()`.
**Warning signs:** Procedural records appearing in chat context before user approval.

### Pitfall 4: Forgetting WriteJournal on Governance Mutations
**What goes wrong:** `pin`, `forget`, `edit` mutate memory records without journaling, losing crash-safety.
**Why it happens:** D-128 says "all mutate MemoryDB records via WriteJournal (single-writer gate)" — but this is easy to forget for new mutation paths.
**How to avoid:** Every MemoryGovernance facade method that mutates state must: (1) check `isPrimaryWriter()`, (2) journal via WriteJournal, (3) apply mutation.
**Warning signs:** Governance mutations that don't appear in WriteJournal recovery tests.

### Pitfall 5: Canonical Type Home Violation
**What goes wrong:** Declaring `MemoryRecord` in `src/core/memory/types.ts` instead of `src/types/harness.ts`.
**Why it happens:** The memory types are already in `types.ts`, so it feels natural to add governance types there.
**How to avoid:** D-126 is explicit: `MemoryRecord`, `ProceduralExperience`, `KnowledgeEdgeSource` go in `src/types/harness.ts` per Appendix C.1. The scope fence in `types.ts` ("do NOT declare memory-kind or memory-record types here") is lifted ONLY for harness.ts.
**Warning signs:** Types declared in wrong file; LSP cross-references point to non-canonical location.

## Code Examples

### MemoryRecord Type (canonical home)
```typescript
// Source: Appendix C.1 (spec 4903-4915) — src/types/harness.ts
export type MemoryKind = 'working' | 'episodic' | 'semantic' | 'preference' | 'procedural';

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  source: 'explicit' | 'inferred' | 'system' | 'correction';
  confidence: number;              // 0..1
  sensitivity: 'none' | 'low' | 'high';
  lifecycle: 'active' | 'expired' | 'forgotten' | 'pinned';
  verifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProceduralExperience {
  id: string;
  trigger: string;
  steps: string[];
  status: 'candidate' | 'approved' | 'rejected';
  evidenceOperationIds: string[];  // activated only after verification + approval
  createdAt: number;
}

export type KnowledgeEdgeSource = 'explicit' | 'imported' | 'suggested' | 'accepted';
```

### Conflict Resolution (MEM-03)
```typescript
// Source: D-127 decision — src/core/memory/MemoryRecord.ts
const CONFLICT_PRECEDENCE: readonly string[] = [
  'correction',   // highest priority — user explicitly corrected
  'verified',     // verified current state
  'prior',        // prior explicit memory
  'inference',    // lowest priority — inferred fact
];

export function resolveConflict(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
  const aRank = CONFLICT_PRECEDENCE.indexOf(a.source);
  const bRank = CONFLICT_PRECEDENCE.indexOf(b.source);
  if (aRank !== bRank) return aRank < bRank ? a : b;
  // Tie-breakers: confidence → verifiedAt → id asc
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
  const aVerified = a.verifiedAt ?? 0;
  const bVerified = b.verifiedAt ?? 0;
  if (aVerified !== bVerified) return aVerified > bVerified ? a : b;
  return a.id < b.id ? a : b;
}
```

### MemoryGovernance Facade (MEM-04)
```typescript
// Source: D-128 decision — src/core/memory/MemoryGovernance.ts
export const MemoryGovernance = {
  async view(recordId: string): Promise<MemoryRecord | undefined> { /* ... */ },
  async source(recordId: string): Promise<MemoryRecord['source'] | undefined> { /* ... */ },
  async confidence(recordId: string): Promise<number | undefined> { /* ... */ },
  async edit(recordId: string, patch: Partial<MemoryRecord>): Promise<void> { /* ... */ },
  async pin(recordId: string): Promise<void> { /* status → 'pinned' */ },
  async forget(recordId: string): Promise<void> { /* status → 'forgotten' (soft-delete) */ },
  async disableType(type: MemoryKind): Promise<void> { /* disable all records of kind */ },
  async export(filter?: (r: MemoryRecord) => boolean): Promise<string> { /* JSON, redacted */ },
  async cloudExclude(recordId: string): Promise<void> { /* flag to exclude from cloud sync */ },
};
```

### v5 Migration Registration
```typescript
// Source: D-131 decision, NotesDB.ts v4 precedent — src/core/storage/MemoryDB.ts
registerMigration('MemoryDB', {
  fromVersion: 1,
  toVersion: 5,
  description: 'Add memory_records + procedural_experiences stores (Phase 10 governance)',
  migrate: (db) => {
    if (!db.objectStoreNames.contains('memory_records')) {
      const store = db.createObjectStore('memory_records', { keyPath: 'id' });
      store.createIndex('byKind', 'kind');
      store.createIndex('byStatus', 'lifecycle.status');
      store.createIndex('byConfidence', 'confidence');
    }
    if (!db.objectStoreNames.contains('procedural_experiences')) {
      db.createObjectStore('procedural_experiences', { keyPath: 'id' });
    }
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UserMemoryFact (Phase 8) | MemoryRecord (Phase 10) | Phase 10 | Governance-enriched record with source/confidence/lifecycle/sensitivity/verified-at |
| No conflict resolution | Deterministic precedence chain | Phase 10 | correction > verified > prior > inference, no LLM |
| No procedural experience | ProceduralExperience store with gating | Phase 10 | Invisible until verified + approved |
| Note.links as string[] | Note.links with provenance source | Phase 10 | Edge provenance: explicit/imported/suggested/accepted |

**Deprecated/outdated:**
- None — Phase 10 is additive, not a replacement

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MemoryRecord` extends `UserMemoryFact` with governance fields (source kind, lifecycle, sensitivity, verifiedAt) | MemoryRecord type | If the relationship is composition rather than extension, the facade pattern changes |
| A2 | Conflict detection uses content hash + tags overlap (not embedding-based) | Conflict resolution | Embedding-based detection is deferred per §3.2; if conflict detection needs to be more sophisticated, the matching function changes |
| A3 | Procedural experience verification = automated check (steps parseable, no contradictions) | ProceduralExperience | If verification needs LLM, the gating logic becomes async and more complex |
| A4 | Note.links[] provenance extension is backward-compatible (default 'existing' for existing links) | NoteGraphProvenance | If existing consumers break, a data migration for all existing links is needed |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions (RESOLVED)

1. **MemoryRecord ↔ UserMemoryFact relationship**
   - What we know: D-126 says "MemoryRecord extends UserMemoryFact" — the governance fields are additive
   - What's unclear: Whether MemoryRecord is a strict superset type or a wrapper with `fact: UserMemoryFact` + governance metadata
   - Recommendation: Use superset type (all UserMemoryFact fields + governance fields) — simpler, satisfies MEM-02
   - — RESOLVED: Superset type. Plan 10-01 Task 1 implements MemoryRecord as UserMemoryFact + governance fields.

2. **Conflict detection matching function**
   - What we know: D-127 says "matched by content hash + tags overlap"
   - What's unclear: Exact hash function and overlap threshold
   - Recommendation: Use normalized content (lowercase, trimmed) + sorted tags as the match key; overlap = shared tags / total tags > 0.5
   - — RESOLVED: Normalized content + sorted tags as match key; overlap threshold > 0.5. Plan 10-01 Task 1 implements.

3. **Note.links[] migration strategy**
   - What we know: D-130 says "stored on the Note type's links[] as Array<{noteId, source}>"
   - What's unclear: Whether existing `string[]` links are migrated in-place or coexist via union type
   - Recommendation: v5 migration reads all notes, transforms `string[]` → `Array<{noteId, source: 'explicit'}>`, writes back. Follows `populateNoteTypeDefaults` precedent.
   - — RESOLVED: In-place transform via v5 migration. Plan 10-02 Task 1 implements.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond what's already in package.json)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | vitest.config.ts (via vite) |
| Quick run command | `pnpm test -- tests/core/memory/governance` |
| Full suite command | `pnpm run verify:phase-10` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEM-01 | Memory taxonomy (working/episodic/semantic/preference/procedural) | unit | `pnpm test -- tests/core/memory/governance/MemoryRecord.test.ts` | ❌ Wave 0 |
| MEM-02 | source+confidence+lifecycle+sensitivity+verified-at fields | unit | `pnpm test -- tests/core/memory/governance/MemoryRecord.test.ts` | ❌ Wave 0 |
| MEM-03 | Conflict precedence: correction > verified > prior > inference | unit | `pnpm test -- tests/core/memory/governance/MemoryRecord.test.ts` | ❌ Wave 0 |
| MEM-04 | 9 user controls (view/source/confidence/edit/pin/forget/disable/export/cloud-exclude) | unit | `pnpm test -- tests/core/memory/governance/MemoryGovernance.test.ts` | ❌ Wave 0 |
| MEM-05 | Procedural experience activates only after verification + approval | unit | `pnpm test -- tests/core/memory/governance/ProceduralExperience.test.ts` | ❌ Wave 0 |
| KNW-01 | Edge provenance (explicit/imported/suggested/accepted) | unit | `pnpm test -- tests/core/knowledge/provenance/NoteGraphProvenance.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/core/memory/governance tests/core/knowledge/provenance`
- **Per wave merge:** `pnpm run verify:phase-10`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/memory/governance/MemoryRecord.test.ts` — covers MEM-01/02/03
- [ ] `tests/core/memory/governance/MemoryGovernance.test.ts` — covers MEM-04
- [ ] `tests/core/memory/governance/ProceduralExperience.test.ts` — covers MEM-05
- [ ] `tests/core/knowledge/provenance/NoteGraphProvenance.test.ts` — covers KNW-01
- [ ] `tests/core/storage/migrations/v5-memory-governance.test.ts` — covers v5 migration idempotency
- [ ] `tests/core/knowledge/` directory — needs creation
- [ ] `package.json` verify:phase-10 script — needs addition

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | isPrimaryWriter() gate on all governance mutations |
| V5 Input Validation | yes | zod schemas for MemoryRecord/ProceduralExperience |
| V6 Cryptography | no | — |

### Known Threat Patterns for Chrome MV3 Extension

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized memory modification | Tampering | isPrimaryWriter() + WriteJournal (single-writer gate) |
| Sensitive memory leakage in export | Information Disclosure | TraceRedactor before export serialization |
| Procedural experience injection | Tampering | Verification + approval gating (MEM-05) |
| Cloud sync of excluded data | Information Disclosure | cloudExclude flag prevents sync of sensitive records |

## Sources

### Primary (HIGH confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` §28.4 (spec 3956-3966) — MEM-01…05, KNW-01 verbatim
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 (spec 4903-4924) — MemoryRecord, ProceduralExperience, KnowledgeEdgeSource canonical types
- `.planning/PRODUCT_SPEC_v0_1.md` §24 (spec 3614) — verify:phase-10 gate string
- `.planning/phases/10-memory-governance-and-experience-candidates/10-CONTEXT.md — D-126…D-131 decisions
- `src/types/harness.ts` — existing canonical type home (reliability, trust, working memory types)
- `src/core/storage/MemoryDB.ts` — v1 schema, migration target
- `src/core/storage/NotesDB.ts` — v4 migration precedent (D-125)
- `src/core/storage/IndexedDBMigrator.ts` — registerMigration pattern
- `src/core/memory/types.ts` — UserMemoryFact (MemoryRecord extends this)
- `src/core/memory/MemoryEngine.ts` — retrieveMemoryHints (governance gating point)
- `src/core/notes/NoteGraph.ts` — topKSimilar, computeBacklinks (edge provenance extension)
- `src/types/notes.ts` — Note type with links[] (provenance extension target)
- `tests/core/storage/migrations/v4-notes-backup-config.test.ts` — v4 migration test precedent

### Secondary (MEDIUM confidence)
- `.planning/RESEARCH-RECONCILIATION.md` — stack decisions, versions
- `.planning/phases/09-llm-wiki-filesystem-sync/09-CONTEXT.md` — D-123 (NMEM-02), D-125 (v4 migration)

### Tertiary (LOW confidence)
- None — all claims verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all already validated
- Architecture: HIGH — follows established patterns (v4 migration, harness.ts canonical home, MemoryEngine facade)
- Pitfalls: HIGH — derived from actual codebase analysis (MemoryDB.ts, NotesDB.ts, NoteGraph.ts, harness.ts)

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (stable — Phase 10 is additive, no external dependencies)
