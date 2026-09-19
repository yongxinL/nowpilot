import { useCallback, useEffect, useState } from 'react';
import type { StandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import {
  resolveStandaloneRouteId,
  standaloneHashRoute,
  type StandaloneRouteId,
} from '@/core/registry/standaloneRoutes';

export interface StandaloneRouterProps {
  registry: StandalonePageRegistry;
  routeId: StandaloneRouteId;
}

export function StandaloneRouter({ registry, routeId }: StandaloneRouterProps) {
  const Page = registry.get(routeId);
  return Page ? <Page /> : null;
}

export interface UseStandaloneRouteOptions {
  initialHash?: string;
  focusSubscription?: (listener: (destination: StandaloneRouteId) => void) => () => void;
  onRouteFallback?: (rawHash: string) => void;
}

export interface StandaloneRouteController {
  routeId: StandaloneRouteId;
  navigate(routeId: StandaloneRouteId): void;
}

export function useStandaloneRoute(
  options: UseStandaloneRouteOptions = {},
): StandaloneRouteController {
  const [routeId, setRouteId] = useState<StandaloneRouteId>(() => {
    const raw = options.initialHash ?? (typeof window === 'undefined' ? '' : window.location.hash);
    const resolved = resolveStandaloneRouteId(raw);
    if (resolved.fellBack && options.onRouteFallback) options.onRouteFallback(raw);
    return resolved.routeId;
  });

  const navigate = useCallback((next: StandaloneRouteId) => {
    setRouteId(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', standaloneHashRoute(next));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', standaloneHashRoute(routeId));
    }
  }, [routeId]);

  useEffect(() => {
    if (!options.focusSubscription) return undefined;
    return options.focusSubscription((destination) => setRouteId(destination));
  }, [options.focusSubscription]);

  return { routeId, navigate };
}
