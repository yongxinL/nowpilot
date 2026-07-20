import React from 'react';
import type { ComponentType } from 'react';
import type { NowPilotNavItem } from './navigationTypes';
import {
  ChatIcon,
  NoteIcon,
  ToolsIcon,
  TaskIcon,
} from '../../components/sider/icons';
import { sidepanelPageRegistry } from '../registries/SidepanelPageRegistry';

export interface CorePageSpec {
  id: string;
  label: string;
  shortLabel?: string;
  icon: ComponentType;
  component: ComponentType;
  order: number;
  tooltip?: string;
  placeholder?: boolean;
}

const corePages: CorePageSpec[] = [
  { id: 'chat', label: 'Chat', icon: ChatIcon, component: ChatPageStub, order: 1, tooltip: 'Chat with AI' },
  { id: 'notes', label: 'Note', icon: NoteIcon, component: NotesPageStub, order: 2, tooltip: 'Personal notes', placeholder: true },
  { id: 'tools', label: 'Tools', icon: ToolsIcon, component: ToolsPageStub, order: 3, tooltip: 'Workspace tools' },
  { id: 'tasks', label: 'Task', icon: TaskIcon, component: PlaceholderPage, order: 4, placeholder: true, tooltip: 'Tasks' },
];

const groupOverrides: Record<string, { group: 'core' | 'addons' | 'footer'; surfaces: ('sidepanel' | 'standalone')[] }> = {
  chat: { group: 'core', surfaces: ['sidepanel', 'standalone'] },
  notes: { group: 'core', surfaces: ['sidepanel', 'standalone'] },
  tools: { group: 'core', surfaces: ['sidepanel', 'standalone'] },
  tasks: { group: 'addons', surfaces: ['sidepanel', 'standalone'] },
};

/** Core page IDs used to filter add-on pages from page registries. */
const CORE_PAGE_IDS = new Set(['chat', 'notes', 'tools', 'tasks', 'options']);

export function buildNavConfig(): NowPilotNavItem[] {
  const coreNavItems = corePages.map<NowPilotNavItem>((page) => {
    const override = groupOverrides[page.id] ?? { group: 'addons' as const, surfaces: ['sidepanel', 'standalone'] as ('sidepanel' | 'standalone')[] };
    return {
      id: page.id,
      label: page.label,
      shortLabel: page.shortLabel,
      icon: React.createElement(page.icon),
      group: override.group,
      order: page.order,
      surfaces: override.surfaces,
      routeId: page.id,
      tooltip: page.tooltip ?? page.label,
      placeholder: page.placeholder,
      showArrowInStandaloneExpanded: override.group === 'addons',
    };
  });

  // Build nav items from registered add-on pages
  const addonPages = sidepanelPageRegistry.getAll().filter((p) => !CORE_PAGE_IDS.has(p.id));
  const addonNavItems: NowPilotNavItem[] = addonPages.map((page) => ({
    id: page.id,
    label: page.label,
    icon: page.icon ? React.createElement(page.icon) : undefined,
    group: 'addons' as const,
    order: page.order ?? 99,
    surfaces: ['sidepanel', 'standalone'],
    routeId: page.id,
    tooltip: page.label,
    showArrowInStandaloneExpanded: true,
  }));

  return [...coreNavItems, ...addonNavItems];
}

export function getNavConfig(): NowPilotNavItem[] {
  return buildNavConfig();
}

export const pageComponentRegistry: Map<string, ComponentType> = new Map(
  corePages.map((page) => [page.id, page.component]),
);

function PlaceholderPage() {
  return null;
}
function ChatPageStub() {
  return null;
}
function NotesPageStub() {
  return null;
}
function ToolsPageStub() {
  return null;
}
