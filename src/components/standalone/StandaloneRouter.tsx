import { useEffect, type ComponentType } from 'react';
import { AgentPage } from '@/components/pages/AgentPage';
import { ChatPage } from '@/components/pages/ChatPage';
import { NotesPage } from '@/components/pages/NotesPage';
import { OptionsPage } from '@/components/pages/OptionsPage';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

const PAGES: Record<string, ComponentType> = {
  chat: ChatPage,
  agent: AgentPage,
  notes: NotesPage,
  options: OptionsPage,
};

export function StandaloneRouter({ page }: { page: string }) {
  useEffect(() => {
    void useWorkspaceStore.getState().hydrateFromURL();
  }, []);
  const Page = PAGES[page] ?? ChatPage;
  return <Page />;
}
