import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StageIndicator } from '../../../src/components/chat/StageIndicator';

describe('StageIndicator', () => {
  it('renders stage label for generating stage', () => {
    render(<StageIndicator stage="generating" hasPinnedTabs={false} />);
    expect(screen.getByText('Generating…')).toBeDefined();
  });

  it('renders detail toggle for generating stage', () => {
    render(<StageIndicator stage="generating" hasPinnedTabs={false} />);
    expect(screen.queryAllByText('detail').length).toBeGreaterThanOrEqual(1);
  });

  it('renders null for idle stage', () => {
    const { container } = render(<StageIndicator stage="idle" hasPinnedTabs={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows page context label when hasPinnedTabs and retrieving', () => {
    render(<StageIndicator stage="retrieving" hasPinnedTabs />);
    expect(screen.getByText('Reading page context…')).toBeDefined();
  });
});
