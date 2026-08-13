// src/core/registry/TrustSettingsStore.ts — D-4b-07/09 np_trust persistence
// store (04b-05, NEW — RESEARCH-recommended path; AddonSettingsStore
// structural copy). Plain zustand store (v5) over
// `{ prefs: TrustPrefs }` with a chrome.storage.local write-through adapter
// keyed np_trust — deliberately NOT zustand storage middleware (Pitfall 7:
// middleware writes localStorage, which does not cross surfaces). Durability
// and cross-surface sync come from chrome.storage.local + chrome.storage.
// onChanged (remove-then-add listener, T-1-11). Initial state is
// DEFAULT_TRUST_PREFS (all-true — the UI-SPEC hydrating row renders the four
// switches at default-true immediately, then init() flips them to persisted
// values). Every error path calls debugLog with a canonical code and never
// throws (Golden Rule 9; T-4b-06 safe-default degradation).
//
// The store PERSISTS the preference only — it enforces nothing itself
// (D-4b-08: runtime enforcement is core-side at the TrustPolicy boundary).
import { create } from 'zustand';
import { produce } from 'immer';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import {
  DEFAULT_TRUST_PREFS,
  NP_TRUST_KEY,
  TrustPrefsSchema,
  type TrustPrefs,
} from '@/core/preferences/trustConfig';

export interface TrustSettingsState {
  /** All-true initial state — switches render at default ON before hydration. */
  prefs: TrustPrefs;
  /** Hydrate from chrome.storage.local and wire the onChanged sync listener. */
  init(): Promise<void>;
  /**
   * Immer-write one source-type preference, then write through to np_trust.
   * Optimistic local set; the write is awaited and the state is ROLLED BACK to
   * the last persisted value when the write fails — the caller's rollback
   * detection (`getState().prefs[kind] !== on`) observes the revert and can
   * surface the E5-style toast (UI-SPEC failure row).
   */
  setSource(kind: keyof TrustPrefs, on: boolean): Promise<void>;
}

type OnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

// remove-then-add keeps exactly ONE active listener per chrome instance (T-1-11)
// while surviving fakeBrowser.reset() between tests.
let onChangedListener: OnChangedListener | null = null;

/** Parse a raw np_trust payload — invalid values degrade to safe defaults (never a crash). */
function parseTrustPrefs(raw: unknown): TrustPrefs {
  const parsed = TrustPrefsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  debugLog(ERROR_CODES.STORE_READ, 'np_trust failed TrustPrefsSchema — using defaults', {
    module: 'TrustSettingsStore',
    extra: { issueCount: parsed.error.issues.length },
  });
  return DEFAULT_TRUST_PREFS;
}

/**
 * Write-through adapter — never throws. Returns false on failure so setSource
 * can roll the optimistic set back to the last persisted value.
 */
async function writeStorage(prefs: TrustPrefs): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [NP_TRUST_KEY]: prefs });
    return true;
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to write np_trust', {
      error: err instanceof Error ? err : undefined,
      module: 'TrustSettingsStore',
    });
    return false;
  }
}

export const useTrustSettingsStore = create<TrustSettingsState>()((set, get) => ({
  prefs: DEFAULT_TRUST_PREFS,

  init: async () => {
    try {
      const stored = await chrome.storage.local.get(NP_TRUST_KEY);
      set({ prefs: parseTrustPrefs(stored.np_trust) });
    } catch (err) {
      // Never throw (Golden Rule 9): read failures fall back to all-true.
      debugLog(ERROR_CODES.STORE_READ, 'read failed; using defaults', {
        error: err instanceof Error ? err : undefined,
        module: 'TrustSettingsStore',
      });
    }

    // Foreign-surface writes propagate via chrome.storage.onChanged (T-1-11
    // remove-then-add — exactly one active listener).
    const handleChanged: OnChangedListener = (changes, area) => {
      if (area !== 'local') return;
      const change = changes[NP_TRUST_KEY];
      if (change === undefined) return;
      // T-4b-06: a tampered/stale key degrades to safe defaults — no source
      // silently excluded, never a crash, never a bypass.
      set({ prefs: parseTrustPrefs(change.newValue) });
    };
    if (onChangedListener !== null) {
      chrome.storage.onChanged.removeListener(onChangedListener);
    }
    onChangedListener = handleChanged;
    chrome.storage.onChanged.addListener(handleChanged);
  },

  setSource: async (kind, on) => {
    const previous = get().prefs;
    const next = produce(previous, (draft) => {
      draft[kind] = on;
    });
    // Optimistic local set (UI-SPEC auto-save) — the switch flips instantly.
    set({ prefs: next });
    const ok = await writeStorage(next);
    if (!ok) {
      // Rollback to the last persisted value — the caller's rollback
      // detection (`prefs[kind] !== on`) observes this and surfaces the
      // E5-style toast (STR.options.trustSaveFailed). The next toggle retries.
      set({ prefs: previous });
    }
  },
}));
