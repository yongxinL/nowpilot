import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface EduTipsState {
  messageCount: number;
  sessionCount: number;
  dismissedTips: Record<string, boolean>;
  slashCommandUsed: boolean;
  agentModeUsed: boolean;
  mentionUsed: boolean;
  incrementMessageCount: () => void;
  incrementSessionCount: () => void;
  dismissTip: (tipId: string) => void;
  markSlashUsed: () => void;
  markAgentUsed: () => void;
  markMentionUsed: () => void;
  reset: () => void;
}

const chromeLocalStorage = createJSONStorage<EduTipsState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((r: Record<string, unknown>) => (r[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

const initialTracking = {
  messageCount: 0,
  sessionCount: 0,
  dismissedTips: {} as Record<string, boolean>,
  slashCommandUsed: false,
  agentModeUsed: false,
  mentionUsed: false,
};

export const useEduTipsStore = create<EduTipsState>()(
  persist(
    (set) => ({
      ...initialTracking,
      incrementMessageCount: () => set((s) => ({ messageCount: s.messageCount + 1 })),
      incrementSessionCount: () => set((s) => ({ sessionCount: s.sessionCount + 1 })),
      dismissTip: (tipId) =>
        set((s) => ({ dismissedTips: { ...s.dismissedTips, [tipId]: true } })),
      markSlashUsed: () => set({ slashCommandUsed: true }),
      markAgentUsed: () => set({ agentModeUsed: true }),
      markMentionUsed: () => set({ mentionUsed: true }),
      reset: () => set({ ...initialTracking }),
    }),
    {
      name: 'np_edu_tips',
      storage: chromeLocalStorage as any,
      partialize: (state) => ({
        messageCount: state.messageCount,
        sessionCount: state.sessionCount,
        dismissedTips: state.dismissedTips,
        slashCommandUsed: state.slashCommandUsed,
        agentModeUsed: state.agentModeUsed,
        mentionUsed: state.mentionUsed,
      }),
    },
  ),
);
