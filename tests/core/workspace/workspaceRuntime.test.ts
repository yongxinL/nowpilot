import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WORKSPACE_CHANNEL,
  WORKSPACE_STORAGE_KEY,
  readWorkspaceState,
  writeWorkspaceState,
} from '../../../src/core/workspace/WorkspacePersistence';
import { useWorkspaceStore } from '../../../src/core/workspace/WorkspaceStore';
import {
  __test__ as runtimeTest,
  establishWorkspaceIdentity,
  startWorkspaceRuntime,
} from '../../../src/core/workspace/workspaceRuntime';
import {
  createWriterElection,
  setActiveWriterElection,
  type WriterElection,
} from '../../../src/core/workspace/WriterElection';
import {
  createInitialWorkspaceState,
  type WorkspaceState,
} from '../../../src/core/workspace/WorkspaceState';
import {
  flushPendingWrites,
  __test__ as adapterTest,
} from '../../../src/core/theme/chromeStorageAdapter';
import { closeDb, getDb, __test__ as dbTest } from '../../../src/core/storage/NowPilotDB';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * workspaceRuntime suite — CR-02, the phase's production wiring for
 * `np_workspace`.
 *
 * Proves ROADMAP success criterion 4 at the integration level the shipped build
 * runs: the durable copy is hydrated before the first election, every authorised
 * mutation persists through the real journaled repository behind the real
 * election gate, a URL bootstrap is never rolled back by an older stored copy,
 * and the narrow cross-surface signal moves the projection forward only.
 *
 * Every seam is the production one — the real store, the real
 * `WorkspacePersistence`, the real `WriterElection`, the real debounced adapter
 * and the real `np_db` journal over the deterministic IndexedDB double.
 */

const localMap = () =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;

const sessionMap = () =>
  (globalThis as unknown as { __chromeStorageSessionMap: Map<string, unknown> })
    .__chromeStorageSessionMap;

/** A durable state with a fixed identity the assertions can name. */
function durableState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    ...createInitialWorkspaceState(),
    workspaceId: 'ws-durable',
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** Settle the runtime's scheduled microtask, the write chain and the debounce. */
async function settle(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
  await flushPendingWrites();
}

/** Read the durable copy, or null when the store is unreadable. */
async function readDurable(): Promise<WorkspaceState | null> {
  const read = await readWorkspaceState();
  return read.ok ? read.value : null;
}

/**
 * Poll until the durable copy satisfies every named field. The runtime persists
 * off-microtask (the journal is IndexedDB), so the assertion waits on the real
 * outcome instead of guessing a turn count — no arbitrary sleep.
 */
async function waitForDurable(expected: Partial<WorkspaceState>): Promise<WorkspaceState> {
  let matched: WorkspaceState | null = null;
  await vi.waitFor(async () => {
    const current = await readDurable();
    const holds =
      current !== null &&
      Object.entries(expected).every(
        ([key, value]) => (current as unknown as Record<string, unknown>)[key] === value,
      );
    if (holds) matched = current;
    expect(holds).toBe(true);
  });
  return matched as unknown as WorkspaceState;
}

/** Poll until `check` resolves true. */
async function waitUntil(check: () => Promise<boolean>): Promise<void> {
  await vi.waitFor(async () => {
    expect(await check()).toBe(true);
  });
}

/** Register and elect a primary for this document, and await its establishment. */
async function electPrimary(tabId = 11): Promise<WriterElection> {
  const election = createWriterElection({ surface: 'sidepanel', tabId });
  setActiveWriterElection(election);
  await startWorkspaceRuntime();
  await election.elect();
  void useWorkspaceStore.getState().applyElectionOutcome(election.coordinationState());
  await waitUntil(async () => ((await readDurable())?.version ?? 0) >= 1);
  await vi.waitFor(async () => {
    expect(await (await getDb()).getAll('entries')).toHaveLength(1);
  });
  return election;
}

beforeEach(async () => {
  await flushPendingWrites();
  adapterTest.resetPendingState();
  localMap().clear();
  sessionMap().clear();
  clearLogs();
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  dbTest.reset();
  closeDb();
  setActiveWriterElection(null);
  runtimeTest.reset();
  useWorkspaceStore.getState().reset();
});

afterEach(async () => {
  await flushPendingWrites();
  adapterTest.resetPendingState();
  setActiveWriterElection(null);
  runtimeTest.reset();
  closeDb();
  dbTest.reset();
});

describe('workspaceRuntime — hydrate before the first election', () => {
  it('installs the durable identity and write counter, and start is idempotent', async () => {
    const durable = durableState({ version: 4, conversationId: 'conv-durable' });
    expect((await writeWorkspaceState(durable)).ok).toBe(true);

    await startWorkspaceRuntime();
    await startWorkspaceRuntime();

    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBe('ws-durable');
    expect(state.conversationId).toBe('conv-durable');
    expect(state.version).toBe(4);

    // A fresh document with no durable copy keeps its own minted identity until
    // it is established (it is not replaced by the reader's initial state).
    runtimeTest.reset();
    await flushPendingWrites();
    localMap().clear();
    useWorkspaceStore.getState().reset();
    const minted = useWorkspaceStore.getState().workspaceId;
    await startWorkspaceRuntime();
    expect(useWorkspaceStore.getState().workspaceId).toBe(minted);
  });

  it('never rolls back a URL bootstrap that is newer than the stored copy', async () => {
    expect(
      (await writeWorkspaceState(durableState({ workspaceId: 'ws-old', version: 1 }))).ok,
    ).toBe(true);

    // The document applies its handoff bootstrap first (two counter bumps).
    const store = useWorkspaceStore.getState();
    store.setWorkspaceId('ws-bootstrap');
    store.setConversationId('conv-bootstrap');
    expect(useWorkspaceStore.getState().version).toBe(2);

    await startWorkspaceRuntime();

    // The bootstrap is kept: the stored copy is older, so it does not win.
    expect(useWorkspaceStore.getState().workspaceId).toBe('ws-bootstrap');
    expect(useWorkspaceStore.getState().conversationId).toBe('conv-bootstrap');
    expect(useWorkspaceStore.getState().version).toBe(2);
  });
});

describe('workspaceRuntime — the establishment write on authority (D2-34)', () => {
  it('establishes the projection once the surface becomes primary', async () => {
    const minted = useWorkspaceStore.getState().workspaceId;

    await electPrimary();

    const durable = await waitForDurable({ workspaceId: minted, version: 1 });
    await flushPendingWrites();
    expect(localMap().has(WORKSPACE_STORAGE_KEY)).toBe(true);

    // The entry is §20.3's, completed with both stages.
    await waitUntil(
      async () => (await (await getDb()).get('entries', `${durable.workspaceId}:1`))?.status === 'completed',
    );
    const entry = await (await getDb()).get('entries', `${minted}:1`);
    expect(entry?.operation).toBe('update-workspace');
    expect(entry?.steps.map((step) => step.status)).toEqual(['completed', 'completed']);

    // The projection adopted the persisted counter, so a later establishment is
    // a no-op while the durable copy is not behind.
    expect(useWorkspaceStore.getState().version).toBe(1);
    await establishWorkspaceIdentity();
    await settle();
    expect((await getDb()).getAll('entries')).resolves.toHaveLength(1);
  });

  it('holds the establishment while no authoritative election is registered', async () => {
    await startWorkspaceRuntime();

    await establishWorkspaceIdentity();
    await settle();

    // Nothing was written: the gate resolved the typed rejection.
    expect(localMap().has(WORKSPACE_STORAGE_KEY)).toBe(false);
    expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_WRITER_REJECTED')).toBe(true);
    expect(runtimeTest.durableVersion()).toBe(-1);
  });
});

describe('workspaceRuntime — authorised mutations persist behind the gate', () => {
  it('persists a store mutation through the journaled path with a strictly greater version', async () => {
    await electPrimary();
    const before = useWorkspaceStore.getState();

    useWorkspaceStore.getState().setConversationId('conv-mutated');

    const durable = await waitForDurable({
      conversationId: 'conv-mutated',
      version: before.version + 1,
      workspaceId: before.workspaceId,
    });
    await flushPendingWrites();

    await waitUntil(
      async () =>
        (await (await getDb()).get('entries', `${durable.workspaceId}:${durable.version}`))?.status ===
        'completed',
    );
    // Two journaled writes exist: the establishment (v1) and the mutation (v2).
    const entries = await (await getDb()).getAll('entries');
    expect(entries.map((entry) => entry.id)).toEqual([
      `${before.workspaceId}:${before.version}`,
      `${before.workspaceId}:${before.version + 1}`,
    ]);
    expect(entries[1]?.operation).toBe('update-workspace');
  });

  it('degrades without an unhandled rejection when IndexedDB cannot open, then recovers (WR-06, §19.10)', async () => {
    await electPrimary();
    const before = useWorkspaceStore.getState().version;

    // The database cannot open: a fresh factory plus the migrator's own failure
    // seam aborts the upgrade — the real §19.10 blocked/unavailable path, not a
    // stubbed one.
    dbTest.reset();
    (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
    dbTest.setMigrationFailure(() => {
      throw new Error('synthetic-injected-migration-failure');
    });

    useWorkspaceStore.getState().setConversationId('conv-degraded');
    await settle();

    // The failure reached the typed path: no rejection escaped the
    // fire-and-forget call site.
    await vi.waitFor(() => {
      expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_JOURNAL_FAILED')).toBe(true);
    });
    const degraded = await readDurable();
    expect(degraded?.version).toBe(before);
    expect(degraded?.conversationId).not.toBe('conv-degraded');

    // The establishment path is equally total: it resolves rather than rejecting.
    await expect(establishWorkspaceIdentity()).resolves.toBeUndefined();

    // Once the database opens again, the next mutation persists.
    dbTest.setMigrationFailure(null);
    useWorkspaceStore.getState().setConversationId('conv-recovered');
    const recovered = await waitForDurable({ conversationId: 'conv-recovered' });
    expect(recovered.version).toBeGreaterThan(before);
  });

  it('holds every mutation when this surface is not the authoritative writer', async () => {
    // Registered but secondary: another surface holds a fresh record.
    sessionMap().set('np_workspace_primary', {
      tabId: 99,
      surface: 'standalone',
      electedAt: Date.now(),
    });
    const election = createWriterElection({ surface: 'sidepanel', tabId: 11 });
    setActiveWriterElection(election);
    await startWorkspaceRuntime();
    await election.elect();
    useWorkspaceStore.getState().applyElectionOutcome(election.coordinationState());
    await settle();

    useWorkspaceStore.getState().setConversationId('conv-held');
    await settle();

    expect(localMap().has(WORKSPACE_STORAGE_KEY)).toBe(false);
    expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_WRITER_REJECTED')).toBe(true);
  });
});

describe('workspaceRuntime — the narrow cross-surface signal (D2-31)', () => {
  it('installs a newer durable copy delivered by the signal and never rolls back', async () => {
    await startWorkspaceRuntime();
    const local = useWorkspaceStore.getState();
    expect(local.version).toBe(0);

    // The opposite surface advances the durable copy.
    const other = durableState({
      workspaceId: local.workspaceId,
      version: 9,
      conversationId: 'conv-other',
    });
    expect((await writeWorkspaceState(other)).ok).toBe(true);
    await flushPendingWrites();

    (
      globalThis as unknown as { __broadcast: (channel: string, data: unknown) => void }
    ).__broadcast(WORKSPACE_CHANNEL, {
      workspaceId: other.workspaceId,
      conversationId: other.conversationId,
    });

    await waitUntil(async () => useWorkspaceStore.getState().version === 9);
    expect(useWorkspaceStore.getState().conversationId).toBe('conv-other');

    // The install is not written back: no journal entry was created for it.
    const entries = await (await getDb()).getAll('entries');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe(`${other.workspaceId}:9`);
  });

  it('ignores a signal whose stored copy is not newer than this projection', async () => {
    const current = durableState({ workspaceId: 'ws-signal', version: 3, conversationId: 'conv-3' });
    expect((await writeWorkspaceState(current)).ok).toBe(true);
    await flushPendingWrites();

    await startWorkspaceRuntime();
    expect(useWorkspaceStore.getState().version).toBe(3);

    (
      globalThis as unknown as { __broadcast: (channel: string, data: unknown) => void }
    ).__broadcast(WORKSPACE_CHANNEL, { workspaceId: 'ws-signal', conversationId: 'conv-3' });
    await settle();

    expect(useWorkspaceStore.getState().version).toBe(3);
    expect(useWorkspaceStore.getState().conversationId).toBe('conv-3');
  });
});
