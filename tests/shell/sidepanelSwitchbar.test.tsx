import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { SidepanelSider, type SidepanelSiderDensity } from '../../src/components/sidepanel/SidepanelSider';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('SidepanelSider density states', () => {
  it('expanded density uses data-sidepanel-sider-density=expanded', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded' as SidepanelSiderDensity,
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    expect(container.querySelector('[data-sidepanel-sider-density="expanded"]')).toBeTruthy();
  });

  it('narrow density uses data-sidepanel-sider-density=narrow', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'narrow' as SidepanelSiderDensity,
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    expect(container.querySelector('[data-sidepanel-sider-density="narrow"]')).toBeTruthy();
  });

  it('expanded topbar contains Collapse navbar and Open Standalone', () => {
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded' as SidepanelSiderDensity,
        activeId: 'chat',
        onSelect: () => {},
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    expect(container.querySelector('[data-sidepanel-action="collapse"]')).toBeTruthy();
    expect(container.querySelector('[data-sidepanel-action="open-standalone"]')).toBeTruthy();
  });

  it('clicking nav item button invokes onSelect with the item id', () => {
    const onSelect = vi.fn();
    const { container } = setup(
      React.createElement(SidepanelSider, {
        density: 'expanded' as SidepanelSiderDensity,
        activeId: 'chat',
        onSelect,
        onCollapse: () => {},
        onOpenStandalone: () => {},
      }),
    );
    const navItem = container.querySelector('[data-nav-id="chat"]');
    expect(navItem).toBeTruthy();
    (navItem as HTMLElement).click();
    expect(onSelect).toHaveBeenCalled();
  });
});
