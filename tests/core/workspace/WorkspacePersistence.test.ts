// tests/core/workspace/WorkspacePersistence.test.ts — STORAGE-04 integration
// tests (D-06 rewire / D-07 recovery / §18 required "Workspace persists across
// reload + handoff" + "WriteJournal recovery test passes" DONE-whens). Imports
// the SAME buildJournalRecoveryFixture builder as the WriteJournal unit tests
// (D-21: one deterministic scenario proven at both levels). Cases:
//   1. Hydration — np_workspace seeded through the store's own journaled path
//      survives a fresh init (reload).
//   2. update() writes THROUGH the journal — a completed 'update-workspace'
//      entry lands in WriteJournalDB with targetIds {workspaceId, version} and
//      np_workspace reflects the new version.
//   3. Crash-mid-write — a seeded pending/applying journal entry (fixture crash
//      variant) is replayed by recoverWorkspaceJournal on init and np_workspace
//      converges to the entry's version (atomic-on-recovery); foreign-workspace
//      and unknown-op entries are skipped.
//   4. Cross-surface handoff — start('sidepanel') then start('standalone')
//      increments np_workspace.version each time; a fresh store init hydrates
//      the standalone activeSurface.
// Env: default jsdom-align (chrome.* via fakeBrowser + IndexedDB via
// fake-indexeddb with a fresh IDBFactory per test — RESEARCH Pattern 8).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { IDBFactory } from 'fake-indexeddb';
import { useWorkspaceStore, NP_WORKSPACE_KEY } from '@/core/workspace/WorkspaceStore';
import { openWriteJournalDB } from '@/core/storage/WriteJournal';
import { buildJournalRecoveryFixture } from '../../fixtures/index';
import type { WriteJournalEntry } from '@/types/storage';
import type { WorkspaceState } from '@/types/workspace';

function freshWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    workspaceId: 'ws-persist',
    conversationId: 'conv-persist',
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: 1000,
    ...overrides,
  };
}

function resetStore(): void {
  useWorkspaceStore.setState({ workspace: freshWorkspace(), isReady: false });
}

/** Poll until the WriteJournalDB contains a completed update-workspace entry. */
async function waitForCompletedJournalEntry(): Promise<WriteJournalEntry> {
  let found: WriteJournalEntry | undefined;
  await vi.waitFor(async () => {
    const db = await openWriteJournalDB();
    const entries = await db.getAll('entries');
    found = entries.find((e) => e.operation === 'update-workspace' && e.status === 'completed');
    expect(found).toBeDefined();
  });
  return found as WriteJournalEntry;
}

beforeEach(() => {
  indexedDB = new IDBFactory(); // fresh IndexedDB per test (RESEARCH Pattern 8)
});

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.getState().stop();
  resetStore();
});

describe('WorkspacePersistence — journaled workspace durability (D-06/D-07)', () => {
  it('hydrates np_workspace seeded through the store’s own journaled path (reload)', async () => {
    // Seed THROUGH the journal: start('standalone') routes the np_workspace
    // write through runJournaled (D-06 — the only np_workspace write path).
    await useWorkspaceStore.getState().start('standalone');
    expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('standalone');
    expect(useWorkspaceStore.getState().workspace.version).toBe(1);

    // Reload: a fresh init hydrates from the journaled np_workspace value.
    resetStore();
    await useWorkspaceStore.getState().init();

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.activeSurface).toBe('standalone');
    expect(ws.version).toBe(1);
  });

  it('update() writes THROUGH the journal — completed update-workspace entry + converged np_workspace', async () => {
    resetStore();
    useWorkspaceStore.getState().update((draft) => {
      draft.activeSurface = 'standalone';
    });

    const entry = await waitForCompletedJournalEntry();
    expect(entry.operation).toBe('update-workspace');
    expect(entry.targetIds).toEqual({ workspaceId: 'ws-persist', version: '1' });

    const stored = (await fakeBrowser.storage.local.get(NP_WORKSPACE_KEY)) as {
      np_workspace?: { version?: number; activeSurface?: string };
    };
    expect(stored.np_workspace?.version).toBe(1);
    expect(stored.np_workspace?.activeSurface).toBe('standalone');
  });

  it('recovers a crash-mid-write: replay converges np_workspace to the entry version; foreign/unknown-op entries skip', async () => {
    // Seed a pre-crash np_workspace at version 4 for the fixture workspaceId.
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 'ws-fixture-01',
        conversationId: 'conv-fixture',
        activeSurface: 'sidepanel',
        version: 4,
        updatedAt: 4000,
      },
    });
    // Seed the full fixture entry set into WriteJournalDB — the crash variant
    // (applying, version '5') must replay; the completed / foreign-workspace /
    // unknown-op entries must be skipped (D-07 matrix).
    const fixture = buildJournalRecoveryFixture();
    const db = await openWriteJournalDB();
    for (const entry of fixture.entries) {
      await db.put('entries', entry);
    }

    // init() hydrates version 4, then recoverWorkspaceJournal replays the crash
    // entry → np_workspace converges to version 5 (atomic-on-recovery).
    await useWorkspaceStore.getState().init();

    expect(useWorkspaceStore.getState().workspace.workspaceId).toBe('ws-fixture-01');
    expect(useWorkspaceStore.getState().workspace.version).toBe(5);
    const stored = (await fakeBrowser.storage.local.get(NP_WORKSPACE_KEY)) as {
      np_workspace?: { version?: number };
    };
    expect(stored.np_workspace?.version).toBe(5);

    // Replayed entries are marked completed (replay-once — the next recovery
    // pass skips them); skipped entries keep their seeded status.
    const after = await db.getAll('entries');
    const byId = new Map(after.map((e) => [e.id, e]));
    expect(byId.get('jrn-crash-before-completed')?.status).toBe('completed');
    expect(byId.get('jrn-pending')?.status).toBe('completed');
    expect(byId.get('jrn-other-workspace')?.status).toBe('applying'); // scope-skipped
    expect(byId.get('jrn-unknown-op')?.status).toBe('pending'); // op-skipped
    expect(byId.get('jrn-completed')?.status).toBe('completed');
  });

  it('persists across cross-surface handoff — start(sidepanel) then start(standalone) hydrate on fresh init', async () => {
    resetStore();
    await useWorkspaceStore.getState().start('sidepanel');
    expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('sidepanel');
    expect(useWorkspaceStore.getState().workspace.version).toBe(1);

    await useWorkspaceStore.getState().start('standalone');
    expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('standalone');
    expect(useWorkspaceStore.getState().workspace.version).toBe(2);

    const stored = (await fakeBrowser.storage.local.get(NP_WORKSPACE_KEY)) as {
      np_workspace?: { version?: number; activeSurface?: string };
    };
    expect(stored.np_workspace?.version).toBe(2);
    expect(stored.np_workspace?.activeSurface).toBe('standalone');

    // Fresh store init hydrates the standalone activeSurface (cross-surface
    // handoff persistence — §18 DONE-when).
    resetStore();
    await useWorkspaceStore.getState().init();
    expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('standalone');
    expect(useWorkspaceStore.getState().workspace.version).toBe(2);
  });
});
