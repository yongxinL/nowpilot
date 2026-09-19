import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS, STORAGE_KEY_AREAS, storageAreaForKey } from '@/core/storage/storageKeys';

describe('storage keys', () => {
  it('declares each canonical key once', () => {
    expect(new Set(STORAGE_KEYS).size).toBe(STORAGE_KEYS.length);
    expect(STORAGE_KEYS).toEqual([
      'np_workspace_meta',
      'np_workspace_version',
      'np_workspace_election',
      'np_workspace_handoff',
      'np_standalone_tab',
      'np_theme',
      'np_theme_pack',
    ]);
  });

  it('maps each key to its approved chrome storage area', () => {
    expect(STORAGE_KEY_AREAS).toEqual({
      np_workspace_meta: 'local',
      np_workspace_version: 'local',
      np_workspace_election: 'session',
      np_workspace_handoff: 'session',
      np_standalone_tab: 'session',
      np_theme: 'sync',
      np_theme_pack: 'sync',
    });
    for (const key of STORAGE_KEYS) {
      expect(storageAreaForKey(key)).toBe(STORAGE_KEY_AREAS[key]);
    }
  });
});
