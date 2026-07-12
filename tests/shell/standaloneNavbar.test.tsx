import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import {
  StandaloneSider,
} from '../../src/components/standalone/StandaloneSider';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('StandaloneSider render structure', () => {
  it('expanded density renders Switch to Side Panel and project name', () => {
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
    expect(container.querySelector('[data-standalone-sider-density="expanded"]')).toBeTruthy();
    expect(container.querySelector('[data-standalone-action="switch-to-sidepanel"]')).toBeTruthy();
    // Collapse/expand toggle moved to footer (no collapse button in header)
    expect(container.querySelector('[data-sider-action="expand"]')).toBeTruthy();
    expect(document.body.textContent).toContain('NowPilot');
  });

  it('collapsed density renders logo only and Expand sider', () => {
    const { container } = setup(
      React.createElement(StandaloneSider, {
        density: 'collapsed',
        activeId: 'chat',
        onSelect: () => {},
        onCollapseToggle: () => {},
        onSwitchToSidePanel: () => {},
        onOpenOptions: () => {},
      }),
    );
    expect(container.querySelector('[data-standalone-sider-density="collapsed"]')).toBeTruthy();
    expect(container.querySelector('[data-sider-action="expand"]')).toBeTruthy();
  });

  it('Options action is present in both densities', () => {
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
    expect(container.querySelector('[data-standalone-action="open-options"]')).toBeTruthy();
  });

  it('User avatar menu is rendered in expanded standalone', () => {
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
    expect(container.querySelector('[aria-label^="User menu"]')).toBeTruthy();
  });
});

describe('Surface toggle actions', () => {
  it('Switch to Side Panel action calls handler when invoked', () => {
    let called = 0;
    const { container } = setup(
      React.createElement(StandaloneSider, {
        density: 'expanded',
        activeId: 'chat',
        onSelect: () => {},
        onCollapseToggle: () => {},
        onSwitchToSidePanel: () => {
          called += 1;
        },
        onOpenOptions: () => {},
      }),
    );
    const button = container.querySelector('[data-standalone-action="switch-to-sidepanel"]');
    expect(button).toBeTruthy();
    (button as HTMLElement).click();
    expect(called).toBe(1);
  });
});
