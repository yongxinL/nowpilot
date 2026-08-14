// tests/core/memory/PreferenceMemoryStore.test.ts — D-05-18 KNW-04 (required by
// §18): the np_persona WRITER with the Open Q1 dual-shape read (Pitfall 1
// guard). Uses the fake chrome.storage.local harness (wxt fakeBrowser, per
// Setting.test.ts) so reads/writes round-trip through the REAL Setting layer
// (np_persona is registered area:'local' — no registry change). Cases:
//   1. write→read round-trip: a full UserPreferences survives the
//      UserPreferencesSchema gate byte-equal.
//   2. Legacy compat (Pitfall 1 pin): a seeded Phase-3 PersonaProfile reads
//      back as UserPreferences with personaId + personaOverrides derived from
//      the legacy id/name/tone/brevity; personaConfig.readPersona() still
//      returns the stored profile unchanged (no PERSONA_LOAD_FAILED reset).
//   3. Invalid stored value (a number) → DEFAULT_USER_PREFERENCES, never throws.
//   4. Schema-gate write: an out-of-union responseStyle resolves WITHOUT
//      persisting (read() returns the previous value) and logs
//      PERSONA_LOAD_FAILED.
//   5. Phase-3 pipeline no-regression: readPersonaPrefs() for a legacy profile
//      returns the pre-migration personaOverrides mapping byte-identical.
//   6. Equality pin: DEFAULT_USER_PREFERENCES is byte-identical to the
//      personaConfig BASE_PERSONA_PREFS surface (the two homes never drift).
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_USER_PREFERENCES, read, write } from '@/core/memory/PreferenceMemoryStore';
import type { UserPreferences } from '@/core/memory/types';
import { NP_PERSONA_KEY, readPersona, readPersonaPrefs } from '@/core/ai/persona/personaConfig';
import type { PersonaProfile } from '@/core/ai/persona/PersonaProfile';
import { DEFAULT_PERSONA } from '@/core/ai/persona/PersonaProfile';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A legacy Phase-3 PersonaProfile-shaped value (PersonaProfileSchema-valid). */
const LEGACY_PROFILE: PersonaProfile = {
  id: 'custom-support-lead',
  identity: {
    name: 'Aria',
    tagline: 'Your precise troubleshooting partner',
    domain: 'ServiceNow incident triage and resolution',
  },
  personalityCore: ['precise', 'methodical', 'calm'],
  behavioralDrivers: ['always verifies before answering'],
  languageStyle: {
    tone: 'friendly',
    vocabulary: 'plain language for support engineers',
    brevity: 'balanced',
  },
  emotionalRepertoire: ['empathy'],
};

/** The pre-migration readPersonaPrefs mapping for LEGACY_PROFILE — pinned literal. */
const LEGACY_PREFS = {
  responseStyle: 'balanced',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false,
  toolAutonomy: 'allow_safe_tools',
  defaultSurface: 'sidepanel',
  personaId: 'custom-support-lead',
  personaOverrides: {
    name: 'Aria',
    tone: 'friendly',
    brevity: 'balanced',
  },
} as const;

const FULL_PREFS: UserPreferences = {
  responseStyle: 'concise',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false,
  defaultProviderId: 'anthropic',
  toolAutonomy: 'ask_every_time',
  defaultSurface: 'standalone',
  personaId: 'p-1',
  personaOverrides: {
    name: 'Alex',
    tone: 'friendly',
    brevity: 'balanced',
  },
};

describe('PreferenceMemoryStore — write→read round-trip', () => {
  it('persists a full UserPreferences through the schema gate byte-equal', async () => {
    await write(FULL_PREFS);

    expect(await read()).toEqual(FULL_PREFS);
  });

  it('returns DEFAULT_USER_PREFERENCES for an empty key', async () => {
    expect(await read()).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('DEFAULT_USER_PREFERENCES is byte-identical to the personaConfig base surface', () => {
    // The two homes (personaConfig BASE_PERSONA_PREFS vs this export) must
    // never drift — pin the literal here so a change fails the test.
    expect(DEFAULT_USER_PREFERENCES).toEqual({
      responseStyle: 'balanced',
      preferredLanguage: 'en',
      preferStructuredOutput: true,
      allowCloudFallbackFromLocal: false,
      toolAutonomy: 'allow_safe_tools',
      defaultSurface: 'sidepanel',
    });
  });
});

describe('PreferenceMemoryStore — legacy Phase-3 compat (Pitfall 1 pin)', () => {
  it('converts a legacy PersonaProfile to UserPreferences with derived overrides', async () => {
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: LEGACY_PROFILE });

    const prefs = await read();

    expect(prefs.personaId).toBe('custom-support-lead');
    expect(prefs.personaOverrides).toEqual({
      name: 'Aria',
      tone: 'friendly',
      brevity: 'balanced',
    });
    expect(prefs.responseStyle).toBe(DEFAULT_USER_PREFERENCES.responseStyle);
  });

  it('personaConfig.readPersona() still returns the legacy profile unchanged', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: LEGACY_PROFILE });

    const persona = await readPersona();

    expect(persona).toEqual(LEGACY_PROFILE); // not DEFAULT_PERSONA, no PERSONA_LOAD_FAILED
    expect(persona.id).toBe('custom-support-lead');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('readPersonaPrefs() maps the legacy profile byte-identical to pre-migration', async () => {
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: LEGACY_PROFILE });

    const prefs = await readPersonaPrefs();

    expect(prefs).toEqual(LEGACY_PREFS);
  });

  it('returns DEFAULT_USER_PREFERENCES for an invalid stored value, never throws', async () => {
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: 42 });

    await expect(read()).resolves.toEqual(DEFAULT_USER_PREFERENCES);
  });
});

describe('PreferenceMemoryStore — schema-gated write (GR-4)', () => {
  it('rejects an out-of-union responseStyle WITHOUT persisting, logging PERSONA_LOAD_FAILED', async () => {
    await write(FULL_PREFS);
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      write({ ...FULL_PREFS, responseStyle: 'chatty' } as unknown as UserPreferences),
    ).resolves.toBeUndefined();

    expect(await read()).toEqual(FULL_PREFS); // previous value untouched
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('PERSONA_LOAD_FAILED'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects a non-boolean preferStructuredOutput WITHOUT persisting', async () => {
    await write(FULL_PREFS);

    await write({ ...FULL_PREFS, preferStructuredOutput: 'yes' } as unknown as UserPreferences);

    expect(await read()).toEqual(FULL_PREFS);
  });

  it('a write on a DEFAULT_PERSONA-typed key never clobbers an unrelated legacy value', async () => {
    // A UserPreferences write and a legacy read coexist on the SAME key: after
    // writing prefs, reading through the Phase-3 accessor still yields a persona
    // (never a reset to DEFAULT_PERSONA with a missing stored value).
    await write(FULL_PREFS);

    const persona = await readPersona();
    expect(persona).not.toBe(DEFAULT_PERSONA); // resolved, not the fallback
    expect(persona.identity.name).toBe('Alex'); // override applied
  });
});
