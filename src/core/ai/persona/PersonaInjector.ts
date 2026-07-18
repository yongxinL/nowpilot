import { debugLog } from '../../utils/debugLog';
import { personaService } from './PersonaService';
import type { PersonaProfile, PersonaHint } from './PersonaProfile';

export class PersonaInjector {
  constructor(private personaService: { getProfile(): PersonaProfile }) {}

  inject(systemPrompt: string, hints?: PersonaHint[]): string {
    const profile = this.personaService.getProfile();
    const personaBlock = this.#buildPersonaBlock(profile, hints);
    return `${personaBlock}\n\n${systemPrompt}`;
  }

  #buildPersonaBlock(profile: PersonaProfile, hints?: PersonaHint[]): string {
    const lines: string[] = [
      '## PERSONA',
      '',
      `You are ${profile.identity.name} — ${profile.identity.tagline}.`,
      '',
      '### Core Values',
      ...profile.coreValues.map((v) => `- ${v}`),
      '',
      '### Communication Style',
      `- Tone: ${profile.languageStyle.tone}`,
      `- Response style: ${profile.languageStyle.responseStyle}`,
      `- Vocabulary: ${profile.languageStyle.vocabulary}`,
      '',
      '### Behavioral Preferences',
      ...profile.communicationPrinciples.map((p) => `- ${p}`),
      '',
      '### Emotional Awareness',
      `- When user expresses frustration: ${profile.emotionalAwareness.frustrationAcknowledgment}`,
      `- When user achieves a milestone: ${profile.emotionalAwareness.progressCelebration}`,
      `- When AI makes a mistake: ${profile.emotionalAwareness.humbleErrorRecovery}`,
      '',
      '### Safety Boundaries',
      profile.safetyBoundary,
    ];

    if (hints && hints.length > 0) {
      lines.push('', '### Context-Specific Guidance');
      for (const hint of hints) {
        lines.push(`- ${hint.instruction}`);
      }
    }

    return lines.join('\n');
  }
}

export const personaInjector = new PersonaInjector(personaService);
