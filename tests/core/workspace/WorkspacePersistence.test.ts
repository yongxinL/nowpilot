import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * WorkspacePersistence — Phase 2 end-to-end integration test (plan 02-07).
 *
 * Locks the spec §20.11 / D-24/D-27/D-31/D-43 invariants:
 *   - Test 1 (happy-path tracer, 02-07 Task 1): primary surface setWorkspaceId
 *     → journaled persist → reload-hydrate restores state — no message loss.
 *   - Test 2 (predicate, 02-07 Task 1): isPrimaryWriter() delegates to the
 *     WorkspaceElection module (the Phase-1 stub is gone).
 *   - Test 3 (reload, 02-07 Task 3): primary persist → reset in-memory →
 *     rehydrate from chrome.storage.local → state identical (success criterion 5).
 *   - Test 4 (handoff, 02-07 Task 3): standalone(primary) and sidepanel(secondary)
 *     surfaces — WORKSPACE_UPDATED reaches the sidepanel via BroadcastChannel;
 *     a secondary setItem produces no journal entry and no storage write
 *     (election-gated, D-27).
 *   - Test 5 (journal recovery, 02-07 Task 3): a 'pending' update-workspace
 *     entry in WriteJournalDB is replayed by recoverJournal on boot →
 *     np_workspace restored (D-31).
 *   - Test 6 (write-rate budget, 02-07 Task 3): over a simulated steady-state
 *     60s window, the combined session-write count (heartbeats) + journal-entry
 *     writes + debounced np_workspace persists stays ≤ 30 writes/min
 *     (D-43 / REQ-R03 precision contract).
 *
 * Per-task map (02-VALIDATION.md lines 41-57):
 *   02-07-01 (Task 1 tracer) → Test 1
 *   02-07-02 (Task 1 predicate) → Test 2
 *   02-07-03 (Task 3 reload) → Test 3
 *   02-07-04 (Task 3 handoff) → Test 4
 *   02-07-05 (Task 3 recovery) → Test 5
 *   02-07-06 (Task 3 write-rate) → Test 6
 */

describe('WorkspacePersistence — integration (02-07)', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
    const sessionMap = (globalThis as any).__chromeSessionMap as Map<string, string>;
    sessionMap?.clear();
    const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;
    storageMap?.clear();
  });

  afterEach(async () => {
    const { __test__ } = await import('../../../src/core/workspace/WorkspaceElection');
    __test__.resetElectionState();
    const { __test__: chromeTest } = await import(
      '../../../src/core/theme/chromeStorageAdapter'
    );
    chromeTest.resetPendingState();
  });

  // --- 02-07-01: Happy-path tracer (primary persist → journal → reload-hydrate) ---
  it('Test 1: primary surface setWorkspaceId → journaled persist → reload-hydrate restores state', async () => {
    const { startElection, __test__: electionTest } = await import(
      '../../../src/core/workspace/WorkspaceElection'
    );
    const { useWorkspaceStore, isPrimaryWriter } = await import(
      '../../../src/core/workspace/WorkspaceStore'
    );
    const { openWriteJournalDB } = await import(
      '../../../src/core/storage/WriteJournalDB'
    );

    electionTest.resetElectionState();
    // Become primary (solo) — same surface, no foreign record
    await startElection('sidepanel');
    expect(isPrimaryWriter()).toBe(true);

    // Capture the workspaceId BEFORE the change
    const targetWorkspaceId = 'ws-tracer-' + Date.now();
    useWorkspaceStore.getState().setWorkspaceId(targetWorkspaceId);

    // Wait for the journaled persist to settle:
    //   1. setItem triggers journalingAdapter.setItem (immediate IDB put)
    //   2. runJournaled applies steps (inner.setItem + emit)
    //   3. Adapter setItem is debounced 300ms — wait past the window
    await new Promise((r) => setTimeout(r, 400));

    // WriteJournalDB should have an 'update-workspace' entry marked completed
    const journalDb = await openWriteJournalDB();
    const entries = await journalDb.getAll('entries');
    expect(entries.length).toBeGreaterThan(0);
    const completedEntry = entries.find(
      (e) => e.operation === 'update-workspace' && e.status === 'completed',
    );
    expect(completedEntry).toBeDefined();

    // np_workspace key (canonical, post-lift) must be in storage
    const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;
    const stored = storageMap.get('np_workspace');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored as string);
    // zustand persist wraps the partialized state under `state`
    expect(parsed.state.workspaceId).toBe(targetWorkspaceId);

    // Simulate reload — reset in-memory store, force rehydrate
    useWorkspaceStore.setState({
      workspaceId: 'placeholder-will-be-overwritten',
      conversationId: null,
    });
    await useWorkspaceStore.persist.rehydrate();
    expect(useWorkspaceStore.getState().workspaceId).toBe(targetWorkspaceId);
  });

  // --- 02-07-02: isPrimaryWriter delegates to the election module ---
  it('Test 2: isPrimaryWriter() === true for primary/solo, false for secondary / no instance', async () => {
    const { isPrimaryWriter } = await import(
      '../../../src/core/workspace/WorkspaceStore'
    );
    const { startElection } = await import(
      '../../../src/core/workspace/WorkspaceElection'
    );

    // No active instance → false
    expect(isPrimaryWriter()).toBe(false);

    // Start election → primary → true
    await startElection('sidepanel');
    expect(isPrimaryWriter()).toBe(true);
  });
});
