import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { SidepanelContent } from '../../src/components/sidepanel/SidepanelContent';
import { WorkspaceStatusBar } from '../../src/components/common/WorkspaceStatusBar';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('Unified sidepanel shell + status bar frame', () => {
  it('shell paints an explicit colorBgContainer background', () => {
    const { container } = setup(
      React.createElement(SidepanelContent, {
        activeNavId: 'chat',
        children: React.createElement('div', null, 'content'),
      }),
    );
    const shell = container.querySelector('[data-sidepanel-content-shell="true"]') as HTMLElement | null;
    expect(shell).toBeTruthy();
    const style = shell?.getAttribute('style') ?? '';
    expect(style).not.toContain('background: transparent');
    expect(style).toMatch(/background:\s*rgb/);
    expect(style).toContain('border-radius: 12px');
  });

  it('shell overflow:hidden so content corners follow the shell radius', () => {
    const { container } = setup(
      React.createElement(SidepanelContent, {
        activeNavId: 'chat',
        children: React.createElement('div', null, 'content'),
      }),
    );
    const shell = container.querySelector('[data-sidepanel-content-shell="true"]') as HTMLElement | null;
    expect(shell).toBeTruthy();
    const style = shell?.getAttribute('style') ?? '';
    expect(style).toContain('overflow: hidden');
    expect(style).toContain('border-radius: 12px');
  });

  it('standalone WorkspaceStatusBar flush default removes its own rounded corners', () => {
    const { container } = setup(
      React.createElement(WorkspaceStatusBar, {
        surface: 'standalone',
        providerName: 'Anthropic (Claude)',
      }),
    );
    const bar = container.querySelector('[data-workspace-status-bar="true"]') as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('data-status-bar-flush')).toBe('true');
    const style = bar?.getAttribute('style') ?? '';
    expect(style).toContain('border-radius: 0');
    expect(style).toContain('background: transparent');
  });
});