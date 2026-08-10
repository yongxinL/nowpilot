// tests/core/ai/ExecutorService.test.ts — executor contract (03-04, D-04/D-05,
// T-03-04-03). Deterministic (R-4): no SDK tool machinery. execute() validates
// toolName against the closed z.enum → TOOL_REJECTED on unknown (a stray
// run_tool decision's toolName can never reach a run); the dangerous-flag and
// input-schema gates reject before any run; the ONE Phase-3 tool
// (get-provider-info, dangerous: no, §10.5 row 8) reads the vault-safe
// ProviderRegistry snapshot (03-02 — apiKey never retained, R-10); results
// carry the ToolExecutionResult shape with durationMs.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExecutorService } from '@/core/ai/ExecutorService';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import type { ProviderConfig } from '@/core/ai/types';

function freshConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai',
    label: 'OpenAI',
    apiKey: 'sk-super-secret', // must never appear in the registry snapshot (R-10)
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

describe('ExecutorService.execute — closed-enum gate (D-05, T-03-04-03)', () => {
  it('rejects an unknown toolName with TOOL_REJECTED (stray run_tool never reaches a run)', async () => {
    const result = await ExecutorService.execute({
      operationId: 'op-exec-0001',
      toolName: 'run-arbitrary-script',
      input: {},
      abortSignal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    expect(result.toolName).toBe('run-arbitrary-script');
    expect(result.error?.code).toBe('TOOL_REJECTED');
    expect(result.error?.retryable).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects a run_tool-shaped toolName when the tool is not the registered builtin', async () => {
    const result = await ExecutorService.execute({
      operationId: 'op-exec-0001',
      toolName: 'invented-tool',
      input: {},
      abortSignal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('TOOL_REJECTED');
  });

  it('rejects non-empty input for the zero-input get-provider-info schema (input-schema gate)', async () => {
    const result = await ExecutorService.execute({
      operationId: 'op-exec-0001',
      toolName: 'get-provider-info',
      input: { foo: 1 },
      abortSignal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('TOOL_REJECTED');
  });
});

describe('ExecutorService.execute — get-provider-info (D-04, §10.5 row 8)', () => {
  it('runs get-provider-info via ProviderRegistry and returns the vault-safe snapshot', async () => {
    getProviderRegistry().registerProvider(freshConfig({ id: 'anthropic' }));

    const result = await ExecutorService.execute({
      operationId: 'op-exec-0001',
      toolName: 'get-provider-info',
      input: {},
      abortSignal: new AbortController().signal,
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.output)).toBe(true);
    const providers = result.output as Array<Record<string, unknown>>;
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('anthropic');
    // R-10: the apiKey is never retained in the snapshot
    expect('apiKey' in providers[0]).toBe(false);
  });

  it('returns an empty snapshot when no provider is configured', async () => {
    const result = await ExecutorService.execute({
      operationId: 'op-exec-0001',
      toolName: 'get-provider-info',
      input: {},
      abortSignal: new AbortController().signal,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual([]);
  });

  it('accepts no input (undefined) as valid for the zero-input tool', async () => {
    getProviderRegistry().registerProvider(freshConfig());

    const result = await ExecutorService.execute({
      operationId: 'op-exec-0001',
      toolName: 'get-provider-info',
      input: undefined,
      abortSignal: new AbortController().signal,
    });

    expect(result.ok).toBe(true);
  });
});
