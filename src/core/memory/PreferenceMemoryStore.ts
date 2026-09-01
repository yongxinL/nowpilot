/**
 * PreferenceMemoryStore — np_persona owner (RICH-R-05, D-112).
 *
 * Persists the user's persona config { personaId, persona, personaOverrides? }
 * to chrome.storage.local under the `np_persona' key. Persona is user CONFIG,
 * never a fact (R2, spec 664/2384) — this store imports ZERO storage/memory
 * DB modules.
 *
 * Single-writer gated (D-106/§13): non-primary surfaces skip np_persona persist.
 * Idempotent hydrate: re-hydrating over an already-hydrated store leaves the
 * persisted config === in-memory config (single-key overwrite, no duplicates).
 *
 * Open Q2: the live PersonaInjector re-point (reading overrides from np_persona
 * at injection time) is Phase 15 — this phase ships the store + producers only.
 */
import { z } from 'zod';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';
import { PersonaProfileSchema, DEFAULT_PERSONA, type PersonaProfile } from '../ai/persona/PersonaProfile';
import { personaOverridesSchema, type PersonaOverrides } from './types';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { debugLog } from '../log/debugLog';

/** np_persona payload schema — zod-validated on hydrate (T-8-01). */
export const npPersonaSchema = z.object({
  personaId: z.string().min(1),
  persona: PersonaProfileSchema,
  personaOverrides: personaOverridesSchema.optional(),
});

export type NpPersona = z.infer<typeof npPersonaSchema>;

interface PreferenceMemoryStoreState {
  personaId: string;
  persona: PersonaProfile;
  personaOverrides: PersonaOverrides | undefined;
  setPersona: (p: PersonaProfile) => void;
  setPersonaOverrides: (o: PersonaOverrides | undefined) => void;
  /** Boot hydration — re-reads np_persona from chrome.storage.local (D-112). */
  hydrate: () => Promise<void>;
}

/** R2 (spec 664): persona is user CONFIG — never a fact. np_persona never touches MemoryDB.userFacts. */

export const usePreferenceMemoryStore = create<PreferenceMemoryStoreState>()(
  persist(
    (set, _get, api) => ({
      personaId: crypto.randomUUID(),
      persona: DEFAULT_PERSONA,
      personaOverrides: undefined,

      setPersona: (p: PersonaProfile) => {
        // Single-writer gate (D-106): non-primary surfaces never persist np_persona.
        if (!isPrimaryWriter()) {
          debugLog('NP_PERSONA_NON_PRIMARY_WRITE_SKIPPED', 'setPersona skipped — non-primary surface');
          return;
        }
        api.setState({ persona: p });
      },

      setPersonaOverrides: (o: PersonaOverrides | undefined) => {
        if (!isPrimaryWriter()) {
          debugLog('NP_PERSONA_NON_PRIMARY_WRITE_SKIPPED', 'setPersonaOverrides skipped — non-primary surface');
          return;
        }
        api.setState({ personaOverrides: o });
      },

      hydrate: async () => {
        await api.persist.rehydrate();
        // Zod-validate the persisted blob after rehydrate (T-8-01).
        // A tampered/legacy blob falls back to DEFAULT_PERSONA, never crashes.
        const state = _get();
        const parsed = npPersonaSchema.safeParse({
          personaId: state.personaId,
          persona: state.persona,
          personaOverrides: state.personaOverrides,
        });
        if (!parsed.success) {
          debugLog('NP_PERSONA_HYDRATE_VALIDATION_FAILED', 'tampered blob — falling back to DEFAULT_PERSONA', {
            error: parsed.error.message,
          });
          api.setState({
            personaId: crypto.randomUUID(),
            persona: DEFAULT_PERSONA,
            personaOverrides: undefined,
          });
        }
      },
    }),
    {
      name: 'np_persona',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        personaId: state.personaId,
        persona: state.persona,
        personaOverrides: state.personaOverrides,
      }),
      version: 1,
    },
  ),
);
