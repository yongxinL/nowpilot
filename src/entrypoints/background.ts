import { createValidatedStorage } from '@/core/storage/chromeStorage';
import {
  createBackgroundRuntime,
  createStandaloneTabController,
} from '@/core/runtime/StandaloneNavigation';
import { createOperationId } from '@/core/runtime/OperationId';
import {
  createBackgroundElectionMessageListener,
  createWorkspaceElectionArbiter,
} from '@/core/workspace/WorkspaceElectionArbiter';
import { ElectionRecordSchema } from '@/core/workspace/workspaceTypes';

export default defineBackground(() => {
  const storage = createValidatedStorage();

  const controller = createStandaloneTabController({
    tabs: {
      get: (tabId) => chrome.tabs.get(tabId).then((tab) => ({ id: tab.id })),
      create: (url) => chrome.tabs.create({ url }),
      update: (tabId, props) => chrome.tabs.update(tabId, props),
      focusWindow: async (tabId) => {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId !== undefined) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      },
    },
    storage,
    buildStandaloneUrl: (destination) => chrome.runtime.getURL(`standalone.html#/${destination}`),
    sendFocus: async (envelope) => {
      await chrome.runtime.sendMessage(envelope);
    },
    now: () => Date.now(),
  });

  const arbiter = createWorkspaceElectionArbiter({ storage, now: () => Date.now() });

  createBackgroundRuntime({
    extensionId: chrome.runtime.id,
    controller,
    onMessage: (listener) => chrome.runtime.onMessage.addListener(listener),
    removeMessageListener: (listener) => chrome.runtime.onMessage.removeListener(listener),
    onTabRemoved: (listener) => chrome.tabs.onRemoved.addListener(listener),
    onSingletonTabClosed: async () => {
      const record = await storage.read('np_workspace_election', ElectionRecordSchema);
      if (record.status === 'valid' && record.value.writerType === 'standalone') {
        await arbiter.handle({
          requestId: createOperationId(),
          operation: 'relinquish',
          requesterInstanceId: record.value.writerInstanceId,
          requesterWriterType: 'standalone',
          committedVersion: record.value.committedVersion,
          expectedEpoch: record.value.epoch,
        });
      }
    },
  }).start();

  chrome.runtime.onMessage.addListener(
    createBackgroundElectionMessageListener({
      extensionId: chrome.runtime.id,
      arbiter,
    }),
  );

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });
});
