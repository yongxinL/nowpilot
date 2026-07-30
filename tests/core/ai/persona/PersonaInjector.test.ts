import { describe, it, expect } from 'vitest';
import { DEFAULT_PERSONA, PersonaProfileSchema } from '../../../../src/core/ai/persona/PersonaProfile';
import { inject, buildPersonaBlock, buildPlannerPersonaBlock } from '../../../../src/core/ai/persona/PersonaInjector';
import type { PersonaProfile } from '../../../../src/core/ai/persona/PersonaProfile';

const BASE_SYSTEM = '[SYSTEM] You are a helpful AI assistant.';

const CUSTOM_PERSONA: PersonaProfile = {
  id: 'custom',
  name: 'TestBot',
  tone: 'professional',
  brevity: 'concise',
  coreValues: ['Accuracy', 'Speed'],
  languageStyle: 'Technical and precise.',
  behavioralDrivers: 'Always verify facts before responding. Use the most efficient approach.',
  responseFormatRules: 'Return only the answer, no explanation.',
};

describe('PersonaInjector', () => {
  describe('inject', () => {
    it('injects behavioral-only persona block for planner stage', () => {
      const result = inject('planner', BASE_SYSTEM, { profile: DEFAULT_PERSONA });
      expect(result).toContain('[PERSONA - BEHAVIORAL]');
      expect(result).toContain('Brevity: balanced');
      expect(result).toContain(BASE_SYSTEM);
      expect(result).not.toContain('[PERSONA]');
    });

    it('injects full persona profile block for renderer stage', () => {
      const result = inject('renderer', BASE_SYSTEM, { profile: DEFAULT_PERSONA });
      expect(result).toContain('[PERSONA]');
      expect(result).toContain('Name: NowPilot');
      expect(result).toContain('Tone: friendly');
      expect(result).toContain(BASE_SYSTEM);
    });

    it('returns base system unchanged for executor stage', () => {
      const result = inject('executor', BASE_SYSTEM, { profile: DEFAULT_PERSONA });
      expect(result).toBe(BASE_SYSTEM);
    });

    it('falls back to DEFAULT_PERSONA when no profile provided', () => {
      const result = inject('renderer', BASE_SYSTEM);
      expect(result).toContain('Name: NowPilot');
      expect(result).toContain(BASE_SYSTEM);
    });
  });

  describe('buildPersonaBlock', () => {
    it('produces byte-stable output for the same profile', () => {
      const a = buildPersonaBlock(DEFAULT_PERSONA);
      const b = buildPersonaBlock(DEFAULT_PERSONA);
      expect(a).toBe(b);
    });

    it('produces different output for different profiles', () => {
      const a = buildPersonaBlock(DEFAULT_PERSONA);
      const b = buildPersonaBlock(CUSTOM_PERSONA);
      expect(a).not.toBe(b);
    });

    it('outputs sorted core values for deterministic ordering', () => {
      const block = buildPersonaBlock(DEFAULT_PERSONA);
      expect(block).toContain('Admit uncertainty, Be helpful, Keep it concise, Respect privacy');
    });
  });

  describe('section separation', () => {
    it('persona block is placed before the system section', () => {
      const result = inject('renderer', BASE_SYSTEM, { profile: DEFAULT_PERSONA });
      const personaIndex = result.indexOf('[PERSONA]');
      const systemIndex = result.indexOf('[SYSTEM]');
      expect(personaIndex).toBeLessThan(systemIndex);
    });
  });

  describe('PersonaProfile schema', () => {
    it('validates a well-formed profile', () => {
      const result = PersonaProfileSchema.safeParse(DEFAULT_PERSONA);
      expect(result.success).toBe(true);
    });

    it('DEFAULT_PERSONA has all required fields', () => {
      expect(DEFAULT_PERSONA.id).toBe('default');
      expect(DEFAULT_PERSONA.name).toBeTruthy();
      expect(DEFAULT_PERSONA.tone).toBeTruthy();
      expect(DEFAULT_PERSONA.brevity).toBeTruthy();
      expect(DEFAULT_PERSONA.coreValues.length).toBeGreaterThan(0);
    });
  });
});
