export const STORAGE_AREAS = ['local', 'sync', 'session'] as const;

export type StorageArea = (typeof STORAGE_AREAS)[number];

export const STORAGE_KEYS = [
  'np_workspace_meta',
  'np_workspace_version',
  'np_workspace_election',
  'np_workspace_handoff',
  'np_standalone_tab',
  'np_theme',
  'np_theme_pack',
] as const;

export type StorageKey = (typeof STORAGE_KEYS)[number];

export const STORAGE_KEY_AREAS: Readonly<Record<StorageKey, StorageArea>> = {
  np_workspace_meta: 'local',
  np_workspace_version: 'local',
  np_workspace_election: 'session',
  np_workspace_handoff: 'session',
  np_standalone_tab: 'session',
  np_theme: 'sync',
  np_theme_pack: 'sync',
};

export function storageAreaForKey(key: StorageKey): StorageArea {
  return STORAGE_KEY_AREAS[key];
}
