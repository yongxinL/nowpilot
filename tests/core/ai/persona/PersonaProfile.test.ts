import { describe, it, expect } from 'vitest';
import { DEFAULT_PERSONA_PROFILE } from '../../../../src/core/ai/persona/PersonaProfile';
import type { PersonaProfile } from '../../../../src/core/ai/persona/PersonaProfile';
import { personaService } from '../../../../src/core/ai/persona/PersonaService';

describe('PersonaProfile', () => {
  // Test 1: identity name and tagline
  it('exports identity.name === NowPilot and identity.tagline === Your AI work co-pilot', () => {
    expect(DEFAULT_PERSONA_PROFILE.identity.name).toBe('NowPilot');
    expect(DEFAULT_PERSONA_PROFILE.identity.tagline).toBe('Your AI work co-pilot');
  });

  // Test 2: coreValues array
  it('includes coreValues containing privacy-first, helpful, precise, humble', () => {
    expect(DEFAULT_PERSONA_PROFILE.coreValues).toContain('privacy-first');
    expect(DEFAULT_PERSONA_PROFILE.coreValues).toContain('helpful');
    expect(DEFAULT_PERSONA_PROFILE.coreValues).toContain('precise');
    expect(DEFAULT_PERSONA_PROFILE.coreValues).toContain('humble');
  });

  // Test 3: languageStyle with tone, responseStyle, vocabulary
  it('includes languageStyle with expected tone, responseStyle, vocabulary', () => {
    expect(DEFAULT_PERSONA_PROFILE.languageStyle.tone).toBe(
      'Professional + approachable — technically accurate, direct, practical, friendly'
    );
    expect(DEFAULT_PERSONA_PROFILE.languageStyle.responseStyle).toBe(
      'Concise by default with task-aware expansion'
    );
    expect(DEFAULT_PERSONA_PROFILE.languageStyle.vocabulary).toBe(
      'Technical but accessible, clear everyday language, avoids corporate jargon'
    );
  });

  // Test 4: emotionalAwareness with three explicit rules
  it('includes emotionalAwareness with frustrationAcknowledgment, progressCelebration, humbleErrorRecovery', () => {
    const ea = DEFAULT_PERSONA_PROFILE.emotionalAwareness;
    expect(ea.frustrationAcknowledgment).toBeTruthy();
    expect(typeof ea.frustrationAcknowledgment).toBe('string');
    expect(ea.frustrationAcknowledgment.length).toBeGreaterThan(0);

    expect(ea.progressCelebration).toBeTruthy();
    expect(typeof ea.progressCelebration).toBe('string');
    expect(ea.progressCelebration.length).toBeGreaterThan(0);

    expect(ea.humbleErrorRecovery).toBeTruthy();
    expect(typeof ea.humbleErrorRecovery).toBe('string');
    expect(ea.humbleErrorRecovery.length).toBeGreaterThan(0);
  });

  // Test 5: safetyBoundary rule
  it('includes safetyBoundary rule describing refusal style', () => {
    expect(DEFAULT_PERSONA_PROFILE.safetyBoundary).toBeTruthy();
    expect(typeof DEFAULT_PERSONA_PROFILE.safetyBoundary).toBe('string');
    expect(DEFAULT_PERSONA_PROFILE.safetyBoundary.length).toBeGreaterThan(0);
  });
});

describe('PersonaService', () => {
  // Test 6: getProfile() returns the identical PersonaProfile object
  it('getProfile() returns the DEFAULT_PERSONA_PROFILE object', () => {
    const profile = personaService.getProfile();
    expect(profile).toBe(DEFAULT_PERSONA_PROFILE);
    expect(profile.identity.name).toBe('NowPilot');
  });

  // Test 7: exports singleton personaService
  it('exports personaService singleton', () => {
    expect(personaService).toBeDefined();
    expect(personaService.getProfile).toBeInstanceOf(Function);
  });
});
