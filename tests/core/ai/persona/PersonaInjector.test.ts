import { describe, it, expect } from 'vitest';
import { DEFAULT_PERSONA } from '../../../../src/core/ai/persona/PersonaProfile';
import {
  PersonaInjector,
  resolvePersona,
  buildPersonaBlock,
} from '../../../../src/core/ai/persona/PersonaInjector';
import type { PipelineStage } from '../../../../src/core/ai/persona/PersonaInjector';
import type { UserPreferences } from '../../../../src/core/ai/UserPreferences';

/**
 * RICH-R-02 / RICH-R-10 (plan 03-02, Task 3): the Appendix N.2 inject
 * contract — data-merge overrides with `??` precedence (partial overrides
 * leave seeded fields), byte-stable block per persona (§1.3 prompt-cache
 * preservation), persona block prepended FIRST.
 */

const BASE_SYSTEM = 'You are the planner stage. Respond concisely.';

const fullPrefs: UserPreferences = {
  responseStyle: 'mixed',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false,
  toolAutonomy: 'ask',
  defaultSurface: 'sidepanel',
  personaOverrides: { name: 'NP-Consult', tone: 'concise', brevity: 'detailed' },
};

describe('PersonaInjector (03-02 Task 3)', () => {
  it('(a) no prefs → base block + baseSystem unchanged', () => {
    const out = PersonaInjector.inject('planner', BASE_SYSTEM);
    expect(out).toBe(`${buildPersonaBlock(DEFAULT_PERSONA)}\n\n${BASE_SYSTEM}`);
    // resolvePersona without overrides returns the base profile untouched.
    expect(resolvePersona(DEFAULT_PERSONA)).toEqual(DEFAULT_PERSONA);
  });

  it('(b) full overrides (name/tone/brevity) are reflected in the block', () => {
    const block = buildPersonaBlock(resolvePersona(DEFAULT_PERSONA, fullPrefs));
    expect(block).toContain('You are NP-Consult');
    expect(block).toContain('Tone: concise.');
    expect(block).toContain('Default brevity: detailed.');
  });

  it('(c) partial overrides leave unset fields from the seed', () => {
    const resolved = resolvePersona(DEFAULT_PERSONA, {
      responseStyle: 'mixed',
      preferredLanguage: 'en',
      preferStructuredOutput: true,
      allowCloudFallbackFromLocal: false,
      toolAutonomy: 'ask',
      defaultSurface: 'sidepanel',
      personaOverrides: { tone: 'concise' },
    });
    expect(resolved.languageStyle.tone).toBe('concise');
    expect(resolved.identity.name).toBe(DEFAULT_PERSONA.identity.name);
    expect(resolved.identity.tagline).toBe(DEFAULT_PERSONA.identity.tagline);
    expect(resolved.languageStyle.brevity).toBe(DEFAULT_PERSONA.languageStyle.brevity);
    // The base profile object is never mutated (pure data merge, D-58).
    expect(DEFAULT_PERSONA.languageStyle.tone).toBe('professional-warm');
  });

  it('(d) byte-stability — identical inputs → identical strings; different overrides → different blocks', () => {
    const a = PersonaInjector.inject('planner', BASE_SYSTEM);
    const b = PersonaInjector.inject('planner', BASE_SYSTEM);
    expect(a).toBe(b);

    const changed = PersonaInjector.inject('planner', BASE_SYSTEM, {
      prefs: {
        responseStyle: 'mixed',
        preferredLanguage: 'en',
        preferStructuredOutput: true,
        allowCloudFallbackFromLocal: false,
        toolAutonomy: 'ask',
        defaultSurface: 'sidepanel',
        personaOverrides: { tone: 'friendly' },
      },
    });
    expect(changed).not.toBe(a);
    expect(changed).toContain('Tone: friendly.');
  });

  it('(e) persona-first ordering — the block is the string PREFIX of the returned prompt', () => {
    const out = PersonaInjector.inject('renderer', BASE_SYSTEM);
    expect(out.startsWith(buildPersonaBlock(DEFAULT_PERSONA))).toBe(true);
    expect(out.endsWith(BASE_SYSTEM)).toBe(true);
  });

  it('(f) per-stage — inject works for all four PipelineStage values', () => {
    const stages: PipelineStage[] = ['planner', 'executor', 'renderer', 'memoryExtractor'];
    for (const stage of stages) {
      const out = PersonaInjector.inject(stage, BASE_SYSTEM);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      expect(out.startsWith(buildPersonaBlock(DEFAULT_PERSONA))).toBe(true);
      expect(out.endsWith(BASE_SYSTEM)).toBe(true);
    }
  });

  it('custom base persona is respected when passed via opts.persona', () => {
    const custom = {
      ...DEFAULT_PERSONA,
      id: 'custom',
      identity: { ...DEFAULT_PERSONA.identity, name: 'CustomAgent' },
    };
    const out = PersonaInjector.inject('planner', BASE_SYSTEM, { persona: custom });
    expect(out.startsWith(buildPersonaBlock(custom))).toBe(true);
    expect(out).toContain('You are CustomAgent');
  });
});