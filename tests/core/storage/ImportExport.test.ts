// tests/core/storage/ImportExport.test.ts — STORAGE-05 import/export contract
// tests (D-17/D-18/D-19): JSON + ZIP round-trips with equal ids, the
// no-secrets export guarantee (D-01: np_providers ciphertext + np_install_secret
// + secret-shaped values never leave; manifest present), per-group MERGE/upsert
// semantics (existing wins by default, 'restore overwrites' toggle, never wipe),
// and the journaled full-vault restore ('restore-notes-batch' — A-20
// user-confirmed live Phase-2 consumer) including the crash/replay path
// (02-04 recovery harness: a failed group step leaves a recoverable entry and
// recoverJournal replays an 'applying' restore entry to convergence).
//
// Runs in the default jsdom-align environment with a fresh IDBFactory per test
// (RESEARCH Pattern 8) — same convention as WriteJournal.test.ts. The merge
// targets are the real idb stores (ChatHistoryDB/NotesDB/MemoryDB) and the real
// Setting permission table (chrome.storage via fakeBrowser), so round-trip and
// exclusion proofs exercise the production data path end-to-end.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { fakeBrowser } from 'wxt/testing';
import {
  EXPORT_GROUPS,
  exportJson,
  exportZip,
  mergeGroup,
  parseImportPayload,
  replayRestoreEntry,
  restoreFullVault,
  type MergeResult,
} from '@/core/storage/ImportExport';
import {
  getSession,
  openChatHistoryDB,
  putMessage,
  putSession,
  type ChatMessage,
  type ChatSession,
} from '@/core/storage/ChatHistoryDB';
import { getNote, openNotesDB, putNote, type Note } from '@/core/storage/NotesDB';
import {
  getFact,
  openMemoryDB,
  putFact,
  putMemoryMessage,
  type Fact,
  type MemoryMessage,
} from '@/core/storage/MemoryDB';
import {
  loadPendingEntries,
  persistJournalEntry,
  recoverJournal,
} from '@/core/storage/WriteJournal';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import {
  buildCrossInstallFixture,
  buildRedactionFixture,
  FIXED_INSTALL_SECRET_A,
} from '../../fixtures/index';
import type { WriteJournalEntry } from '@/types/storage';

// ---------------------------------------------------------------------------
// Deterministic test data (D-21: fixed ids/timestamps — no real randomness)
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 's-1',
    title: 'session one',
    created: 1000,
    updated: 1100,
    starred: false,
    preview: 'hello world',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm-1',
    sessionId: 's-1',
    role: 'user' as const,
    content: 'hello from user',
    timestamp: 1050,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n-1',
    title: 'note one',
    content: 'note body',
    created: 1000,
    updated: 1100,
    tags: ['tag'],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

function makeMemoryMessage(overrides: Partial<MemoryMessage> = {}): MemoryMessage {
  return {
    conversationId: 'conv-1',
    seq: 1,
    role: 'user' as const,
    content: 'memory body',
    timestamp: 2000,
    ...overrides,
  };
}

function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: 'f-1',
    content: 'user prefers dark mode',
    confidence: 0.9,
    source: 'explicit' as const,
    created: 1000,
    ...overrides,
  };
}

/** Seed the real chat-history store with one session + one message (returns the db, caller closes). */
async function seedChatHistory(): Promise<void> {
  const db = await openChatHistoryDB();
  await putSession(db, makeSession());
  await putMessage(db, makeMessage());
  db.close();
}

/** Seed the real notes store with one note (returns the db, caller closes). */
async function seedNotes(): Promise<void> {
  const db = await openNotesDB();
  await putNote(db, makeNote());
  db.close();
}

/** Seed the real memory store with one message + one fact. */
async function seedMemory(): Promise<void> {
  const db = await openMemoryDB();
  await putMemoryMessage(db, makeMemoryMessage());
  await putFact(db, makeFact());
  db.close();
}

/** Delete the named IndexedDB databases (fresh-set round-trip + crash simulation). */
async function wipeDBs(...names: string[]): Promise<void> {
  for (const name of names) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('JSON canonical round-trip (D-17)', () => {
  it('exports chat-history + notes + memory groups to JSON and merges them back with equal ids', async () => {
    await seedChatHistory();
    await seedNotes();
    await seedMemory();

    const json = await exportJson(['chat-history', 'notes', 'memory']);
    const parsed = await parseImportPayload(json);

    // Manifest accompanies every export (D-17).
    expect(parsed.manifest.exportedAt).toBeTypeOf('number');
    expect(parsed.manifest.appVersion).toBe('0.1.0');
    expect(parsed.manifest.schemaVersion).toBe(1);
    // Only the requested groups are present.
    expect(Object.keys(parsed.groups).sort()).toEqual(['chat-history', 'memory', 'notes']);

    // Merge into a FRESH set of stores → data survives with equal ids.
    await wipeDBs('ChatHistoryDB', 'NotesDB', 'MemoryDB');
    const result = await mergeGroup('chat-history', parsed.groups['chat-history']);
    await mergeGroup('notes', parsed.groups['notes']);
    await mergeGroup('memory', parsed.groups['memory']);
    expect(result.upserted).toBe(2); // session + message
    expect(result.kept).toBe(0);

    const chatDb = await openChatHistoryDB();
    expect(await getSession(chatDb, 's-1')).toEqual(makeSession());
    expect(await chatDb.get('messages', 'm-1')).toEqual(makeMessage());
    chatDb.close();

    const notesDb = await openNotesDB();
    expect(await getNote(notesDb, 'n-1')).toEqual(makeNote());
    notesDb.close();

    const memoryDb = await openMemoryDB();
    expect(await memoryDb.get('messages', ['conv-1', 1])).toEqual(makeMemoryMessage());
    expect(await getFact(memoryDb, 'f-1')).toEqual(makeFact());
    memoryDb.close();
  });
});

describe('ZIP round-trip via fflate (D-17, RESEARCH Pattern 7)', () => {
  it('exportZip produces a payload parseImportPayload can restore with equal ids', async () => {
    await seedChatHistory();
    await seedNotes();

    const zip = await exportZip(['chat-history', 'notes']);
    expect(zip).toBeInstanceOf(Uint8Array);

    const parsed = await parseImportPayload(zip);
    expect(parsed.manifest.schemaVersion).toBe(1);
    expect(Object.keys(parsed.groups).sort()).toEqual(['chat-history', 'notes']);

    await wipeDBs('ChatHistoryDB', 'NotesDB');
    await mergeGroup('chat-history', parsed.groups['chat-history']);
    await mergeGroup('notes', parsed.groups['notes']);

    const chatDb = await openChatHistoryDB();
    expect(await getSession(chatDb, 's-1')).toEqual(makeSession());
    expect(await chatDb.get('messages', 'm-1')).toEqual(makeMessage());
    chatDb.close();

    const notesDb = await openNotesDB();
    expect(await getNote(notesDb, 'n-1')).toEqual(makeNote());
    notesDb.close();
  });
});

describe('no-secrets export (D-01 / T-2-09-01)', () => {
  it('excludes np_providers ciphertext, np_install_secret, and every secret-shaped value from the payload', async () => {
    // Seed secret material that must NEVER leave: np_providers holds the §15.2
    // vault envelope (ciphertext), np_install_secret the install-bound secret.
    const envelope = buildCrossInstallFixture().envelopeA;
    await fakeBrowserStorageSet({ np_providers: envelope });
    await fakeBrowserStorageSet({ np_install_secret: FIXED_INSTALL_SECRET_A });

    // Seed secret-shaped VALUES inside otherwise-exportable data — the
    // sanitizeGroup step must scrub them to [REDACTED] (D-17).
    const redaction = buildRedactionFixture();
    await seedChatHistoryWithContent(redaction.messages[0], redaction.structured);

    const json = await exportJson([...EXPORT_GROUPS]);
    expect(json).toContain('[REDACTED]');
    // Neither the excluded keys nor their values appear anywhere.
    expect(json).not.toContain('np_providers');
    expect(json).not.toContain('np_install_secret');
    expect(json).not.toContain(FIXED_INSTALL_SECRET_A);
    expect(json).not.toContain('sk-abc123def456ghi789');
    expect(json).not.toContain('eyJhbGciOiJIUzI1NiJ9.abc');
    expect(json).not.toContain('sup3r-secret-password');
    // The settings group carries no np_providers entry even though storage has it.
    const parsed = await parseImportPayload(json);
    const settings = parsed.groups['settings'] as { settings?: Record<string, unknown> };
    expect(settings.settings).not.toHaveProperty('np_providers');
    expect(settings.settings).not.toHaveProperty('np_install_secret');
  });
});

describe('per-group MERGE/upsert semantics (D-18 / T-2-09-02)', () => {
  it('existing records win by default; overwrite:true lets incoming win; new ids insert without wiping others', async () => {
    // Local state: session s-local + an unrelated session s-other.
    const chatDb = await openChatHistoryDB();
    await putSession(chatDb, makeSession({ id: 's-local', title: 'local title' }));
    await putSession(chatDb, makeSession({ id: 's-other', title: 'untouched' }));
    chatDb.close();

    // Incoming payload: same id s-local (different title) + a brand-new s-new.
    const incoming = {
      sessions: [
        makeSession({ id: 's-local', title: 'incoming title' }),
        makeSession({ id: 's-new', title: 'brand new' }),
      ],
      messages: [],
    };

    // Default: existing wins, new inserted, unrelated never touched (no wipe).
    const result: MergeResult = await mergeGroup('chat-history', incoming);
    expect(result).toEqual({ upserted: 1, kept: 1 });

    const db1 = await openChatHistoryDB();
    expect((await getSession(db1, 's-local'))?.title).toBe('local title'); // existing wins
    expect((await getSession(db1, 's-new'))?.title).toBe('brand new'); // inserted
    expect((await getSession(db1, 's-other'))?.title).toBe('untouched'); // no wipe
    db1.close();

    // overwrite:true → incoming wins everywhere: s-local replaced AND the
    // already-present s-new re-upserted (both counted upserted); s-other
    // (absent from the payload) stays untouched — still never a wipe.
    const overwriteResult = await mergeGroup('chat-history', incoming, { overwrite: true });
    expect(overwriteResult).toEqual({ upserted: 2, kept: 0 });
    const db2 = await openChatHistoryDB();
    expect((await getSession(db2, 's-local'))?.title).toBe('incoming title');
    db2.close();
  });
});

describe('journaled full-vault restore (D-18 / A-20 / T-2-09-03)', () => {
  it('restores every group through a restore-notes-batch journal entry that completes', async () => {
    await seedChatHistory();
    await seedNotes();
    await seedMemory();

    const zip = await exportZip([...EXPORT_GROUPS]);
    await wipeDBs('ChatHistoryDB', 'NotesDB', 'MemoryDB', 'WriteJournalDB');

    const totals = await restoreFullVault(zip);
    // chat-history (session + message) + notes (note) + memory (message + fact)
    expect(totals.upserted).toBe(5);
    expect(totals.kept).toBe(0);

    // A 'restore-notes-batch' entry was journaled and completed (A-20).
    const entries = await loadPendingEntries();
    const restoreEntry = entries.find((e) => e.operation === 'restore-notes-batch');
    expect(restoreEntry).toBeDefined();
    expect(restoreEntry?.status).toBe('completed');
    expect(restoreEntry?.targetIds.scope).toBe('full-vault');
    expect(restoreEntry?.steps.length).toBe(EXPORT_GROUPS.length); // one step per group
    // WR-02: the parsed groups are RETAINED on the entry — crash recovery can
    // re-run the merges with the actual payload (D-18 journaled restore).
    expect(restoreEntry?.payload).toBeDefined();
    const retainedGroups = (restoreEntry?.payload as { groups?: Record<string, unknown> }).groups;
    expect(retainedGroups).toBeDefined();
    expect(Object.keys(retainedGroups ?? {}).sort()).toEqual([...EXPORT_GROUPS].sort());

    // Data landed in the fresh stores.
    const chatDb = await openChatHistoryDB();
    expect(await getSession(chatDb, 's-1')).toEqual(makeSession());
    chatDb.close();
    const notesDb = await openNotesDB();
    expect(await getNote(notesDb, 'n-1')).toEqual(makeNote());
    notesDb.close();
  });

  it('a failed group step leaves the restore entry in the journal with completed groups persisted (additive)', async () => {
    await seedChatHistory();
    const zip = await exportZip(['chat-history', 'notes']);
    await wipeDBs('ChatHistoryDB', 'NotesDB', 'WriteJournalDB');

    // Tamper with the payload: the notes group becomes non-iterable, so the
    // merge-notes step throws mid-restore (hostile/malformed payload, T-2-09-02).
    const parsed = await parseImportPayload(zip);
    const malformed = JSON.stringify({
      manifest: parsed.manifest,
      groups: { ...parsed.groups, notes: { notes: 42 } },
    });

    await expect(restoreFullVault(malformed)).rejects.toThrow();

    // The journal entry exists and is in a terminal-but-recoverable state; the
    // chat-history step (which ran before notes) is persisted — a crash never
    // destroys data (additive, D-18).
    const entries = await loadPendingEntries();
    const restoreEntry = entries.find((e) => e.operation === 'restore-notes-batch');
    expect(restoreEntry).toBeDefined();
    expect(['rolled-back', 'applying']).toContain(restoreEntry?.status);

    const chatDb = await openChatHistoryDB();
    expect(await getSession(chatDb, 's-1')).toEqual(makeSession());
    chatDb.close();
    const notesDb = await openNotesDB();
    expect(await getNote(notesDb, 'n-1')).toBeUndefined();
    notesDb.close();
  });

  it('recoverJournal replays an applying restore entry via the PRODUCTION handler using the retained payload (WR-02)', async () => {
    await seedChatHistory();
    await seedNotes();
    const payload = await exportZip([...EXPORT_GROUPS]);
    const parsed = await parseImportPayload(payload);
    await wipeDBs('ChatHistoryDB', 'NotesDB', 'WriteJournalDB');

    // Crash simulation: chat-history step already merged (completed step marker)
    // but the entry was never finalized — persisted in the 'applying' state
    // exactly as runJournaled leaves it after a hard crash. The payload is
    // RETAINED on the entry (the WR-02 production shape) — the replay must use
    // the entry's OWN payload, never test-scope data.
    await mergeGroup('chat-history', parsed.groups['chat-history']);
    const crashEntry: WriteJournalEntry = {
      id: 'restore-crash-1',
      operation: 'restore-notes-batch',
      status: 'applying',
      createdAt: 1000,
      updatedAt: 1100,
      attempts: 1,
      targetIds: { scope: 'full-vault' },
      payload: { groups: parsed.groups },
      steps: [{ name: 'merge-chat-history', status: 'completed' }],
    };
    await persistJournalEntry(crashEntry);

    // Recovery replay through recoverJournal + the PRODUCTION merge handler
    // (replayRestoreEntry — the same handler recoverWorkspaceJournal dispatches
    // to). Idempotent: already-merged records are kept (existing-wins, D-18).
    // The handler marks the entry completed (replay-once), mirroring the
    // recoverWorkspaceJournal contract.
    let merges = 0;
    const replay = async (entry: WriteJournalEntry): Promise<void> => {
      expect(entry.operation).toBe('restore-notes-batch');
      await replayRestoreEntry(entry);
      merges++;
      entry.status = 'completed';
      await persistJournalEntry(entry);
    };

    await recoverJournal(loadPendingEntries, replay);
    await recoverJournal(loadPendingEntries, replay); // second pass — replay-once

    const mergedEntries = await loadPendingEntries();
    const restoreEntry = mergedEntries.find((e) => e.id === 'restore-crash-1');
    expect(restoreEntry?.status).toBe('completed');
    expect(merges).toBe(1); // only the first pass replayed it — replay-once

    // Both groups converged from the ENTRY's retained payload.
    const chatDb = await openChatHistoryDB();
    expect(await getSession(chatDb, 's-1')).toEqual(makeSession());
    chatDb.close();
    const notesDb = await openNotesDB();
    expect(await getNote(notesDb, 'n-1')).toEqual(makeNote());
    notesDb.close();
  });

  it('the production recovery path (recoverWorkspaceJournal) dispatches restore-notes-batch to the merge handler (WR-02)', async () => {
    await seedChatHistory();
    await seedNotes();
    const payload = await exportZip([...EXPORT_GROUPS]);
    const parsed = await parseImportPayload(payload);
    await wipeDBs('ChatHistoryDB', 'NotesDB', 'WriteJournalDB');

    // A mid-restore crash leaves an 'applying' entry with its payload retained
    // (the exact shape restoreFullVault now persists).
    const crashEntry: WriteJournalEntry = {
      id: 'restore-crash-2',
      operation: 'restore-notes-batch',
      status: 'applying',
      createdAt: 1000,
      updatedAt: 1100,
      attempts: 1,
      targetIds: { scope: 'full-vault' },
      payload: { groups: parsed.groups },
      steps: [],
    };
    await persistJournalEntry(crashEntry);

    // init() runs recoverWorkspaceJournal, which must NOT skip the
    // restore-notes-batch op (previously "unknown operation") — it re-runs the
    // retained merges and marks the entry completed.
    useWorkspaceStore.setState({
      workspace: {
        workspaceId: 'ws-restore-replay',
        conversationId: 'conv-restore-replay',
        pinnedTabs: [],
        selectedNotes: [],
        activeSurface: 'sidepanel',
        version: 0,
        updatedAt: 1000,
      },
      isReady: false,
    });
    await useWorkspaceStore.getState().init();

    const mergedEntries = await loadPendingEntries();
    const restoreEntry = mergedEntries.find((e) => e.id === 'restore-crash-2');
    expect(restoreEntry?.status).toBe('completed'); // replayed + finalized

    const chatDb = await openChatHistoryDB();
    expect(await getSession(chatDb, 's-1')).toEqual(makeSession());
    chatDb.close();
    const notesDb = await openNotesDB();
    expect(await getNote(notesDb, 'n-1')).toEqual(makeNote());
    notesDb.close();

    useWorkspaceStore.getState().stop();
  });
});

// ---------------------------------------------------------------------------
// Test-local helpers
// ---------------------------------------------------------------------------

/** fakeBrowser chrome.storage.local alias — chrome.* is mocked by wxt/testing. */
async function fakeBrowserStorageSet(items: Record<string, unknown>): Promise<void> {
  await fakeBrowser.storage.local.set(items);
}

/** Seed chat-history with secret-bearing content (session preview + message body). */
async function seedChatHistoryWithContent(
  messageContent: string,
  structured: Record<string, unknown>,
): Promise<void> {
  const db = await openChatHistoryDB();
  await putSession(
    db,
    makeSession({ id: 's-secret', title: String(structured.apiKey ?? 'title') }),
  );
  await putMessage(
    db,
    makeMessage({ id: 'm-secret', sessionId: 's-secret', content: messageContent }),
  );
  db.close();
}
