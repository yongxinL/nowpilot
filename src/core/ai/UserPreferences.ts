// Full §3.5 UserPreferences store + np_preferences persistence (plan 08-01, Task 3).
//
// D-112: the full §3.5 UserPreferences shape is now canonical at
// @/core/memory/types. This store re-exports the type + schema + enums from
// there (Pitfall 3: the store's initialPreferences/partialize must be updated
// for the new required §3.5 fields).
//
// Open Q3 grep result (2026-09-01): personaOverrides has live readers in
//   - src/core/context/trust/contextItems.ts:147
//   - src/core/ai/PromptCacheManager.ts:165-166
//   - src/core/ai/persona/PersonaInjector.ts:19-20
// So personaOverrides STAYS in partialize (np_preferences legacy). Phase 15
// consolidates personaOverrides -> np_persona.
//
// No secrets live here: apiKey stays in the encrypted np_providers store
// (Phase 2) — this store holds only non-secret preferences per §15.2
// partition rules (threat T-3-05 disposition: accept).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';
import type { UserPreferences, PersonaTone, PersonaBrevity, PersonaOverrides } from '../memory/types';
import { personaOverridesSchema, PERSONA_TONE_ENUM, PERSONA_BREVITY_ENUM } from '../memory/types';

/** D-112: re-export canonical UserPreferences from @/core/memory/types. */
export type { UserPreferences };
/** D-112: re-export canonical enums/schema from @/core/memory/types. */
export { PERSONA_TONE_ENUM, PERSONA_BREVITY_ENUM, personaOverridesSchema };
/** D-112: re-export canonical Persona* types from @/core/memory/types. */
export type { PersonaTone, PersonaBrevity, PersonaOverrides };

interface UserPreferencesStore extends UserPreferences {
  setFastModel: (model: string) => void;
  setBalancedModel: (model: string) => void;
  setPersonaOverrides: (overrides: PersonaOverrides | undefined) => void;
  /** Boot hydration — re-reads np_preferences from chrome.storage.local. */
  hydrate: () => Promise<void>;
}

const initialPreferences: UserPreferences = {
  // Required §3.5 fields (defaults from spec 4579-4595)
  responseStyle: 'mixed',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false,
  toolAutonomy: 'ask',
  defaultSurface: 'sidepanel',
  // Optional fields
  defaultProviderId: undefined,
  personaId: undefined,
  personaOverrides: undefined,
  // D-54 additive fields
  fastModel: undefined,
  balancedModel: undefined,
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
        // Required §3.5 fields
        responseStyle: state.responseStyle,
        preferredLanguage: state.preferredLanguage,
        preferStructuredOutput: state.preferStructuredOutput,
        allowCloudFallbackFromLocal: state.allowCloudFallbackFromLocal,
        toolAutonomy: state.toolAutonomy,
        defaultSurface: state.defaultSurface,
        // Optional fields
        defaultProviderId: state.defaultProviderId,
        personaId: state.personaId,
        // Phase 15: consolidate personaOverrides -> np_persona (Open Q3)
        personaOverrides: state.personaOverrides,
        // D-54 additive fields
        fastModel: state.fastModel,
        balancedModel: state.balancedModel,
      }),
      version: 1,
    },
  ),
);