import type { NavGroup, Surface } from './navigationTypes';
import { navConfig } from './navConfig';
import type { NowPilotNavItem } from './navigationTypes';

export interface NavSelectionOptions {
  surface: Surface;
  group?: NavGroup;
}

export function selectNavItems(options: NavSelectionOptions): NowPilotNavItem[] {
  const { surface, group } = options;
  if (surface === 'popup') return [];
  return navConfig
    .filter((item) => item.surfaces.includes(surface))
    .filter((item) => (group ? item.group === group : true))
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function findNavItem(id: string): NowPilotNavItem | undefined {
  return navConfig.find((item) => item.id === id);
}
