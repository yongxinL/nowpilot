// src/core/ai/persona/personaConfig.ts — D-09 np_persona accessor (+1 documented
// to §18 by 03-09: not in the §18 Phase-3 create-list). The persona config is
// USER config (R-7) stored at chrome.storage.local key `np_persona` — ALREADY
// registered area:'local' in Setting.ts line 67 (NO Setting.ts modification).
//
// Read-only this phase (D-10): Phase 5's PreferenceMemoryStore is the writer;
// it swaps only the injected provider, so this file stays the single read seam.
// Every read is PersonaProfileSchema-validated (the D-09/T-1-13 inbound gate);
// an empty or invalid key logs PERSONA_LOAD_FAILED and falls back to
// DEFAULT_PERSONA — never a crash, never a blocked Sender (AI-05 empty).
//
// readPersonaPrefs() maps the stored persona's name/tone/brevity onto
// UserPreferences.personaOverrides so PersonaInjector.resolvePersona merges
// them deterministically — changing np_persona changes behavior by DATA, not
// code (R-2/R-7, §18 DONE-when "UserPreferences.personaOverrides apply without
// a code change"). An empty/invalid key yields {} (no overrides → the base
// persona stands).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { settingRead } from '@/core/storage/Setting';
import type { UserPreferences } from '@/core/memory/types';
import { DEFAULT_PERSONA, PersonaProfileSchema } from './PersonaProfile';
import type { PersonaProfile } from './PersonaProfile';

/** §15.1 key — registered area:'local' at Setting.ts (NO registry change, D-09). */
export const NP_PERSONA_KEY = 'np_persona';

interface PersonaLoad {
  persona: PersonaProfile;
  /** true when storage held a schema-valid profile; false for empty/invalid (DEFAULT_PERSONA). */
  loaded: boolean;
}

/**
 * D-09 shared read path: one chrome.storage.local read (Setting.ts permission
 * table + STORE_READ error handling), one schema validation, one fallback. The
 * T-1-13 inbound gate lives HERE — a stored value is never merged raw.
 */
async function loadPersona(): Promise<PersonaLoad> {
  const stored = await settingRead<unknown>(
    NP_PERSONA_KEY,
    (v) => v, // schema validation below — settingRead only guards permission/area
    undefined,
  );
  if (stored === undefined) {
    // Empty key — silent DEFAULT_PERSONA (the Sender is never blocked; the
    // persona pipeline is independent of provider config, AI-05 empty).
    return { persona: DEFAULT_PERSONA, loaded: false };
  }
  const parsed = PersonaProfileSchema.safeParse(stored);
  if (!parsed.success) {
    debugLog(ERROR_CODES.PERSONA_LOAD_FAILED, 'np_persona failed PersonaProfileSchema validation — using DEFAULT_PERSONA', {
      module: 'personaConfig',
      extra: { issueCount: parsed.error.issues.length },
    });
    return { persona: DEFAULT_PERSONA, loaded: false };
  }
  return { persona: parsed.data, loaded: true };
}

/** D-09: the validated stored persona, or DEFAULT_PERSONA (never throws). */
export async function readPersona(): Promise<PersonaProfile> {
  return (await loadPersona()).persona;
}

/**
 * D-09/D-10: the stored persona as UserPreferences-shaped config for the
 * PersonaInjector config-provider seam. name/tone/brevity ride in
 * personaOverrides so resolvePersona can merge them onto the base persona.
 * Empty/invalid → persona defaults (no overrides) — the base persona stands.
 * Non-persona preference fields are Phase-3 defaults: the persona accessor
 * only OWNS the persona slice (Phase 5's PreferenceMemoryStore writer swaps
 * the injected provider with the full user-prefs surface).
 */
const BASE_PERSONA_PREFS: UserPreferences = {
  responseStyle: 'balanced',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false, // D-13: false → 'prefer-local' default
  toolAutonomy: 'allow_safe_tools',
  defaultSurface: 'sidepanel',
};

export async function readPersonaPrefs(): Promise<UserPreferences> {
  const { persona, loaded } = await loadPersona();
  if (!loaded) return BASE_PERSONA_PREFS;
  return {
    ...BASE_PERSONA_PREFS,
    personaId: persona.id,
    personaOverrides: {
      name: persona.identity.name,
      tone: persona.languageStyle.tone,
      brevity: persona.languageStyle.brevity,
    },
  };
}
