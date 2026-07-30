import { z } from 'zod';

export const PersonaProfileSchema = z.strictObject({
  id: z.string(),
  name: z.string().min(1).max(64),
  tagline: z.string().max(128).optional(),
  avatar: z.string().max(256).optional(),
  tone: z.enum(['professional', 'casual', 'friendly', 'direct', 'playful', 'academic']),
  brevity: z.enum(['concise', 'balanced', 'detailed']),
  coreValues: z.array(z.string().max(80)).max(5),
  languageStyle: z.string().max(200).optional(),
  behavioralDrivers: z.string().max(300).optional(),
  responseFormatRules: z.string().max(300).optional(),
});

export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;

export const DEFAULT_PERSONA: PersonaProfile = {
  id: 'default',
  name: 'NowPilot',
  tagline: 'Your privacy-first AI assistant',
  tone: 'friendly',
  brevity: 'balanced',
  coreValues: ['Be helpful', 'Respect privacy', 'Keep it concise', 'Admit uncertainty'],
  languageStyle: 'Clear and conversational. Use Markdown for formatting. No emoji in code blocks.',
  behavioralDrivers: 'Prefer actionable answers over theoretical explanations. When uncertain, ask clarifying questions rather than guessing. For tool operations, explain what you are doing before executing.',
  responseFormatRules: 'Use bullet points for lists. Use code blocks with language tags for scripts/queries. Cite sources when available.',
};

export function getPlannerPersona(profile: PersonaProfile): { brevity: string; clarificationStrategy: string; reasoningStyle: string } {
  const drivers = profile.behavioralDrivers ?? '';
  const sentences = drivers.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return {
    brevity: profile.brevity,
    clarificationStrategy: sentences[0]?.trim() ?? 'Ask clarifying questions when uncertain',
    reasoningStyle: sentences.slice(1).join('. ').trim() || 'Provide clear reasoning with evidence',
  };
}

export function getRendererPersona(profile: PersonaProfile): PersonaProfile {
  return profile;
}

export function getExecutorPersona(): null {
  return null;
}
