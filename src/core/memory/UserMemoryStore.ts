// src/core/memory/UserMemoryStore.ts — D-05-04/D-05-09: cross-session user
// memory (§3.4 UserMemoryFact CRUD over the v2-migrated MemoryDB.userFacts) +
// the Appendix O.10 working-memory updater (PRODUCT_SPEC L6661-6692) co-located
// per D-05-09 (working memory = source 'inferred', NEVER persona — R2/R-7).
//
// Conventions: NotesDB.ts verbatim (write paths never signal failure; every
// catch calls debugLog with a canonical STORE_READ/STORE_WRITE code — GR-9,
// PATTERNS Shared Pattern 1). Bodies live in MemoryDB IndexedDB only — no
// browser-storage reference (Pitfall 4). R-1: WorkingMemory +
// WORKING_MEMORY_TEMPLATE are imported from @/types/harness (C.1 home) — never
// re-declared here.
//
// Working memory (O.10): init fills the fixed five-line template; update merges
// field patches redacted via TraceRedactor.redact (R-10 — the store never logs
// raw profile text), recomputes tokens via estimateTokens (the ONLY token
// counter, Pitfall 1), and trims at MAX_WORKING_MEMORY_TOKENS=300 via
// truncateToTokens — the ONE sanctioned slice (the template tail, never a
// fact's content mid-structure, D-04-13/D-05-06). Single-writer: only the
// primary surface writes through MemoryEngine (§13).
//
// The working-memory block persists as a UserMemoryFact row keyed `wm:${id}` in
// the SAME userFacts store so it survives reloads and rides the store's
// migration path. retrieve() excludes `wm:`-prefixed rows — the block is
// injected separately BEFORE retrieved facts (D-05-09) and must never rank as a
// retrieved fact.
import type { IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { estimateTokens } from '@/core/context/TokenBudget';
import * as TraceRedactor from '@/core/security/TraceRedactor';
import { WORKING_MEMORY_TEMPLATE, type WorkingMemory } from '@/types/harness';
import type { MemoryDBSchema } from '@/core/storage/MemoryDB';
import { scoreMemoryFact } from './MemoryScorer';
import type { UserMemoryFact } from './types';

/** §3.6 resource scope — the user/owner block (NOT thread), per §3.1. */
export const WORKING_MEMORY_RESOURCE_ID = 'user';

/** §3.6/O.10: the working-memory token cap (never crowd out retrieved facts). */
export const MAX_WORKING_MEMORY_TOKENS = 300;

/** Persistence key prefix for the working-memory row in userFacts. */
const WORKING_MEMORY_ID_PREFIX = 'wm:';

/**
 * O.10 trim (the ONE sanctioned slice): cap*4 chars approximates cap tokens
 * under estimateTokens' 4-char/3-char heuristic; the caller pins tokens = cap.
 */
function truncateToTokens(s: string, cap: number): string {
  return s.slice(0, cap * 4);
}

/** Fact id → working-memory row key (e.g. 'wm:user'). */
function workingMemoryId(resourceId: string): string {
  return `${WORKING_MEMORY_ID_PREFIX}${resourceId}`;
}

/**
 * Upsert a user memory fact. Write path — never signals failure (STORE_WRITE on
 * failure). Re-upsert preserves createdAt/lastUsedAt/useCount from the existing
 * row unless the caller overrides them (lastUsedAt: undefined or useCount 0
 * mean "keep current usage metadata"; explicit values win).
 */
export async function putFact(
  db: IDBPDatabase<MemoryDBSchema>,
  fact: UserMemoryFact,
): Promise<void> {
  try {
    const existing = await db.get('userFacts', fact.id);
    const merged: UserMemoryFact =
      existing === undefined
        ? fact
        : {
            ...fact,
            createdAt: existing.createdAt,
            lastUsedAt: fact.lastUsedAt ?? existing.lastUsedAt,
            useCount: fact.useCount > 0 ? fact.useCount : existing.useCount,
          };
    await db.put('userFacts', merged);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put user memory fact', {
      error: err instanceof Error ? err : undefined,
      module: 'UserMemoryStore',
      extra: { factId: fact.id },
    });
  }
}

/** Read a user memory fact by id (undefined when absent or on read failure). */
export async function getFact(
  db: IDBPDatabase<MemoryDBSchema>,
  id: string,
): Promise<UserMemoryFact | undefined> {
  try {
    return await db.get('userFacts', id);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get user memory fact', {
      error: err instanceof Error ? err : undefined,
      module: 'UserMemoryStore',
      extra: { factId: id },
    });
    return undefined;
  }
}

/** All user memory facts ([] on read failure; excludes nothing at this layer). */
export async function listFacts(db: IDBPDatabase<MemoryDBSchema>): Promise<UserMemoryFact[]> {
  try {
    return await db.getAll('userFacts');
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to list user memory facts', {
      error: err instanceof Error ? err : undefined,
      module: 'UserMemoryStore',
    });
    return [];
  }
}

/** Delete a user memory fact by id (write path — never signals failure). */
export async function deleteFact(db: IDBPDatabase<MemoryDBSchema>, id: string): Promise<void> {
  try {
    await db.delete('userFacts', id);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to delete user memory fact', {
      error: err instanceof Error ? err : undefined,
      module: 'UserMemoryStore',
      extra: { factId: id },
    });
  }
}

/**
 * §3.4 retrieval: score every user fact against the query via MemoryScorer
 * (§3.4 verbatim weights), keep score > 0, sort desc (ties: updatedAt desc then
 * id asc). Pure ordering — the top-k/token slicing is MemoryEngine's (05-04),
 * this returns the scored list. The working-memory block row (`wm:…`) never
 * ranks as a retrieved fact — it is injected separately BEFORE facts (D-05-09).
 * Serves only MemoryDB reads (listFacts never signals failure), so this never signals failure.
 */
export async function retrieve(
  db: IDBPDatabase<MemoryDBSchema>,
  query: string,
  nowMs: number,
): Promise<UserMemoryFact[]> {
  const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const facts = await listFacts(db);
  return facts
    .filter((f) => !f.id.startsWith(WORKING_MEMORY_ID_PREFIX))
    .map((fact) => ({ fact, score: scoreMemoryFact(fact, terms, nowMs) }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.fact.updatedAt - a.fact.updatedAt ||
        (a.fact.id < b.fact.id ? -1 : 1),
    )
    .map((s) => s.fact);
}

/**
 * O.10 (L6661-6692): the always-on §3.6 profile block, one per resource.
 * Fills WORKING_MEMORY_TEMPLATE (harness.ts C.1) with estimateTokens and the
 * injected clock (default nowMs = Date.now(), Pitfall 6 precedent).
 */
export function initWorkingMemory(
  resourceId: string = WORKING_MEMORY_RESOURCE_ID,
  nowMs: number = Date.now(),
): WorkingMemory {
  return {
    resourceId,
    markdown: WORKING_MEMORY_TEMPLATE,
    tokens: estimateTokens(WORKING_MEMORY_TEMPLATE),
    updatedAt: nowMs,
  };
}

/**
 * O.10 VERBATIM: merge profile field patches into the block — skip falsy,
 * redact every value via TraceRedactor.redact (R-10, §4.4 — never store
 * secrets), replace the `- **Field**:` line via regex, recompute tokens via
 * estimateTokens, and trim at MAX_WORKING_MEMORY_TOKENS (truncateToTokens —
 * the ONE sanctioned slice; tokens pinned to the cap). Single-writer: primary
 * surface only (§13). Pure — no I/O, never signals failure.
 */
export function updateWorkingMemory(
  cur: WorkingMemory,
  patch: Partial<
    Record<'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals', string>
  >,
  nowMs: number = Date.now(),
): WorkingMemory {
  let md = cur.markdown;
  for (const [field, value] of Object.entries(patch)) {
    if (!value) continue;
    const safe = TraceRedactor.redact(value);
    md = md.replace(new RegExp(`(- \\*\\*${field}\\*\\*:).*`), `$1 ${safe}`);
  }
  let tokens = estimateTokens(md);
  if (tokens > MAX_WORKING_MEMORY_TOKENS) {
    md = truncateToTokens(md, MAX_WORKING_MEMORY_TOKENS);
    tokens = MAX_WORKING_MEMORY_TOKENS;
  }
  return { ...cur, markdown: md, tokens, updatedAt: nowMs };
}

/**
 * Read the working-memory block (undefined when absent or on read failure).
 * Tokens are recomputed via estimateTokens (the only counter, Pitfall 1); the
 * stored row carries markdown + updatedAt only.
 */
export async function readWorkingMemory(
  db: IDBPDatabase<MemoryDBSchema>,
  resourceId: string = WORKING_MEMORY_RESOURCE_ID,
): Promise<WorkingMemory | undefined> {
  try {
    const row = await db.get('userFacts', workingMemoryId(resourceId));
    if (row === undefined) return undefined;
    return {
      resourceId,
      markdown: row.content,
      tokens: estimateTokens(row.content),
      updatedAt: row.updatedAt,
    };
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to read working memory', {
      error: err instanceof Error ? err : undefined,
      module: 'UserMemoryStore',
      extra: { resourceId },
    });
    return undefined;
  }
}

/**
 * Persist the working-memory block as a UserMemoryFact row keyed `wm:${id}` in
 * the userFacts store (survives reloads, rides the v2 store, source
 * 'inferred' per D-05-09). Write path — never signals failure.
 */
export async function putWorkingMemory(
  db: IDBPDatabase<MemoryDBSchema>,
  wm: WorkingMemory,
): Promise<void> {
  await putFact(db, {
    id: workingMemoryId(wm.resourceId),
    content: wm.markdown,
    type: 'pattern',
    tags: [],
    confidence: 1,
    source: 'inferred',
    createdAt: wm.updatedAt,
    updatedAt: wm.updatedAt,
    lastUsedAt: undefined,
    useCount: 0,
  });
}
