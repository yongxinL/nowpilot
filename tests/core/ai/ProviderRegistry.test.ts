// tests/core/ai/ProviderRegistry.test.ts — ProviderRegistry contract tests (03-02,
// D-21): registerProvider flips the D-07 gate and stores a vault-safe snapshot
// (apiKey stripped, R-10) with resolvedBaseURL computed once (§10.2); the four-ID
// rule rejects unknown ids (§0.2); markProviderKeyUnreadable is the single
// PROVIDER_KEY_UNREADABLE transition → enabled:false + keyUnreadable:true with NO
// auto-wipe / NO auto-regenerate (02-CONTEXT D-04) and closes the gate
// (T-03-02-03); the Phase-1 registerActiveProvider primitive keeps working; the
// module stays dependency-free (Pitfall 4 — no zustand/react imports, grep-
// asserted). Runs in the default jsdom-align environment like the other core tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import type { ProviderConfig } from '@/core/ai/types';

function freshConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['deepseek-chat'],
    contextWindow: 65536,
    supportsTools: true,
    enabled: true,
    priority: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  getProviderRegistry().clear();
});

describe('ProviderRegistry D-07 gate', () => {
  it('registerProvider flips the gate on (any configured provider is active)', () => {
    const registry = getProviderRegistry();
    expect(registry.hasActiveProvider()).toBe(false);

    registry.registerProvider(freshConfig({ id: 'anthropic' }));

    expect(registry.hasActiveProvider()).toBe(true);
    expect(registry.getActiveProvider()).toBe('anthropic');
  });

  it('rejects a config with an unknown id — the four-ID rule (§0.2) is not a runtime throw', () => {
    const registry = getProviderRegistry();
    registry.registerProvider({ ...freshConfig(), id: 'not-a-provider' as ProviderConfig['id'] });

    expect(registry.hasActiveProvider()).toBe(false);
    expect(registry.getProviderInfos()).toEqual([]);
  });

  it('strips apiKey and computes resolvedBaseURL once (§10.2, R-10)', () => {
    const registry = getProviderRegistry();
    registry.registerProvider(
      freshConfig({
        apiKey: 'sk-super-secret',
        baseURL: 'https://api.openai.com/v1',
        customBaseURL: 'https://deepseek.example.com/v1',
      }),
    );

    const info = registry.getProviderInfo('openai');
    expect(info).toBeDefined();
    expect(info?.resolvedBaseURL).toBe('https://deepseek.example.com/v1'); // customBaseURL ?? baseURL
    expect(JSON.stringify(info)).not.toContain('sk-super-secret');
  });

  it('falls back to baseURL when no customBaseURL is set (§10.2)', () => {
    const registry = getProviderRegistry();
    registry.registerProvider(freshConfig());

    expect(registry.getProviderInfo('openai')?.resolvedBaseURL).toBe('https://api.openai.com/v1');
  });

  it('keeps the Phase-1 registerActiveProvider primitive working (backward compat)', () => {
    const registry = getProviderRegistry();
    registry.registerActiveProvider('openai');

    expect(registry.hasActiveProvider()).toBe(true);
    expect(registry.getActiveProvider()).toBe('openai');
  });
});

describe('ProviderRegistry PROVIDER_KEY_UNREADABLE (D-21)', () => {
  it('markProviderKeyUnreadable disables the provider WITHOUT wiping the entry', () => {
    const registry = getProviderRegistry();
    registry.registerProvider(freshConfig());
    expect(registry.hasActiveProvider()).toBe(true);

    registry.markProviderKeyUnreadable('openai');

    const info = registry.getProviderInfo('openai');
    // No auto-wipe (D-04): the entry survives, marked unreadable + disabled.
    expect(info).toBeDefined();
    expect(info?.keyUnreadable).toBe(true);
    expect(info?.enabled).toBe(false);
    // T-03-02-03: the gate closes — the router never calls a broken provider.
    expect(registry.hasActiveProvider()).toBe(false);
  });

  it('creates a disabled marker when decrypt failed before any registerProvider (03-09 wiring order)', () => {
    const registry = getProviderRegistry();

    registry.markProviderKeyUnreadable('gemini');

    const info = registry.getProviderInfo('gemini');
    expect(info?.keyUnreadable).toBe(true);
    expect(info?.enabled).toBe(false);
    expect(registry.hasActiveProvider()).toBe(false);
  });

  it('does not mark an unknown provider id (four-ID rule)', () => {
    const registry = getProviderRegistry();
    registry.markProviderKeyUnreadable('bogus');

    expect(registry.getProviderInfos()).toEqual([]);
    expect(registry.hasActiveProvider()).toBe(false);
  });

  it('a user-driven re-registration resets the unreadable state (no auto-regenerate, D-04)', () => {
    const registry = getProviderRegistry();
    registry.registerProvider(freshConfig());
    registry.markProviderKeyUnreadable('openai');
    expect(registry.hasActiveProvider()).toBe(false);

    // The user re-enters the key in Options → the wiring registers a fresh config.
    registry.registerProvider(freshConfig());

    const info = registry.getProviderInfo('openai');
    expect(info?.keyUnreadable).toBe(false);
    expect(info?.enabled).toBe(true);
    expect(registry.hasActiveProvider()).toBe(true);
  });
});

describe('ProviderRegistry dependency-free (Pitfall 4)', () => {
  it('imports only core/error + type-only types — no zustand or react', () => {
    const source = readFileSync(join(process.cwd(), 'src/core/ai/ProviderRegistry.ts'), 'utf8');

    expect(source).not.toMatch(/from\s+['"]zustand['"]/);
    expect(source).not.toMatch(/from\s+['"]react['"]/);
  });
});
