// SkillDisclosure — D-101 progressive disclosure mechanism (CTX-05).
//
// renderSkillDisclosure maps candidate skills to a prompt fragment that injects
// the FULL instructions only for ACTIVE skills and a trigger + one-line
// description for INACTIVE ones — irrelevant full instructions are ABSENT from
// the output, consuming zero prompt tokens (ROADMAP SC#4 / spec §28.3 CTX-05).
//
// The candidate shape aligns to the §14.1 ISkill contract (PRODUCT_SPEC_v0_1.md
// 1829-1856: id/name/description + a trigger metadata field; fullInstructions is
// the body Phase-15 real skill manifests supply) — this module is the DECLARED
// SEAM Phase 15's RICH catalog consumes (declare-now/populate-later, the
// Summarizer precedent at src/core/context/types.ts:46-53). Real ISkill
// implementations, slash commands, and the RICH catalog land Phase 15 (D-101).
//
// Standalone by design (D-69 create-only discipline): NOT wired into assemble()
// or the live prompt — that would disturb the stable sections the 07-02 golden
// snapshots pin. Pure, deterministic, never throws. Token accounting uses
// countTokensHeuristic — the shipped accounting unit, no tokenizer library
// (STACK.md); sections join with the pack() '\n\n' separator convention
// (ContextPack.ts:49).
import { countTokensHeuristic } from '../TokenBudget';

/** CTX-05 progressive-disclosure candidate — shaped against the §14.1 ISkill
 * contract (spec 1829-1856). Phase 15 real skill manifests supply these fields;
 * this module only renders them. */
export interface SkillDisclosureCandidate {
  id: string;
  name: string;
  description: string;      // one-line description (ISkill.description)
  trigger: string;          // trigger metadata (slash command / activation keyword)
  fullInstructions: string; // the full skill body — injected ONLY when active
  active: boolean;
}

/** Section separator — the pack() '\n\n' convention (ContextPack.ts:49). */
const SECTION_SEPARATOR = '\n\n';

/**
 * Render progressive disclosure for the candidate skills (CTX-05 / D-101):
 * ACTIVE candidates render as `name:\n<fullInstructions>`; INACTIVE candidates
 * render as `<trigger> — <description>` (one line each). Order = input order
 * (the caller owns catalog ordering — Phase 15). The output contains ZERO bytes
 * of any inactive candidate's fullInstructions — irrelevant full bodies consume
 * zero prompt tokens (SC#4). `tokens` = countTokensHeuristic(output text) — the
 * shipped accounting unit, no tokenizer library (STACK.md). Pure, deterministic.
 */
export function renderSkillDisclosure(
  candidates: SkillDisclosureCandidate[],
): { text: string; tokens: number } {
  const sections = candidates.map((candidate) =>
    candidate.active
      ? `${candidate.name}:\n${candidate.fullInstructions}`
      : `${candidate.trigger} — ${candidate.description}`,
  );
  const text = sections.join(SECTION_SEPARATOR);
  return { text, tokens: countTokensHeuristic(text) };
}