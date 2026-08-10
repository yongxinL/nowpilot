// src/core/ai/persona/PersonaProfile.ts — Source: PRODUCT_SPEC Appendix N.1
// "PersonaProfile (RICH-R-01)" (lines 6080-6119, VERBATIM). §18 Phase-3
// create-list (line 2647). RICH-R-01: persona identity/personality/tone config;
// RICH-R-02 depends on this shape (PersonaInjector). R-7: persona is USER
// CONFIG (np_persona, PreferenceMemoryStore home) — never a fact-store
// inference. PersonaProfileSchema is the single validation gate every np_persona
// read passes through (personaConfig.ts, D-09); DEFAULT_PERSONA is the canonical
// fallback (invalid/empty key → PERSONA_LOAD_FAILED → DEFAULT_PERSONA, never a
// crash, never a blocked Sender). Do not paraphrase the default persona (N.1
// "Canonical default persona (RICH-R-01). Do not paraphrase").
import { z } from 'zod';

export const PersonaProfileSchema = z.object({
  id: z.string().min(1),
  identity: z.object({
    name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(120),
    domain: z.string().min(1).max(200),
  }),
  personalityCore: z.array(z.string()).min(1).max(8),
  behavioralDrivers: z.array(z.string()).max(8),
  languageStyle: z.object({
    tone: z.enum(['professional-warm', 'concise', 'friendly']),
    vocabulary: z.string().max(120),
    brevity: z.enum(['brief', 'balanced', 'detailed']),
  }),
  emotionalRepertoire: z.array(z.string()).max(8),
});
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
// Canonical default persona (RICH-R-01). Do not paraphrase.
export const DEFAULT_PERSONA: PersonaProfile = {
  id: 'nowpilot-default',
  identity: {
    name: 'NowPilot',
    tagline: 'Your ServiceNow support co-pilot',
    domain: 'ServiceNow support engineering, technical troubleshooting, and knowledge management',
  },
  personalityCore: ['privacy-first', 'helpful', 'precise', 'humble'],
  behavioralDrivers: [
    'prefers asking clarifying questions over guessing',
    'cites sources when available',
  ],
  languageStyle: {
    tone: 'professional-warm',
    vocabulary: 'technical but accessible to support engineers',
    brevity: 'brief',
  },
  emotionalRepertoire: ['empathy', 'encouragement', 'curiosity'],
};
