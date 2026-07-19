import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { OptionsRoot, optionsSections } from '../../src/components/options/OptionsRoot';

function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('Options page UI shell', () => {
  it('renders sidebar with all 8 core sections', () => {
    const { container } = setup(React.createElement(OptionsRoot, {}));
    const items = container.querySelectorAll('[data-options-nav-item]');
    expect(items.length).toBe(10);
  });

  it('renders options search input with accessible label', () => {
    const { container } = setup(React.createElement(OptionsRoot, {}));
    const searchInput = container.querySelector('[aria-label="Search settings"]');
    expect(searchInput).toBeTruthy();
  });

  it('exposes the canonical sections list', () => {
    const ids = optionsSections.map((s) => s.id);
    expect(ids).not.toContain('providers');
    expect(ids).not.toContain('models');
    expect(ids).toContain('general');
    expect(ids).toContain('sidebar');
    expect(ids).toContain('translate');
    expect(ids).toContain('prompts');
    expect(ids).toContain('slash');
    expect(ids).toContain('mcp');
    expect(ids).toContain('addons');
    expect(ids).toContain('advanced');
  });

  it('marks the active section via aria-current', () => {
    const { container } = setup(React.createElement(OptionsRoot, { initialSection: 'general' }));
    const active = container.querySelector('[data-options-nav-item="general"]');
    expect(active?.getAttribute('aria-current')).toBe('page');
  });
});
