import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
import { createBroadcastBus, type RawMessageListener } from '@/core/runtime/BroadcastBus';
import { openStandalone } from '@/core/runtime/StandaloneNavigation';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore } from '@/core/theme/ThemeStore';
import { useTheme } from '@/core/theme/useTheme';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceCoordinator } from '@/core/workspace/WorkspaceSync';
import { createInstanceId } from '@/core/workspace/workspaceTypes';

const storage = createValidatedStorage();
const instanceId = createInstanceId();
const store = createWorkspaceStore(storage);

const rawListeners = new Set<RawMessageListener>();
const bus = createBroadcastBus({
  extensionId: chrome.runtime.id,
  sendMessage: async (envelope) => {
    const response = await chrome.runtime.sendMessage(envelope);
    if (response !== undefined) {
      for (const listener of rawListeners) listener(response, { id: chrome.runtime.id });
    }
    return response;
  },
  addMessageListener: (listener) => {
    rawListeners.add(listener);
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
    );
  },
  removeMessageListener: (listener) => {
    rawListeners.delete(listener);
    chrome.runtime.onMessage.removeListener(
      listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0],
    );
  },
});

const election = createWorkspaceElection({
  storage,
  store,
  bus,
  writerType: 'sidepanel',
  instanceId,
  now: () => Date.now(),
});
const handoff = createWorkspaceHandoff({
  storage,
  writerType: 'sidepanel',
  instanceId,
  now: () => Date.now(),
  submitElectionRequest: election.request,
});
const coordinator = createWorkspaceCoordinator({
  bus,
  surface: 'sidepanel',
  instanceId,
  storage,
  election,
  handoff,
  store,
});
const themeStore = createThemeStore(storage);

export default function App() {
  const { config } = useTheme(themeStore, { compact: true });

  useEffect(() => {
    void election.claim('initial');
    return coordinator.start();
  }, []);

  return (
    <ConfigProvider theme={config}>
      <SidePanelShell onNavigate={(destination) => openStandalone(destination, 'sidepanel', bus)} />
    </ConfigProvider>
  );
}
