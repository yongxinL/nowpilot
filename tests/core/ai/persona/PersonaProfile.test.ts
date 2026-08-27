import { describe, it, expect } from 'vitest';
import {
  PersonaProfileSchema,
  DEFAULT_PERSONA,
} from '../../../../src/core/ai/persona/PersonaProfile';

/**
 * RICH-R-01 (plan 03-02, Task 1): DEFAULT_PERSONA is the Appendix N.1
 * constant field-for-field ("do not paraphrase"), and PersonaProfileSchema
 * enforces the locked §21.6 tone/brevity enums plus required-field shapes.
 */

describe('PersonaProfile (03-02 Task 1)', () => {
  it('DEFAULT_PERSONA matches Appendix N.1 field-for-field', () => {
    expect(DEFAULT_PERSONA.id).toBe('nowpilot-default');
    expect(DEFAULT_PERSONA.identity.name).toBe('NowPilot');
    expect(DEFAULT_PERSONA.identity.tagline).toBe('Your ServiceNow support co-pilot');
    expect(DEFAULT_PERSONA.identity.domain).toBe(
      'ServiceNow support engineering, technical troubleshooting, and knowledge management',
    );
    expect(DEFAULT_PERSONA.personalityCore).toEqual([
      'privacy-first',
      'helpful',
      'precise',
      'humble',
    ]);
    expect(DEFAULT_PERSONA.behavioralDrivers).toEqual([
      'prefers asking clarifying questions over guessing',
      'cites sources when available',
    ]);
    expect(DEFAULT_PERSONA.languageStyle.tone).toBe('professional-warm');
    expect(DEFAULT_PERSONA.languageStyle.vocabulary).toBe(
      'technical but accessible to support engineers',
    );
    expect(DEFAULT_PERSONA.languageStyle.brevity).toBe('brief');
    expect(DEFAULT_PERSONA.emotionalRepertoire).toEqual([
      'empathy',
      'encouragement',
      'curiosity',
    ]);
  });

  it('DEFAULT_PERSONA round-trips through the schema', () => {
    expect(PersonaProfileSchema.safeParse(DEFAULT_PERSONA).success).toBe(true);
  });

  it('schema rejects an invalid tone', () => {
    const invalid = {
      ...DEFAULT_PERSONA,
      languageStyle: { ...DEFAULT_PERSONA.languageStyle, tone: 'casual' },
    };
    const result = PersonaProfileSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('schema rejects an invalid brevity', () => {
    const invalid = {
      ...DEFAULT_PERSONA,
      languageStyle: { ...DEFAULT_PERSONA.languageStyle, brevity: 'chatty' },
    };
    const result = PersonaProfileSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('missing required field fails parse (partial profile construction is impossible)', () => {
    const { name: _name, ...identityWithoutName } = DEFAULT_PERSONA.identity;
    const partial = {
      ...DEFAULT_PERSONA,
      identity: identityWithoutName,
    };
    const result = PersonaProfileSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it('schema rejects an empty id', () => {
    const result = PersonaProfileSchema.safeParse({ ...DEFAULT_PERSONA, id: '' });
    expect(result.success).toBe(false);
  });
});