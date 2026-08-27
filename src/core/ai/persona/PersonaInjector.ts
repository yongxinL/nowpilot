// Appendix N.2 (PRODUCT_SPEC_v0_1.md:6105-6141) — verbatim semantics.
// RICH-R-02 (data-merge overrides, D-58) + RICH-R-10 (per-stage persona,
// D-59 single choke-point consumed by plan 03-04's PromptCacheManager).
//
// Import-target change: Appendix N.2 imports UserPreferences from
// `@/core/memory/types`, which does not exist — this plan supplies the
// minimal shape at `../UserPreferences` (flagged assumption A1).
// `memoryExtractor` is reserved for its future owner — Phase 3 never
// integrates it (D-59).
import type { PersonaProfile } from './PersonaProfile';
import { DEFAULT_PERSONA } from './PersonaProfile';
import type { UserPreferences } from '../UserPreferences';

export type PipelineStage = 'planner' | 'executor' | 'renderer' | 'memoryExtractor';

// Applies user overrides (RICH-R-04). Config from PreferenceMemoryStore
// (np_persona) — NEVER the fact store (R2).
export function resolvePersona(base: PersonaProfile, prefs?: UserPreferences): PersonaProfile {
  if (!prefs?.personaOverrides) return base;
  const o = prefs.personaOverrides;
  return {
    ...base,
    identity: { ...base.identity, name: o.name ?? base.identity.name },
    languageStyle: {
      ...base.languageStyle,
      tone: o.tone ?? base.languageStyle.tone,
      brevity: o.brevity ?? base.languageStyle.brevity,
    },
  };
}

// Stable output (byte-identical per persona) so prompt caching is preserved (§1.3).
export function buildPersonaBlock(p: PersonaProfile): string {
  return [
    `You are ${p.identity.name} — ${p.identity.tagline}.`,
    `Domain: ${p.identity.domain}.`,
    `Core values: ${p.personalityCore.join(', ')}.`,
    `Behaviour: ${p.behavioralDrivers.join('; ')}.`,
    `Tone: ${p.languageStyle.tone}. Vocabulary: ${p.languageStyle.vocabulary}. Default brevity: ${p.languageStyle.brevity}.`,
    `You may express: ${p.emotionalRepertoire.join(', ')}. Acknowledge user frustration before solving; celebrate progress briefly; if you err, apologise briefly and offer an alternative — never be defensive.`,
  ].join('\n');
}

export const PersonaInjector = {
  inject(
    stage: PipelineStage,
    baseSystem: string,
    opts?: { persona?: PersonaProfile; prefs?: UserPreferences },
  ): string {
    const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
    const block = buildPersonaBlock(persona);
    return `${block}\n\n${baseSystem}`; // persona first (cacheable), then canonical stage system string (Appendix A)
  },
};