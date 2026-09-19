import { describe, expect, it, vi } from 'vitest';
import {
  createStandaloneFocusEnvelope,
  createStandaloneOpenEnvelope,
  focusStandalone,
  openStandalone,
  readStandaloneNavigationRequest,
} from '@/core/runtime/StandaloneNavigation';
import { parseRuntimeEnvelope, type RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

describe('standalone navigation contract', () => {
  it('builds a valid standalone.open envelope targeted at the background', () => {
    const envelope = createStandaloneOpenEnvelope('chat', 'sidepanel');
    expect(parseRuntimeEnvelope(envelope).success).toBe(true);
    expect(envelope.type).toBe('standalone.open');
    expect(envelope.target).toBe('background');
    expect(envelope.source).toBe('sidepanel');
    expect(envelope.payload).toEqual({ destination: 'chat' });
  });

  it('builds a valid standalone.focus envelope targeted at the standalone surface', () => {
    const envelope = createStandaloneFocusEnvelope('options', 'background');
    expect(parseRuntimeEnvelope(envelope).success).toBe(true);
    expect(envelope.type).toBe('standalone.focus');
    expect(envelope.target).toBe('standalone');
    expect(envelope.payload).toEqual({ destination: 'options' });
  });

  it('reads navigation requests from both message types', () => {
    expect(
      readStandaloneNavigationRequest(createStandaloneOpenEnvelope('notes', 'sidepanel')),
    ).toEqual({ kind: 'open', destination: 'notes' });
    expect(
      readStandaloneNavigationRequest(createStandaloneFocusEnvelope('tools', 'background')),
    ).toEqual({ kind: 'focus', destination: 'tools' });
  });

  it('returns undefined for unrelated envelopes', () => {
    const envelope = createStandaloneOpenEnvelope('chat', 'sidepanel');
    expect(
      readStandaloneNavigationRequest({
        ...envelope,
        type: 'workspace.relinquish',
        payload: { epoch: 0, committedVersion: 0 },
      } as never),
    ).toBeUndefined();
  });

  it('openStandalone sends the open envelope through the bus', async () => {
    const bus = { send: vi.fn(async (_envelope: RuntimeEnvelope) => {}), on: vi.fn() };
    await openStandalone('chat', 'sidepanel', bus);
    expect(bus.send).toHaveBeenCalledTimes(1);
    expect(bus.send.mock.calls[0]![0].type).toBe('standalone.open');
  });

  it('focusStandalone sends the focus envelope through the bus', async () => {
    const bus = { send: vi.fn(async (_envelope: RuntimeEnvelope) => {}), on: vi.fn() };
    await focusStandalone('diagnostics', 'background', bus);
    expect(bus.send.mock.calls[0]![0].type).toBe('standalone.focus');
  });
});
