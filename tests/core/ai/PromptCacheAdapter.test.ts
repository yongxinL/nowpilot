import { describe, it, expect } from 'vitest';
import {
  applyCacheHints,
  hashStableSections,
  ANTHROPIC_MAX_BREAKPOINTS,
  GEMINI_MIN_CACHED_TOKENS,
} from '../../../src/core/ai/PromptCacheAdapter';
import type { PromptSection } from '../../../src/core/ai/types';

/**
 * PromptCacheAdapter contract tests (plan 03-04, Task 1 — added under the
 * Rule 2 deviation precedent from 03-02: the Task 1 acceptance criteria are
 * behavioral, so a deterministic test proves them repeatably):
 *  - anthropic: cache_control ephemeral on at most 4 stable sections; the 5th
 *    stays unmarked (a 5th breakpoint → HTTP 400, Pitfall 5);
 *  - gemini: cachedContent split ONLY at stableTokens >= 32768 (Pitfall 4),
 *    else inline + prefix-only;
 *  - openai/ollama/default: stableFirst sort + prefix-only;
 *  - hashStableSections is FNV-1a 32-bit over the joined stable texts.
 */

function section(kind: string, text: string, stable: boolean, tokens = 100): PromptSection {
  return { kind, text, stable, tokens };
}

const ANTHROPIC = 'anthropic' as const;
const GEMINI = 'gemini' as const;

describe('applyCacheHints — anthropic (4-breakpoint cap, Pitfall 5)', () => {
  it(`marks cache_control ephemeral on at most ${ANTHROPIC_MAX_BREAKPOINTS} stable sections`, () => {
    const sections = [
      section('SYSTEM', 'system text', true),
      section('TOOL SCHEMAS', 'tool schemas', true),
      section('PREFERENCES', 'prefs', true),
      section('MEMORY', 'memory', true),
      section('CONTEXT', 'context', true), // 5th stable — must stay unmarked
      section('TASK', 'task', false),
    ];
    const out = applyCacheHints(ANTHROPIC, sections);
    expect(out.strategy).toBe('anthropic-ephemeral');
    const marked = out.providerRequestSections as Array<PromptSection & { cache_control?: unknown }>;
    const withBreakpoint = marked.filter((s) => 'cache_control' in s);
    expect(withBreakpoint.length).toBe(ANTHROPIC_MAX_BREAKPOINTS);
    expect(withBreakpoint.every((s) => s.stable)).toBe(true);
    // The 5th stable section has no cache_control.
    expect((marked[4] as { cache_control?: unknown }).cache_control).toBeUndefined();
    // Unstable sections are never marked.
    expect((marked[5] as { cache_control?: unknown }).cache_control).toBeUndefined();
  });

  it('does not mark when fewer stable sections than the cap exist', () => {
    const sections = [section('SYSTEM', 'system', true), section('TASK', 'task', false)];
    const out = applyCacheHints(ANTHROPIC, sections);
    const marked = out.providerRequestSections as Array<PromptSection & { cache_control?: unknown }>;
    expect(marked.filter((s) => 'cache_control' in s).length).toBe(1);
  });
});

describe('applyCacheHints — gemini (32,768-token minimum, Pitfall 4)', () => {
  it('below the minimum → inline + prefix-only (never cachedContent)', () => {
    // 2 stable sections × 100 tokens = 200 < 32768.
    const sections = [section('SYSTEM', 'system', true, 100), section('TASK', 'task', false)];
    const out = applyCacheHints(GEMINI, sections);
    expect(out.strategy).toBe('prefix-only');
    expect(out.providerRequestSections).toEqual({ inline: sections });
  });

  it(`at/above ${GEMINI_MIN_CACHED_TOKENS} → cachedContent split`, () => {
    const stable = [
      section('SYSTEM', 'system', true, 20_000),
      section('TOOL SCHEMAS', 'tools', true, 12_768), // 32,768 total
    ];
    const unstable = [section('TASK', 'task', false, 100)];
    const out = applyCacheHints(GEMINI, [...stable, ...unstable]);
    expect(out.strategy).toBe('gemini-cachedContent');
    expect(out.providerRequestSections).toEqual({
      cachedContent: stable,
      inline: unstable,
    });
  });
});

describe('applyCacheHints — openai/ollama/default (stableFirst + prefix-only)', () => {
  it('sorts stable-first (kind tie-break) and stays prefix-only', () => {
    const sections = [
      section('TASK', 'task', false),
      section('SYSTEM', 'system', true),
      section('TASK2', 'task2', false),
      section('TOOL SCHEMAS', 'tools', true),
    ];
    const out = applyCacheHints('openai', sections);
    expect(out.strategy).toBe('prefix-only');
    const ordered = out.providerRequestSections as PromptSection[];
    expect(ordered[0].kind).toBe('SYSTEM'); // stable first, kind asc
    expect(ordered[1].kind).toBe('TOOL SCHEMAS');
    expect(ordered[2].stable).toBe(false);
    expect(ordered[3].stable).toBe(false);
  });

  it('ollama and unknown providers follow the same default branch', () => {
    expect(applyCacheHints('ollama', []).strategy).toBe('prefix-only');
    expect(applyCacheHints('openai-compat', []).strategy).toBe('prefix-only');
  });
});

describe('hashStableSections — FNV-1a 32-bit', () => {
  it('matches the FNV-1a 32-bit reference vectors (offset 2166136261, prime 16777619)', () => {
    expect(hashStableSections([])).toBe('811c9dc5'); // empty → base offset
    expect(hashStableSections([{ text: 'a', stable: true }])).toBe('e40c292c');
    expect(hashStableSections([{ text: 'hello', stable: true }])).toBe('a82fb4a1');
  });

  it('joins stable texts with \\u0000 (the spec separator)', () => {
    // [a, b] differs from [ab] because of the NUL join.
    const joined = hashStableSections([
      { text: 'a', stable: true },
      { text: 'b', stable: true },
    ]);
    const concatenated = hashStableSections([{ text: 'ab', stable: true }]);
    expect(joined).toBe('10f3abd2');
    expect(concatenated).not.toBe(joined);
  });

  it('filters unstable sections out of the hash input', () => {
    const withUnstable = hashStableSections([
      { text: 'a', stable: true },
      { text: 'volatile', stable: false },
    ]);
    expect(withUnstable).toBe('e40c292c'); // identical to hashing ['a'] alone
  });
});