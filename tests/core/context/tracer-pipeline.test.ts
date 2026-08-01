import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ContextItemSchema,
  SensitivitySchema,
  unwrapToPromptSections,
} from '../../../src/core/context/ContextItem';
import type { ContextItem } from '../../../src/core/context/ContextItem';
import { ContextTrustPolicy, contextTrustPolicy } from '../../../src/core/context/ContextTrustPolicy';
import type { PromptSection } from '../../../src/core/ai/types';

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — ContextItem + ContextReceiptEntry contract (D-01, D-03, D-09)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ITEM: ContextItem = {
  kind: 'context',
  text: 'NowPilot is a privacy-first Chrome extension AI assistant.',
  tokens: 13,
  stable: false,
  sourceId: 'context.page.current-url',
  relevance: 0.8,
  freshness: 0.9,
  trust: 0.5,
  sensitivity: 'private',
  instructionAuthority: 'data',
};

describe('ContextItem contract (Task 1)', () => {
  it('ContextItemSchema accepts a well-formed item with all PromptSection + metadata fields', () => {
    const result = ContextItemSchema.safeParse(VALID_ITEM);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // PromptSection fields
    expect(result.data.kind).toBe('context');
    expect(result.data.text).toBe(VALID_ITEM.text);
    expect(result.data.tokens).toBe(13);
    expect(result.data.stable).toBe(false);
    expect(result.data.sourceId).toBe('context.page.current-url');
    // Metadata fields
    expect(result.data.relevance).toBe(0.8);
    expect(result.data.freshness).toBe(0.9);
    expect(result.data.trust).toBe(0.5);
    expect(result.data.sensitivity).toBe('private');
    expect(result.data.instructionAuthority).toBe('data');
  });

  it('ContextItemSchema rejects trust out of the [0, 1] range', () => {
    const result = ContextItemSchema.safeParse({ ...VALID_ITEM, trust: 1.5 });
    expect(result.success).toBe(false);
  });

  it('ContextItemSchema rejects sensitivity:secret items (D-09 gate)', () => {
    const result = ContextItemSchema.safeParse({ ...VALID_ITEM, sensitivity: 'secret' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((i) => i.message);
    expect(messages.some((m) => m.toLowerCase().includes('secret'))).toBe(true);
  });

  it('unwrapToPromptSections() strips metadata — only PromptSection fields survive', () => {
    const second: ContextItem = {
      ...VALID_ITEM,
      kind: 'memory',
      text: 'User prefers concise answers',
      tokens: 6,
      sourceId: 'memory.user.facts',
      trust: 0.8,
      instructionAuthority: 'data',
    };
    const sections = unwrapToPromptSections([VALID_ITEM, second]);

    expect(sections).toHaveLength(2);
    const keys = Object.keys(sections[0]).sort();
    expect(keys).toEqual(['kind', 'sourceId', 'stable', 'text', 'tokens']);
    expect(sections[0]).toEqual({
      kind: 'context',
      text: VALID_ITEM.text,
      tokens: 13,
      stable: false,
      sourceId: 'context.page.current-url',
    });
    expect(sections[1].kind).toBe('memory');
    expect(sections[1].sourceId).toBe('memory.user.facts');
    // The returned type is the plain PromptSection contract (D-01)
    expectTypeOf(sections).toMatchTypeOf<PromptSection[]>();
  });

  it('ContextItem type is assignable with all fields (compile-time check)', () => {
    const typed: ContextItem = VALID_ITEM;
    expect(typed.sensitivity).toBe('private');
    expect(typed.instructionAuthority).toBe('data');
    // Schema-inferred enums agree with the canonical unions
    expectTypeOf(SensitivitySchema.options).toMatchTypeOf<
      Array<'public' | 'private' | 'confidential' | 'secret'>
    >();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — ContextTrustPolicy singleton (D-06, D-07, D-09)
// ─────────────────────────────────────────────────────────────────────────────

describe('ContextTrustPolicy (Task 2)', () => {
  it('assesses system instructions with trust 1.0 / public / system authority', () => {
    expect(contextTrustPolicy.assess('core.instructions.system', 'system')).toEqual({
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
  });

  it('assesses page context with trust 0.5 / private / data authority', () => {
    expect(contextTrustPolicy.assess('context.page.current-url', 'context')).toEqual({
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });

  it('assesses user input with trust 0.9 / private / user authority', () => {
    expect(contextTrustPolicy.assess('interaction.user.current-turn', 'user_input')).toEqual({
      trust: 0.9,
      sensitivity: 'private',
      instructionAuthority: 'user',
    });
  });

  it('validate() rejects items whose trust metadata is self-assigned (D-06)', () => {
    const policy = contextTrustPolicy.assess('core.instructions.system', 'system');
    expect(policy.trust).toBe(1.0);
    const selfAssigned: ContextItem = {
      kind: 'system',
      text: 'You are a helpful assistant.',
      tokens: 6,
      stable: true,
      sourceId: 'core.instructions.system',
      relevance: 1,
      freshness: 1,
      trust: 0.5, // adapter self-assigned — must be rejected
      sensitivity: 'public',
      instructionAuthority: 'system',
    };
    expect(contextTrustPolicy.validate(selfAssigned, policy)).toBe(false);
  });

  it('validate() accepts items that match the policy exactly', () => {
    const policy = contextTrustPolicy.assess('context.page.current-url', 'context');
    const matching: ContextItem = {
      kind: 'context',
      text: 'Page content.',
      tokens: 3,
      stable: false,
      sourceId: 'context.page.current-url',
      relevance: 0.7,
      freshness: 0.8,
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
    };
    expect(contextTrustPolicy.validate(matching, policy)).toBe(true);
  });

  it('upgrade() returns the most restrictive sensitivity (D-09)', () => {
    expect(ContextTrustPolicy.upgrade('public', 'secret')).toBe('secret');
    expect(ContextTrustPolicy.upgrade('private', 'public')).toBe('private');
    expect(ContextTrustPolicy.upgrade('confidential', 'secret')).toBe('secret');
    expect(ContextTrustPolicy.upgrade('secret', 'private')).toBe('secret');
  });

  it('assess() is deterministic — identical (sourceId, kind) inputs give identical results', () => {
    const a = contextTrustPolicy.assess('context.page.current-url', 'context');
    const b = contextTrustPolicy.assess('context.page.current-url', 'context');
    expect(a).toEqual(b);
  });

  it('covers memory and unknown sources per the D-07 table', () => {
    expect(contextTrustPolicy.assess('memory.user.facts', 'memory')).toEqual({
      trust: 0.8,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
    expect(contextTrustPolicy.assess('tools.search.notes', 'context')).toEqual({
      trust: 0.9,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
    expect(contextTrustPolicy.assess('unknown.source.xyz', 'context')).toEqual({
      trust: 0.3,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });
});
