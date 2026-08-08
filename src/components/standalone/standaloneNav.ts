// src/components/standalone/standaloneNav.ts — the standalone-view active-page
// navigation state (the StandaloneRouter action backing the Cmd+K 'Open
// Options' command, W-8). Co-located in its own module so CmdKPicker — which
// is mounted by BOTH shells — can set the standalone active page without a
// circular import through StandaloneRouter → StandaloneShell → CmdKPicker.
// StandaloneRouter re-exports navigateToPage/useStandaloneNav as its router
// actions (plan Task 1: "navigateToPage sets the standalone active page via the
// standalone router action"). page ids are StandalonePageRegistry ids (01-07);
// 'chat' is the default landing page.
import { create } from 'zustand';

interface StandaloneNavState {
  activePageId: string;
  setActivePage: (pageId: string) => void;
}

export const useStandaloneNav = create<StandaloneNavState>()((set) => ({
  activePageId: 'chat',
  setActivePage: (pageId) => set({ activePageId: pageId }),
}));

/** Set the standalone active page (StandalonePageRegistry id). */
export function navigateToPage(pageId: string): void {
  useStandaloneNav.getState().setActivePage(pageId);
}
