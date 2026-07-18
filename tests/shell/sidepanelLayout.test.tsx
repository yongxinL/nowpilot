import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { SidepanelContent } from '../../src/components/sidepanel/SidepanelContent';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('SidepanelContent shell layout', () => {
  it('renders a 4px-padded main with rounded shell that extends full height', () => {
    const { container } = setup(
      React.createElement(SidepanelContent, {
        activeNavId: 'chat',
        children: React.createElement('div', { 'data-test': 'page-content' }, 'content'),
      }),
    );
    const main = container.querySelector('[data-sidepanel-content]') as HTMLElement | null;
    expect(main).toBeTruthy();
    const mainStyle = main?.getAttribute('style') ?? '';
    expect(mainStyle).toMatch(/padding(-top)?:\s*4px/);
    expect(mainStyle).toMatch(/padding(-left)?:\s*4px/);
    expect(mainStyle).toMatch(/padding(-bottom)?:\s*4px/);
    expect(mainStyle).toMatch(/padding(-right)?:\s*4px/);

    const shell = container.querySelector('[data-sidepanel-content-shell="true"]') as HTMLElement | null;
    expect(shell).toBeTruthy();
    const shellStyle = shell?.getAttribute('style') ?? '';
    expect(shellStyle).toContain('flex: 1');
    expect(shellStyle).toContain('overflow: hidden');
    expect(shellStyle).toContain('border-radius: 12px');
  });

  it('does not apply top padding to the scrollable area', () => {
    const { container } = setup(
      React.createElement(SidepanelContent, {
        activeNavId: 'chat',
        children: React.createElement('div', null, 'content'),
      }),
    );
    const shell = container.querySelector('[data-sidepanel-content-shell="true"]');
    const scrollable = shell?.querySelector(':scope > div:not([data-workspace-status-bar])') as HTMLElement | null;
    expect(scrollable).toBeTruthy();
    const style = scrollable?.getAttribute('style') ?? '';
    expect(style).not.toContain('padding-top: 12px');
    expect(style).not.toContain('padding: 12px');
  });

  it('does not render WorkspaceStatusBar inside the shell (page handles its own)', () => {
    const { container } = setup(
      React.createElement(SidepanelContent, {
        activeNavId: 'chat',
        children: React.createElement('div', null, 'content'),
      }),
    );
    const shell = container.querySelector('[data-sidepanel-content-shell="true"]');
    const statusBar = shell?.querySelector('[data-workspace-status-bar="true"]');
    expect(statusBar).toBeNull();
  });
});