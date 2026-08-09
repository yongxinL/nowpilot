// src/core/registry/AddonSettingsStore.ts — per-addon settings store (WSPC-04).
// Plain zustand store (v5) over { settings: Record<addonId, Record<key, value>> }
// with a 01-06-style chrome.storage.local write-through adapter keyed
// np_addon_settings — deliberately NOT zustand storage middleware (Pitfall 7:
// middleware writes localStorage, which does not cross surfaces). Durability and
// cross-surface sync come from chrome.storage.local + chrome.storage.onChanged
// (remove-then-add listener, T-1-11). Every error path calls debugLog with the
// canonical ADDON_SETTINGS code and never throws (Golden Rule 9).
import { create } from 'zustand';
import { produce } from 'immer';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export const NP_ADDON_SETTINGS_KEY = 'np_addon_settings';

interface AddonSettingsState {
  settings: Record<string, Record<string, unknown>>;
  /** Hydrate from storage and wire the onChanged sync listener. */
  init(): Promise<void>;
  /** Immer-write one key for an addon, then write through to storage. */
  setSetting(addonId: string, key: string, value: unknown): void;
  /** Read one key with a fallback when unset. */
  getSetting(addonId: string, key: string, fallback?: unknown): unknown;
}

type OnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

// remove-then-add keeps exactly ONE active listener per chrome instance (T-1-11)
// while surviving fakeBrowser.reset() between tests.
let onChangedListener: OnChangedListener | null = null;

/**
 * Validate a stored np_addon_settings value (never merge raw storage). Exported
 * so Setting.ts's migrate-on-read (D-10) reuses this exact shape guard as the
 * np_addon_settings per-key sanitizer — one guard for every inbound path.
 */
export function sanitizeStored(value: unknown): Record<string, Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return {};
  const v = value as Record<string, unknown>;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [addonId, entry] of Object.entries(v)) {
    if (typeof entry === 'object' && entry !== null) {
      out[addonId] = entry as Record<string, unknown>;
    }
  }
  return out;
}

/** Write-through adapter — never throws. */
async function writeStorage(settings: Record<string, Record<string, unknown>>): Promise<void> {
  try {
    await chrome.storage.local.set({ [NP_ADDON_SETTINGS_KEY]: settings });
  } catch (err) {
    debugLog(ERROR_CODES.ADDON_SETTINGS, 'failed to write np_addon_settings', {
      error: err instanceof Error ? err : undefined,
      module: 'AddonSettingsStore',
    });
  }
}

export const useAddonSettingsStore = create<AddonSettingsState>()((set, get) => ({
  settings: {},

  init: async () => {
    try {
      const stored = await chrome.storage.local.get(NP_ADDON_SETTINGS_KEY);
      set({ settings: sanitizeStored(stored.np_addon_settings) });
    } catch (err) {
      // Never throw (Golden Rule 9): read failures fall back to empty.
      debugLog(ERROR_CODES.ADDON_SETTINGS, 'read failed; starting empty', {
        error: err instanceof Error ? err : undefined,
        module: 'AddonSettingsStore',
      });
    }

    // Foreign-surface writes propagate via chrome.storage.onChanged.
    const handleChanged: OnChangedListener = (changes, area) => {
      if (area !== 'local') return;
      const change = changes[NP_ADDON_SETTINGS_KEY];
      if (change === undefined) return;
      set({ settings: sanitizeStored(change.newValue) });
    };
    if (onChangedListener !== null) {
      chrome.storage.onChanged.removeListener(onChangedListener);
    }
    onChangedListener = handleChanged;
    chrome.storage.onChanged.addListener(handleChanged);
  },

  setSetting: (addonId, key, value) => {
    const next = produce(get().settings, (draft) => {
      if (!draft[addonId]) draft[addonId] = {};
      draft[addonId][key] = value;
    });
    set({ settings: next });
    void writeStorage(next);
  },

  getSetting: (addonId, key, fallback) => {
    const entry = get().settings[addonId];
    if (entry === undefined) return fallback;
    return key in entry ? entry[key] : fallback;
  },
}));
