import { DEFAULT_PERSONA, getPlannerPersona, getRendererPersona } from './PersonaProfile';
import type { PersonaProfile } from './PersonaProfile';

export type InjectionStage = 'planner' | 'executor' | 'renderer';

export interface InjectOptions {
  profile?: PersonaProfile;
}

export function buildPersonaBlock(profile: PersonaProfile): string {
  const lines: string[] = ['[PERSONA]'];
  lines.push(`Name: ${profile.name}`);
  lines.push(`Tone: ${profile.tone} | Brevity: ${profile.brevity}`);
  if (profile.tagline) lines.push(`Tagline: ${profile.tagline}`);
  if (profile.avatar) lines.push(`Avatar: ${profile.avatar}`);
  lines.push(`Core Values: ${profile.coreValues.sort().join(', ')}`);
  if (profile.languageStyle) lines.push(`Language: ${profile.languageStyle}`);
  if (profile.behavioralDrivers) lines.push(`Behavior: ${profile.behavioralDrivers}`);
  if (profile.responseFormatRules) lines.push(`Response Rules: ${profile.responseFormatRules}`);
  return lines.join('\n');
}

export function buildPlannerPersonaBlock(profile: PersonaProfile): string {
  const planner = getPlannerPersona(profile);
  return [
    '[PERSONA - BEHAVIORAL]',
    `Brevity: ${planner.brevity}`,
    `Clarification Strategy: ${planner.clarificationStrategy}`,
    `Reasoning Style: ${planner.reasoningStyle}`,
  ].join('\n');
}

export function inject(stage: InjectionStage, baseSystemPrompt: string, opts?: InjectOptions): string {
  const profile = opts?.profile ?? DEFAULT_PERSONA;

  switch (stage) {
    case 'planner': {
      const block = buildPlannerPersonaBlock(profile);
      return `${block}\n\n${baseSystemPrompt}`;
    }
    case 'executor':
      return baseSystemPrompt;
    case 'renderer': {
      const block = buildPersonaBlock(profile);
      return `${block}\n\n${baseSystemPrompt}`;
    }
    default:
      return baseSystemPrompt;
  }
}
