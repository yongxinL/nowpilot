import { describe, expect, it } from 'vitest';
import type { ContextItem } from '../../../src/core/context/ContextItem';
import { ContextTrustPolicy, contextTrustPolicy } from '../../../src/core/context/ContextTrustPolicy';

/**
 * Fixture builder (plan: fixture builder pattern consistent with the
 * existing context test suites). Defaults to a valid, policy-matching
 * page-context item; overrides let each test construct the exact
 * self-assigned-metadata scenario it needs.
 */
function makeItem(overrides: Partial<ContextItem>): ContextItem {
  return {
    kind: 'context',
    text: 'Fixture page content.',
    tokens: 4,
    stable: false,
    sourceId: 'context.page.current-url',
    relevance: 1,
    freshness: 1,
    trust: 0.5,
    sensitivity: 'private',
    instructionAuthority: 'data',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — full static source-type table (D-07): all 8 source types
// ─────────────────────────────────────────────────────────────────────────────

describe('ContextTrustPolicy.assess() — full static source-type table (D-07)', () => {
  it('system kind → trust 1.0 / public / system authority', () => {
    expect(contextTrustPolicy.assess('core.instructions.system', 'system')).toEqual({
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
  });

  it('persona source (sourceId prefix) → trust 1.0 / public / system authority even with a data kind', () => {
    expect(contextTrustPolicy.assess('persona.injector.default', 'context')).toEqual({
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
  });

  it('tool_schemas kind → trust 1.0 / public / system authority', () => {
    expect(contextTrustPolicy.assess('tools.registry.schemas', 'tool_schemas')).toEqual({
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
  });

  it('preferences kind → trust 1.0 / public / system authority', () => {
    expect(contextTrustPolicy.assess('user.preferences.active', 'preferences')).toEqual({
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
  });

  it('user_input kind → trust 0.9 / private / user authority', () => {
    expect(contextTrustPolicy.assess('interaction.user.current-turn', 'user_input')).toEqual({
      trust: 0.9,
      sensitivity: 'private',
      instructionAuthority: 'user',
    });
  });

  it('memory kind → trust 0.8 / private / data authority', () => {
    expect(contextTrustPolicy.assess('memory.user.facts', 'memory')).toEqual({
      trust: 0.8,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });

  it('context kind with standard page sourceId → trust 0.5 / private / data authority (known domain)', () => {
    expect(contextTrustPolicy.assess('context.page.current-url', 'context')).toEqual({
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });

  it('context kind with unknown-domain page sourceId → trust 0.3 / private / data authority (D-07 unknown-domain default)', () => {
    expect(contextTrustPolicy.assess('context.page.unknown-domain.com', 'context')).toEqual({
      trust: 0.3,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });

  it('context kind with verified tool sourceId → trust 0.9 / private / data authority (D-07 verified tool result)', () => {
    expect(contextTrustPolicy.assess('tools.builtin.search', 'context')).toEqual({
      trust: 0.9,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });

  it('completely unknown sourceId and kind → trust 0.3 / private / data authority (conservative default)', () => {
    expect(contextTrustPolicy.assess('orchestration.task.unknown', 'task')).toEqual({
      trust: 0.3,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — validate(): no self-assigned trust (D-06)
// ─────────────────────────────────────────────────────────────────────────────

describe('ContextTrustPolicy.validate() — policy-enforced, never self-assigned (D-06)', () => {
  it('returns true when item trust/sensitivity/authority exactly match policy', () => {
    const policy = contextTrustPolicy.assess('context.page.current-url', 'context');
    const item = makeItem({
      sourceId: 'context.page.current-url',
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
    expect(contextTrustPolicy.validate(item, policy)).toBe(true);
  });

  it('returns false when item.trust is 0.5 but policy says 1.0', () => {
    const policy = contextTrustPolicy.assess('core.instructions.system', 'system');
    const item = makeItem({
      kind: 'system',
      sourceId: 'core.instructions.system',
      trust: 0.5, // self-assigned downgrade — must be rejected
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
    expect(contextTrustPolicy.validate(item, policy)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — upgrade(): most restrictive sensitivity wins (D-09)
// ─────────────────────────────────────────────────────────────────────────────

describe('ContextTrustPolicy.upgrade() — most restrictive always wins (D-09)', () => {
  it("upgrade('public', 'secret') → 'secret' (max escalation)", () => {
    expect(ContextTrustPolicy.upgrade('public', 'secret')).toBe('secret');
  });

  it("upgrade('private', 'public') → 'private' (existing is more restrictive)", () => {
    expect(ContextTrustPolicy.upgrade('private', 'public')).toBe('private');
  });

  it("upgrade('confidential', 'private') → 'confidential' (candidate wins only if more restrictive)", () => {
    expect(ContextTrustPolicy.upgrade('confidential', 'private')).toBe('confidential');
  });
});
