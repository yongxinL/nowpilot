import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UsageEntry {
  usageCount: number;
  lastUsedAt: number;
  firstUsedAt: number;
  source: string;
}

export interface PromptStarterUsageState {
  usage: Record<string, UsageEntry>;
  recordUsage: (promptStarterId: string, source: string) => void;
}

const chromeLocalStorage = createJSONStorage<PromptStarterUsageState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((r: Record<string, unknown>) => (r[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const usePromptStarterUsageStore = create<PromptStarterUsageState>()(
  persist(
    (set) => ({
      usage: {},
      recordUsage: (promptStarterId, source) =>
        set((state) => {
          const prev = state.usage[promptStarterId];
          return {
            usage: {
              ...state.usage,
              [promptStarterId]: {
                usageCount: (prev?.usageCount ?? 0) + 1,
                lastUsedAt: Date.now(),
                firstUsedAt: prev?.firstUsedAt ?? Date.now(),
                source,
              },
            },
          };
        }),
    }),
    {
      name: 'np_prompt_usage',
      storage: chromeLocalStorage as any,
    },
  ),
);
