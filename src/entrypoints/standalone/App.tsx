import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { CORE_PAGE_REGISTRY } from '@/core/registry/registerCorePages';
import { createBroadcastBus, type RawMessageListener } from '@/core/runtime/BroadcastBus';
import { readStandaloneNavigationRequest } from '@/core/runtime/StandaloneNavigation';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore } from '@/core/theme/ThemeStore';
import { useTheme } from '@/core/theme/useTheme';
import { createDiagnosticRecord, debugLog } from '@/core/error/debugLog';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceCoordinator } from '@/core/workspace/WorkspaceSync';
import { createInstanceId } from '@/core/workspace/workspaceTypes';
import type { StandaloneRouteId } from '@/core/registry/standaloneRoutes';

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
  writerType: 'standalone',
  instanceId,
  now: () => Date.now(),
});
const handoff = createWorkspaceHandoff({
  storage,
  writerType: 'standalone',
  instanceId,
  now: () => Date.now(),
  submitElectionRequest: election.request,
});
const coordinator = createWorkspaceCoordinator({
  bus,
  surface: 'standalone',
  instanceId,
  storage,
  election,
  handoff,
  store,
});
const themeStore = createThemeStore(storage);

const focusSubscription = (listener: (destination: StandaloneRouteId) => void) =>
  bus.on('standalone.focus', (envelope) => {
    const request = readStandaloneNavigationRequest(envelope);
    if (request) listener(request.destination);
  });

export default function App() {
  const { config } = useTheme(themeStore, { compact: false });

  useEffect(() => {
    void election.claim('initial');
    void coordinator.announce();
    return coordinator.start();
  }, []);

  return (
    <ConfigProvider theme={config}>
      <StandaloneShell
        registry={CORE_PAGE_REGISTRY}
        focusSubscription={focusSubscription}
        onRouteFallback={(rawHash) =>
          debugLog(createDiagnosticRecord('STANDALONE_ROUTE_FALLBACK', { rawHash }))
        }
      />
    </ConfigProvider>
  );
}
