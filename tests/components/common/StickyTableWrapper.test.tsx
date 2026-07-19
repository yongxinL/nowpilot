import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StickyTableWrapper } from '../../../src/components/common/StickyTableWrapper';

describe('StickyTableWrapper', () => {
  it('renders table with sticky-header-table class', () => {
    const { container } = render(
      <StickyTableWrapper>
        <thead><tr><th>Header</th></tr></thead>
        <tbody><tr><td>Cell</td></tr></tbody>
      </StickyTableWrapper>,
    );
    const table = container.querySelector('.sticky-header-table');
    expect(table).toBeDefined();
  });

  it('renders wrapper div with overflow-x auto', () => {
    const { container } = render(
      <StickyTableWrapper>
        <thead><tr><th>H</th></tr></thead>
        <tbody><tr><td>C</td></tr></tbody>
      </StickyTableWrapper>,
    );
    const wrapper = container.querySelector('div > style + table')?.parentElement;
    expect(wrapper).toBeDefined();
    expect((wrapper as HTMLElement).style.overflowX).toBe('auto');
  });

  it('injects style element for sticky headers', () => {
    const { container } = render(
      <StickyTableWrapper>
        <thead><tr><th>H</th></tr></thead>
        <tbody><tr><td>C</td></tr></tbody>
      </StickyTableWrapper>,
    );
    const styleEl = container.querySelector('style');
    expect(styleEl).toBeDefined();
    expect(styleEl?.innerHTML).toContain('sticky-header-table');
  });
});
