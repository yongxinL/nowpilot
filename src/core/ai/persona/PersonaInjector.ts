import { DEFAULT_PERSONA, getPlannerPersona, getRendererPersona } from './PersonaProfile';
import type { PersonaProfile } from './PersonaProfile';
import { getMemoryEngine } from '../../memory/MemoryEngine';

export type InjectionStage = 'planner' | 'executor' | 'renderer';

export interface InjectOptions {
  profile?: PersonaProfile;
}

/**
 * Load the active persona from memory (Phase 5 integration contract):
 * reads np_persona through MemoryEngine — the single intermediary for all
 * memory access (Phase 4b). Falls back to DEFAULT_PERSONA when the user
 * has not configured a persona. Additive — the existing inject() flow
 * remains unchanged.
 */
export async function loadPersonaFromMemory(): Promise<PersonaProfile> {
  const memoryEngine = getMemoryEngine();
  const stored = await memoryEngine.getPersona();
  return stored ? (stored as PersonaProfile) : DEFAULT_PERSONA;
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
