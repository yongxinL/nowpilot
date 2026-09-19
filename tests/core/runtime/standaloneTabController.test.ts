import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { createStandaloneTabController } from '@/core/runtime/StandaloneNavigation';
import { StandaloneTabRecordSchema } from '@/core/workspace/workspaceTypes';

function setup(overrides: Partial<Parameters<typeof createStandaloneTabController>[0]> = {}) {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const tabs = {
    get: vi.fn(async (tabId: number) => ({ id: tabId })),
    create: vi.fn(async (): Promise<{ id?: number }> => ({ id: 42 })),
    update: vi.fn(async () => undefined),
    focusWindow: vi.fn(async () => undefined),
  };
  const sendFocus = vi.fn(async (_envelope: RuntimeEnvelope) => undefined);
  const controller = createStandaloneTabController({
    tabs,
    storage,
    buildStandaloneUrl: (destination) => `chrome-extension://test/standalone.html#/${destination}`,
    sendFocus,
    now: () => 100,
    ...overrides,
  });
  return { chromeStorage, storage, tabs, sendFocus, controller };
}

describe('standalone tab controller', () => {
  it('creates a singleton tab and stores its id when none exists', async () => {
    const { controller, tabs, storage } = setup();
    const result = await controller.open('chat');
    expect(tabs.create).toHaveBeenCalledWith('chrome-extension://test/standalone.html#/chat');
    expect(result).toEqual({ status: 'created', tabId: 42 });
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: { tabId: 42, openedAt: 100 },
    });
  });

  it('focuses the existing singleton tab and forwards the destination', async () => {
    const { controller, tabs, storage, sendFocus } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    const result = await controller.open('options');
    expect(tabs.get).toHaveBeenCalledWith(7);
    expect(tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(tabs.focusWindow).toHaveBeenCalledWith(7);
    expect(tabs.create).not.toHaveBeenCalled();
    expect(sendFocus).toHaveBeenCalledTimes(1);
    expect(sendFocus.mock.calls[0]![0].type).toBe('standalone.focus');
    expect(sendFocus.mock.calls[0]![0].payload).toEqual({ destination: 'options' });
    expect(result).toEqual({ status: 'focused', tabId: 7 });
  });

  it('recovers from a stale tab id by clearing it and creating a new tab', async () => {
    const { controller, tabs, storage } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    tabs.get.mockRejectedValueOnce(new Error('No tab with id: 7'));
    const result = await controller.open('chat');
    expect(tabs.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'created', tabId: 42 });
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: { tabId: 42, openedAt: 100 },
    });
  });

  it('treats a malformed stored record as absent', async () => {
    const { controller, tabs, chromeStorage } = setup();
    chromeStorage.session._setRaw('np_standalone_tab', { tabId: 'not-a-number' });
    const result = await controller.open('chat');
    expect(tabs.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('created');
  });

  it('fails closed when tab creation returns no id', async () => {
    const { controller, tabs } = setup();
    tabs.create.mockResolvedValueOnce({});
    const result = await controller.open('chat');
    expect(result).toEqual({ status: 'failed', code: 'STANDALONE_OPEN_FAILED' });
  });

  it('clears the stored record when the singleton tab is removed', async () => {
    const { controller, storage } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    await expect(controller.handleTabRemoved(7)).resolves.toBe(true);
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('ignores removal of an unrelated tab', async () => {
    const { controller, storage } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    await expect(controller.handleTabRemoved(99)).resolves.toBe(false);
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: { tabId: 7, openedAt: 1 },
    });
  });
});
