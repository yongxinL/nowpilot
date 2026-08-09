// src/core/storage/ImportExport.ts — STORAGE-05 import/export core (D-17/D-18/D-19).
//
// DOCUMENTED +1 to the §18 create-list (RESEARCH Open Question Q1 resolution,
// Assumption A4): the §18 create-list has no file for the import/export core,
// and D-09's folding rule forbids only the *StorageLayer/StorageSession* names —
// this file is the Rule-3 deviation note (Phase 1 precedent: documented
// deviations in plan comments). Do NOT fold into Setting.ts.
//
// Export contract (D-17): JSON is the canonical format (inspectable, diffable,
// sanitizable) plus ZIP via fflate for full-vault multi-group exports. Groups
// mirror the export-data tool's `{ scopes: string[] }` vocabulary (spec line
// 1598): chat-history | notes | memory | workspace | settings. Each group is
// sanitized with redactSensitive BEFORE serialization (sanitizeGroup also
// asserts no secret-shaped value survives). NO secret material ever crosses the
// export boundary (D-01): np_providers ciphertext, np_install_secret, and the
// D-11 session tokens are excluded wholesale via EXCLUDED_KEYS. Every export
// carries a manifest { exportedAt, appVersion, schemaVersion }.
//
// Restore contract (D-18): import is per-group MERGE/upsert by id — existing
// records win on conflict by default, with a 'restore overwrites' toggle; NEVER
// full wipe-and-replace, so a partial restore can never destroy data. Full-vault
// restore runs journaled via runJournaled (operation 'restore-notes-batch' —
// A-20: user-confirmed live Phase-2 consumer of the locked WriteJournalOperation
// vocabulary; D-18 supersedes the declared-but-unwired wording — see
// 02-CONTEXT.md Deferred Ideas exception, 2026-08-09) so a mid-restore crash
// leaves a consistent state: group merges are additive + idempotent
// (existing-wins), the entry persists at every boundary, and recovery re-runs
// the merge with the retained payload (mergeGroup is replay-safe).
//
// UI (D-19): CORE ONLY — the Options → Advanced → Import/ExportPanel UI is a
// Phase 7 deliverable (§18 Phase 7 create-list; §9.3).
//
// Golden Rule 9: every catch calls debugLog with a canonical §C.2 code
// (STORE_READ / STORE_WRITE / WRITE_JOURNAL_FAILED).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { redact } from '@/core/security/TraceRedactor';
import { redactSensitive } from '@/core/security/redactSensitive';
import type { WriteJournalEntry } from '@/types/storage';
import {
  openChatHistoryDB,
  getSession,
  listSessions,
  putMessage,
  putSession,
  type ChatMessage,
  type ChatSession,
} from '@/core/storage/ChatHistoryDB';
import {
  openNotesDB,
  getConcept,
  getNote,
  listConcepts,
  listNotes,
  putConcept,
  putNote,
  type Concept,
  type Note,
} from '@/core/storage/NotesDB';
import {
  openMemoryDB,
  getConversationSummary,
  getFact,
  listFacts,
  putConversationSummary,
  putFact,
  putMemoryMessage,
  type ConversationSummary,
  type Fact,
  type MemoryMessage,
} from '@/core/storage/MemoryDB';
import { persistJournalEntry, runJournaled, type JournalStep } from '@/core/storage/WriteJournal';
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY_REGISTRY } from '@/core/storage/Setting';
import { NP_WORKSPACE_KEY } from '@/core/workspace/WorkspaceStore';

// ---------------------------------------------------------------------------
// Group vocabulary (D-17 — mirrors export-data's `{ scopes: string[] }`, spec
// line 1598). Golden Rule 2: these exact strings are the locked vocabulary.
// ---------------------------------------------------------------------------

export const EXPORT_GROUPS = ['chat-history', 'notes', 'memory', 'workspace', 'settings'] as const;

export type ExportGroup = (typeof EXPORT_GROUPS)[number];

/**
 * Keys that are EXCLUDED from every export (D-01/D-11 / T-2-09-01):
 * np_providers carries the §15.2 vault ciphertext (never leaves the machine),
 * np_install_secret is the install-bound secret, and the five D-11 session
 * tokens are declared-only in the Setting registry — none may cross the
 * export boundary, neither the key nor its value.
 */
export const EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  'np_providers',
  'np_install_secret',
  // D-11 session tokens (declared-only keys, no accessors).
  'np_jsessionid',
  'np_sysparm_ck',
  'np_token_ttl',
  'np_active_stream',
  'np_workspace_primary',
]);

/**
 * A-19: the non-secret keys the 'settings' group may carry. np_workspace is
 * its own group; np_providers/np_install_secret/session tokens are excluded
 * (EXCLUDED_KEYS). Area routing (local vs sync) derives from the Setting.ts
 * permission table — the single source of truth, no invented routing.
 */
const SETTINGS_GROUP_KEYS: readonly string[] = [
  'np_theme',
  'np_theme_pack',
  'np_language',
  'np_addon_settings',
  'np_flags',
  'np_schema_version',
  'np_persona',
];

/** App version stamped into every manifest (D-17). */
const APP_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Manifest (D-17)
// ---------------------------------------------------------------------------

export interface ExportManifest {
  exportedAt: number;
  appVersion: string;
  schemaVersion: number;
}

/** Build the export manifest — schemaVersion aligns with np_schema_version (02-05). */
export function buildManifest(): ExportManifest {
  return {
    exportedAt: Date.now(),
    appVersion: APP_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Group collection (per-group data sources: 02-06/02-07 stores + Setting.ts)
// ---------------------------------------------------------------------------

/**
 * Gather one group's raw data from its store(s). chat-history/notes/memory read
 * the idb stores (messages, notes/concepts, memory messages/facts/summaries),
 * workspace reads np_workspace, settings reads the non-secret Setting keys.
 * Read failures are logged (STORE_READ) and rethrown — an incomplete export
 * must surface, never ship silently.
 */
export async function collectGroup(group: ExportGroup): Promise<Record<string, unknown>> {
  try {
    switch (group) {
      case 'chat-history': {
        const db = await openChatHistoryDB();
        const data: Record<string, unknown> = {
          sessions: await listSessions(db),
          messages: await db.getAll('messages'),
        };
        db.close();
        return data;
      }
      case 'notes': {
        const db = await openNotesDB();
        const data: Record<string, unknown> = {
          notes: await listNotes(db),
          concepts: await listConcepts(db),
        };
        db.close();
        return data;
      }
      case 'memory': {
        const db = await openMemoryDB();
        const data: Record<string, unknown> = {
          messages: await db.getAll('messages'),
          facts: await listFacts(db),
          conversationSummaries: await db.getAll('conversationSummaries'),
        };
        db.close();
        return data;
      }
      case 'workspace': {
        const stored = await chrome.storage.local.get(NP_WORKSPACE_KEY);
        return { workspace: stored[NP_WORKSPACE_KEY] ?? null };
      }
      case 'settings': {
        const localKeys = SETTINGS_GROUP_KEYS.filter(
          (key) => !EXCLUDED_KEYS.has(key) && STORAGE_KEY_REGISTRY[key]?.area !== 'sync',
        );
        const syncKeys = SETTINGS_GROUP_KEYS.filter(
          (key) => !EXCLUDED_KEYS.has(key) && STORAGE_KEY_REGISTRY[key]?.area === 'sync',
        );
        const [localStored, syncStored] = await Promise.all([
          chrome.storage.local.get(localKeys),
          chrome.storage.sync.get(syncKeys),
        ]);
        const settings: Record<string, unknown> = {};
        for (const [key, value] of Object.entries({ ...localStored, ...syncStored })) {
          if (value !== undefined) settings[key] = value;
        }
        return { settings };
      }
    }
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, `failed to collect group '${group}'`, {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
      extra: { group },
    });
    throw err;
  }
}

/**
 * Assert no secret-shaped string survives in a (sanitized) value — a string is
 * clean iff the canonical O.13 redaction patterns leave it untouched (D-17).
 * Runs after redactSensitive so a surviving secret is a hard failure, not a
 * silent leak (T-2-09-01).
 */
function assertNoSecrets(value: unknown): void {
  if (typeof value === 'string') {
    if (redact(value) !== value) {
      throw new Error('export group carries a secret-shaped value after redaction');
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const element of value) assertNoSecrets(element);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value as Record<string, unknown>)) assertNoSecrets(nested);
  }
}

/**
 * Sanitize a group payload BEFORE serialization (D-17): run redactSensitive
 * (O.13 string scrubbing + password-like field DROP) and assert the result
 * carries no secret-shaped values.
 */
export function sanitizeGroup(group: ExportGroup, data: unknown): unknown {
  const sanitized = redactSensitive(data);
  assertNoSecrets(sanitized);
  return sanitized;
}

// ---------------------------------------------------------------------------
// Export: JSON canonical + ZIP via fflate (D-17)
// ---------------------------------------------------------------------------

/** Serialize the requested (sanitized) groups as canonical JSON. */
export async function exportJson(groups: ExportGroup[]): Promise<string> {
  const manifest = buildManifest();
  const groupData: Record<string, unknown> = {};
  for (const group of groups) {
    groupData[group] = sanitizeGroup(group, await collectGroup(group));
  }
  return JSON.stringify({ manifest, groups: groupData }, null, 2);
}

/** Serialize the requested (sanitized) groups as a ZIP (fflate, level 6). */
export async function exportZip(groups: ExportGroup[]): Promise<Uint8Array> {
  const manifest = buildManifest();
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  };
  for (const group of groups) {
    const data = sanitizeGroup(group, await collectGroup(group));
    entries[`groups/${group}.json`] = strToU8(JSON.stringify(data, null, 2));
  }
  return zipSync(entries, { level: 6 });
}

// ---------------------------------------------------------------------------
// Import: parse + validate + per-group MERGE/upsert (D-18 / T-2-09-02)
// ---------------------------------------------------------------------------

export interface ParsedExport {
  manifest: ExportManifest;
  groups: Record<string, unknown>;
}

/** Parse a JSON string or fflate ZIP payload; unknown groups are rejected. */
export async function parseImportPayload(payload: string | Uint8Array): Promise<ParsedExport> {
  try {
    const parsed: unknown =
      typeof payload === 'string' ? JSON.parse(payload) : parseZipPayload(payload);
    validateExportShape(parsed);
    return parsed;
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to parse import payload', {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
    });
    throw err;
  }
}

function parseZipPayload(payload: Uint8Array): unknown {
  const restored = unzipSync(payload);
  const manifestEntry = restored['manifest.json'];
  if (manifestEntry === undefined) {
    throw new Error('ZIP payload is missing manifest.json');
  }
  const groups: Record<string, unknown> = {};
  for (const group of EXPORT_GROUPS) {
    const entry = restored[`groups/${group}.json`];
    if (entry !== undefined) groups[group] = JSON.parse(strFromU8(entry));
  }
  return { manifest: JSON.parse(strFromU8(manifestEntry)), groups };
}

function isExportManifest(value: unknown): value is ExportManifest {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.exportedAt === 'number' &&
    typeof m.appVersion === 'string' &&
    typeof m.schemaVersion === 'number'
  );
}

/** Validate the parsed export shape: manifest present + typed, groups known (T-2-09-02). */
function validateExportShape(value: unknown): asserts value is ParsedExport {
  if (typeof value !== 'object' || value === null) {
    throw new Error('invalid export payload: not an object');
  }
  const parsed = value as Record<string, unknown>;
  if (!isExportManifest(parsed.manifest)) {
    throw new Error('invalid export payload: manifest missing or malformed');
  }
  if (typeof parsed.groups !== 'object' || parsed.groups === null) {
    throw new Error('invalid export payload: groups missing or malformed');
  }
  for (const key of Object.keys(parsed.groups)) {
    if (!(EXPORT_GROUPS as readonly string[]).includes(key)) {
      throw new Error(`invalid export payload: unknown group '${key}'`);
    }
  }
}

export interface MergeResult {
  upserted: number;
  kept: number;
}

/**
 * Per-group MERGE/upsert by id (D-18 / T-2-09-02): for each incoming record,
 * if the local id exists → keep local unless overwrite:true; if absent →
 * insert. Never wipes or deletes. Writes route through the relevant store's
 * upsert puts; a malformed incoming record throws (the hostile-payload path
 * surfaces to the journaled restore as a failed step).
 */
export async function mergeGroup(
  group: ExportGroup,
  incoming: unknown,
  opts: { overwrite?: boolean } = {},
): Promise<MergeResult> {
  switch (group) {
    case 'chat-history':
      return mergeChatHistory(incoming, opts);
    case 'notes':
      return mergeNotes(incoming, opts);
    case 'memory':
      return mergeMemory(incoming, opts);
    case 'workspace':
      return mergeWorkspace(incoming, opts);
    case 'settings':
      return mergeSettings(incoming, opts);
  }
}

async function mergeChatHistory(
  incoming: unknown,
  opts: { overwrite?: boolean },
): Promise<MergeResult> {
  const data = (incoming ?? {}) as { sessions?: ChatSession[]; messages?: ChatMessage[] };
  let upserted = 0;
  let kept = 0;
  const db = await openChatHistoryDB();
  try {
    for (const session of data.sessions ?? []) {
      const existing = await getSession(db, session.id);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putSession(db, session);
      upserted++;
    }
    for (const message of data.messages ?? []) {
      const existing = await db.get('messages', message.id);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putMessage(db, message);
      upserted++;
    }
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to merge chat-history group', {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
    });
    throw err;
  } finally {
    db.close();
  }
  return { upserted, kept };
}

async function mergeNotes(incoming: unknown, opts: { overwrite?: boolean }): Promise<MergeResult> {
  const data = (incoming ?? {}) as { notes?: Note[]; concepts?: Concept[] };
  let upserted = 0;
  let kept = 0;
  const db = await openNotesDB();
  try {
    for (const note of data.notes ?? []) {
      const existing = await getNote(db, note.id);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putNote(db, note);
      upserted++;
    }
    for (const concept of data.concepts ?? []) {
      const existing = await getConcept(db, concept.slug);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putConcept(db, concept);
      upserted++;
    }
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to merge notes group', {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
    });
    throw err;
  } finally {
    db.close();
  }
  return { upserted, kept };
}

async function mergeMemory(incoming: unknown, opts: { overwrite?: boolean }): Promise<MergeResult> {
  const data = (incoming ?? {}) as {
    messages?: MemoryMessage[];
    facts?: Fact[];
    conversationSummaries?: ConversationSummary[];
  };
  let upserted = 0;
  let kept = 0;
  const db = await openMemoryDB();
  try {
    for (const message of data.messages ?? []) {
      // §20.2 idempotency key: composite [conversationId, seq] IS the record id.
      const existing = await db.get('messages', [message.conversationId, message.seq]);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putMemoryMessage(db, message);
      upserted++;
    }
    for (const fact of data.facts ?? []) {
      const existing = await getFact(db, fact.id);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putFact(db, fact);
      upserted++;
    }
    for (const summary of data.conversationSummaries ?? []) {
      const existing = await getConversationSummary(db, summary.conversationId);
      if (existing !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await putConversationSummary(db, summary);
      upserted++;
    }
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to merge memory group', {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
    });
    throw err;
  } finally {
    db.close();
  }
  return { upserted, kept };
}

async function mergeWorkspace(
  incoming: unknown,
  opts: { overwrite?: boolean },
): Promise<MergeResult> {
  const data = (incoming ?? {}) as { workspace?: unknown };
  const incomingWorkspace = data.workspace;
  if (incomingWorkspace === null || incomingWorkspace === undefined) {
    return { upserted: 0, kept: 0 };
  }
  try {
    const stored = await chrome.storage.local.get(NP_WORKSPACE_KEY);
    const local = stored[NP_WORKSPACE_KEY];
    if (local !== undefined && opts.overwrite !== true) {
      return { upserted: 0, kept: 1 }; // existing workspace wins by default
    }
    await chrome.storage.local.set({ [NP_WORKSPACE_KEY]: incomingWorkspace });
    return { upserted: 1, kept: 0 };
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to merge workspace group', {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
    });
    throw err;
  }
}

async function mergeSettings(
  incoming: unknown,
  opts: { overwrite?: boolean },
): Promise<MergeResult> {
  const data = (incoming ?? {}) as { settings?: Record<string, unknown> };
  const settings = data.settings ?? {};
  let upserted = 0;
  let kept = 0;
  for (const [key, value] of Object.entries(settings)) {
    // T-2-09-01/T-2-09-02: hostile or secret-bearing keys can never reach
    // storage — excluded keys, unknown keys, declared-only keys, and
    // encrypted-only keys are all refused at the merge boundary.
    if (EXCLUDED_KEYS.has(key)) {
      kept++;
      continue;
    }
    const permission = STORAGE_KEY_REGISTRY[key];
    if (
      permission === undefined ||
      permission.writeAllowed === false ||
      permission.encrypted === true
    ) {
      kept++;
      continue;
    }
    const area = permission.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
    try {
      const stored = await area.get(key);
      if (stored[key] !== undefined && opts.overwrite !== true) {
        kept++;
        continue;
      }
      await area.set({ [key]: value });
      upserted++;
    } catch (err) {
      debugLog(ERROR_CODES.STORE_WRITE, 'failed to merge settings key', {
        error: err instanceof Error ? err : undefined,
        module: 'ImportExport',
        extra: { key },
      });
    }
  }
  return { upserted, kept };
}

// ---------------------------------------------------------------------------
// Journaled full-vault restore (D-18 / A-20 / T-2-09-03)
// ---------------------------------------------------------------------------

/**
 * Restore a full-vault payload (JSON or ZIP) through the journal: one
 * idempotent merge step per exported group under the 'restore-notes-batch'
 * operation (A-20 — user-confirmed live Phase-2 consumer of the locked
 * WriteJournalOperation vocabulary). runJournaled persists the entry at every
 * boundary, so a mid-restore crash leaves a consistent state: completed group
 * merges are additive + replay-safe (existing-wins), and recovery re-runs the
 * merges with the retained payload.
 */
export async function restoreFullVault(
  payload: string | Uint8Array,
  opts: { overwrite?: boolean } = {},
): Promise<MergeResult> {
  const { groups } = await parseImportPayload(payload);
  const entry: WriteJournalEntry = {
    id: `restore-${Date.now()}`,
    operation: 'restore-notes-batch',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    targetIds: { scope: 'full-vault' },
    steps: [],
  };
  const totals: MergeResult = { upserted: 0, kept: 0 };
  const steps: JournalStep[] = EXPORT_GROUPS.filter((group) => groups[group] !== undefined).map(
    (group) => ({
      name: `merge-${group}`,
      apply: async () => {
        const result = await mergeGroup(group, groups[group], opts);
        totals.upserted += result.upserted;
        totals.kept += result.kept;
      },
      // Merges are additive upserts — a rollback cannot safely un-insert records.
      // D-18's consistency comes from replay/idempotency, not rollback.
      rollback: async () => {},
    }),
  );
  try {
    await runJournaled(entry, steps, persistJournalEntry);
  } catch (err) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'full-vault restore failed', {
      error: err instanceof Error ? err : undefined,
      module: 'ImportExport',
      extra: { entryId: entry.id },
    });
    throw err;
  }
  return totals;
}
