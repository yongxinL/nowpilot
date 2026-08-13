// tests/core/memory/MemoryTypes.test.ts — Wave-1 R-1 contract suite (05-01).
// Contract under test (05-01-PLAN.md task 1, KNW-04 / D-05-01):
//   1. The Phase-5 memory interfaces (UserMemoryFact §3.4, ConversationMemory
//      §3.3, ConversationMeta §21.3+§15.1, MemoryInjection RESEARCH Pattern 3)
//      compile against full fixtures — tsc enforces shape parity (a fixture
//      object literal assigned to each interface type).
//   2. UserPreferencesSchema (GR-4 zod boundary gate, co-located beside
//      UserPreferences per harness.ts L211-251 precedent) parses a full valid
//      UserPreferences fixture (positive gate), rejects out-of-union values
//      (negative gates, ContextProvenanceManifest.test.ts L55-66 precedent),
//      and accepts both with- and without-personaOverrides fixtures
//      (D-05-08 compact-JSON shape — optionality).
//
// Pure types + zod — runs in the node environment (no chrome APIs).
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  UserPreferencesSchema,
  type ConversationMemory,
  type ConversationMeta,
  type MemoryInjection,
  type UserMemoryFact,
} from '@/core/memory/types';

const fullUserPreferences = {
  responseStyle: 'concise',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false,
  defaultProviderId: 'anthropic',
  toolAutonomy: 'ask_every_time',
  defaultSurface: 'sidepanel',
  personaId: 'p-1',
  personaOverrides: {
    name: 'Alex',
    tone: 'friendly',
    brevity: 'balanced',
  },
};

describe('UserPreferencesSchema (05-01 Task 1 — GR-4 boundary gate)', () => {
  it('parses a full valid UserPreferences fixture (positive gate)', () => {
    const parsed = UserPreferencesSchema.safeParse(fullUserPreferences);
    expect(parsed.success).toBe(true);
  });

  it('parses a minimal fixture WITHOUT persona overrides (optionality)', () => {
    const minimal = {
      responseStyle: 'balanced',
      preferredLanguage: 'de',
      preferStructuredOutput: false,
      allowCloudFallbackFromLocal: true,
      toolAutonomy: 'manual_only',
      defaultSurface: 'standalone',
    };
    expect(UserPreferencesSchema.safeParse(minimal).success).toBe(true);
  });

  it('rejects an out-of-union responseStyle value', () => {
    const parsed = UserPreferencesSchema.safeParse({ ...fullUserPreferences, responseStyle: 'chatty' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'responseStyle')).toBe(true);
    }
  });

  it('rejects a numeric preferStructuredOutput value', () => {
    const parsed = UserPreferencesSchema.safeParse({ ...fullUserPreferences, preferStructuredOutput: 1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'preferStructuredOutput')).toBe(true);
    }
  });
});

describe('Phase-5 interface shape parity (05-01 Task 1 — tsc-enforced)', () => {
  it('a full UserMemoryFact fixture assigns to the interface', () => {
    const fact: UserMemoryFact = {
      id: 'f-1',
      content: 'prefers concise answers',
      type: 'preference',
      tags: ['style'],
      confidence: 0.9,
      source: 'explicit',
      createdAt: 1,
      updatedAt: 2,
      lastUsedAt: 3,
      useCount: 4,
    };
    expect(fact.id).toBe('f-1');
    expect(fact.confidence).toBeLessThanOrEqual(1);
  });

  it('a full ConversationMemory fixture assigns to the interface', () => {
    const memory: ConversationMemory = {
      conversationId: 'c-1',
      summary: 'discussed onboarding',
      summaryTokens: 12,
      lastMessages: [
        { role: 'user', content: 'hi', tokens: 2, timestamp: 1 },
        { role: 'assistant', content: 'hello', tokens: 2, timestamp: 2 },
        { role: 'tool', content: 'ok', tokens: 1, timestamp: 3 },
      ],
      updatedAt: 3,
    };
    expect(memory.lastMessages).toHaveLength(3);
    expect(memory.lastMessages[0].role).toBe('user');
  });

  it('a full ConversationMeta fixture assigns to the interface', () => {
    const meta: ConversationMeta = {
      conversationId: 'c-1',
      status: 'active',
      messageCount: 10,
      lastAccessed: 4,
      updatedAt: 4,
      summary: 'onboarding',
    };
    expect(meta.status).toBe('active');
    expect(meta.messageCount).toBe(10);
  });

  it('a full MemoryInjection fixture assigns to the interface', () => {
    const injection: MemoryInjection = {
      memories: [
        {
          id: 'm-1',
          content: 'uses service now',
          type: 'fact',
          tags: ['tooling'],
          score: 0.85,
        },
      ],
      workingMemoryBlock: '# User Profile\n- **Name**:',
      preferences: {
        responseStyle: 'balanced',
        preferredLanguage: 'en',
        preferStructuredOutput: false,
        allowCloudFallbackFromLocal: true,
        toolAutonomy: 'allow_safe_tools',
        defaultSurface: 'sidepanel',
      },
    };
    expect(injection.memories[0].score).toBe(0.85);
    expect(injection.workingMemoryBlock).toContain('User Profile');
  });
});
