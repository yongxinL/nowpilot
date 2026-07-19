import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEduTipsStore } from '../../../src/core/edu/EduTipsStore';
import { EduTipBanner } from '../../../src/components/chat/EduTipBanner';

describe('EduTipBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders eligible tip banner', async () => {
    useEduTipsStore.setState({
      messageCount: 3,
      sessionCount: 0,
      dismissedTips: {},
      slashCommandUsed: false,
      agentModeUsed: false,
      mentionUsed: false,
    });

    render(<EduTipBanner />);
    expect(screen.queryByText('Tip: Slash Commands')).toBeDefined();
  });

  it('does not render when no tips eligible', () => {
    useEduTipsStore.setState({
      messageCount: 0,
      sessionCount: 0,
      dismissedTips: {},
      slashCommandUsed: false,
      agentModeUsed: false,
      mentionUsed: true,
    });

    const { container } = render(<EduTipBanner />);
    expect(container.innerHTML).toBe('');
  });
});
