import React from 'react';
import { ChatPage } from '../pages/ChatPage';
import { AgentPage } from '../pages/AgentPage';
import { NotesWorkspace } from '../notes/NotesWorkspace';
import { StandaloneWritePage } from './StandaloneWritePage';
import { ToolsGridPanel } from './ToolsGridPanel';
import { OptionsPage } from '../options/OptionsPage';

/**
 * The Standalone workspace's route set: the canonical Main group plus the
 * `?page=options` route that renders the Options workspace **inside** the
 * Standalone shell (§5.4 / §8.6). No surface-to-surface import, no
 * `chrome.tabs.create` from a page component.
 */
export type StandaloneRoute = 'Chat' | 'Agent' | 'Note' | 'Write' | 'Tools' | 'Options';

/** The fixed canonical Sider Main group (DEC-OP-03). */
export const STANDALONE_MAIN_ROUTES: readonly StandaloneRoute[] = [
  'Chat',
  'Agent',
  'Note',
  'Write',
  'Tools',
];

const PAGE_PARAM_TO_ROUTE: Record<string, StandaloneRoute> = {
  chat: 'Chat',
  agent: 'Agent',
  note: 'Note',
  write: 'Write',
  tools: 'Tools',
  options: 'Options',
};

/**
 * Resolve a route from the `page` query parameter. Unknown, malformed or
 * missing values fall back to the canonical default (`Chat`) rather than
 * rendering an unvalidated value.
 */
export function resolveStandaloneRoute(search: string): StandaloneRoute {
  const requested = new URLSearchParams(search).get('page');
  if (!requested) return 'Chat';
  return PAGE_PARAM_TO_ROUTE[requested] ?? 'Chat';
}

export interface StandaloneRouterProps {
  route: StandaloneRoute;
  onOpenOptions?: () => void;
}

/**
 * Route switching for the Standalone workspace. Keeps the prototype's plain
 * `route === 'X' && <Component/>` switch shape — no router library — and
 * reads the initial view from the validated URL.
 */
export const StandaloneRouter: React.FC<StandaloneRouterProps> = ({ route, onOpenOptions }) => {
  switch (route) {
    case 'Agent':
      return <AgentPage />;
    case 'Note':
      return <NotesWorkspace />;
    case 'Write':
      return <StandaloneWritePage onOpenOptions={onOpenOptions} />;
    case 'Tools':
      return <ToolsGridPanel />;
    case 'Options':
      return <OptionsPage />;
    case 'Chat':
    default:
      return <ChatPage />;
  }
};
