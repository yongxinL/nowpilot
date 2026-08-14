// src/core/memory/MemoryEngine.ts — D-05-02: the SINGLE orchestrator entry for
// memory read/write from surfaces. assemble()/recordTurn()/summariseIfNeeded()/
// updateWorkingMemory()/addFacts()/subscribe() — surfaces never talk to the
// individual stores directly (R-4); this module composes the 05-02/05-03
// stores (UserMemoryStore / PreferenceMemoryStore / ConversationMemoryStore)
// through structural dependency injection so deterministic tests need no
// singletons or module-level store imports.
//
// assemble() enforces the §3.4/§3.6 injection budgets (D-05-06/GR-6): top-5
// (top-3 tiny), combined memory section (working-memory block + fact lines +
// separators) ≤ MAX_MEMORY_TOKENS (1000) measured against the REAL packed
// section via estimateTokens — the ONLY token counter (Pitfall 1) — with
// WHOLE-ITEM fact drops from the end, never a text.slice on a fact's content
// (D-04-13/D-05-06). The working-memory block (§3.6, ≤300 tokens, O.10-written)
// is injected FIRST (D-05-09) so it can never crowd out retrieved facts; the
// §3.6 truncate-the-block-before-dropping-facts order is honored ONLY as a
// last resort (an O.10-valid ≤300 block never reaches it — the normal
// degradation stays facts-first whole-item drops; the truncation exists so the
// ≤1000-token truth holds unconditionally against a corrupt >1000-token block).
// No secrets ever reach the injection: facts are redacted at write time (O.10,
// TraceRedactor) and the extractor prompt forbids them (R-10). Writes dispatch
// to the stores and never throw (GR-9 — every catch calls debugLog with a
// canonical STORE_READ/STORE_WRITE code; retrieval failures at THIS
// orchestration boundary log ERROR_CODES.MEMORY_RETRIEVAL_FAILED — the
// idb-level failure is already logged inside the store with STORE_READ).
import type { IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { estimateTokens } from '@/core/context/TokenBudget';
import { buildMemorySectionText } from '@/core/context/ContextPack';
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import type { MemoryDBSchema, MemoryMessage } from '@/core/storage/MemoryDB';
import { openMemoryDB } from '@/core/storage/MemoryDB';
import type { WorkingMemory } from '@/types/harness';
import * as UserMemoryStore from './UserMemoryStore';
import * as PreferenceMemoryStore from './PreferenceMemoryStore';
import * as ConversationMemoryStore from './ConversationMemoryStore';
import { scoreMemoryFact } from './MemoryScorer';
import type { MemoryInjection, RetrievedMemory, UserMemoryFact, UserPreferences } from './types';

/** §3.4 (GR-6): the memory-section token cap (never exceed — whole-item drops). */
export const MAX_MEMORY_TOKENS = 1000;
/** §3.6 (D-05-09): the working-memory block token cap (O.10 updater enforces). */
export const WORKING_MEMORY_MAX_TOKENS = 300;
/** §3.4: top-k default — 5 memories for small/medium/large tiers. */
export const MAX_MEMORIES = 5;
/** §3.4 (D-05-06): top-k for the tiny tier — 3 memories. */
export const MAX_MEMORIES_TINY = 3;

/** §3.6 O.10 patch union — the only sanctioned working-memory edit surface. */
export type WorkingMemoryPatch = Partial<
  Record<'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals', string>
>;

/** assemble() inputs — the hook resolves these per stage (Open Q3 resolved). */
export interface AssembleOptions {
  query: string;
  conversationId: string;
  tier: ModelContextTier;
  nowMs?: number;
}

/** Structural UserMemoryStore surface (05-02) — real store functions in prod, fakes in tests. */
export interface UserMemoryStoreAPI {
  retrieve(
    db: IDBPDatabase<MemoryDBSchema>,
    query: string,
    nowMs: number,
  ): Promise<UserMemoryFact[]>;
  readWorkingMemory(
    db: IDBPDatabase<MemoryDBSchema>,
    resourceId?: string,
  ): Promise<WorkingMemory | undefined>;
  initWorkingMemory(resourceId?: string, nowMs?: number): WorkingMemory;
  updateWorkingMemory(cur: WorkingMemory, patch: WorkingMemoryPatch, nowMs?: number): WorkingMemory;
  putWorkingMemory(db: IDBPDatabase<MemoryDBSchema>, wm: WorkingMemory): Promise<void>;
  putFact(db: IDBPDatabase<MemoryDBSchema>, fact: UserMemoryFact): Promise<void>;
}

/** Structural PreferenceMemoryStore surface (05-03) — np_persona read. */
export interface PreferenceMemoryStoreAPI {
  read(): Promise<UserPreferences>;
}

/** Structural ConversationMemoryStore surface (05-03) — per-conversation turns. */
export interface ConversationMemoryStoreAPI {
  appendTurn(
    db: IDBPDatabase<MemoryDBSchema>,
    input: {
      conversationId: string;
      role: 'user' | 'assistant' | 'tool';
      content: string;
      timestamp: number;
    },
  ): Promise<void>;
  summariseIfNeeded(
    db: IDBPDatabase<MemoryDBSchema>,
    conversationId: string,
    opts?: { summarise?: (middle: readonly MemoryMessage[]) => Promise<string> },
  ): Promise<void>;
}

/** The three stores MemoryEngine composes — injected, never imported as singletons. */
export interface MemoryEngineDeps {
  facts: UserMemoryStoreAPI;
  prefs: PreferenceMemoryStoreAPI;
  conversation: ConversationMemoryStoreAPI;
}

/** Lightweight change-notification payload (subscribe seam). */
export type MemoryEngineEvent =
  { kind: 'turn'; conversationId: string } | { kind: 'facts' } | { kind: 'working-memory' };

/** In-memory subscriber set — the subscribe() seam backing store. */
const listeners = new Set<(event: MemoryEngineEvent) => void>();

/** Fire listeners defensively — a listener must never break the engine. */
function notifyListeners(event: MemoryEngineEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // listener failures are ignored — the engine stays available
    }
  }
}

/**
 * Subscribe to memory change notifications (recordTurn/addFacts/
 * updateWorkingMemory). Returns an unsubscribe function. The hook/UI may use
 * this to trigger a re-assemble (planner discretion — kept minimal).
 */
export function subscribe(listener: (event: MemoryEngineEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * §3.4 tokenization shared with UserMemoryStore.retrieve — the same lowercase
 * 3+ alnum terms so the DTO scores reproduce the retrieve ordering exactly.
 */
function queryTerms(query: string): string[] {
  return query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}

/**
 * D-05-02/06/09: the budgeted injection DTO builder the hook (05-06) calls.
 * Order: working-memory block FIRST (D-05-09 — never crowded out by facts),
 * then facts scored via MemoryScorer (scores in [0,1], desc), budgeted
 * top-5/top-3-tiny and ≤ MAX_MEMORY_TOKENS via whole-item drops from the end
 * (never a substring of a fact — D-04-13), then preferences from the
 * np_persona read. Every read degrades to a safe empty — assemble never
 * throws; a closed/missing db yields { memories: [], workingMemoryBlock: '',
 * preferences: defaults }.
 */
export async function assemble(
  db: IDBPDatabase<MemoryDBSchema>,
  deps: MemoryEngineDeps,
  opts: AssembleOptions,
): Promise<MemoryInjection> {
  const nowMs = opts.nowMs ?? Date.now();

  // 1. Working-memory block FIRST (D-05-09) — injected before facts so it can
  //    never crowd them out; ≤300 tokens by construction (O.10 updater).
  let workingMemoryBlock = '';
  try {
    const wm = await deps.facts.readWorkingMemory(db);
    workingMemoryBlock = wm?.markdown ?? '';
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to read working-memory block during assemble', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
      extra: { conversationId: opts.conversationId },
    });
  }

  // 2. User facts — scored via MemoryScorer ([0,1]), already desc-sorted by
  //    the store's retrieve; re-score here so the DTO carries real scores.
  let scored: RetrievedMemory[] = [];
  try {
    const facts = await deps.facts.retrieve(db, opts.query, nowMs);
    const terms = queryTerms(opts.query);
    scored = facts.map((fact) => ({
      id: fact.id,
      content: fact.content,
      type: fact.type,
      tags: fact.tags,
      score: scoreMemoryFact(fact, terms, nowMs),
    }));
  } catch (err) {
    debugLog(ERROR_CODES.MEMORY_RETRIEVAL_FAILED, 'memory retrieval failed during assemble', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
      extra: { conversationId: opts.conversationId },
    });
  }

  // 3. Budgets (D-05-06/GR-6, WR-01): top-k by tier, then the ≤1000-token cap
  //    measured against the REAL packed memory section (working-memory block +
  //    fact lines + separators via buildMemorySectionText — the only honest
  //    token measurement, §3.6 counts the block in the memory budget) with
  //    WHOLE-ITEM fact drops from the end — never a mid-structure slice
  //    (D-04-13). estimateTokens is the ONLY counter (Pitfall 1).
  const maxMemories = opts.tier === 'tiny' ? MAX_MEMORIES_TINY : MAX_MEMORIES;
  const memories: RetrievedMemory[] = [];
  const packedTokens = (hints: readonly RetrievedMemory[]): number =>
    estimateTokens(buildMemorySectionText({ memoryHints: hints, workingMemoryBlock }) ?? '');
  for (const m of scored) {
    if (memories.length >= maxMemories) break;
    if (memories.length > 0 && packedTokens([...memories, m]) > MAX_MEMORY_TOKENS) break;
    memories.push(m);
  }
  // Whole-item drop from the END while over the cap (a single oversized fact
  // degrades to empty, never to a truncated fragment — D-05-06 ladder). The
  // `memories.length > 0` guard is RETAINED so a corrupt oversized block can
  // never drive the loop past empty and underflow the slice.
  while (packedTokens(memories) > MAX_MEMORY_TOKENS && memories.length > 0) {
    memories.pop();
  }
  // §3.6 LAST RESORT — truncate the working-memory block BEFORE dropping more
  // retrieved facts when the block alone exceeds the cap (a corrupt
  // >1000-token block outside the O.10 ≤300 sanctioned write path): facts are
  // already gone, so the only lever left is the block. An O.10-valid ≤300
  // block never reaches this branch — the normal degradation is facts-first
  // whole-item drops (D-04-13). estimateTokens stays the only counter.
  if (memories.length === 0 && packedTokens([]) > MAX_MEMORY_TOKENS) {
    while (packedTokens([]) > MAX_MEMORY_TOKENS && workingMemoryBlock.length > 0) {
      workingMemoryBlock = workingMemoryBlock.slice(0, Math.ceil(workingMemoryBlock.length * 0.75));
    }
  }

  // 4. Preferences — np_persona source for the optimizer's preferences section.
  let preferences: UserPreferences = PreferenceMemoryStore.DEFAULT_USER_PREFERENCES;
  try {
    preferences = await deps.prefs.read();
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to read preferences during assemble', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
    });
  }

  return { memories, workingMemoryBlock, preferences };
}

/**
 * Append a turn through ConversationMemoryStore (05-03) and trigger the
 * 12-message compactor seam. Write path — never throws (STORE_WRITE on
 * failure, GR-9); a turn timestamp defaults to Date.now().
 */
export async function recordTurn(
  db: IDBPDatabase<MemoryDBSchema>,
  deps: MemoryEngineDeps,
  input: {
    conversationId: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp?: number;
  },
): Promise<void> {
  try {
    await deps.conversation.appendTurn(db, {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      timestamp: input.timestamp ?? Date.now(),
    });
    notifyListeners({ kind: 'turn', conversationId: input.conversationId });
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to record turn', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
      extra: { conversationId: input.conversationId },
    });
  }
}

/**
 * Dispatch to ConversationMemoryStore.summariseIfNeeded (05-03) — the
 * 12-message compactor; the LLM summarizer stage (PROMPTS.conversationSummarizer)
 * is the documented injectable seam, not wired in Phase 5. Never throws.
 */
export async function summariseIfNeeded(
  db: IDBPDatabase<MemoryDBSchema>,
  deps: MemoryEngineDeps,
  conversationId: string,
  opts?: { summarise?: (middle: readonly MemoryMessage[]) => Promise<string> },
): Promise<void> {
  try {
    await deps.conversation.summariseIfNeeded(db, conversationId, opts);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to summarise conversation', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
      extra: { conversationId },
    });
  }
}

/**
 * O.10 working-memory update: read the current block (or init the §3.6
 * template), route the patch through the store's O.10 updater (TraceRedactor
 * redaction + ≤300-token trim happen THERE — the ONE sanctioned slice, never a
 * fact's content), persist, and return the new block. Never throws — a failure
 * returns a fresh initialized block.
 */
export async function updateWorkingMemory(
  db: IDBPDatabase<MemoryDBSchema>,
  deps: MemoryEngineDeps,
  patch: WorkingMemoryPatch,
): Promise<WorkingMemory> {
  try {
    const current =
      (await deps.facts.readWorkingMemory(db)) ??
      deps.facts.initWorkingMemory(UserMemoryStore.WORKING_MEMORY_RESOURCE_ID);
    const updated = deps.facts.updateWorkingMemory(current, patch);
    await deps.facts.putWorkingMemory(db, updated);
    notifyListeners({ kind: 'working-memory' });
    return updated;
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to update working memory', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
    });
    return deps.facts.initWorkingMemory(UserMemoryStore.WORKING_MEMORY_RESOURCE_ID);
  }
}

/**
 * Batch-persist extracted memory facts (single-writer surface for the 05a
 * extractor/NoteTagger callers — D-05-02/§3.4 note). Write path — never
 * throws; each fact rides the store's putFact (which never signals failure).
 */
export async function addFacts(
  db: IDBPDatabase<MemoryDBSchema>,
  deps: MemoryEngineDeps,
  facts: UserMemoryFact[],
): Promise<void> {
  try {
    for (const fact of facts) {
      await deps.facts.putFact(db, fact);
    }
    if (facts.length > 0) notifyListeners({ kind: 'facts' });
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to add memory facts', {
      error: err instanceof Error ? err : undefined,
      module: 'MemoryEngine',
      extra: { factCount: facts.length },
    });
  }
}

/**
 * 05-06 (planner discretion — 05-04 shipped structural DI with NO singleton;
 * the surface-facing factory the 05-06 hook imports is the sanctioned seam):
 * the assemble()-only surface bound to the REAL store functions + the MemoryDB
 * handle. The hook never constructs stores inline (single-writer D-05-02 — no
 * store imports in useStreamingLLM); this factory wires the production deps
 * ONCE. assemble opens the DB lazily per call; a closed/missing DB degrades to
 * safe empties inside assemble (the never-throws contract holds).
 */
export interface MemoryEngineSurface {
  assemble(opts: {
    query: string;
    conversationId: string;
    tier: ModelContextTier;
  }): Promise<MemoryInjection>;
}

/** Module-level lazy singleton (the module already owns the listener Set). */
let memoryEngineSurface: MemoryEngineSurface | null = null;

// WR-06: the single IndexedDB connection held across assemble calls. The open
// promise is created once per factory lifetime and reused; a rejection resets
// the holder so the NEXT call self-heals with a fresh open (assemble's
// never-throws contract still degrades a failed open to safe empties).
let memoryDbPromise: Promise<IDBPDatabase<MemoryDBSchema>> | null = null;

/** Open MemoryDB once and reuse the connection (rejection self-heals). */
function getMemoryDb(): Promise<IDBPDatabase<MemoryDBSchema>> {
  if (memoryDbPromise === null) {
    memoryDbPromise = openMemoryDB().catch((err) => {
      memoryDbPromise = null;
      throw err;
    });
  }
  return memoryDbPromise;
}

/**
 * D-05-02/05-06: get the production memory-engine surface. Real store functions
 * bound to openMemoryDB; assemble() is the only exposed op (surfaces never talk
 * to the individual stores — R-4). Tests that exercise the hook mock this
 * boundary; MemoryEngine's own suite keeps testing assemble() directly.
 */
export function getMemoryEngine(): MemoryEngineSurface {
  if (memoryEngineSurface === null) {
    const deps: MemoryEngineDeps = {
      facts: {
        retrieve: UserMemoryStore.retrieve,
        readWorkingMemory: UserMemoryStore.readWorkingMemory,
        initWorkingMemory: UserMemoryStore.initWorkingMemory,
        updateWorkingMemory: UserMemoryStore.updateWorkingMemory,
        putWorkingMemory: UserMemoryStore.putWorkingMemory,
        putFact: UserMemoryStore.putFact,
      },
      prefs: { read: PreferenceMemoryStore.read },
      conversation: {
        appendTurn: ConversationMemoryStore.appendTurn,
        summariseIfNeeded: ConversationMemoryStore.summariseIfNeeded,
      },
    };
    memoryEngineSurface = {
      assemble: async ({ query, conversationId, tier }) => {
        const db = await getMemoryDb();
        return assemble(db, deps, { query, conversationId, tier });
      },
    };
  }
  return memoryEngineSurface;
}
