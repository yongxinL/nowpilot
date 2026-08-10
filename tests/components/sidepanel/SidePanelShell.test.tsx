// tests/components/sidepanel/SidePanelShell.test.tsx — §17.1 chat-only shell
// contract + the SidePanelRouter D-07 gate (W-10: provider presence, not an
// onboarding flag). Covers: header + disabled askPlaceholder input when
// UNCONFIGURED, no send button in that state, disabled surface
// (STR.chat.noProvider) when no provider, chat content when a provider is
// registered — and the Phase-3 D-01 single-composer rule: when a provider is
// active the ChatPage's Sender is the ONLY composer (the shell's disabled
// footer is replaced, no double composer). Includes the router's three gate
// branches (onboarding pending → Onboarding; onboarding done → disabled shell;
// provider present → enabled shell — including the Flow 9 'Configure later'
// flip).
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidePanelRouter } from '@/components/sidepanel/SidePanelRouter';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { STR } from '@/core/i18n/strings';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';

// BubbleList (rendered by ChatPage once a provider is active) needs
// IntersectionObserver/ResizeObserver — jsdom lacks them; minimal no-op stubs.
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
  getProviderRegistry().clear();
  useAddonSettingsStore.setState({ settings: {} });
  vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SidePanelShell', () => {
  it('renders the header title and a disabled askPlaceholder input when UNCONFIGURED', () => {
    render(<SidePanelShell />);
    expect(screen.getByText('NowPilot')).toBeTruthy();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    expect(input).toBeTruthy();
    expect(input).toBeDisabled();
  });

  it('renders no send button when unconfigured (§17.1 composer is a Phase-1 placeholder)', () => {
    render(<SidePanelShell />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
  });

  it('renders the disabled surface (STR.chat.noProvider banner) when no provider is active', () => {
    render(<SidePanelShell />);
    expect(screen.getByText(STR.chat.noProvider)).toBeTruthy();
  });

  it('D-01 single composer: with a provider active, ChatPage Sender REPLACES the shell footer (no double composer)', () => {
    getProviderRegistry().registerActiveProvider('openai');
    render(<SidePanelShell />);
    expect(screen.queryByText(STR.chat.noProvider)).toBeNull();
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
    // EXACTLY ONE composer per surface — the ChatPage Sender (not disabled),
    // never a second disabled footer Input (D-01).
    const composers = screen.getAllByPlaceholderText(STR.chat.askPlaceholder);
    expect(composers).toHaveLength(1);
    expect(composers[0]).not.toBeDisabled();
  });
});

describe('SidePanelRouter (D-07 gate)', () => {
  it('shows Onboarding when no provider and onboarding is pending', () => {
    render(<SidePanelRouter />);
    expect(screen.getByText(STR.onboarding.heading)).toBeTruthy();
  });

  it("shows the disabled shell when onboarding was dismissed via 'Configure later'", () => {
    render(<SidePanelRouter />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure later' }));
    expect(screen.getByText(STR.chat.noProvider)).toBeTruthy();
  });

  it('shows the enabled chat shell when a provider is registered (W-10: provider gate, not onboarding flag)', () => {
    getProviderRegistry().registerActiveProvider('anthropic');
    render(<SidePanelRouter />);
    expect(screen.queryByText(STR.chat.noProvider)).toBeNull();
    expect(screen.queryByText(STR.onboarding.heading)).toBeNull();
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
  });
});
