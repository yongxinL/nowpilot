import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as BroadcastBus from '../../../src/core/runtime/BroadcastBus';
import {
  flushPendingWrites,
  __test__ as adapterTest,
} from '../../../src/core/theme/chromeStorageAdapter';
import { closeDb, getDb, __test__ as dbTest } from '../../../src/core/storage/NowPilotDB';
import {
  recoverJournal,
  type JournalEntryStore,
  type WriteJournalEntry,
} from '../../../src/core/storage/WriteJournal';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';
import {
  WORKSPACE_CHANNEL,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_WRITE_STAGE_NAMES,
  readWorkspaceState,
  replayUpdateWorkspace,
  subscribeToWorkspaceChanges,
  writeWorkspaceState,
  type WorkspaceStorageArea,
  type WorkspaceUpdateSignal,
} from '../../../src/core/workspace/WorkspacePersistence';
import {
  createInitialWorkspaceState,
  parseWorkspaceState,
  type WorkspaceState,
} from '../../../src/core/workspace/WorkspaceState';

/**
 * WorkspacePersistence suite — plan 02-06 Task 1.
 *
 * Proves the durability half of ROADMAP success criterion 4: a version-ordered,
 * journaled write through the **existing debounced adapter** that survives a
 * reload, with a narrow two-identifier cross-surface signal.
 *
 * Every storage seam is either the production adapter or a Map-backed fake;
 * the journal is either a Map-backed fake or the real `np_db` `entries` store.
 * No body, credential or whole state object is ever placed on a channel, and
 * the payload case asserts the exact key set rather than a subset.
 */

const FIXED_NOW = 1_700_000_000_000;

function state(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return { ...createInitialWorkspaceState(), updatedAt: FIXED_NOW, ...overrides };
}

function localMap(): Map<string, unknown> {
  return (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;
}

function sessionMap(): Map<string, unknown> {
  return (globalThis as unknown as { __chromeStorageSessionMap: Map<string, unknown> })
    .__chromeStorageSessionMap;
}

const broadcast = (payload: unknown): void => {
  (globalThis as unknown as { __broadcast: (channel: string, data: unknown) => void }).__broadcast(
    WORKSPACE_CHANNEL,
    payload,
  );
};

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

/** A Map-backed `WorkspaceStorageArea` with switchable failure injection. */
function memoryStorage(options: { value?: string } = {}): {
  area: WorkspaceStorageArea;
  map: Map<string, string>;
  control: { failReads: boolean; failWrites: boolean };
} {
  const map = new Map<string, string>();
  if (options.value !== undefined) map.set(WORKSPACE_STORAGE_KEY, options.value);
  const control = { failReads: false, failWrites: false };

  const area: WorkspaceStorageArea = {
    getItem: async (name: string) => {
      if (control.failReads) throw new Error('storage read failed');
      return map.get(name) ?? null;
    },
    setItem: async (name: string, value: string) => {
      if (control.failWrites) throw new Error('storage write failed');
      map.set(name, value);
    },
  };

  return { area, map, control };
}

/** A Map-backed `JournalEntryStore` that stores snapshots, not live objects. */
function memoryJournal(): {
  entries: Map<string, WriteJournalEntry>;
  store: JournalEntryStore;
} {
  const entries = new Map<string, WriteJournalEntry>();
  const snapshot = (entry: WriteJournalEntry): WriteJournalEntry => ({
    ...entry,
    targetIds: { ...entry.targetIds },
    steps: entry.steps.map((step) => ({ ...step })),
  });

  return {
    entries,
    store: {
      load: async (id: string) => {
        const entry = entries.get(id);
        return entry ? snapshot(entry) : undefined;
      },
      persist: async (entry: WriteJournalEntry) => {
        entries.set(entry.id, snapshot(entry));
      },
    },
  };
}

beforeEach(() => {
  adapterTest.resetPendingState();
  localMap().clear();
  sessionMap().clear();
  clearLogs();
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  dbTest.reset();
});

afterEach(() => {
  adapterTest.resetPendingState();
  closeDb();
  vi.restoreAllMocks();
});

describe('WorkspacePersistence — pinned key and channel (D2-31)', () => {
  it('exports the canonical storage key and the update channel', () => {
    expect(WORKSPACE_STORAGE_KEY).toBe('np_workspace');
    expect(WORKSPACE_CHANNEL).toBe('np_workspace');
    expect(WORKSPACE_WRITE_STAGE_NAMES).toEqual(['write-np-workspace', 'emit-workspace-updated']);
  });
});

describe('WorkspacePersistence — read path', () => {
  it('a missing key resolves the initial state', async () => {
    const { area } = memoryStorage();
    const result = await readWorkspaceState({ storage: area });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parseWorkspaceState(result.value).ok).toBe(true);
    expect(result.value.version).toBe(0);
  });

  it('an unreadable store resolves a typed failure and never throws', async () => {
    const { area, control } = memoryStorage();
    control.failReads = true;

    const read = await readWorkspaceState({ storage: area });
    expect(read).toEqual({ ok: false, code: 'WORKSPACE_READ_FAILED' });

    // The write path fails closed too: it never writes blind over an unread store.
    const journal = memoryJournal();
    const write = await writeWorkspaceState(state({ version: 1 }), {
      storage: area,
      journal: journal.store,
    });
    expect(write).toEqual({ ok: false, code: 'WORKSPACE_READ_FAILED' });
    expect(journal.entries.size).toBe(0);
  });

  it('a schema-invalid stored value migrates to a schema-valid state without throwing', async () => {
    const { area } = memoryStorage({
      value: JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'ws-migrating',
        version: 4,
        updatedAt: FIXED_NOW,
        surprise: 'unknown-field',
        pinnedTabs: 'not-an-array',
      }),
    });

    const result = await readWorkspaceState({ storage: area });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parseWorkspaceState(result.value).ok).toBe(true);
    // The recognised fields are salvaged; the unrecognised one is discarded.
    expect(result.value.workspaceId).toBe('ws-migrating');
    expect(result.value.version).toBe(4);
  });
});

describe('WorkspacePersistence — journaled, version-ordered writes (§20.3, M.3)', () => {
  it('a write/read round trip lands through the real adapter and survives a reload', async () => {
    const written = state({ version: 3, conversationId: 'conv-round-trip' });

    const result = await writeWorkspaceState(written);
    expect(result.ok).toBe(true);

    // WR-04: the write is landed before the call resolves — the signal follows
    // a durable key write, never a merely queued one.
    expect(adapterTest.getPendingSize()).toBe(0);
    expect(localMap().has(WORKSPACE_STORAGE_KEY)).toBe(true);

    // A reload: drop the adapter's in-memory pending state and read the map.
    adapterTest.resetPendingState();
    const reloaded = await readWorkspaceState();

    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;
    expect(reloaded.value).toEqual(written);
  });

  it('a lower-version write is rejected and leaves the stored value byte-identical', async () => {
    const { area, map } = memoryStorage();
    const journal = memoryJournal();
    const deps = { storage: area, journal: journal.store, now: () => FIXED_NOW };

    const accepted = await writeWorkspaceState(state({ version: 5 }), deps);
    expect(accepted.ok).toBe(true);
    const storedBefore = map.get(WORKSPACE_STORAGE_KEY);
    expect(storedBefore).toBeDefined();

    const rejected = await writeWorkspaceState(state({ version: 3 }), deps);

    expect(rejected).toEqual({ ok: false, code: 'WORKSPACE_VERSION_REJECTED' });
    expect(map.get(WORKSPACE_STORAGE_KEY)).toBe(storedBefore);
  });

  it('a tie is resolved by the stored version, not by arrival order', async () => {
    const { area, map } = memoryStorage();
    const journal = memoryJournal();
    const deps = { storage: area, journal: journal.store, now: () => FIXED_NOW };

    const first = state({ version: 3, conversationId: 'conv-first' });
    const second = state({ version: 3, conversationId: 'conv-second' });

    expect((await writeWorkspaceState(first, deps)).ok).toBe(true);
    const storedBefore = map.get(WORKSPACE_STORAGE_KEY);

    const rejected = await writeWorkspaceState(second, deps);

    expect(rejected).toEqual({ ok: false, code: 'WORKSPACE_VERSION_REJECTED' });
    expect(map.get(WORKSPACE_STORAGE_KEY)).toBe(storedBefore);
  });

  it('last-write-wins at an equal updatedAt is decided by the version', async () => {
    const { area, map } = memoryStorage();
    const journal = memoryJournal();
    const deps = { storage: area, journal: journal.store, now: () => FIXED_NOW };

    // Both writes carry the same integer millisecond timestamp.
    expect((await writeWorkspaceState(state({ version: 1 }), deps)).ok).toBe(true);
    expect((await writeWorkspaceState(state({ version: 2 }), deps)).ok).toBe(true);

    const stored = JSON.parse(String(map.get(WORKSPACE_STORAGE_KEY))) as { version: number };
    expect(stored.version).toBe(2);
    expect(Number.isInteger(stored.version)).toBe(true);

    // The reverse arrival order cannot overwrite the newer version.
    const reversed = await writeWorkspaceState(state({ version: 1 }), deps);
    expect(reversed).toEqual({ ok: false, code: 'WORKSPACE_VERSION_REJECTED' });
  });

  it('a successful write leaves the journal entry completed', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    const written = state({ version: 7, conversationId: 'conv-journal' });

    const result = await writeWorkspaceState(written, {
      storage: area,
      journal: journal.store,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(true);

    const entry = journal.entries.get(`${written.workspaceId}:7`);
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.operation).toBe('update-workspace');
    expect(entry.status).toBe('completed');
    expect(entry.targetIds).toEqual({ workspaceId: written.workspaceId, version: '7' });
    expect(entry.steps.map((step) => [step.name, step.status])).toEqual([
      ['write-np-workspace', 'completed'],
      ['emit-workspace-updated', 'completed'],
    ]);
  });

  it('a failed storage write leaves the journal entry non-terminal with the stage visible', async () => {
    const { area, control } = memoryStorage();
    const journal = memoryJournal();
    control.failWrites = true;
    const written = state({ version: 1 });

    const result = await writeWorkspaceState(written, {
      storage: area,
      journal: journal.store,
      now: () => FIXED_NOW,
    });

    expect(result).toEqual({ ok: false, code: 'WORKSPACE_WRITE_FAILED' });

    const entry = journal.entries.get(`${written.workspaceId}:1`);
    expect(entry).toBeDefined();
    if (!entry) return;
    // Non-terminal: the next attempt with the same idempotency key resumes it.
    expect(['pending', 'applying']).toContain(entry.status);
    expect(entry.status).toBe('applying');
    expect(entry.steps[0]).toMatchObject({ name: 'write-np-workspace', status: 'failed' });
    expect(entry.steps[1]).toMatchObject({ name: 'emit-workspace-updated', status: 'pending' });
  });

  it('resolves a typed failure when the journal store rejects — the IndexedDB-blocked path (WR-06)', async () => {
    const { area, map } = memoryStorage();
    const blocked: JournalEntryStore = {
      load: async () => {
        // What `defaultJournalStore.load` does when `getDb()` rejects in the
        // §19.10 blocked/unavailable state.
        throw new DOMException('blocked', 'InvalidStateError');
      },
      persist: async () => {},
    };

    const result = await writeWorkspaceState(state({ version: 1 }), {
      storage: area,
      journal: blocked,
    });

    expect(result).toEqual({ ok: false, code: 'WORKSPACE_JOURNAL_FAILED' });
    // Nothing reached the key: the write never started.
    expect(map.size).toBe(0);
    expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_JOURNAL_FAILED')).toBe(true);
  });

  it('a non-schema-valid state is rejected at the boundary and nothing is written', async () => {
    const { area, map } = memoryStorage();
    const journal = memoryJournal();
    const invalid = { ...state({ version: 1 }), surprise: true } as unknown as WorkspaceState;

    const result = await writeWorkspaceState(invalid, { storage: area, journal: journal.store });

    expect(result).toEqual({ ok: false, code: 'WORKSPACE_STATE_INVALID' });
    expect(map.size).toBe(0);
    expect(journal.entries.size).toBe(0);
  });

  it('the production write path uses the real np_db journal store', async () => {
    const { area } = memoryStorage();
    const written = state({ version: 9 });

    const result = await writeWorkspaceState(written, { storage: area, now: () => FIXED_NOW });
    expect(result.ok).toBe(true);

    const db = await getDb();
    const entry = await db.get('entries', `${written.workspaceId}:9`);
    expect(entry).toBeDefined();
    expect(entry?.operation).toBe('update-workspace');
    expect(entry?.status).toBe('completed');
  });

  it('the published payload has exactly the two identifiers and no state object', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    const publishSpy = vi.spyOn(BroadcastBus, 'publish');
    const written = state({ version: 4, conversationId: 'conv-signal' });

    await writeWorkspaceState(written, { storage: area, journal: journal.store });

    expect(publishSpy).toHaveBeenCalledTimes(1);
    const [channel, payload] = publishSpy.mock.calls[0] as [string, WorkspaceUpdateSignal];
    expect(channel).toBe(WORKSPACE_CHANNEL);
    expect(Object.keys(payload).sort()).toEqual(['conversationId', 'workspaceId']);
    expect(payload).toEqual({
      workspaceId: written.workspaceId,
      conversationId: 'conv-signal',
    });

    // Nothing state-shaped crossed: the serialised payload is two fields.
    expect(JSON.stringify(payload)).not.toContain('schemaVersion');
    expect(JSON.stringify(payload)).not.toContain('version');
  });

  it('the emitted payload is identical through an injected publisher', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    const signals: WorkspaceUpdateSignal[] = [];

    await writeWorkspaceState(state({ version: 2, conversationId: null }), {
      storage: area,
      journal: journal.store,
      publishUpdate: (signal) => signals.push(signal),
    });

    expect(signals).toEqual([{ workspaceId: expect.any(String), conversationId: null }]);
    expect(Object.keys(signals[0]).sort()).toEqual(['conversationId', 'workspaceId']);
  });
});

describe('WorkspacePersistence — cross-surface signal (D2-31)', () => {
  it('a signal re-reads the key and delivers the stored state once per version', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    const written = state({ version: 5, conversationId: 'conv-subscribe' });
    await writeWorkspaceState(written, { storage: area, journal: journal.store });

    const delivered: WorkspaceState[] = [];
    const unsubscribe = subscribeToWorkspaceChanges((next) => delivered.push(next), {
      storage: area,
    });

    broadcast({ workspaceId: written.workspaceId, conversationId: written.conversationId });
    await flushMicrotasks();

    expect(delivered).toHaveLength(1);
    expect(delivered[0].version).toBe(5);

    // A duplicate signal at the same version is not delivered again.
    broadcast({ workspaceId: written.workspaceId, conversationId: written.conversationId });
    await flushMicrotasks();
    expect(delivered).toHaveLength(1);

    // A newer stored version is delivered.
    await writeWorkspaceState(
      state({ workspaceId: written.workspaceId, version: 6, conversationId: 'conv-newer' }),
      { storage: area, journal: journal.store },
    );
    broadcast({ workspaceId: written.workspaceId, conversationId: 'conv-newer' });
    await flushMicrotasks();

    expect(delivered.map((entry) => entry.version)).toEqual([5, 6]);
    unsubscribe();
  });

  it('lands the key before the signal, so a receiver without the sender pending map adopts the write (WR-04)', async () => {
    // The receiver is a different document: it reads only what landed in
    // `chrome.storage.local`, never the sender's in-memory pending map.
    const receiverArea: WorkspaceStorageArea = {
      getItem: async (name: string) => (localMap().get(name) as string | undefined) ?? null,
      setItem: async () => {},
    };
    const delivered: WorkspaceState[] = [];
    const unsubscribe = subscribeToWorkspaceChanges((next) => delivered.push(next), {
      storage: receiverArea,
    });

    const written = state({ version: 5, conversationId: 'conv-debounce' });
    // The real debounced adapter, and no manual flush before the signal.
    expect((await writeWorkspaceState(written)).ok).toBe(true);

    broadcast({ workspaceId: written.workspaceId, conversationId: written.conversationId });
    await flushMicrotasks();

    expect(delivered.map((entry) => entry.version)).toEqual([5]);
    expect(delivered[0]?.conversationId).toBe('conv-debounce');
    unsubscribe();
  });

  it('rejects a payload that is not the strict two-identifier signal', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    const written = state({ version: 5 });
    await writeWorkspaceState(written, { storage: area, journal: journal.store });

    const delivered: WorkspaceState[] = [];
    const unsubscribe = subscribeToWorkspaceChanges((next) => delivered.push(next), {
      storage: area,
    });

    // A whole state object — exactly what Appendix M.3's reference broadcast.
    broadcast(written);
    await flushMicrotasks();
    expect(delivered).toHaveLength(0);

    // A signal for a different workspace is ignored.
    broadcast({ workspaceId: 'ws-other', conversationId: null });
    await flushMicrotasks();
    expect(delivered).toHaveLength(0);

    expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_UPDATE_PAYLOAD_REJECTED')).toBe(
      true,
    );
    unsubscribe();
  });
});

describe('WorkspacePersistence — startup replay of an interrupted update-workspace (WR-01)', () => {
  /** An entry left mid-flight by a crash: the key write ran, the signal did not. */
  function interruptedEntry(overrides: Partial<WriteJournalEntry> = {}): WriteJournalEntry {
    return {
      id: 'ws-interrupted:5',
      operation: 'update-workspace',
      status: 'applying',
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
      attempts: 1,
      targetIds: { workspaceId: 'ws-interrupted', version: '5' },
      steps: [
        { name: WORKSPACE_WRITE_STAGE_NAMES[0], status: 'completed' },
        { name: WORKSPACE_WRITE_STAGE_NAMES[1], status: 'pending' },
      ],
      ...overrides,
    };
  }

  it('finishes the missing signal step and completes the entry when the key write landed', async () => {
    const { area, map } = memoryStorage();
    const journal = memoryJournal();
    expect(
      (
        await writeWorkspaceState(
          state({ workspaceId: 'ws-interrupted', version: 5, conversationId: 'conv-landed' }),
          { storage: area, journal: journal.store },
        )
      ).ok,
    ).toBe(true);
    const storedBefore = map.get(WORKSPACE_STORAGE_KEY);

    const signals: WorkspaceUpdateSignal[] = [];
    const entry = interruptedEntry();
    const result = await replayUpdateWorkspace(entry, {
      storage: area,
      journal: journal.store,
      now: () => FIXED_NOW,
      publishUpdate: (signal) => signals.push(signal),
    });

    expect(result).toEqual({ ok: true });
    // The narrow two-identifier signal, exactly once, carrying no state object.
    expect(signals).toEqual([{ workspaceId: 'ws-interrupted', conversationId: 'conv-landed' }]);
    expect(Object.keys(signals[0]).sort()).toEqual(['conversationId', 'workspaceId']);

    const persisted = journal.entries.get('ws-interrupted:5');
    expect(persisted?.status).toBe('completed');
    expect(persisted?.steps.map((step) => step.status)).toEqual(['completed', 'completed']);
    // The replay never rewrites the stored key: it only owes the signal.
    expect(map.get(WORKSPACE_STORAGE_KEY)).toBe(storedBefore);
  });

  it('completes and signals when a newer write already superseded the entry', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    await writeWorkspaceState(
      state({ workspaceId: 'ws-interrupted', version: 9, conversationId: 'conv-newer' }),
      { storage: area, journal: journal.store },
    );

    const signals: WorkspaceUpdateSignal[] = [];
    const entry = interruptedEntry();
    const result = await replayUpdateWorkspace(entry, {
      storage: area,
      journal: journal.store,
      publishUpdate: (signal) => signals.push(signal),
    });

    expect(result).toEqual({ ok: true });
    expect(signals).toEqual([{ workspaceId: 'ws-interrupted', conversationId: 'conv-newer' }]);
    expect(journal.entries.get('ws-interrupted:5')?.status).toBe('completed');
  });

  it('marks the entry terminal failed when the key write never landed', async () => {
    const { area, map } = memoryStorage();
    const journal = memoryJournal();
    const entry = interruptedEntry();

    const result = await replayUpdateWorkspace(entry, {
      storage: area,
      journal: journal.store,
      now: () => FIXED_NOW,
      // Positive control: the unrecoverable path must publish nothing at all.
      publishUpdate: () => {
        throw new Error('the replay must not signal an unlanded write');
      },
    });

    expect(result).toEqual({ ok: false, code: 'WORKSPACE_WRITE_FAILED' });
    const persisted = journal.entries.get('ws-interrupted:5');
    expect(persisted?.status).toBe('failed');
    expect(persisted?.steps[0]).toMatchObject({
      name: WORKSPACE_WRITE_STAGE_NAMES[0],
      status: 'failed',
      error: 'WORKSPACE_WRITE_FAILED',
    });
    // Nothing was written over the (absent) stored copy.
    expect(map.size).toBe(0);
  });

  it('fails the entry when the stored copy is older than the interrupted write', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    await writeWorkspaceState(state({ workspaceId: 'ws-interrupted', version: 4 }), {
      storage: area,
      journal: journal.store,
    });

    const result = await replayUpdateWorkspace(interruptedEntry(), {
      storage: area,
      journal: journal.store,
    });

    expect(result).toEqual({ ok: false, code: 'WORKSPACE_WRITE_FAILED' });
    expect(journal.entries.get('ws-interrupted:5')?.status).toBe('failed');
  });

  it('makes recoverJournal count a landed replay as replayed and an unrecoverable one as failed', async () => {
    const { area } = memoryStorage();
    const journal = memoryJournal();
    await writeWorkspaceState(state({ workspaceId: 'ws-interrupted', version: 5 }), {
      storage: area,
      journal: journal.store,
    });

    const landed = interruptedEntry();
    const unlanded = interruptedEntry({
      id: 'ws-lost:9',
      targetIds: { workspaceId: 'ws-lost', version: '9' },
      steps: [
        { name: WORKSPACE_WRITE_STAGE_NAMES[0], status: 'pending' },
        { name: WORKSPACE_WRITE_STAGE_NAMES[1], status: 'pending' },
      ],
    });
    await journal.store.persist(landed);
    await journal.store.persist(unlanded);

    const counts = await recoverJournal(
      async () => [...journal.entries.values()],
      async (entry) => {
        const replayed = await replayUpdateWorkspace(entry, { storage: area, journal: journal.store });
        if (!replayed.ok) throw new Error(replayed.code);
      },
    );

    expect(counts).toEqual({ replayed: 1, failed: 1 });
    expect(journal.entries.get('ws-interrupted:5')?.status).toBe('completed');
    expect(journal.entries.get('ws-lost:9')?.status).toBe('failed');
  });
});
