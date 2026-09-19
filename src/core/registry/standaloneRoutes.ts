import { z } from 'zod';

export const STANDALONE_ROUTE_IDS = [
  'chat',
  'agent',
  'notes',
  'write',
  'tools',
  'options',
  'diagnostics',
] as const;

export type StandaloneRouteId = (typeof STANDALONE_ROUTE_IDS)[number];

export const StandaloneRouteIdSchema = z.enum(STANDALONE_ROUTE_IDS);

export const DEFAULT_STANDALONE_ROUTE_ID: StandaloneRouteId = 'chat';

export type StandaloneRoutePlacement = 'primary' | 'footer';

export interface StandaloneRouteDefinition {
  id: StandaloneRouteId;
  label: string;
  placement: StandaloneRoutePlacement;
  order: number;
  hash: string;
}

export function standaloneHashRoute(id: StandaloneRouteId): string {
  return `#/${id}`;
}

export const STANDALONE_ROUTES: Readonly<Record<StandaloneRouteId, StandaloneRouteDefinition>> = {
  chat: { id: 'chat', label: 'Chat', placement: 'primary', order: 1, hash: '#/chat' },
  agent: { id: 'agent', label: 'Agent', placement: 'primary', order: 2, hash: '#/agent' },
  notes: { id: 'notes', label: 'Notes', placement: 'primary', order: 3, hash: '#/notes' },
  write: { id: 'write', label: 'Write', placement: 'primary', order: 4, hash: '#/write' },
  tools: { id: 'tools', label: 'Tools', placement: 'primary', order: 5, hash: '#/tools' },
  options: { id: 'options', label: 'Options', placement: 'footer', order: 6, hash: '#/options' },
  diagnostics: {
    id: 'diagnostics',
    label: 'Diagnostics',
    placement: 'footer',
    order: 7,
    hash: '#/diagnostics',
  },
};

export const PRIMARY_STANDALONE_ROUTES = STANDALONE_ROUTE_IDS.filter(
  (id) => STANDALONE_ROUTES[id].placement === 'primary',
).map((id) => STANDALONE_ROUTES[id]);

export const FOOTER_STANDALONE_ROUTES = STANDALONE_ROUTE_IDS.filter(
  (id) => STANDALONE_ROUTES[id].placement === 'footer',
).map((id) => STANDALONE_ROUTES[id]);

const HASH_ROUTE_PATTERN = /^#\/([a-z-]+)$/;

export function parseStandaloneRouteId(hash: string): StandaloneRouteId | undefined {
  const match = HASH_ROUTE_PATTERN.exec(hash);
  if (!match) return undefined;
  const candidate = match[1]!;
  return (STANDALONE_ROUTE_IDS as readonly string[]).includes(candidate)
    ? (candidate as StandaloneRouteId)
    : undefined;
}

export function resolveStandaloneRouteId(hash: string): {
  routeId: StandaloneRouteId;
  fellBack: boolean;
} {
  const routeId = parseStandaloneRouteId(hash);
  if (routeId) return { routeId, fellBack: false };
  return { routeId: DEFAULT_STANDALONE_ROUTE_ID, fellBack: true };
}
