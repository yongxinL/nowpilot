// tests/components/standalone/StandaloneShell.test.tsx — standalone shell
// contract (openTitle header, §18 page resolution from StandalonePageRegistry)
// + StandaloneRouter page routing ('chat' default; navigateToPage flips the
// active page — backing the Cmd+K 'Open Options' command).
import { render, screen } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { beforeEach, describe, expect, it } from 'vitest';
import { StandaloneRouter } from '@/components/standalone/StandaloneRouter';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { useStandaloneNav } from '@/components/standalone/standaloneNav';
import { STR } from '@/core/i18n/strings';

beforeEach(() => {
  useStandaloneNav.setState({ activePageId: 'chat' });
});

describe('StandaloneShell', () => {
  it('renders the openTitle header', () => {
    render(<StandaloneShell activePageId="chat" />);
    expect(screen.getByText(STR.standalone.openTitle)).toBeTruthy();
  });

  it('renders the Chat page for the default registry id', () => {
    render(<StandaloneShell activePageId="chat" />);
    expect(screen.getByText(STR.chat.empty)).toBeTruthy();
  });

  it('renders the Options page for the options registry id (needs AntdApp for useApp)', () => {
    render(
      <AntdApp>
        <StandaloneShell activePageId="options" />
      </AntdApp>,
    );
    expect(screen.getByText('No provider connected. Set up a provider to start.')).toBeTruthy();
  });
});

describe('StandaloneRouter', () => {
  it('defaults to the Chat page', () => {
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
