// src/core/ai/persona/PersonaInjector.ts — Source: PRODUCT_SPEC Appendix N.2
// "PersonaInjector (RICH-R-02 / R-10)" (lines 6121-6160, VERBATIM). §18
// Phase-3 create-list (line 2648). RICH-R-02: the persona block is prepended
// inside the cached [SYSTEM] of EVERY AI call (Planner, Executor, Renderer,
// MemoryExtractor — §17.7, Appendix A note). D-11: `memoryExtractor` is an
// accepted PipelineStage NOW (unit-tested); its call site ships Phase 5.
//
// Byte-stability (RICH-R-02 / §1.3, Pitfall 5): resolvePersona + buildPersonaBlock
// are pure — the SAME (base, prefs) ALWAYS produce the SAME block, so the
// provider prompt cache stays alive (T-03-07-02: drift would kill the caches).
// buildPersonaBlock joins in the fixed N.2 template order with '\n' only — no
// locale/whitespace normalization, no unordered serialization (AI-05 encoding).
//
// T-03-07-01 (injection surface): the block is a fixed template over
// schema-validated fields ONLY (PersonaProfileSchema, personaConfig.ts);
// user input NEVER reaches this module — contextHelper.ts places it in a
// separate user_input section (stable: false), so a persona-injection attempt
// can only change [USER INPUT], never the cached prefix.
//
// D-10 config-provider seam: the accessor (personaConfig.ts) is INJECTED via
// opts.prefs, never imported here — Phase 5's PreferenceMemoryStore writer
// swaps only the injected provider (R-7: persona = np_persona, never the fact
// store).
import type { PersonaProfile } from './PersonaProfile';
import { DEFAULT_PERSONA } from './PersonaProfile';
import type { UserPreferences } from '@/core/memory/types';
export type PipelineStage = 'planner' | 'executor' | 'renderer' | 'memoryExtractor';
// Applies user overrides (RICH-R-04). Config from PreferenceMemoryStore (np_persona) — NEVER the fact store (R2).
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
  inject(stage: PipelineStage, baseSystem: string, opts?: { persona?: PersonaProfile; prefs?: UserPreferences }): string {
    const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
    const block = buildPersonaBlock(persona);
    return `${block}\n\n${baseSystem}`;   // persona first (cacheable), then canonical stage system string (Appendix A)
  },
};
