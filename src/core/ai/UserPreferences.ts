// Minimal UserPreferences shape + np_preferences persistence (plan 03-02, Task 2).
//
// Phase-3 supply point for PersonaInjector (Appendix N.2 imports UserPreferences
// from `@/core/memory/types`, which does not exist — RESEARCH Open Q2). The
// memory phases (8/10) own the FULL UserPreferences shape; this minimal shape
// is the supersession point those phases replace in place.
//
// Override strings are z.string().min(1).optional() so an empty-string override
// is REJECTED at the boundary — the data-merge `??` would otherwise treat '' as
// a value and clobber the seeded persona field (flagged assumption).
//
// No secrets live here: apiKey stays in the encrypted np_providers store
// (Phase 2) — this store holds only non-secret preferences per §15.2
// partition rules (threat T-3-05 disposition: accept).
import { z } from 'zod';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';

/** Locked §21.6 tone enum (D-58) — const array exported for reuse. */
export const PERSONA_TONE_ENUM = ['professional-warm', 'concise', 'friendly'] as const;
export type PersonaTone = (typeof PERSONA_TONE_ENUM)[number];

/** Locked §21.6 brevity enum (D-58) — const array exported for reuse. */
export const PERSONA_BREVITY_ENUM = ['brief', 'balanced', 'detailed'] as const;
export type PersonaBrevity = (typeof PERSONA_BREVITY_ENUM)[number];

export const personaOverridesSchema = z.object({
  name: z.string().min(1).optional(),
  tone: z.enum(PERSONA_TONE_ENUM).optional(),
  brevity: z.enum(PERSONA_BREVITY_ENUM).optional(),
});
export type PersonaOverrides = z.infer<typeof personaOverridesSchema>;

export const UserPreferencesSchema = z.object({
  /** D-54 write-through target: fast-tier model the operator assigned. */
  fastModel: z.string().optional(),
  /** D-54 write-through target: balanced-tier model the operator assigned. */
  balancedModel: z.string().optional(),
  /** RICH-R-02 data-merge overrides applied at render time by PersonaInjector. */
  personaOverrides: personaOverridesSchema.optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

interface UserPreferencesStore extends UserPreferences {
  setFastModel: (model: string) => void;
  setBalancedModel: (model: string) => void;
  setPersonaOverrides: (overrides: PersonaOverrides | undefined) => void;
  /** Boot hydration — re-reads np_preferences from chrome.storage.local. */
  hydrate: () => Promise<void>;
}

const initialPreferences: UserPreferences = {
  fastModel: undefined,
  balancedModel: undefined,
  personaOverrides: undefined,
};

/**
 * Persisted under `np_preferences` (chrome.storage.local — non-secrets per
 * §15.2 partition rules, T-3-05). Mirrors the WorkspaceStore persist pattern:
 * create + persist + immer + createJSONStorage(chromeStorageAdapter) +
 * partialize + version 1 (zustand-persist schema version axis, D-22).
 */
export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    immer((set, _get, api) => ({
      ...initialPreferences,

      setFastModel: (fastModel: string) =>
        set((state) => {
          state.fastModel = fastModel;
        }),

      setBalancedModel: (balancedModel: string) =>
        set((state) => {
          state.balancedModel = balancedModel;
        }),

      setPersonaOverrides: (personaOverrides: PersonaOverrides | undefined) =>
        set((state) => {
          state.personaOverrides = personaOverrides;
        }),

      // Re-reads np_preferences from chrome.storage.local at boot. The `api`
      // third parameter carries the persist middleware's extension, so no
      // module-level self-reference (which would break type inference).
      // persist's rehydrate is typed `Promise<void> | void` — the async
      // wrapper normalizes it to Promise<void> for callers.
      hydrate: async () => {
        await api.persist.rehydrate();
      },
    })),
    {
      name: 'np_preferences',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        fastModel: state.fastModel,
        balancedModel: state.balancedModel,
        personaOverrides: state.personaOverrides,
      }),
      version: 1,
    },
  ),
);