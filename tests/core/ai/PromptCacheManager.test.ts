import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  recordCacheResult,
  isCacheDisabled,
  CACHE_DISABLE_MISS_THRESHOLD,
} from '../../../src/core/ai/PromptCacheManager';
import { DEFAULT_PERSONA } from '../../../src/core/ai/persona/PersonaProfile';
import { buildPersonaBlock, resolvePersona } from '../../../src/core/ai/persona/PersonaInjector';
import { PROMPTS } from '../../../src/core/prompts';

/**
 * PromptCacheManager contract tests (plan 03-04, Task 2 — added under the
 * Rule 2 deviation precedent from 03-02): proves the D-59 single choke-point,
 * the Open Q5 profile-version cache key, the §1.3 section order, and the
 * §19.13 5-miss → 60 s disable rule deterministically.
 */

describe('buildSystemPrompt — D-59 single choke-point', () => {
  it('prepends the byte-stable persona block FIRST inside [SYSTEM]', () => {
    const result = buildSystemPrompt('planner');
    const system = result.sections[0];
    expect(system.kind).toBe('SYSTEM');
    expect(system.stable).toBe(true);
    const personaBlock = buildPersonaBlock(resolvePersona(DEFAULT_PERSONA));
    expect(system.text.startsWith(`${personaBlock}\n\n`)).toBe(true);
    // The canonical Appendix A planner string follows the persona block.
    expect(system.text).toContain(PROMPTS.planner.system);
  });

  it('assembles the §1.3 canonical section order', () => {
    const result = buildSystemPrompt('renderer', {
      task: 'Summarize',
      userInput: 'help me',
    });
    expect(result.sections.map((s) => s.kind)).toEqual([
      'SYSTEM',
      'TOOL SCHEMAS',
      'USER PREFERENCES',
      'TASK',
      'USER INPUT',
    ]);
    // Only [SYSTEM] + [TOOL SCHEMAS] are cache-eligible (§1.3).
    expect(result.sections.filter((s) => s.stable).map((s) => s.kind)).toEqual([
      'SYSTEM',
      'TOOL SCHEMAS',
    ]);
  });

  it('handles the reserved executor stage (persona-first, persona-free canonical string)', () => {
    const result = buildSystemPrompt('executor');
    const personaBlock = buildPersonaBlock(resolvePersona(DEFAULT_PERSONA));
    expect(result.sections[0].text.startsWith(`${personaBlock}\n\n`)).toBe(true);
    expect(result.sections[0].text).toContain('tool call');
  });

  it('is byte-stable: identical inputs → identical [SYSTEM] text and cache key', () => {
    const a = buildSystemPrompt('planner');
    const b = buildSystemPrompt('planner');
    expect(a.sections[0].text).toBe(b.sections[0].text);
    expect(a.cacheKeyHash).toBe(b.cacheKeyHash);
  });

  it('re-derives the cache key when persona overrides change (Open Q5 — no invalidation API)', () => {
    const base = buildSystemPrompt('planner');
    const overridden = buildSystemPrompt('planner', {
      prefs: { personaOverrides: { tone: 'friendly' } },
    });
    expect(overridden.cacheKeyHash).not.toBe(base.cacheKeyHash);
    expect(overridden.sections[0].text).not.toBe(base.sections[0].text);
    // The override is re-applied on the next call — same hash again (stable per persona).
    const overriddenAgain = buildSystemPrompt('planner', {
      prefs: { personaOverrides: { tone: 'friendly' } },
    });
    expect(overriddenAgain.cacheKeyHash).toBe(overridden.cacheKeyHash);
  });
});

describe('§19.13 cache-miss cascade — 5 consecutive misses → 60 s disable', () => {
  // The disable state is module-level, so each test anchors its miss streak in
  // the FUTURE (Date.now() + N·1e6) — windows never collide with the real
  // clock, and the streaks accumulate deterministically across the file.
  it(`exports CACHE_DISABLE_MISS_THRESHOLD = ${CACHE_DISABLE_MISS_THRESHOLD} and disables after 5 misses`, () => {
    expect(CACHE_DISABLE_MISS_THRESHOLD).toBe(5);
    const t0 = Date.now() + 1_000_000;
    for (let i = 0; i < 4; i++) recordCacheResult(false, t0 + i);
    expect(isCacheDisabled(t0 + 10)).toBe(false);
    recordCacheResult(false, t0 + 10); // the 5th consecutive miss
    expect(isCacheDisabled(t0 + 10)).toBe(true);
    // The disable window is 60 s — after it, hints re-enable.
    expect(isCacheDisabled(t0 + 10 + 60_000)).toBe(false);
  });

  it('a cache hit resets the streak', () => {
    const t0 = Date.now() + 2_000_000;
    recordCacheResult(false, t0);
    recordCacheResult(false, t0 + 1);
    recordCacheResult(true, t0 + 2); // hit — streak cleared
    recordCacheResult(false, t0 + 3);
    recordCacheResult(false, t0 + 4);
    recordCacheResult(false, t0 + 5);
    recordCacheResult(false, t0 + 6);
    expect(isCacheDisabled(t0 + 7)).toBe(false); // 4 misses after the reset — not disabled
  });

  it('buildSystemPrompt surfaces the disable state to the caller', () => {
    const t0 = Date.now() + 3_000_000;
    for (let i = 0; i < CACHE_DISABLE_MISS_THRESHOLD; i++) recordCacheResult(false, t0 + i);
    // disabledUntil = t0 + 4 + 60_000 — ahead of the real clock, so
    // buildSystemPrompt (which uses the real now) reports cacheDisabled.
    const result = buildSystemPrompt('planner');
    expect(result.cacheDisabled).toBe(true);
  });
});