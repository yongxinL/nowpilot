import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChecklistCardGroup } from '../../../src/components/chat/ChecklistCardGroup';

describe('ChecklistCardGroup', () => {
  it('renders checkboxes for 2+ item lists', () => {
    const { container } = render(
      <ChecklistCardGroup>
        <li>Step one</li>
        <li>Step two</li>
      </ChecklistCardGroup>,
    );
    const checkboxes = container.querySelectorAll('.ant-checkbox-input');
    expect(checkboxes.length).toBe(2);
  });

  it('renders progress bar', () => {
    const { container } = render(
      <ChecklistCardGroup>
        <li>Step one</li>
        <li>Step two</li>
        <li>Step three</li>
      </ChecklistCardGroup>,
    );
    const progress = container.querySelector('.ant-progress');
    expect(progress).toBeDefined();
  });

  it('falls back to standard ol for single item', () => {
    const { container } = render(
      <ChecklistCardGroup>
        <li>Only step</li>
      </ChecklistCardGroup>,
    );
    const checkboxes = container.querySelectorAll('.ant-checkbox-input');
    expect(checkboxes.length).toBe(0);
    expect(container.querySelector('ol')).toBeDefined();
  });
});
