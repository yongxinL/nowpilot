import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import {
  WorkspaceStatusBar,
  WORKSPACE_STATUS_BAR_HEIGHT,
  WORKSPACE_STATUS_BAR_MAX_WIDTH,
} from '../../src/components/common/WorkspaceStatusBar';
import { WorkspaceStatusBarLeft } from '../../src/components/common/WorkspaceStatusBarLeft';
import { WorkspaceStatusBarRight } from '../../src/components/common/WorkspaceStatusBarRight';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('WorkspaceStatusBar shared shell structure', () => {
  it('exports the 38px height constant', () => {
    expect(WORKSPACE_STATUS_BAR_HEIGHT).toBe(38);
  });

  it('exports the 790px max-width constant', () => {
    expect(WORKSPACE_STATUS_BAR_MAX_WIDTH).toBe(790);
  });

  it('standalone status bar is 38px tall and flush with its shell by default', () => {
    const { container } = setup(
      React.createElement(WorkspaceStatusBar, {
        surface: 'standalone',
        providerName: 'Anthropic (Claude)',
      }),
    );
    const bar = container.querySelector('[data-workspace-status-bar="true"]') as HTMLElement | null;
    expect(bar).toBeTruthy();
    const style = bar?.getAttribute('style') ?? '';
    expect(style).toContain('height: 38px');
    expect(style).toContain('min-height: 38px');
    expect(bar?.getAttribute('data-status-bar-flush')).toBe('true');
    expect(style).toContain('border-radius: 0');

    const inner = container.querySelector('[data-workspace-status-bar-inner="true"]') as HTMLElement | null;
    expect(inner).toBeTruthy();
    const innerStyle = inner?.getAttribute('style') ?? '';
    expect(innerStyle).toContain('max-width: 790px');
  });

  it('standalone status bar with flush=false paints its own rounded bottom corners', () => {
    const { container } = setup(
      React.createElement(WorkspaceStatusBar, {
        surface: 'standalone',
        providerName: 'NowPilot',
        flush: false,
      }),
    );
    const bar = container.querySelector('[data-workspace-status-bar="true"]') as HTMLElement | null;
    expect(bar).toBeTruthy();
    const style = bar?.getAttribute('style') ?? '';
    expect(style).toContain('border-bottom-left-radius');
    expect(style).toContain('border-bottom-right-radius');
    expect(bar?.getAttribute('data-status-bar-flush')).toBe('false');
  });

  it('renders provider name, zap, server, and token indicators on the left', () => {
    const { container } = setup(
      React.createElement(WorkspaceStatusBarLeft, {
        providerName: 'Anthropic (Claude)',
        inputTokens: 0,
        sessionTokens: 14000,
      }),
    );
    const left = container.querySelector('[data-workspace-status-bar-left="true"]');
    expect(left).toBeTruthy();
    expect(left?.textContent).toContain('Anthropic (Claude)');
    expect(container.querySelector('[data-status-item="provider"]')).toBeTruthy();
    expect(container.querySelector('[data-status-item="zap"]')).toBeTruthy();
    expect(container.querySelector('[data-status-item="server"]')).toBeTruthy();
    expect(container.querySelector('[data-status-item="tokens"]')).toBeTruthy();
    expect(left?.textContent).toContain('In: 0 | Total: 14k');
  });

  it('renders help and feedback actions on the right', () => {
    const { container } = setup(
      React.createElement(WorkspaceStatusBarRight, {
        onHelp: vi.fn(),
        onFeedback: vi.fn(),
      }),
    );
    const right = container.querySelector('[data-workspace-status-bar-right="true"]');
    expect(right).toBeTruthy();
    expect(container.querySelector('[data-status-action="help"]')).toBeTruthy();
    expect(container.querySelector('[data-status-action="feedback"]')).toBeTruthy();
  });

  it('clicking the help action invokes onHelp', () => {
    const onHelp = vi.fn();
    const { container } = setup(
      React.createElement(WorkspaceStatusBarRight, { onHelp }),
    );
    const help = container.querySelector('[data-status-action="help"]') as HTMLElement | null;
    expect(help).toBeTruthy();
    help?.click();
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it('clicking the feedback action invokes onFeedback', () => {
    const onFeedback = vi.fn();
    const { container } = setup(
      React.createElement(WorkspaceStatusBarRight, { onFeedback }),
    );
    const feedback = container.querySelector('[data-status-action="feedback"]') as HTMLElement | null;
    expect(feedback).toBeTruthy();
    feedback?.click();
    expect(onFeedback).toHaveBeenCalledTimes(1);
  });

  it('surface prop is reflected in data attribute', () => {
    const standaloneBar = setup(
      React.createElement(WorkspaceStatusBar, { surface: 'standalone', providerName: 'NowPilot' }),
    );
    expect(
      standaloneBar.container.querySelector('[data-status-bar-surface="standalone"]'),
    ).toBeTruthy();

    const sidepanelBar = setup(
      React.createElement(WorkspaceStatusBar, { surface: 'sidepanel', providerName: 'NowPilot' }),
    );
    expect(
      sidepanelBar.container.querySelector('[data-status-bar-surface="sidepanel"]'),
    ).toBeTruthy();
  });
});