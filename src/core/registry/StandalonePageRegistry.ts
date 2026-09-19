import type { ComponentType } from 'react';
import type { StandaloneRouteId } from './standaloneRoutes';

export type StandalonePageComponent = ComponentType;

export interface StandalonePageRegistry {
  register(routeId: StandaloneRouteId, component: StandalonePageComponent): void;
  get(routeId: StandaloneRouteId): StandalonePageComponent | undefined;
  has(routeId: StandaloneRouteId): boolean;
  entries(): ReadonlyArray<{ routeId: StandaloneRouteId; component: StandalonePageComponent }>;
}

export function createStandalonePageRegistry(): StandalonePageRegistry {
  const pages = new Map<StandaloneRouteId, StandalonePageComponent>();
  return {
    register(routeId, component) {
      if (pages.has(routeId)) {
        throw new Error(`Standalone route already registered: ${routeId}`);
      }
      pages.set(routeId, component);
    },
    get(routeId) {
      return pages.get(routeId);
    },
    has(routeId) {
      return pages.has(routeId);
    },
    entries() {
      return [...pages.entries()].map(([routeId, component]) => ({ routeId, component }));
    },
  };
}
