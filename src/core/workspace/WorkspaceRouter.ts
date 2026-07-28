import { publish } from '../runtime/BroadcastBus';
import { useWorkspaceStore } from './WorkspaceStore';

const WORKSPACE_CHANNEL = 'np_workspace';

export function openFullApp(workspaceId: string, conversationId?: string, page?: string): void {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId);
  if (conversationId) params.set('conversationId', conversationId);
  if (page) params.set('page', page);

  const url = chrome.runtime.getURL(`app.html?${params.toString()}`);

  publish(WORKSPACE_CHANNEL, {
    type: 'FULL_APP_OPEN',
    workspaceId,
    conversationId,
    page,
  });

  chrome.tabs.query({ url: chrome.runtime.getURL('app.html') }, (tabs) => {
    if (tabs.length > 0 && tabs[0].id) {
      chrome.tabs.update(tabs[0].id, { active: true });
      useWorkspaceStore.getState().setOpenedFullAppTabId(tabs[0].id);
    } else {
      chrome.tabs.create({ url }, (tab) => {
        if (tab.id) {
          useWorkspaceStore.getState().setOpenedFullAppTabId(tab.id);
        }
      });
    }
  });
}

export function hydrateFromURL(searchParams: URLSearchParams): void {
  const wsId = searchParams.get('workspaceId');
  const convId = searchParams.get('conversationId');

  const store = useWorkspaceStore.getState();

  if (wsId) {
    Object.assign(store, { workspaceId: wsId });
  }
  if (convId) {
    store.setConversationId(convId);
  }
}
