// tests/core/workspace/WorkspaceSync.test.ts — WorkspaceSync (Appendix M.3) tests
// (WSPC-02): store changes publish WORKSPACE_UPDATED with a bumped version; remote
// WORKSPACE_UPDATED adopts with version-LWW (higher wins, lower/equal ignored)
// through the T-1-13 sanitizer + M.3 workspaceId scope gate (foreign workspaceId
// and malformed state are ignored — WR-04); requestHandoff publishes
// WORKSPACE_HANDOFF via the whitelisted bridge and a PONG from the target completes
// the handoff (SHOW_HANDOFF_COMPLETE); a missing PONG transitions to electionFailed
// (T-1-14); non-whitelist message types are ignored (Pitfall 5 / T-1-12); mirroring
// emits WORKSPACE_MIRRORING_START/STOP. Drives the fakeBrowser runtime channel
// (01-03 precedent). Node env — pure logic, no DOM.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { WorkspaceSync, HANDOFF_TIMEOUT_MS } from '@/core/workspace/WorkspaceSync';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { broadcastBus } from '@/core/runtime/BroadcastBus';
import { MessageType } from '@/core/runtime/MessageType';
import { MessageBusBridge } from '@/core/messaging/MessageBusBridge';
import { getEventBus } from '@/core/events/EventBusManager';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { WorkspaceState } from '@/types/workspace';

function freshWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    workspaceId: 'ws-local',
    conversationId: 'conv-local',
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: 1000,
    ...overrides,
  };
}

function envelope(type: string, payload: unknown): RuntimeEnvelope {
  return {
    id: 'op-1',
    type: type as RuntimeEnvelope['type'],
    createdAt: 1710000000000,
    source: 'standalone',
    payload,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  // The useWorkspaceStore singleton persists across tests — reset it each run.
  useWorkspaceStore.setState({ workspace: freshWorkspace(), isReady: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WorkspaceSync', () => {
  it('a store change publishes WORKSPACE_UPDATED with a bumped version', async () => {
    const sync = new WorkspaceSync('sidepanel');
    const received: Array<{ state: WorkspaceState; from: string; mirror?: boolean }> = [];
    const unsubscribe = broadcastBus.on(MessageType.WORKSPACE_UPDATED, (payload) => {
      received.push(payload as { state: WorkspaceState; from: string; mirror?: boolean });
    });
    sync.start();

    useWorkspaceStore.getState().setActiveSurface('standalone');
    await flush();

    expect(received.length).toBeGreaterThan(0);
    const last = received[received.length - 1];
    expect(last.state.version).toBe(1);
    expect(last.from).toBe('sidepanel');

    unsubscribe();
    sync.stop();
  });

  it('a WORKSPACE_UPDATED with a higher remote version merges into the store', async () => {
    const sync = new WorkspaceSync('sidepanel');
    sync.start();

    // Same-workspace fixture (the M.3 scope gate requires workspaceId to match
    // the local one — the other fields still assert the merge).
    const remote = freshWorkspace({
      workspaceId: 'ws-local',
      conversationId: 'conv-remote',
      activeSurface: 'standalone',
      version: 9,
      updatedAt: 9000,
    });
    await fakeBrowser.runtime.sendMessage(
      envelope(MessageType.WORKSPACE_UPDATED, { state: remote, from: 'standalone' }),
    );

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe('ws-local');
    expect(ws.conversationId).toBe('conv-remote');
    expect(ws.activeSurface).toBe('standalone');
    expect(ws.version).toBe(9);

    sync.stop();
  });

  it('a WORKSPACE_UPDATED from a foreign workspaceId is ignored (M.3 scope gate)', async () => {
    const sync = new WorkspaceSync('sidepanel');
    sync.start();

    const remote = freshWorkspace({
      workspaceId: 'ws-foreign',
      conversationId: 'conv-foreign',
      activeSurface: 'standalone',
      version: 99,
      updatedAt: 99000,
    });
    await fakeBrowser.runtime.sendMessage(
      envelope(MessageType.WORKSPACE_UPDATED, { state: remote, from: 'standalone' }),
    );

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe('ws-local');
    expect(ws.version).toBe(0);

    sync.stop();
  });

  it('a malformed WORKSPACE_UPDATED state payload is ignored (T-1-13)', async () => {
    const sync = new WorkspaceSync('sidepanel');
    sync.start();

    // Missing workspaceId/conversationId/activeSurface — fails sanitizeStored.
    await fakeBrowser.runtime.sendMessage(
      envelope(MessageType.WORKSPACE_UPDATED, { state: { version: 99 }, from: 'standalone' }),
    );

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe('ws-local');
    expect(ws.version).toBe(0);

    sync.stop();
  });

  it('a lower/equal remote version is ignored (LWW)', async () => {
    const sync = new WorkspaceSync('sidepanel');
    sync.start();
    const localId = useWorkspaceStore.getState().workspace.workspaceId;

    // Same-workspace fixture (WR-13): the M.3 scope gate is passed, so the
    // version <= local.version LWW branch is what rejects the snapshot.
    const stale = freshWorkspace({ workspaceId: 'ws-local', version: 0, updatedAt: 100 });
    await fakeBrowser.runtime.sendMessage(
      envelope(MessageType.WORKSPACE_UPDATED, { state: stale, from: 'standalone' }),
    );

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe(localId);
    expect(ws.version).toBe(0);

    sync.stop();
  });

  it('requestHandoff publishes WORKSPACE_HANDOFF and a PONG from the target completes it', async () => {
    const sync = new WorkspaceSync('sidepanel');
    sync.start();
    const events = getEventBus();
    const pendingSpy = vi.fn();
    const completeSpy = vi.fn();
    events.subscribe('SHOW_HANDOFF_PENDING', pendingSpy);
    events.subscribe('SHOW_HANDOFF_COMPLETE', completeSpy);

    // Observe the WORKSPACE_HANDOFF publish on the bridge channel.
    const observerBridge = new MessageBusBridge();
    const handoffSpy = vi.fn();
    observerBridge.subscribe((msg) => {
      if (msg.type === 'WORKSPACE_HANDOFF') handoffSpy(msg);
    });

    await sync.requestHandoff('standalone');
    await flush();

    expect(pendingSpy).toHaveBeenCalled();
    expect(handoffSpy).toHaveBeenCalled();
    expect(sync.getHandoffState()).toBe('pending');

    // The target surface replies with PONG.
    await fakeBrowser.runtime.sendMessage(
      envelope(MessageType.PONG, { source: 'standalone', target: 'sidepanel' }),
    );

    expect(sync.getHandoffState()).toBe('complete');
    expect(completeSpy).toHaveBeenCalled();

    sync.stop();
  });

  it('a missing PONG transitions handoff state to electionFailed (T-1-14)', async () => {
    vi.useFakeTimers();
    const sync = new WorkspaceSync('sidepanel');
    sync.start();
    const failSpy = vi.fn();
    getEventBus().subscribe('WORKSPACE_ELECTION_FAILED', failSpy);

    await sync.requestHandoff('standalone');
    vi.advanceTimersByTime(HANDOFF_TIMEOUT_MS + 10);
    await flush();

    expect(sync.getHandoffState()).toBe('electionFailed');
    expect(failSpy).toHaveBeenCalled();

    sync.stop();
  });

  it('a non-whitelist message type is ignored (no handler invocation)', async () => {
    const sync = new WorkspaceSync('sidepanel');
    sync.start();
    const completeSpy = vi.fn();
    getEventBus().subscribe('SHOW_HANDOFF_COMPLETE', completeSpy);

    await fakeBrowser.runtime.sendMessage(envelope('NOT_A_CANONICAL_TYPE', { evil: true }));
    await flush();

    expect(sync.getHandoffState()).toBe('idle');
    expect(completeSpy).not.toHaveBeenCalled();

    sync.stop();
  });

  it('startMirroring/stopMirroring emit WORKSPACE_MIRRORING_START/STOP events', () => {
    const sync = new WorkspaceSync('sidepanel');
    const events = getEventBus();
    const startSpy = vi.fn();
    const stopSpy = vi.fn();
    events.subscribe('WORKSPACE_MIRRORING_START', startSpy);
    events.subscribe('WORKSPACE_MIRRORING_STOP', stopSpy);

    sync.startMirroring();
    expect(startSpy).toHaveBeenCalled();

    sync.stopMirroring();
    expect(stopSpy).toHaveBeenCalled();
  });
});
