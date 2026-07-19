import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock @ant-design/x ThoughtChain
vi.mock('@ant-design/x', () => ({
  ThoughtChain: ({ items, expandedKeys, onExpand, style, title, ...rest }: any) => (
    <div data-testid="thoughtchain-mock" data-title={title}>
      {items?.length ? items.map((item: any) => (
        <div key={item.key} data-step-status={item.status}>
          {item.title}
        </div>
      )) : 'No items'}
    </div>
  ),
}));

import { ThoughtChainView } from '../../../src/components/agent/ThoughtChainView';

describe('ThoughtChainView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "NowPilot is working…" when steps are empty (D-29)', () => {
    const { container } = render(<ThoughtChainView steps={[]} />);

    // The component should show "NowPilot is working…" in the empty state
    expect(container.textContent).toContain('NowPilot is working…');
  });

  it('renders step items when steps are provided', () => {
    const steps = [
      { id: 'step-1', title: 'Researching', status: 'pending', description: 'Gathering info' },
    ];
    const { container } = render(<ThoughtChainView steps={steps as any} />);

    expect(container.textContent).toContain('Researching');
    expect(container.textContent).not.toContain('NowPilot is working…');
  });
});
