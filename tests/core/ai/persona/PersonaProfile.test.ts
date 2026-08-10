// tests/core/ai/persona/PersonaProfile.test.ts — contract (03-07, Appendix N.1 +
// D-09). PersonaProfileSchema is the single validation gate every np_persona
// read passes through: a canonical DEFAULT_PERSONA is schema-valid, invalid
// shapes are rejected (missing id / bad tone enum / over-length name / empty
// personalityCore), and the personaConfig accessor falls back to DEFAULT_PERSONA
// on an EMPTY or INVALID np_persona key — logging PERSONA_LOAD_FAILED, never
// throwing, never blocking the Sender (AI-05 empty). readPersonaPrefs maps the
// stored persona's name/tone/brevity onto personaOverrides (D-10 config-provider
// seam) and yields NO overrides for an empty/invalid key.
//
// Runs in the default jsdom-align environment; chrome.storage.local is the wxt
// fakeBrowser mock (auto-reset per test in tests/setup.ts) — seeding uses
// fakeBrowser.storage.local.set directly, reads go through the real Setting.ts
// permission table (np_persona is registered area:'local' — no registry change).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import { DEFAULT_PERSONA, PersonaProfileSchema } from '@/core/ai/persona/PersonaProfile';
import {
  NP_PERSONA_KEY,
  readPersona,
  readPersonaPrefs,
} from '@/core/ai/persona/personaConfig';
import type { PersonaProfile } from '@/core/ai/persona/PersonaProfile';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A valid custom profile (distinct from DEFAULT_PERSONA). */
const CUSTOM_PERSONA: PersonaProfile = {
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

describe('PersonaProfileSchema — Appendix N.1 validation', () => {
  it('accepts a canonical valid profile (DEFAULT_PERSONA is schema-valid)', () => {
    expect(PersonaProfileSchema.safeParse(DEFAULT_PERSONA).success).toBe(true);
  });

  it('accepts a valid custom profile', () => {
    expect(PersonaProfileSchema.safeParse(CUSTOM_PERSONA).success).toBe(true);
  });

  it('rejects a profile with a missing id', () => {
    const { id: _id, ...noId } = CUSTOM_PERSONA;
    expect(PersonaProfileSchema.safeParse(noId).success).toBe(false);
  });

  it('rejects an unknown tone enum value', () => {
    const badTone = {
      ...CUSTOM_PERSONA,
      languageStyle: { ...CUSTOM_PERSONA.languageStyle, tone: 'aggressive' },
    };
    expect(PersonaProfileSchema.safeParse(badTone).success).toBe(false);
  });

  it('rejects an over-length identity name (> 40 chars)', () => {
    const longName = {
      ...CUSTOM_PERSONA,
      identity: { ...CUSTOM_PERSONA.identity, name: 'x'.repeat(41) },
    };
    expect(PersonaProfileSchema.safeParse(longName).success).toBe(false);
  });

  it('rejects an empty personalityCore (min 1)', () => {
    const noCore = { ...CUSTOM_PERSONA, personalityCore: [] };
    expect(PersonaProfileSchema.safeParse(noCore).success).toBe(false);
  });
});

describe('readPersona — DEFAULT_PERSONA fallback (D-09, AI-05 empty)', () => {
  it('returns DEFAULT_PERSONA when np_persona is empty (never throws)', async () => {
    // fresh fakeBrowser storage — np_persona absent
    const persona = await readPersona();
    expect(persona).toBe(DEFAULT_PERSONA);
    expect(persona.id).toBe('nowpilot-default');
  });

  it('returns DEFAULT_PERSONA for an invalid stored value, logging PERSONA_LOAD_FAILED', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: { not: 'a persona' } });

    const persona = await readPersona();

    expect(persona).toBe(DEFAULT_PERSONA);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('PERSONA_LOAD_FAILED'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns the stored schema-valid persona unchanged', async () => {
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: CUSTOM_PERSONA });

    const persona = await readPersona();

    expect(persona).toEqual(CUSTOM_PERSONA);
    expect(persona.id).toBe('custom-support-lead');
  });
});

describe('readPersonaPrefs — D-10 config-provider seam', () => {
  it('yields base prefs with NO personaOverrides for an empty key', async () => {
    const prefs = await readPersonaPrefs();
    expect(prefs.personaOverrides).toBeUndefined();
    expect(prefs.personaId).toBeUndefined();
  });

  it('maps the stored persona name/tone/brevity onto personaOverrides', async () => {
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: CUSTOM_PERSONA });

    const prefs = await readPersonaPrefs();

    expect(prefs.personaId).toBe('custom-support-lead');
    expect(prefs.personaOverrides).toEqual({
      name: 'Aria',
      tone: 'friendly',
      brevity: 'balanced',
    });
  });

  it('yields base prefs with NO overrides for an invalid stored value', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await fakeBrowser.storage.local.set({ [NP_PERSONA_KEY]: 42 });

    const prefs = await readPersonaPrefs();

    expect(prefs.personaOverrides).toBeUndefined();
    expect(prefs.personaId).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('PERSONA_LOAD_FAILED'),
      expect.anything(),
      expect.anything(),
    );
  });
});
