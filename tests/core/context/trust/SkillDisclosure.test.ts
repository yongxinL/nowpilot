import { describe, it, expect } from 'vitest';
import {
  renderSkillDisclosure,
  type SkillDisclosureCandidate,
} from '@/core/context/trust/SkillDisclosure';
import { countTokensHeuristic } from '@/core/context/TokenBudget';

/**
 * SkillDisclosure tests (plan 07-03, Task 1) — §18-required
 * tests/core/context/trust/SkillDisclosure.test.ts. Pure unit, no chrome mocks
 * (ContextQualityMetrics.test.ts conventions): the CTX-05/D-101 progressive
 * disclosure proof — N=4 candidates / M=2 active → the output carries the 2
 * active full bodies + the 2 inactive trigger+one-liners, the inactive full
 * bodies are ABSENT (zero prompt tokens, ROADMAP SC#4), the token count equals
 * the sum decomposition of exactly the rendered parts (active bodies +
 * one-liners + '\n\n' separators), input order is preserved, and the all-active
 * / all-inactive / empty degenerate shapes hold.
 *
 * Fixture length discipline: every rendered part's length is ≡ 2 (mod 4)
 * (alpha/beta/gamma) or ≡ 0 (mod 4, the trailing delta), so folding each
 * part's trailing '\n\n' separator into it yields lengths ≡ 0 (mod 4) — the
 * ceil-based countTokensHeuristic is then exactly additive over the parts
 * (sum of ceils == ceil of the sum), making the token decomposition assertion
 * exact rather than coincidental.
 */

/** N=4 fixture: 2 active (alpha/beta) + 2 inactive (gamma/delta). The inactive
 * bodies carry the FULL_BODY_SKILL_GAMMA/FULL_BODY_SKILL_DELTA markers — they
 * must never appear in the rendered output (the SC#4 zero-token proof). */
function makeCandidates(
  overrides: Partial<SkillDisclosureCandidate>[] = [],
): SkillDisclosureCandidate[] {
  const base: SkillDisclosureCandidate[] = [
    {
      id: 'skill-alpha',
      name: 'Skill Alpha',
      description: 'Handles alpha incidents end to end.',
      trigger: '/alpha',
      fullInstructions:
        'FULL_BODY_SKILL_ALPHA: fetch the incident, classify severity, and propose a fix now.',
      active: true,
    },
    {
      id: 'skill-beta',
      name: 'Skill Beta',
      description: 'Runs beta workflow steps.',
      trigger: '/beta',
      fullInstructions: 'FULL_BODY_SKILL_BETA: execute the beta workflow and report status.',
      active: true,
    },
    {
      id: 'skill-gamma',
      name: 'Skill Gamma',
      description: 'Validates gamma payloads.',
      trigger: '/gamma',
      fullInstructions: 'FULL_BODY_SKILL_GAMMA: gamma is inactive, this body must never render.',
      active: false,
    },
    {
      id: 'skill-delta',
      name: 'Skill Delta',
      description: 'Archives delta records.',
      trigger: '/delta',
      fullInstructions: 'FULL_BODY_SKILL_DELTA: delta is inactive, this body must never render.',
      active: false,
    },
  ];
  return base.map((candidate, index) => ({ ...candidate, ...(overrides[index] ?? {}) }));
}

/** The rendered parts in input order — the independent oracle for the output
 * text (the documented render rules, duplicated here so the assertions do not
 * simply re-read the implementation). */
function expectedParts(candidates: SkillDisclosureCandidate[]): string[] {
  return candidates.map((candidate) =>
    candidate.active
      ? `${candidate.name}:\n${candidate.fullInstructions}`
      : `${candidate.trigger} — ${candidate.description}`,
  );
}

describe('renderSkillDisclosure — CTX-05/D-101 progressive disclosure', () => {
  it('carries the active full instruction bodies verbatim in the output (a)', () => {
    const output = renderSkillDisclosure(makeCandidates());
    expect(output.text).toContain(
      'Skill Alpha:\nFULL_BODY_SKILL_ALPHA: fetch the incident, classify severity, and propose a fix now.',
    );
    expect(output.text).toContain(
      'Skill Beta:\nFULL_BODY_SKILL_BETA: execute the beta workflow and report status.',
    );
  });

  it('NEVER carries the inactive full instruction bodies — zero prompt tokens (b, SC#4)', () => {
    const output = renderSkillDisclosure(makeCandidates());
    // The inactive bodies' unique markers must be absent from the rendered text
    // entirely (their instructions consume zero prompt tokens).
    expect(output.text).not.toContain('FULL_BODY_SKILL_GAMMA');
    expect(output.text).not.toContain('FULL_BODY_SKILL_DELTA');
    // Sanity: the fixture DOES carry the markers (the test proves the boundary
    // by showing the markers exist in the input, absent in the output).
    const fixture = makeCandidates();
    expect(fixture[2].fullInstructions).toContain('FULL_BODY_SKILL_GAMMA');
    expect(fixture[3].fullInstructions).toContain('FULL_BODY_SKILL_DELTA');
  });

  it('carries the inactive one-liners in the <trigger> — <description> shape (c)', () => {
    const output = renderSkillDisclosure(makeCandidates());
    expect(output.text).toContain('/gamma — Validates gamma payloads.');
    expect(output.text).toContain('/delta — Archives delta records.');
  });

  it('token accounting: tokens === countTokensHeuristic(text) === sum of the rendered parts (d)', () => {
    const candidates = makeCandidates();
    const output = renderSkillDisclosure(candidates);
    const parts = expectedParts(candidates);
    // The shipped accounting unit on the exact output text.
    expect(output.tokens).toBe(countTokensHeuristic(output.text));
    // Sum decomposition: each part folded with its trailing '\n\n' separator
    // (except the last) is length ≡ 0 (mod 4), so countTokensHeuristic is
    // exactly additive — tokens(active bodies) + tokens(one-liners) +
    // tokens(separators). The inactive full bodies contribute nothing.
    const folded = parts.map((part, index) =>
      index < parts.length - 1 ? `${part}\n\n` : part,
    );
    const decomposition = folded.reduce(
      (sum, part) => sum + countTokensHeuristic(part),
      0,
    );
    expect(output.tokens).toBe(decomposition);
    // And the SC#4 punchline: the output costs FAR less than rendering all four
    // full bodies — the two inactive bodies are what the disclosure removes.
    const allBodies = candidates.map((candidate) => candidate.fullInstructions).join('\n\n');
    expect(output.tokens).toBeLessThan(countTokensHeuristic(allBodies));
  });

  it('preserves input order — active and inactive sections interleave as given (e)', () => {
    const candidates = makeCandidates();
    const output = renderSkillDisclosure(candidates);
    // Interleave check: alpha (active) before beta (active) before the gamma/
    // delta one-liners — order = input order, not active-first grouping.
    const alphaIndex = output.text.indexOf('Skill Alpha:');
    const betaIndex = output.text.indexOf('Skill Beta:');
    const gammaIndex = output.text.indexOf('/gamma —');
    const deltaIndex = output.text.indexOf('/delta —');
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(alphaIndex).toBeLessThan(betaIndex);
    expect(betaIndex).toBeLessThan(gammaIndex);
    expect(gammaIndex).toBeLessThan(deltaIndex);
    expect(output.text).toBe(expectedParts(candidates).join('\n\n'));
  });

  it('all-inactive → one-liners only, no full body (f)', () => {
    const candidates = makeCandidates([
      { active: false },
      { active: false },
      { active: false },
      { active: false },
    ]);
    const output = renderSkillDisclosure(candidates);
    expect(output.text).toBe(
      '/alpha — Handles alpha incidents end to end.\n\n' +
        '/beta — Runs beta workflow steps.\n\n' +
        '/gamma — Validates gamma payloads.\n\n' +
        '/delta — Archives delta records.',
    );
    expect(output.text).not.toContain('FULL_BODY_SKILL_ALPHA');
    expect(output.text).not.toContain('FULL_BODY_SKILL_BETA');
    expect(output.text).not.toContain('FULL_BODY_SKILL_GAMMA');
    expect(output.text).not.toContain('FULL_BODY_SKILL_DELTA');
    expect(output.tokens).toBe(countTokensHeuristic(output.text));
  });

  it('all-active → full bodies only, no one-liners (g)', () => {
    const candidates = makeCandidates([
      { active: true },
      { active: true },
      { active: true },
      { active: true },
    ]);
    const output = renderSkillDisclosure(candidates);
    expect(output.text).toContain('FULL_BODY_SKILL_GAMMA');
    expect(output.text).toContain('FULL_BODY_SKILL_DELTA');
    expect(output.text).toContain('Skill Alpha:\nFULL_BODY_SKILL_ALPHA');
    expect(output.text).toContain('Skill Beta:\nFULL_BODY_SKILL_BETA');
    expect(output.text).not.toContain('/gamma —');
    expect(output.text).not.toContain('/delta —');
    expect(output.tokens).toBe(countTokensHeuristic(output.text));
  });

  it('empty candidate list → { text: "", tokens: 0 } (h)', () => {
    const output = renderSkillDisclosure([]);
    expect(output).toEqual({ text: '', tokens: 0 });
  });

  it('deterministic — identical input renders identical output text and tokens', () => {
    const first = renderSkillDisclosure(makeCandidates());
    const second = renderSkillDisclosure(makeCandidates());
    expect(second.text).toBe(first.text);
    expect(second.tokens).toBe(first.tokens);
  });
});