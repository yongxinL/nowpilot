import type { ReactNode } from 'react';

export type Surface = 'sidepanel' | 'standalone' | 'popup';

export type NavGroup = 'core' | 'addons' | 'footer' | 'utility';

export interface NowPilotNavItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: ReactNode;
  group: NavGroup;
  order: number;
  surfaces: Surface[];
  routeId?: string;
  tooltip?: string;
  disabled?: boolean;
  placeholder?: boolean;
  showArrowInStandaloneExpanded?: boolean;
}

export interface NavItemRenderContext {
  surface: 'sidepanel' | 'standalone';
  density: 'expanded' | 'collapsed' | 'narrow';
}

export const workspaceStoreSidepanelSurface: Surface = 'sidepanel';
