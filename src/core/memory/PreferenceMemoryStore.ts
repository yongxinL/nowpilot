// src/core/memory/PreferenceMemoryStore.ts — §18 Phase-5 create-list
// (D-05-18). The np_persona WRITER (R2/R-7: persona is USER CONFIG, never a
// fact — the fact store never stores persona; §3.5 "persists in this store
// (np_persona)"). Phase 3 shipped personaConfig.ts as the READ-ONLY accessor;
// this store supersedes it as the write path, while personaConfig keeps the
// Phase-3 read seam (dual-shape — Pitfall 1 guard).
//
// Open Q1 resolution (05-RESEARCH L511-514): np_persona stores the FULL
// UserPreferences shape (UserPreferencesSchema-gated, GR-4). Legacy Phase-3
// PersonaProfile values are converted on read via
// resolvePersona(DEFAULT_PERSONA, { ...defaults, personaId: legacy.id,
// personaOverrides: { name, tone, brevity } }) — the merged profile's
// identity/languageStyle map back onto the overrides shape, and the legacy
// profile's OWN id is preserved as personaId (the derived-profile id is the
// base default — the legacy id is the honest source). A stored value that is
// neither shape logs PERSONA_LOAD_FAILED and returns DEFAULT_USER_PREFERENCES —
// NEVER throws, NEVER a crash (AI-05 empty precedent, personaConfig L9-17).
//
// Single key §3.5: NP_PERSONA_KEY ('np_persona', registered area:'local' in
// Setting.ts L67) is the only persona storage key — the store writes it via
// settingWrite (permission table + §13 promise-chain mutex, never throws) and
// reads via settingRead; no direct chrome.storage access anywhere.
//
// Every failure path calls debugLog with the canonical PERSONA_LOAD_FAILED
// code (Golden Rule 9, Open Q7 — no new C.2 codes); write paths never throw
// (PATTERNS Shared Pattern 1).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { settingRead, settingWrite } from '@/core/storage/Setting';
import type { UserPreferences } from '@/core/memory/types';
import { UserPreferencesSchema } from '@/core/memory/types';
import { DEFAULT_PERSONA, PersonaProfileSchema } from '@/core/ai/persona/PersonaProfile';
import type { PersonaProfile } from '@/core/ai/persona/PersonaProfile';
import { resolvePersona } from '@/core/ai/persona/PersonaInjector';
import { NP_PERSONA_KEY } from '@/core/ai/persona/personaConfig';

/** D-05-08 resource id — the preferences section source MemoryEngine (05-04) consumes. */
export const PREFERENCE_MEMORY_RESOURCE_ID = 'preferences';

/**
 * The base preference surface — byte-identical to personaConfig's
 * BASE_PERSONA_PREFS (test pins the equality so the two can never drift):
 * responseStyle 'balanced', preferredLanguage 'en', preferStructuredOutput
 * true, allowCloudFallbackFromLocal false (D-13 'prefer-local' default),
 * toolAutonomy 'allow_safe_tools', defaultSurface 'sidepanel'. No
 * personaId/personaOverrides — the base persona stands when none stored.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  responseStyle: 'balanced',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false, // D-13: false → 'prefer-local' default
  toolAutonomy: 'allow_safe_tools',
  defaultSurface: 'sidepanel',
};

/**
 * D-05-18 write path: the np_persona WRITER. The value is gated by
 * UserPreferencesSchema (GR-4) BEFORE it reaches chrome.storage — an invalid
 * shape logs PERSONA_LOAD_FAILED and is dropped (nothing persists). settingWrite
 * never throws (permission table + serialized mutex), so write() never throws.
 */
export async function write(prefs: UserPreferences): Promise<void> {
  const parsed = UserPreferencesSchema.safeParse(prefs);
  if (!parsed.success) {
    debugLog(
      ERROR_CODES.PERSONA_LOAD_FAILED,
      'np_persona write rejected by UserPreferencesSchema',
      {
        module: 'PreferenceMemoryStore',
        extra: { issueCount: parsed.error.issues.length },
      },
    );
    return;
  }
  await settingWrite(NP_PERSONA_KEY, parsed.data);
}

/**
 * Pitfall 1 shim: convert a legacy Phase-3 PersonaProfile into the Phase-5
 * UserPreferences overrides shape. The overrides derive through
 * resolvePersona(DEFAULT_PERSONA, prefs) — the SAME merge PersonaInjector
 * applies — so a stored legacy profile produces byte-identical injected
 * persona output before and after the migration; personaId carries the legacy
 * profile's OWN id (the merged profile's id is the base default).
 */
function fromLegacyProfile(legacy: PersonaProfile): UserPreferences {
  const merged = resolvePersona(DEFAULT_PERSONA, {
    ...DEFAULT_USER_PREFERENCES,
    personaId: legacy.id,
    personaOverrides: {
      name: legacy.identity.name,
      tone: legacy.languageStyle.tone,
      brevity: legacy.languageStyle.brevity,
    },
  });
  return {
    ...DEFAULT_USER_PREFERENCES,
    personaId: legacy.id,
    personaOverrides: {
      name: merged.identity.name,
      tone: merged.languageStyle.tone,
      brevity: merged.languageStyle.brevity,
    },
  };
}

/**
 * D-05-18/Open Q1 dual-shape read: UserPreferencesSchema FIRST (the Phase-5
 * shape passes through byte-equal); PersonaProfileSchema legacy fallback
 * (converted via fromLegacyProfile — the Phase-3 pipeline cannot regress,
 * Pitfall 1 closed); neither parses → PERSONA_LOAD_FAILED +
 * DEFAULT_USER_PREFERENCES. NEVER throws.
 */
export async function read(): Promise<UserPreferences> {
  const stored = await settingRead<unknown>(
    NP_PERSONA_KEY,
    (v) => v, // schema validation below — settingRead only guards permission/area
    undefined,
  );
  if (stored === undefined) return DEFAULT_USER_PREFERENCES;
  const parsed = UserPreferencesSchema.safeParse(stored);
  if (parsed.success) {
    // Boundary cast: UserPreferencesSchema validates the shape but types
    // defaultProviderId as `string` (schema shipped 05-01, pinned by
    // MemoryTypes.test.ts); the UserPreferences interface narrows it to
    // ProviderId. Values persisted via write() are already interface-typed, so
    // the cast is a schema/interface alignment, never a validation bypass.
    return parsed.data as UserPreferences;
  }
  const legacy = PersonaProfileSchema.safeParse(stored);
  if (legacy.success) return fromLegacyProfile(legacy.data);
  debugLog(
    ERROR_CODES.PERSONA_LOAD_FAILED,
    'np_persona failed both UserPreferencesSchema and PersonaProfileSchema validation — using defaults',
    {
      module: 'PreferenceMemoryStore',
      extra: { issueCount: parsed.error.issues.length },
    },
  );
  return DEFAULT_USER_PREFERENCES;
}
