// tests/components/sidepanel/SidePanelShell.test.tsx — §17.1 chat-only shell
// contract + the SidePanelRouter D-07 gate (W-10: provider presence, not an
// onboarding flag). Covers: header + disabled askPlaceholder input, no send
// button, disabled surface (STR.chat.noProvider) when no provider, chat content
// when a provider is registered, and the router's three gate branches
// (onboarding pending → Onboarding; onboarding done → disabled shell; provider
// present → enabled shell — including the Flow 9 'Configure later' flip).
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SidePanelRouter } from '@/components/sidepanel/SidePanelRouter';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { STR } from '@/core/i18n/strings';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';

beforeEach(() => {
  getProviderRegistry().clear();
  useAddonSettingsStore.setState({ settings: {} });
});

describe('SidePanelShell', () => {
  it('renders the header title and a disabled askPlaceholder input (no chat logic)', () => {
    render(<SidePanelShell />);
    expect(screen.getByText('NowPilot')).toBeTruthy();
    const input = screen.getByPlaceholderText(STR.chat.askPlaceholder);
    expect(input).toBeTruthy();
    expect(input).toBeDisabled();
  });

  it('renders no send button (§17.1 composer is a placeholder this phase)', () => {
    render(<SidePanelShell />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
  });

  it('renders the disabled surface (STR.chat.noProvider banner) when no provider is active', () => {
    render(<SidePanelShell />);
    expect(screen.getByText(STR.chat.noProvider)).toBeTruthy();
  });

  it('renders the chat content once a provider is registered (D-07)', () => {
    getProviderRegistry().registerActiveProvider('openai');
    render(<SidePanelShell />);
    expect(screen.queryByText(STR.chat.noProvider)).toBeNull();
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
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
