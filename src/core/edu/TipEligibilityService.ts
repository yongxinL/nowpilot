import { useEduTipsStore } from './EduTipsStore';

export class TipEligibilityService {
  getEligibleTips(): string[] {
    const state = useEduTipsStore.getState();
    const eligible: string[] = [];

    if (state.messageCount >= 3 && !state.slashCommandUsed && !state.dismissedTips['slash-command']) {
      eligible.push('slash-command');
    }

    if (state.sessionCount >= 5 && !state.agentModeUsed && !state.dismissedTips['agent-mode']) {
      eligible.push('agent-mode');
    }

    if (!state.mentionUsed && !state.dismissedTips['mention-discovery']) {
      eligible.push('mention-discovery');
    }

    return eligible;
  }
}

export const tipEligibilityService = new TipEligibilityService();
