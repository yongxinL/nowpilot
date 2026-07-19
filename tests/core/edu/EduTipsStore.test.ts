import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('EduTipsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks messageCount incremented per message', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    useEduTipsStore.getState().incrementMessageCount();
    useEduTipsStore.getState().incrementMessageCount();
    useEduTipsStore.getState().incrementMessageCount();
    expect(useEduTipsStore.getState().messageCount).toBe(3);
  });

  it('tracks sessionCount incremented per new conversation', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    useEduTipsStore.getState().incrementSessionCount();
    expect(useEduTipsStore.getState().sessionCount).toBe(1);
  });

  it('persists per-tip dismiss booleans under np_edu_tips', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    useEduTipsStore.getState().dismissTip('slash-command');
    expect(useEduTipsStore.getState().dismissedTips['slash-command']).toBe(true);
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('tracks slash/agent/mention usage markers', async () => {
    const { useEduTipsStore } = await import('../../../src/core/edu/EduTipsStore');
    useEduTipsStore.getState().markSlashUsed();
    useEduTipsStore.getState().markAgentUsed();
    useEduTipsStore.getState().markMentionUsed();
    const state = useEduTipsStore.getState();
    expect(state.slashCommandUsed).toBe(true);
    expect(state.agentModeUsed).toBe(true);
    expect(state.mentionUsed).toBe(true);
  });
});
