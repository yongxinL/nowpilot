import { describe, expect, it, vi } from 'vitest';
import { createBackgroundRuntime } from '@/core/runtime/StandaloneNavigation';
import { createOperationId } from '@/core/runtime/OperationId';
import { parseRuntimeEnvelope, type RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import {
  createBackgroundElectionMessageListener,
  createWorkspaceElectionArbiter,
} from '@/core/workspace/WorkspaceElectionArbiter';
import { createChromeStorageMock } from '../../helpers/chromeMock';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
const SENDER = { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/sidepanel.html` };

function openMessage(destination = 'chat') {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination },
  };
}

function setup() {
  const listeners: Array<(message: unknown, sender: unknown) => void> = [];
  const removed: Array<(tabId: number) => void> = [];
  const controller = {
    open: vi.fn(async () => ({ status: 'created' as const, tabId: 1 })),
    handleTabRemoved: vi.fn(async () => true),
    readRecord: vi.fn(async () => undefined),
  };
  const onSingletonTabClosed = vi.fn(async () => undefined);
  const runtime = createBackgroundRuntime({
    extensionId: EXTENSION_ID,
    controller,
    onMessage: (listener) => listeners.push(listener),
    removeMessageListener: (listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    onTabRemoved: (listener) => removed.push(listener),
    onSingletonTabClosed,
  });
  const stop = runtime.start();
  return { controller, listeners, removed, onSingletonTabClosed, stop };
}

describe('background runtime', () => {
  it('opens the requested standalone destination for a trusted open message', async () => {
    const { controller, listeners } = setup();
    await listeners[0]!(openMessage('options'), SENDER);
    expect(controller.open).toHaveBeenCalledWith('options');
  });

  it('ignores messages from an untrusted sender', async () => {
    const { controller, listeners } = setup();
    listeners[0]!(openMessage(), { id: 'someoneelse', url: 'https://example.com' });
    expect(controller.open).not.toHaveBeenCalled();
  });

  it('ignores malformed messages without throwing', () => {
    const { controller, listeners } = setup();
    expect(() => listeners[0]!({ nope: true }, SENDER)).not.toThrow();
    expect(controller.open).not.toHaveBeenCalled();
  });

  it('routes tab removal to the singleton controller', async () => {
    const { controller, removed } = setup();
    removed[0]!(7);
    expect(controller.handleTabRemoved).toHaveBeenCalledWith(7);
  });

  it('runs close recovery when the singleton tab is removed', async () => {
    const { removed, onSingletonTabClosed } = setup();
    removed[0]!(7);
    await vi.waitFor(() => expect(onSingletonTabClosed).toHaveBeenCalledTimes(1));
  });

  it('does not run close recovery for an unrelated tab', async () => {
    const { controller, removed, onSingletonTabClosed } = setup();
    controller.handleTabRemoved.mockResolvedValueOnce(false);
    removed[0]!(99);
    await vi.waitFor(() => expect(controller.handleTabRemoved).toHaveBeenCalledWith(99));
    expect(onSingletonTabClosed).not.toHaveBeenCalled();
  });

  it('removes the message listener on stop', () => {
    const { controller, listeners, removed, stop } = setup();
    stop();
    expect(listeners).toHaveLength(0);
    expect(removed).toHaveLength(1);
    expect(controller.open).not.toHaveBeenCalled();
  });
});

describe('background election listener integration', () => {
  it('returns literal true and delivers exactly one correlated background response', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const arbiter = createWorkspaceElectionArbiter({ storage, now: () => 1 });
    const listener = createBackgroundElectionMessageListener({
      extensionId: EXTENSION_ID,
      arbiter,
    });
    const requestEnvelope = {
      envelopeVersion: 1,
      id: createOperationId(),
      type: 'workspace.election.request',
      source: 'sidepanel',
      target: 'background',
      timestamp: 1,
      payload: {
        requestId: createOperationId(),
        operation: 'claim',
        requesterInstanceId: 'sp-1',
        requesterWriterType: 'sidepanel',
        committedVersion: 0,
        reason: 'initial',
      },
    };
    const sendResponse = vi.fn();
    const result = listener(requestEnvelope, SENDER, sendResponse);
    expect(result).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));
    const response = sendResponse.mock.calls[0]![0] as RuntimeEnvelope;
    expect(parseRuntimeEnvelope(response).success).toBe(true);
    expect(response.type).toBe('workspace.election.response');
    expect(response.source).toBe('background');
    expect(response.target).toBe('sidepanel');
    expect(response.correlationId).toBe(requestEnvelope.id);
  });
});
