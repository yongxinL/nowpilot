import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useWorkspaceStore } from '../../../src/core/workspace/WorkspaceStore';
import { isPrimaryWriter } from '../../../src/core/workspace/WorkspaceStore';
import * as BroadcastBus from '../../../src/core/runtime/BroadcastBus';
import {
  HANDOFF_CHANNEL,
  HANDOFF_SCHEMA_VERSION,
  HANDOFF_TIMEOUT_MS,
  HANDOFF_MAX_RETRIES,
  type HandoffEnvelope,
} from '../../../src/core/workspace/handoff/protocol';

// Mock chrome API — callback-style (matches WorkspaceRouter.ts convention)
const chromeApi = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: undefined as { message: string } | undefined,
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  windows: {
    update: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeApi);

// Import AFTER stubbing chrome so WorkspaceRouter.ts sees the mock
import {
  openStandalone,
  openOptions,
  hydrateFromURL,
} from '../../../src/core/workspace/WorkspaceRouter';

const broadcast = (payload: unknown): void => {
  (globalThis as unknown as { __broadcast: (channel: string, data: unknown) => void }).__broadcast(
    HANDOFF_CHANNEL,
    payload,
  );
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

const ready = (requestId: string): HandoffEnvelope => ({
  type: 'HANDOFF_READY',
  requestId,
  workspaceId: 'ws1',
  sourceSurface: 'sidepanel',
  targetSurface: 'standalone',
  supportedSchemaVersion: HANDOFF_SCHEMA_VERSION,
});

const ack = (requestId: string): HandoffEnvelope => ({
  type: 'HANDOFF_ACK',
  requestId,
  appliedSchemaVersion: HANDOFF_SCHEMA_VERSION,
  result: { ok: true },
});

const transfer = (requestId: string, workspaceId = 'ws1'): HandoffEnvelope => ({
  type: 'WORKSPACE_HANDOFF',
  requestId,
  schemaVersion: HANDOFF_SCHEMA_VERSION,
  projection: {
    workspaceId,
    conversationId: 'conv-9',
    sourceSurface: 'sidepanel',
    targetSurface: 'standalone',
    activeRoute: 'chat',
    composerDraft: 'a private draft',
    requestId,
    schemaVersion: HANDOFF_SCHEMA_VERSION,
  },
});

function createdUrl(): string {
  const options = chromeApi.tabs.create.mock.calls[0]?.[0] as { url: string };
  return options.url;
}

function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
}

function publishedOf(type: string): HandoffEnvelope[] {
  return publishSpy.mock.calls
    .filter(
      ([channel, payload]) =>
        channel === HANDOFF_CHANNEL &&
        typeof payload === 'object' &&
        payload !== null &&
        (payload as { type?: string }).type === type,
    )
    .map(([, payload]) => payload as HandoffEnvelope);
}

let publishSpy: ReturnType<typeof vi.spyOn>;

function stubCreatePath(tabId = 99): void {
  chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]));
  chromeApi.tabs.create.mockImplementation(
    (_opts: chrome.tabs.CreateProperties, cb: (tab: chrome.tabs.Tab) => void) =>
      cb({ id: tabId, windowId: 7 } as chrome.tabs.Tab),
  );
}

function stubExistingTab(tab: chrome.tabs.Tab = { id: 123, windowId: 5 } as chrome.tabs.Tab): void {
  chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([tab]));
  chromeApi.tabs.update.mockImplementation(
    (_id: number, _props: chrome.tabs.UpdateProperties, cb?: () => void) => cb?.(),
  );
  chromeApi.windows.update.mockImplementation(
    (_id: number, _props: chrome.windows.UpdateInfo, cb?: (w: chrome.windows.Window) => void) =>
      cb?.({} as chrome.windows.Window),
  );
}

describe('WorkspaceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeApi.runtime.lastError = undefined;
    useWorkspaceStore.getState().reset();
    vi.useFakeTimers();
    publishSpy = vi.spyOn(BroadcastBus, 'publish');
  });

  afterEach(async () => {
    // Let every in-flight handshake reach its bounded failure and dispose, so
    // no listener or timer leaks into the next case.
    await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS * (HANDOFF_MAX_RETRIES + 2));
    await flush();
    publishSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('openStandalone — dedupe, focus and create-once (D-04, D-07, D-12)', () => {
    it('queries by standalone.html (not the legacy app.html)', () => {
      stubCreatePath();

      openStandalone('ws1');

      const queryArg = chromeApi.tabs.query.mock.calls[0]?.[0] as { url?: string };
      expect(queryArg.url).toContain('standalone.html');
      expect(queryArg.url).not.toContain('app.html');
    });

    it('creates exactly one tab whose URL carries only the approved bootstrap identifiers', () => {
      stubCreatePath();

      openStandalone('ws1', 'c1', 'chat');

      expect(chromeApi.tabs.create).toHaveBeenCalledTimes(1);
      const params = queryOf(createdUrl());
      expect(createdUrl()).toContain('standalone.html?');
      expect([...params.keys()].sort()).toEqual(
        ['conversationId', 'page', 'requestId', 'schemaVersion', 'source', 'target', 'workspaceId'].sort(),
      );
      expect(params.get('workspaceId')).toBe('ws1');
      expect(params.get('conversationId')).toBe('c1');
      expect(params.get('page')).toBe('chat');
      expect(params.get('requestId')).toBeTruthy();
      expect(params.get('schemaVersion')).toBe(String(HANDOFF_SCHEMA_VERSION));
      // The draft never travels through the URL.
      expect(createdUrl()).not.toContain('draft');
      // Cross-window focus must NOT happen on the create path.
      expect(chromeApi.windows.update).not.toHaveBeenCalled();
    });

    it('focuses the existing tab (no duplicate create) and cross-window focuses when found', () => {
      stubExistingTab();

      openStandalone('ws1');

      expect(chromeApi.tabs.update).toHaveBeenCalledWith(123, { active: true }, expect.any(Function));
      expect(chromeApi.windows.update).toHaveBeenCalledWith(5, { focused: true }, expect.any(Function));
      expect(chromeApi.tabs.create).not.toHaveBeenCalled();
    });

    it('records openedStandaloneTabId on the store', () => {
      stubCreatePath(77);

      openStandalone('ws1');

      const state = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
      expect(state.openedStandaloneTabId).toBe(77);
    });

    it('does not create a second Standalone tab for a repeated open', () => {
      stubExistingTab();

      openStandalone('ws1');
      openStandalone('ws1');

      expect(chromeApi.tabs.create).not.toHaveBeenCalled();
      expect(chromeApi.tabs.update).toHaveBeenCalledTimes(2);
    });

    it('reports STANDALONE_OPEN_FAILED when tabs.query surfaces chrome.runtime.lastError', async () => {
      chromeApi.tabs.query.mockImplementation(
        (_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => {
          chromeApi.runtime.lastError = { message: 'fake query error' };
          cb([]);
          chromeApi.runtime.lastError = undefined;
        },
      );
      const onSettled = vi.fn();

      openStandalone('ws1', undefined, undefined, { onSettled });
      await flush();

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled.mock.calls[0]?.[0]).toEqual({
        ok: false,
        code: 'STANDALONE_OPEN_FAILED',
        error: 'fake query error',
      });
      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(0);
    });

    it('reports STANDALONE_OPEN_FAILED when tabs.create surfaces chrome.runtime.lastError', async () => {
      chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]));
      chromeApi.tabs.create.mockImplementation(
        (_opts: chrome.tabs.CreateProperties, cb: (tab: chrome.tabs.Tab) => void) => {
          chromeApi.runtime.lastError = { message: 'fake create error' };
          cb({} as chrome.tabs.Tab);
          chromeApi.runtime.lastError = undefined;
        },
      );
      const onSettled = vi.fn();

      openStandalone('ws1', undefined, undefined, { onSettled });
      await flush();

      expect(onSettled.mock.calls[0]?.[0]).toEqual({
        ok: false,
        code: 'STANDALONE_OPEN_FAILED',
        error: 'fake create error',
      });
    });
  });

  describe('openStandalone — acknowledgement-gated success (D-13, T-1-34)', () => {
    it('publishes the transfer only after readiness and claims success only after the acknowledgement', async () => {
      stubCreatePath();
      const onSettled = vi.fn();

      openStandalone('ws1', 'c1', undefined, { onSettled });
      await flush();

      // Cold start: nothing is published immediately after tabs.create.
      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(0);

      const requestId = queryOf(createdUrl()).get('requestId') ?? '';
      broadcast(ready(requestId));
      await flush();

      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(1);
      expect(onSettled).not.toHaveBeenCalled();

      broadcast(ack(requestId));
      await flush();

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled.mock.calls[0]?.[0]).toEqual({ ok: true });
    });

    it('retries the transfer after the bounded timeout and succeeds on a later acknowledgement', async () => {
      stubCreatePath();
      const onSettled = vi.fn();

      openStandalone('ws1', undefined, undefined, { onSettled });
      await flush();
      const requestId = queryOf(createdUrl()).get('requestId') ?? '';
      broadcast(ready(requestId));
      await flush();
      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
      await flush();
      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(2);

      broadcast(ack(requestId));
      await flush();
      expect(onSettled.mock.calls[0]?.[0]).toEqual({ ok: true });
    });

    it('reports the typed recoverable failure when readiness never arrives and leaves the Side Panel writable', async () => {
      stubCreatePath();
      useWorkspaceStore.getState().setConversationId('draft-conversation');
      const onSettled = vi.fn();

      openStandalone('ws1', 'draft-conversation', undefined, { onSettled });
      await flush();
      await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
      await flush();

      expect(onSettled).toHaveBeenCalledTimes(1);
      const result = onSettled.mock.calls[0]?.[0] as { ok: false; code: string };
      expect(result.ok).toBe(false);
      expect(result.code).toBe('WORKSPACE_HANDOFF_FAILED');
      // No success claim, no store mutation, no fabricated demotion.
      expect(useWorkspaceStore.getState().conversationId).toBe('draft-conversation');
      expect(isPrimaryWriter()).toBe(true);
      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(0);
    });

    it('reports the typed failure when the acknowledgement never arrives, after the bounded attempts', async () => {
      stubCreatePath();
      const onSettled = vi.fn();

      openStandalone('ws1', undefined, undefined, { onSettled });
      await flush();
      const requestId = queryOf(createdUrl()).get('requestId') ?? '';
      broadcast(ready(requestId));
      await flush();

      for (let i = 0; i <= HANDOFF_MAX_RETRIES; i += 1) {
        await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
        await flush();
      }

      expect(publishedOf('WORKSPACE_HANDOFF')).toHaveLength(1 + HANDOFF_MAX_RETRIES);
      const result = onSettled.mock.calls[0]?.[0] as { ok: false; code: string };
      expect(result.code).toBe('WORKSPACE_HANDOFF_FAILED');
    });
  });

  describe('openOptions — Standalone options route (§5.4)', () => {
    it('opens the Standalone options route instead of the removed options.html', () => {
      stubCreatePath();

      openOptions();

      expect(chromeApi.tabs.create).toHaveBeenCalledTimes(1);
      expect(createdUrl()).toContain('standalone.html?page=options');
      expect(createdUrl()).not.toContain('options.html');
    });
  });

  describe('WorkspaceRouter source — one validated URL path', () => {
    it('builds URLs with buildHandoffUrl and never with ad-hoc URLSearchParams construction', () => {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), 'src/core/workspace/WorkspaceRouter.ts'),
        'utf8',
      );

      expect(source).toContain('buildHandoffUrl');
      expect(source).toContain('parseHandoffUrl');
      expect(source).not.toContain('new URLSearchParams(');
    });
  });

  describe('hydrateFromURL — validated bootstrap, no partial application (H2, T-1-31)', () => {
    it('goes through setWorkspaceId (subscribers fire)', () => {
      const subscriber = vi.fn();
      const unsubscribe = useWorkspaceStore.subscribe(subscriber);
      subscriber.mockClear();

      hydrateFromURL(new URLSearchParams('workspaceId=ws2&conversationId=c1'));

      const state = useWorkspaceStore.getState();
      expect(state.workspaceId).toBe('ws2');
      expect(state.conversationId).toBe('c1');
      expect(subscriber).toHaveBeenCalled();

      unsubscribe();
    });

    it('is a no-op when no bootstrap is present', () => {
      const beforeWsId = useWorkspaceStore.getState().workspaceId;
      const beforeConvId = useWorkspaceStore.getState().conversationId;

      hydrateFromURL(new URLSearchParams(''));

      expect(useWorkspaceStore.getState().workspaceId).toBe(beforeWsId);
      expect(useWorkspaceStore.getState().conversationId).toBe(beforeConvId);
      expect(publishedOf('HANDOFF_READY')).toHaveLength(0);
    });

    it('fails closed on an unknown parameter and applies nothing', () => {
      const beforeWsId = useWorkspaceStore.getState().workspaceId;

      hydrateFromURL(new URLSearchParams('workspaceId=ws-evil&token=sk-sentinel'));

      expect(useWorkspaceStore.getState().workspaceId).toBe(beforeWsId);
      expect(publishedOf('HANDOFF_READY')).toHaveLength(0);
    });

    it('announces readiness for a validated handoff bootstrap and applies a matching projection once', () => {
      const dispose = hydrateFromURL(
        new URLSearchParams({
          workspaceId: 'ws-1',
          conversationId: 'conv-1',
          page: 'chat',
          requestId: 'req-hydrate',
          schemaVersion: String(HANDOFF_SCHEMA_VERSION),
        }),
      );

      const announced = publishedOf('HANDOFF_READY');
      expect(announced).toHaveLength(1);
      expect(announced[0]).toMatchObject({ requestId: 'req-hydrate', workspaceId: 'ws-1' });

      broadcast(transfer('req-hydrate', 'ws-1'));
      expect(useWorkspaceStore.getState().conversationId).toBe('conv-9');
      expect(publishedOf('HANDOFF_ACK')).toHaveLength(1);

      broadcast(transfer('req-hydrate', 'ws-1'));
      expect(publishedOf('HANDOFF_ACK')).toHaveLength(2);

      dispose();
    });

    it('ignores a projection whose workspaceId differs from the URL bootstrap', () => {
      const dispose = hydrateFromURL(
        new URLSearchParams({
          workspaceId: 'ws-1',
          requestId: 'req-foreign',
          schemaVersion: String(HANDOFF_SCHEMA_VERSION),
        }),
      );
      const before = useWorkspaceStore.getState().conversationId;

      broadcast(transfer('req-foreign', 'ws-someone-else'));

      expect(useWorkspaceStore.getState().conversationId).toBe(before);
      expect(publishedOf('HANDOFF_ACK')).toHaveLength(0);

      dispose();
    });
  });
});
