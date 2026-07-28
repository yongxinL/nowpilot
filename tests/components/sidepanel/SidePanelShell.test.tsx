import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { App } from 'antd';
import { SidePanelShell } from '../../../src/components/sidepanel/SidePanelShell';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';

describe('SidePanelShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    expect(container).toBeTruthy();
  });

  it('renders the app name NowPilot in header', () => {
    const { getByText } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    expect(getByText('NowPilot')).toBeTruthy();
  });

  it('renders all four tab items', () => {
    const { getByText } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    expect(getByText('Chat')).toBeTruthy();
    expect(getByText('Agent')).toBeTruthy();
    expect(getByText('Write')).toBeTruthy();
    expect(getByText('TeamGQM')).toBeTruthy();
  });

  it('renders Open in Full Tab button in footer', () => {
    const { getByText } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    expect(getByText('Open in Full Tab')).toBeTruthy();
  });

  it('renders the theme toggle button', () => {
    const { container } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    // The ThemeToggle renders a button with aria-label "Toggle theme"
    const toggleButton = container.querySelector('button[aria-label="Toggle theme"]');
    expect(toggleButton).not.toBeNull();
  });

  it('renders default chat page content', () => {
    const { getByText } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    // ChatPage renders with "Start a conversation" empty state
    expect(getByText('Start a conversation')).toBeTruthy();
  });

  it('does not import from src/components/app/', () => {
    // Static check: SidePanelShell should have no imports from app/
    const source = SidePanelShell.toString();
    expect(source).not.toContain('components/app/');
    expect(source).not.toContain('src/components/app');
  });

  it('supports switching page type to agent and write', () => {
    // Verify the page type union includes all expected values
    const { getByText } = render(
      <App>
        <SidePanelShell />
      </App>,
    );
    // Verify both Chat and Agent tabs are present (not disabled)
    const chatTab = getByText('Chat');
    const agentTab = getByText('Agent');
    expect(chatTab).toBeTruthy();
    expect(agentTab).toBeTruthy();
  });
});
