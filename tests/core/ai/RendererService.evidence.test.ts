// tests/core/ai/RendererService.evidence.test.ts — Phase 3a (03a-03): the
// renderer's evidence-aware done-narration guard (D-3a-17, R-8). The renderer
// is display-only — it never re-verifies or changes the orchestrator's verdict
// (D-3a-05/17). RenderInput gains `verdict` + `evidence`; the guard ensures the
// renderer never presents a side-effecting tool as 'done' without a matching
// ok:true CompletionEvidence entry in the received set.
// Proves:
//   (a) render with a verified ok:true evidence entry may describe the tool as done;
//   (b) render with an empty/matching-less evidence set for a side-effecting
//       tool does NOT narrate it as done (the done claim is omitted);
//   (c) the renderer never changes the verdict or re-verifies (display-only).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { streamText } from 'ai';
import type { CoreMessage, LanguageModel } from 'ai';

import { RendererService, evidenceDoneTools } from '@/core/ai/RendererService';
import type { RenderInput } from '@/core/ai/RendererService';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import type { CompletionEvidence } from '@/types/harness';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';
import { syntheticEvidence, MOCK_DANGEROUS_TOOL } from '../../fixtures/trajectory';

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    recordFailure: vi.fn(),
    markStreamedFirstToken: vi.fn(),
    classifyProviderError: vi.fn(),
  },
}));

vi.mock('@/core/ai/ProviderRouter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/ai/ProviderRouter')>();
  return { ...actual, getProviderRouter: () => routerMock };
});

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

const streamTextMock = vi.mocked(streamText);

const fakeModel = {
  id: 'fixture-model',
  vendor: 'fixture',
  modelId: 'claude-3-5-haiku-latest',
} as unknown as LanguageModel;

function invocationStub(overrides: Partial<StageInvocation> = {}): StageInvocation {
  return {
    providerId: 'anthropic',
    model: fakeModel,
    jsonMode: 'native',
    callProviderJsonMode: vi.fn(async () => '{}'),
    ...overrides,
  };
}

function sideEffectToolResult(ok = true) {
  return {
    toolName: MOCK_DANGEROUS_TOOL.name,
    ok,
    output: ok ? { written: true } : undefined,
    error: ok
      ? undefined
      : { code: 'TOOL_FAILED', message: 'write failed', retryable: false },
    durationMs: 1,
  };
}

function baseInput(overrides: Partial<RenderInput> = {}): RenderInput {
  return {
    operationId: 'op-evidence-0001',
    context: buildOptimizedContextFixture(),
    userInput: 'Write the note.',
    toolResults: [sideEffectToolResult(true)],
    abortSignal: new AbortController().signal,
    invocation: invocationStub(),
    verdict: 'completed',
    evidence: [syntheticEvidence({ ok: true })],
    ...overrides,
  };
}

function mockStream(deltas: string[] = ['done.']): void {
  streamTextMock.mockReturnValue({
    textStream: (async function* () {
      for (const d of deltas) yield d;
    })(),
    finishReason: Promise.resolve('stop'),
  } as unknown as ReturnType<typeof streamText>);
}

beforeEach(() => {
  vi.clearAllMocks();
  routerMock.recordFailure.mockClear();
  routerMock.markStreamedFirstToken.mockClear();
  getPromptCacheManager().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('evidenceDoneTools — D-3a-17 derived done-set', () => {
  it('returns only tools with an ok:true evidence entry', () => {
    const evidence: CompletionEvidence[] = [
      syntheticEvidence({ ok: true }),
      syntheticEvidence({ ok: false, toolName: 'other-write' }),
    ];
    const done = evidenceDoneTools(evidence);
    expect(done.has(MOCK_DANGEROUS_TOOL.name)).toBe(true);
    expect(done.has('other-write')).toBe(false);
  });

  it('returns an empty set for empty or all-failed evidence', () => {
    expect(evidenceDoneTools([]).size).toBe(0);
    expect(evidenceDoneTools([syntheticEvidence({ ok: false })]).size).toBe(0);
  });
});

describe('RendererService.render — evidence-aware done-narration guard (D-3a-17)', () => {
  it('(a) render with a verified ok:true evidence entry may describe the tool as done', async () => {
    mockStream();
    const evidence = [syntheticEvidence({ ok: true })];
    const input = baseInput({ evidence, verdict: 'completed' });

    await RendererService.render(input);

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const messages = streamTextMock.mock.calls[0][0].messages as CoreMessage[];
    // The honest completion-status note marks the tool done.
    const note = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(note).toContain(`${MOCK_DANGEROUS_TOOL.name}: done`);
    expect(note).toContain('Turn verdict: completed');
    expect(routerMock.recordFailure).not.toHaveBeenCalled();
  });

  it('(b) render with an empty/matching-less evidence set does NOT narrate the side-effecting tool as done', async () => {
    mockStream();
    const input = baseInput({ evidence: [], verdict: 'failed' });

    await RendererService.render(input);

    const messages = streamTextMock.mock.calls[0][0].messages as CoreMessage[];
    const note = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    // The done claim is omitted — the tool is marked not-confirmed instead.
    expect(note).toContain(`${MOCK_DANGEROUS_TOOL.name}: not-confirmed`);
    expect(note).not.toContain(`${MOCK_DANGEROUS_TOOL.name}: done`);
  });

  it('(c) the renderer never changes the verdict or re-verifies (display-only, D-3a-17)', async () => {
    mockStream();
    // A side-effecting tool with NO ok:true evidence and a failed verdict — the
    // renderer reflects the orchestrator's verdict verbatim, never recomputes it.
    const input = baseInput({
      evidence: [syntheticEvidence({ ok: false })],
      verdict: 'partial',
    });

    const output = await RendererService.render(input);

    const messages = streamTextMock.mock.calls[0][0].messages as CoreMessage[];
    const note = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    // The received verdict is surfaced unchanged (display-only).
    expect(note).toContain('Turn verdict: partial');
    // Display-only: the render output is exactly the streamed text; no
    // re-verification (buildOutcome is the orchestrator's job, never here).
    expect(output).toEqual({ text: 'done.', finishReason: 'stop' });
    expect(routerMock.recordFailure).not.toHaveBeenCalled();
  });
});
