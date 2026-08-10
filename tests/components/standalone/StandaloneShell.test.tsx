// tests/components/standalone/StandaloneShell.test.tsx — standalone shell
// contract (openTitle header, §18 page resolution from StandalonePageRegistry)
// + StandaloneRouter page routing ('chat' default; navigateToPage flips the
// active page — backing the Cmd+K 'Open Options' command). Phase-3 (03-08):
// the Chat page is gated behind ProviderRegistry.hasActiveProvider() (D-21) —
// unconfigured renders the STR.chat.noProvider Alert (E4); with a provider the
// real ChatPage surface renders (one composer inside ChatPage); other pages
// are unaffected by the gate.
import { render, screen } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StandaloneRouter } from '@/components/standalone/StandaloneRouter';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { useStandaloneNav } from '@/components/standalone/standaloneNav';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { STR } from '@/core/i18n/strings';

// ChatPage renders BubbleList + Sender when a provider is active — jsdom lacks
// IntersectionObserver/ResizeObserver; minimal no-op stubs keep them alive.
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
  useStandaloneNav.setState({ activePageId: 'chat' });
  getProviderRegistry().clear();
  vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StandaloneShell', () => {
  it('renders the openTitle header', () => {
    render(<StandaloneShell activePageId="chat" />);
    expect(screen.getByText(STR.standalone.openTitle)).toBeTruthy();
  });

  it('gates the Chat page behind hasActiveProvider (D-21): unconfigured shows the noProvider Alert', () => {
    render(<StandaloneShell activePageId="chat" />);
    expect(screen.getByText(STR.chat.noProvider)).toBeTruthy();
    // ChatPage itself must NOT render while unconfigured.
    expect(screen.queryByText(STR.chat.empty)).toBeNull();
  });

  it('renders the Chat page surface once a provider is registered', () => {
    getProviderRegistry().registerActiveProvider('openai');
    render(<StandaloneShell activePageId="chat" />);
    expect(screen.queryByText(STR.chat.noProvider)).toBeNull();
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
  });

  it('leaves non-chat pages unaffected by the provider gate', () => {
    render(
      <AntdApp>
        <StandaloneShell activePageId="options" />
      </AntdApp>,
    );
    // Options page renders regardless of provider presence (no gate).
    expect(screen.getByText('No provider connected. Set up a provider to start.')).toBeTruthy();
  });
});

describe('StandaloneRouter', () => {
  it('defaults to the Chat page (gated: noProvider Alert when unconfigured)', () => {
    render(<StandaloneRouter />);
    expect(screen.getByText(STR.chat.noProvider)).toBeTruthy();
  });

  it('renders the Chat page for the default registry id once a provider is registered', () => {
    getProviderRegistry().registerActiveProvider('anthropic');
    render(<StandaloneRouter />);
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
  });

  it('renders the page for the active registry id set via navigateToPage', async () => {
    render(
      <AntdApp>
        <StandaloneRouter />
      </AntdApp>,
    );
    useStandaloneNav.getState().setActivePage('options');
    expect(
      await screen.findByText('No provider connected. Set up a provider to start.'),
    ).toBeTruthy();
  });
});
