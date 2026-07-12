import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import {
  StandaloneSider,
  STANDALONE_NAVBAR_WIDTH,
} from '../../src/components/standalone/StandaloneSider';
import { SidepanelSider, SIDEPANEL_SWITCHBAR_WIDTH } from '../../src/components/sidepanel/SidepanelSider';
import { ApplicationFrame } from '../../src/components/common/ApplicationFrame';
import { NavbarSeparator } from '../../src/components/sider/NavbarSeparator';
import { NavItemSuffixArrow } from '../../src/components/sider/NavItemSuffixArrow';
import { WorkspaceStatusBar, WORKSPACE_STATUS_BAR_HEIGHT } from '../../src/components/common/WorkspaceStatusBar';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('ApplicationFrame shell containment', () => {
  it('standalone surface renders an application frame', () => {
    const { container } = setup(
      React.createElement(ApplicationFrame, { surface: 'standalone' }, 'children'),
    );
    const frame = container.querySelector('[data-application-frame="true"]');
    expect(frame).toBeTruthy();
    expect(frame?.getAttribute('data-surface')).toBe('standalone');
    const style = (frame as HTMLElement | null)?.getAttribute('style') ?? '';
    expect(style).toContain('overflow: hidden');
    expect(style).toContain('width: 100%');
    expect(style).toContain('height: 100%');
  });

  it('sidepanel surface renders an application frame', () => {
    const { container } = setup(
      React.createElement(ApplicationFrame, { surface: 'sidepanel' }, 'children'),
    );
    const frame = container.querySelector('[data-application-frame="true"]');
    expect(frame).toBeTruthy();
    expect(frame?.getAttribute('data-surface')).toBe('sidepanel');
  });
});

describe('Standalone navbar width lock (240px)', () => {
  it('exports a 240px width constant', () => {
    expect(STANDALONE_NAVBAR_WIDTH).toBe(240);
  });

  it('expanded sider pins width, min-width and max-width to 240px', () => {
    const { container } = setup(
      React.createElement(StandaloneSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapseToggle: () => {},
        onSwitchToSidePanel: () => {},
        onOpenOptions: () => {},
      }),
    );
    const aside = container.querySelector('[data-standalone-sider-density="expanded"]') as HTMLElement | null;
    expect(aside).toBeTruthy();
    const style = aside?.getAttribute('style') ?? '';
    expect(style).toContain('width: 240px');
    expect(style).toContain('min-width: 240px');
    expect(style).toContain('max-width: 240px');
    expect(aside?.getAttribute('data-standalone-sider-width')).toBe('240');
  });
});

describe('Sidepanel switchbar width lock (60px)', () => {
  it('exports a 60px width constant', () => {
    expect(SIDEPANEL_SWITCHBAR_WIDTH).toBe(60);
  });

  it('expanded sider pins width, min-width and max-width to 60px', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const aside = container.querySelector('[data-sidepanel-sider-density="expanded"]') as HTMLElement | null;
    expect(aside).toBeTruthy();
    const style = aside?.getAttribute('style') ?? '';
    expect(style).toContain('width: 60px');
    expect(style).toContain('min-width: 60px');
    expect(style).toContain('max-width: 60px');
    expect(aside?.getAttribute('data-sidepanel-sider-width')).toBe('60');
  });
});

describe('Footer pinned to bottom', () => {
  it('standalone expanded footer uses margin-top:auto', () => {
    const { container } = setup(
      React.createElement(StandaloneSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapseToggle: () => {},
        onSwitchToSidePanel: () => {},
        onOpenOptions: () => {},
      }),
    );
    const footer = container.querySelector('[data-standalone-sider-footer="expanded"]') as HTMLElement | null;
    expect(footer).toBeTruthy();
    const style = footer?.getAttribute('style') ?? '';
    expect(style).toContain('margin-top: auto');
  });

  it('sidepanel sider expanded footer uses margin-top:auto and column direction', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const footer = container.querySelector('[data-sidepanel-sider-footer="true"]') as HTMLElement | null;
    expect(footer).toBeTruthy();
    const style = footer?.getAttribute('style') ?? '';
    expect(style).toContain('margin-top: auto');
    expect(style).toContain('flex-direction: column');
  });

  it('sidepanel sider narrow footer uses column direction (vertical items)', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'narrow',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const footer = container.querySelector('[data-sidepanel-sider-footer="true"]') as HTMLElement | null;
    expect(footer).toBeTruthy();
    const style = footer?.getAttribute('style') ?? '';
    expect(style).toContain('flex-direction: column');
  });
});

describe('Navigation hierarchy helpers', () => {
  it('NavbarSeparator renders with role=separator', () => {
    const { container } = setup(React.createElement(NavbarSeparator, {}));
    const sep = container.querySelector('[data-navbar-separator="true"]');
    expect(sep).toBeTruthy();
    expect(sep?.getAttribute('role')).toBe('separator');
  });

  it('NavItemSuffixArrow renders an aria-hidden suffix', () => {
    const { container } = setup(React.createElement(NavItemSuffixArrow, {}));
    const arrow = container.querySelector('[data-nav-item-suffix-arrow="true"]');
    expect(arrow).toBeTruthy();
    expect(arrow?.getAttribute('aria-hidden')).toBe('true');
  });

  it('NavItemSuffixArrow returns null when visible=false', () => {
    const { container } = setup(React.createElement(NavItemSuffixArrow, { visible: false }));
    expect(container.querySelector('[data-nav-item-suffix-arrow="true"]')).toBeNull();
  });
});

describe('Sidepanel addon (Task) item is icon-only with tooltip', () => {
  it('expanded sidepanel sider hides the Task label and exposes tooltip', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const taskButton = container.querySelector('[data-nav-id="tasks"]') as HTMLElement | null;
    expect(taskButton).toBeTruthy();
    const text = (taskButton?.textContent ?? '').trim();
    expect(text).not.toContain('Task');
    expect(taskButton?.getAttribute('aria-label')).toBe('Tasks');
  });

  it('narrow sidepanel sider also hides the Task label', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'narrow',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const taskButton = container.querySelector('[data-nav-id="tasks"]') as HTMLElement | null;
    expect(taskButton).toBeTruthy();
    const text = (taskButton?.textContent ?? '').trim();
    expect(text).not.toContain('Task');
  });

  it('expanded sidepanel sider still shows the Chat label (core item)', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const chatButton = container.querySelector('[data-nav-id="chat"]') as HTMLElement | null;
    expect(chatButton).toBeTruthy();
    expect(chatButton?.textContent).toContain('Chat');
  });
});

describe('Sidepanel sider shows separator between core and addon groups', () => {
  it('renders exactly one separator between core and addon items', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const seps = container.querySelectorAll('[data-navbar-separator="true"]');
    expect(seps.length).toBe(1);
  });

  it('separator sits between Chat (core) and Tasks (addon) in the DOM', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const menu = container.querySelector('[role="group"][aria-label="Sider menu"]');
    expect(menu).toBeTruthy();
    const navItems = Array.from(container.querySelectorAll('[data-nav-id]'));
    const idsInOrder = navItems.map((el) => el.getAttribute('data-nav-id'));
    const taskPos = idsInOrder.indexOf('tasks');
    const toolsPos = idsInOrder.indexOf('tools');
    expect(taskPos).toBeGreaterThan(0);
    expect(toolsPos).toBeGreaterThan(-1);
    expect(taskPos).toBe(toolsPos + 1);
    const sep = menu!.querySelector('[data-navbar-separator="true"]');
    expect(sep).toBeTruthy();
  });
});

describe('Sidepanel SwitchbarTopbar', () => {
  it('expanded density has gap=6, centered layout, and row direction', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const topbar = container.querySelector('[data-switchbar-topbar="true"]') as HTMLElement | null;
    expect(topbar).toBeTruthy();
    expect(topbar?.getAttribute('data-switchbar-topbar-density')).toBe('expanded');
    const style = topbar?.getAttribute('style') ?? '';
    expect(style).toContain('gap: 6px');
    expect(style).toContain('justify-content: center');
    expect(style).toContain('flex-direction: row');
  });

  it('narrow density also uses row layout for toggles', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'narrow',
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const topbar = container.querySelector('[data-switchbar-topbar="true"]') as HTMLElement | null;
    expect(topbar).toBeTruthy();
    expect(topbar?.getAttribute('data-switchbar-topbar-density')).toBe('narrow');
    const style = topbar?.getAttribute('style') ?? '';
    expect(style).toContain('flex-direction: row');
    expect(style).toContain('justify-content: center');
  });
});

describe('WorkspaceStatusBar height and spacing', () => {
  it('exports 38px height constant', () => {
    expect(WORKSPACE_STATUS_BAR_HEIGHT).toBe(38);
  });

  it('standalone status bar applies height 38px', () => {
    const { container } = setup(
      React.createElement(WorkspaceStatusBar, { surface: 'standalone', providerName: 'Anthropic (Claude)' }),
    );
    const bar = container.querySelector('[data-workspace-status-bar="true"]') as HTMLElement | null;
    expect(bar).toBeTruthy();
    const style = bar?.getAttribute('style') ?? '';
    expect(style).toContain('height: 38px');
    expect(style).toContain('min-height: 38px');
  });
});