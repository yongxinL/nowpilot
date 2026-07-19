import { describe, it, expect, beforeEach } from 'vitest';
import { personaService } from '../../../../src/core/ai/persona/PersonaService';
import { DEFAULT_PERSONA_PROFILE } from '../../../../src/core/ai/persona/PersonaProfile';
import type { PersonaProfile } from '../../../../src/core/ai/persona/PersonaProfile';
import { usePreferenceStore } from '../../../../src/core/memory/PreferenceMemoryStore';

describe('PersonaService', () => {
  describe('getActiveProfile()', () => {
    beforeEach(() => {
      // Reset preferences to defaults before each test
      usePreferenceStore.setState({
        displayName: undefined,
        aiName: undefined,
        aiTone: undefined,
        responseBrevity: undefined,
        responseStyle: 'concise',
        preferredLanguage: 'auto',
        preferStructuredOutput: false,
        allowCloudFallbackFromLocal: false,
        defaultProviderId: '',
        toolAutonomy: 'manual',
      });
    });

    it('returns DEFAULT_PERSONA_PROFILE when no preferences are set', () => {
      const profile = personaService.getActiveProfile();
      expect(profile.identity.name).toBe(DEFAULT_PERSONA_PROFILE.identity.name);
      expect(profile.identity.tagline).toBe(DEFAULT_PERSONA_PROFILE.identity.tagline);
      expect(profile.languageStyle.tone).toBe(DEFAULT_PERSONA_PROFILE.languageStyle.tone);
      expect(profile.languageStyle.responseStyle).toBe(DEFAULT_PERSONA_PROFILE.languageStyle.responseStyle);
    });

    it('with aiName="TestBot" overrides identity.name ONLY — other identity fields unchanged', () => {
      usePreferenceStore.getState().setPreferences({ aiName: 'TestBot' } as any);
      const profile = personaService.getActiveProfile();
      expect(profile.identity.name).toBe('TestBot');
      // Other identity fields should remain as defaults
      expect(profile.identity.tagline).toBe(DEFAULT_PERSONA_PROFILE.identity.tagline);
      expect(profile.identity.domainExpertise).toBe(DEFAULT_PERSONA_PROFILE.identity.domainExpertise);
    });

    it('with aiTone="professional" overrides languageStyle.tone ONLY — responseStyle and vocabulary unchanged', () => {
      usePreferenceStore.getState().setPreferences({ aiTone: 'professional' } as any);
      const profile = personaService.getActiveProfile();
      expect(profile.languageStyle.tone).toBe('professional');
      // Other language style fields should remain as defaults
      expect(profile.languageStyle.responseStyle).toBe(DEFAULT_PERSONA_PROFILE.languageStyle.responseStyle);
      expect(profile.languageStyle.vocabulary).toBe(DEFAULT_PERSONA_PROFILE.languageStyle.vocabulary);
    });

    it('with responseBrevity="detailed" sets languageStyle.responseStyle to "Detailed with thorough explanations"', () => {
      usePreferenceStore.getState().setPreferences({ responseBrevity: 'detailed' } as any);
      const profile = personaService.getActiveProfile();
      expect(profile.languageStyle.responseStyle).toBe('Detailed with thorough explanations');
    });

    it('with responseBrevity="balanced" sets languageStyle.responseStyle to "Balanced — moderately detailed with context-appropriate expansion"', () => {
      usePreferenceStore.getState().setPreferences({ responseBrevity: 'balanced' } as any);
      const profile = personaService.getActiveProfile();
      expect(profile.languageStyle.responseStyle).toBe('Balanced — moderately detailed with context-appropriate expansion');
    });

    it('with responseBrevity="concise" sets languageStyle.responseStyle to "Concise by default with task-aware expansion"', () => {
      usePreferenceStore.getState().setPreferences({ responseBrevity: 'concise' } as any);
      const profile = personaService.getActiveProfile();
      expect(profile.languageStyle.responseStyle).toBe('Concise by default with task-aware expansion');
    });

    it('returns a NEW object each call — no mutation of DEFAULT_PERSONA_PROFILE', () => {
      const profile1 = personaService.getActiveProfile();
      const profile2 = personaService.getActiveProfile();
      expect(profile1).not.toBe(profile2);
      // Mutating profile1 should NOT affect DEFAULT_PERSONA_PROFILE
      (profile1 as any).identity = { name: 'Hacked', tagline: '', domainExpertise: '' };
      expect(DEFAULT_PERSONA_PROFILE.identity.name).toBe('NowPilot');
    });

    it('getProfile() still returns the original DEFAULT_PERSONA_PROFILE (backward compat)', () => {
      // Set a preference
      usePreferenceStore.getState().setPreferences({ aiName: 'ChangedBot' } as any);
      // getActiveProfile should return merged profile
      const activeProfile = personaService.getActiveProfile();
      expect(activeProfile.identity.name).toBe('ChangedBot');
      // getProfile should still return the original
      const baseProfile = personaService.getProfile();
      expect(baseProfile.identity.name).toBe('NowPilot');
    });
  });
});
