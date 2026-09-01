// UserMemoryStore — D-104/D-113 user-facts store (PRODUCT_SPEC_v0_1.md §3.4/§15.1).
//
// Module singleton owning the user-facts retrieval spine:
//   (a) BODIES  → MemoryDB.userFacts (openMemoryDB) — §3.4 canonical
//       UserMemoryFact shape (Pitfall 2 — the type re-export from
//       @/core/memory/types is the value shape).
//   (b) METADATA → chrome.storage.local np_facts — LRU index capped at
//       NP_FACTS_MAX = 500 entries, each { id, updatedAt, useCount }
//       (A6 — ids + recency + useCount per D-104). LRU eviction drops
//       the lowest (useCount, updatedAt) entries when full.
//   (c) REDACTION — every fact body passes through redactSensitiveValue
//       before the IDB put (// TODO(Phase 11): swap to TraceRedactor —
//       Pitfall 1: TraceRedactor does not exist yet).
//   (d) SINGLE-WRITER — upsert/evict paths gate on isPrimaryWriter()
//       (WorkspaceStore.ts:23-25); non-primary surfaces are read-only.
//
// Scoring reads metadata without opening IDB where feasible; bodies are
// fetched for keyword/tag scoring (the metadata index carries only
// ids + recency + useCount, not tags/content). v0.1 fetches all bodies
// and scores in memory — a tag index in metadata is a forward perf opt.
import { openMemoryDB } from '../storage/MemoryDB';
import type { UserMemoryFact } from './types';
import { scoreMemory } from './MemoryScorer';
import { redactSensitiveValue } from '../security/redactSensitive';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { debugLog } from '../log/debugLog';

/** §15.1 verbatim: np_facts metadata index cap = 500 (LRU). */
export const NP_FACTS_MAX = 500;

/** chrome.storage.local key for the np_facts metadata index. */
const NP_FACTS_KEY = 'np_facts';

/** Metadata index entry — small, scores without opening IDB. */
interface FactsMetadata {
  id: string;
  updatedAt: number;
  useCount: number;
}

/** Module-level metadata index (loaded from chrome.storage.local.np_facts). */
let metadataIndex: FactsMetadata[] = [];
let hydrated = false;

/** Load the metadata index from chrome.storage.local (idempotent). */
async function hydrate(): Promise<void> {
  if (hydrated) return;
  const result = await chrome.storage.local.get(NP_FACTS_KEY);
  const raw = result[NP_FACTS_KEY];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        metadataIndex = parsed.filter(
          (e): e is FactsMetadata =>
            e &&
            typeof e === 'object' &&
            typeof e.id === 'string' &&
            typeof e.updatedAt === 'number' &&
            typeof e.useCount === 'number',
        );
      }
    } catch {
      // Corrupt blob — start fresh (defensive, matches zod hydrate pattern).
      metadataIndex = [];
    }
  }
  hydrated = true;
}

/** Persist the metadata index to chrome.storage.local.np_facts. */
async function persistMetadata(): Promise<void> {
  await chrome.storage.local.set({ [NP_FACTS_KEY]: JSON.stringify(metadataIndex) });
}

/**
 * LRU eviction: when the index exceeds NP_FACTS_MAX, drop the lowest
 * (useCount, updatedAt) entries. Sorts by useCount asc then updatedAt
 * asc (oldest/least-used first) and trims from the front.
 */
function evictLru(): void {
  if (metadataIndex.length <= NP_FACTS_MAX) return;
  metadataIndex.sort((a, b) => a.useCount - b.useCount || a.updatedAt - b.updatedAt);
  const evicted = metadataIndex.splice(0, metadataIndex.length - NP_FACTS_MAX);
  for (const e of evicted) {
    debugLog('MEMORY_FACT_EVICTED', 'np_facts LRU eviction', {
      id: e.id,
      useCount: e.useCount,
      updatedAt: e.updatedAt,
    });
  }
}

/**
 * Upsert a user fact — body → MemoryDB.userFacts, metadata → np_facts index.
 * Single-writer gated: non-primary surfaces are a no-op (read-only).
 * The body is redacted before the IDB write (never secrets — §3.4).
 */
export async function upsertFact(fact: UserMemoryFact): Promise<void> {
  if (!isPrimaryWriter()) {
    debugLog('MEMORY_FACT_NON_PRIMARY_SKIP', 'upsertFact skipped — non-primary surface', {
      id: fact.id,
    });
    return;
  }

  await hydrate();

  // (c) Redaction — redactSensitiveValue before IDB write (TODO Phase 11 swap).
  const redacted = redactSensitiveValue(fact) as UserMemoryFact;

  // (a) Body → MemoryDB.userFacts.
  const db = await openMemoryDB();
  await db.put('userFacts', redacted);

  // (b) Metadata → np_facts index (upsert by id).
  const existing = metadataIndex.find((m) => m.id === fact.id);
  if (existing) {
    existing.updatedAt = fact.updatedAt;
    existing.useCount = fact.useCount;
  } else {
    metadataIndex.push({ id: fact.id, updatedAt: fact.updatedAt, useCount: fact.useCount });
  }

  // LRU eviction when over cap.
  evictLru();

  // Persist metadata index.
  await persistMetadata();

  debugLog('MEMORY_FACT_UPSERT', 'fact upserted', { id: fact.id });
}

/**
 * Retrieve top-k facts for a query, scored by MemoryScorer (§3.4 verbatim).
 * Fetches bodies from IDB, scores in memory, returns top-k in score-desc order.
 *
 * @param query — raw query string (tokenised inside).
 * @param opts.k   — max results (default 5).
 * @param opts.now — current epoch ms (injectable for deterministic tests).
 */
export async function getTopFacts(
  query: string,
  opts?: { k?: number; now?: number },
): Promise<UserMemoryFact[]> {
  await hydrate();

  const k = opts?.k ?? 5;
  const now = opts?.now ?? Date.now();
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  // Fetch all bodies from IDB (v0.1 — a tag index in metadata is a forward opt).
  const db = await openMemoryDB();
  const allFacts = await db.getAll('userFacts');

  // Score + sort desc + top-k.
  const scored = allFacts
    .map((fact) => ({ fact, score: scoreMemory(fact, queryTerms, now) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((s) => s.fact);
}

/**
 * Retrieve scored facts for a query — returns { fact, score } pairs in
 * score-desc order. Used by MemoryEngine to attach scores to the
 * RetrievedMemory shape (spec 4572-4578).
 */
export async function getScoredFacts(
  query: string,
  opts?: { k?: number; now?: number },
): Promise<Array<{ fact: UserMemoryFact; score: number }>> {
  await hydrate();

  const k = opts?.k ?? 5;
  const now = opts?.now ?? Date.now();
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const db = await openMemoryDB();
  const allFacts = await db.getAll('userFacts');

  const scored = allFacts
    .map((fact) => ({ fact, score: scoreMemory(fact, queryTerms, now) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k);
}

/** Read the current metadata index (tests + diagnostics). */
export function getMetadataIndex(): FactsMetadata[] {
  return metadataIndex;
}

/** Read the hydrated metadata entry for a fact id (tests). */
export function getMetadataEntry(id: string): FactsMetadata | undefined {
  return metadataIndex.find((m) => m.id === id);
}

/** Count of facts currently in the metadata index (tests). */
export function getFactCount(): number {
  return metadataIndex.length;
}

// --- Test seam --------------------------------------------------------------

export const __test__ = {
  /** Reset module-level state (tests — beforeEach). */
  reset(): void {
    metadataIndex = [];
    hydrated = false;
  },
  /** Force hydration from chrome.storage.local (tests). */
  async hydrate(): Promise<void> {
    await hydrate();
  },
};
