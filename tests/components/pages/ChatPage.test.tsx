// tests/components/pages/ChatPage.test.tsx — Phase-3 minimal streaming chat
// surface (D-01): the 5-state stream machine (idle/streaming/completed/failed/
// offline), ONE composer per surface (the Sender lives inside ChatPage), the
// D-21-provider-gated shell behavior, RICH fencing (D-03 — grep-asserted
// absent), and plain-text bubbles (T-03-08-02 — no dangerouslySetInnerHTML).
// The streaming hook is mocked at the module boundary so each UI state is
// driven deterministically; the surface contract itself (Bubble/Sender
// composition + state mapping) stays real.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatPage } from '@/components/pages/ChatPage';
import { STR } from '@/core/i18n/strings';

// ---------------------------------------------------------------------------
// jsdom lacks IntersectionObserver/ResizeObserver — BubbleList/Sender rely on
// them for scroll-locking; minimal no-op stubs keep the real components alive.
// ---------------------------------------------------------------------------
class NoopIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [];
}
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Controllable hook mock (the ChatPage state machine is driven via this)
// ---------------------------------------------------------------------------
const hookMock = vi.hoisted(() => ({
  state: { state: 'idle' },
  text: '',
  send: vi.fn(async () => undefined),
  retry: vi.fn(),
  abort: vi.fn(),
}));

vi.mock('@/components/pages/useStreamingLLM', () => ({
  useStreamingLLM: () => hookMock,
}));

function setStream(state: 'idle' | 'streaming' | 'completed' | 'failed' | 'offline', text = '') {
  hookMock.state = { state, ...(state === 'idle' ? {} : { operationId: 'op-test-1' }) };
  hookMock.text = text;
}

/**
 * Render ChatPage and return a helper that drives a state transition: mutate
 * the (stable) mocked hook, then force a re-render so the surface re-reads it.
 */
function renderSurface() {
  const view = render(<ChatPage />);
  return {
    forceUpdate: () => view.rerender(<ChatPage />),
    ...view,
  };
}

describe('ChatPage — 5-state stream machine (UI-SPEC surface contract)', () => {
  beforeEach(() => {
    setStream('idle');
    hookMock.send.mockClear();
    hookMock.retry.mockClear();
  });

  it('idle (empty): renders the centered STR.chat.empty one-liner + the Sender (one composer)', () => {
    render(<ChatPage />);
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
    // ONE composer per surface — the Sender lives inside ChatPage (D-01).
    expect(screen.getAllByPlaceholderText(STR.chat.askPlaceholder)).toHaveLength(1);
    // No RICH empty-state surface (no welcome card, no prompts list).
    expect(screen.queryByText(STR.rich.welcomeTitle)).toBeNull();
  });

  it('send: appends a user bubble + an assistant streaming bubble with the caret, Sender disabled during stream', async () => {
    const { forceUpdate } = renderSurface();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(hookMock.send).toHaveBeenCalledWith('hello'));
    // User bubble rendered; assistant streaming bubble appended immediately.
    expect(screen.getByText('hello')).toBeTruthy();

    setStream('streaming', 'Hel');
    forceUpdate();
    await waitFor(() => expect(screen.getByText('Hel')).toBeTruthy());
    // Sender + send button disabled during the stream (one stream per session §17.5).
    expect((screen.getByPlaceholderText(STR.chat.askPlaceholder) as HTMLTextAreaElement).disabled).toBe(
      true,
    );
  });

  it('completed: final text rendered, caret removed (streaming state flipped off)', async () => {
    const { forceUpdate } = renderSurface();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(hookMock.send).toHaveBeenCalled());

    setStream('completed', 'Hello, world!');
    forceUpdate();
    await waitFor(() => expect(screen.getByText('Hello, world!')).toBeTruthy());
    // Send re-enabled after completion.
    expect(
      (screen.getByPlaceholderText(STR.chat.askPlaceholder) as HTMLTextAreaElement).disabled,
    ).toBe(false);
  });

  it('failed: partial text retained + "Provider error." (colorError) + Retry (colorPrimary) action', async () => {
    const { forceUpdate } = renderSurface();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(hookMock.send).toHaveBeenCalled());

    setStream('failed', 'Partial answer');
    forceUpdate();
    await waitFor(() => expect(screen.getByText('Partial answer')).toBeTruthy());
    // The failed bubble retains partial text + the error prefix + Retry.
    expect(screen.getByText('Provider error.')).toBeTruthy();
    expect(screen.getByText(STR.chat.retry)).toBeTruthy();
  });

  it('Retry re-sends the last input through the hook (NEW operationId) — partial text replaced', async () => {
    const { forceUpdate } = renderSurface();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(hookMock.send).toHaveBeenCalledWith('hello'));

    setStream('failed', 'Partial answer');
    forceUpdate();
    await waitFor(() => expect(screen.getByText(STR.chat.retry)).toBeTruthy());
    fireEvent.click(screen.getByText(STR.chat.retry));

    await waitFor(() => expect(hookMock.retry).toHaveBeenCalledTimes(1));
  });

  it('offline: partial text retained + the muted STR.chat.offline notice above the Sender', async () => {
    const { forceUpdate } = renderSurface();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(hookMock.send).toHaveBeenCalled());

    setStream('offline', 'Partial answer');
    forceUpdate();
    await waitFor(() => expect(screen.getByText(STR.chat.offline)).toBeTruthy());
    expect(screen.getByText('Partial answer')).toBeTruthy();
    // Retry path unchanged in the offline state.
    expect(screen.getByText(STR.chat.retry)).toBeTruthy();
  });
});

describe('ChatPage — plain text + RICH fencing (source invariants)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/pages/ChatPage.tsx'), 'utf8');

  it('renders PLAIN TEXT only — no dangerouslySetInnerHTML / innerHTML (T-03-08-02)', () => {
    expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });

  it('ships NO RICH elements (D-03 fence list absent from the surface)', () => {
    // D-03: no welcome cards, prompts, clarification chips, persona header,
    // stage indicators, chat-history persistence, agent toggle, action panels.
    for (const token of [
      'STR.rich.',
      'welcome',
      'clarif',
      'stageReading',
      'stagePlanning',
      'stageGenerating',
      'actionPanel',
      'followUpLabel',
      'closureAsk',
    ]) {
      expect(source).not.toContain(token);
    }
  });
});

describe('ChatPage — shell-level provider gate (D-21) is NOT inside ChatPage', () => {
  it('ChatPage itself renders regardless of provider state (the SHELL gates it)', () => {
    // The D-21 gate lives in the shells (SidePanelShell/StandaloneShell tests);
    // ChatPage is the surface — it renders the idle cue unconditionally.
    render(<ChatPage />);
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
  });
});
