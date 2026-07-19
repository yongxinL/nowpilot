import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TipEligibilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates slash-command tip: messageCount>=3 && !slashCommandUsed && !dismissed', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    const { tipEligibilityService } = await import('../../../src/core/edu/TipEligibilityService');

    useEduTipsStore.setState({
      messageCount: 3,
      sessionCount: 0,
      dismissedTips: {},
      slashCommandUsed: false,
      agentModeUsed: false,
      mentionUsed: false,
    });

    const eligible = tipEligibilityService.getEligibleTips();
    expect(eligible).toContain('slash-command');
  });

  it('slash-command tip not eligible when dismissed', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    const { tipEligibilityService } = await import('../../../src/core/edu/TipEligibilityService');

    useEduTipsStore.setState({
      messageCount: 5,
      dismissedTips: { 'slash-command': true },
      slashCommandUsed: false,
      agentModeUsed: false,
      mentionUsed: false,
      sessionCount: 0,
    });

    const eligible = tipEligibilityService.getEligibleTips();
    expect(eligible).not.toContain('slash-command');
  });

  it('slash-command tip not eligible when already used slash', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    const { tipEligibilityService } = await import('../../../src/core/edu/TipEligibilityService');

    useEduTipsStore.setState({
      messageCount: 5,
      dismissedTips: {},
      slashCommandUsed: true,
      agentModeUsed: false,
      mentionUsed: false,
      sessionCount: 0,
    });

    const eligible = tipEligibilityService.getEligibleTips();
    expect(eligible).not.toContain('slash-command');
  });

  it('mention-discovery tip eligible when mention not used', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    const { tipEligibilityService } = await import('../../../src/core/edu/TipEligibilityService');

    useEduTipsStore.setState({
      messageCount: 0,
      sessionCount: 0,
      dismissedTips: {},
      slashCommandUsed: false,
      agentModeUsed: false,
      mentionUsed: false,
    });

    const eligible = tipEligibilityService.getEligibleTips();
    expect(eligible).toContain('mention-discovery');
  });
});
