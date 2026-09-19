import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STANDALONE_ROUTE_ID,
  FOOTER_STANDALONE_ROUTES,
  PRIMARY_STANDALONE_ROUTES,
  STANDALONE_ROUTE_IDS,
  StandaloneRouteIdSchema,
  STANDALONE_ROUTES,
  parseStandaloneRouteId,
  resolveStandaloneRouteId,
  standaloneHashRoute,
} from '@/core/registry/standaloneRoutes';

describe('standalone route registry', () => {
  it('declares exactly the seven canonical routes in order', () => {
    expect(STANDALONE_ROUTE_IDS).toEqual([
      'chat',
      'agent',
      'notes',
      'write',
      'tools',
      'options',
      'diagnostics',
    ]);
  });

  it('uses chat as the default route', () => {
    expect(DEFAULT_STANDALONE_ROUTE_ID).toBe('chat');
  });

  it('places five routes in primary navigation and two in the footer', () => {
    expect(PRIMARY_STANDALONE_ROUTES.map((route) => route.id)).toEqual([
      'chat',
      'agent',
      'notes',
      'write',
      'tools',
    ]);
    expect(FOOTER_STANDALONE_ROUTES.map((route) => route.id)).toEqual(['options', 'diagnostics']);
  });

  it('renders the canonical hash format for each route', () => {
    for (const id of STANDALONE_ROUTE_IDS) {
      expect(STANDALONE_ROUTES[id].hash).toBe(`#/${id}`);
      expect(standaloneHashRoute(id)).toBe(`#/${id}`);
    }
  });

  it('validates route identifiers with a closed schema', () => {
    expect(StandaloneRouteIdSchema.safeParse('chat').success).toBe(true);
    expect(StandaloneRouteIdSchema.safeParse('teamgqm').success).toBe(false);
    expect(StandaloneRouteIdSchema.safeParse('servicenow').success).toBe(false);
  });

  it('parses valid hashes and rejects unknown ones', () => {
    expect(parseStandaloneRouteId('#/notes')).toBe('notes');
    expect(parseStandaloneRouteId('#/not-a-route')).toBeUndefined();
    expect(parseStandaloneRouteId('#/')).toBeUndefined();
    expect(parseStandaloneRouteId('notes')).toBeUndefined();
  });

  it('normalises unknown hashes to chat and reports the fallback', () => {
    expect(resolveStandaloneRouteId('#/options')).toEqual({ routeId: 'options', fellBack: false });
    expect(resolveStandaloneRouteId('#/unknown')).toEqual({ routeId: 'chat', fellBack: true });
    expect(resolveStandaloneRouteId('')).toEqual({ routeId: 'chat', fellBack: true });
  });
});
