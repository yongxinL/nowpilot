import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../core/storage/chromeStorageAdapter';
import { useThemeStore, type ThemeMode } from '../core/theme/ThemeStore';
import type {
  ChatSession,
  Message,
  ProviderConfig,
  PromptItem,
  Attachment,
  TabItem,
} from '../types';

const INITIAL_PROMPTS: PromptItem[] = [
  { id: '1', title: 'Summarize', content: 'Provide a concise summary of the following text with key bullet points:', category: 'Reading', showInList: true, icon: 'FileText' },
  { id: '2', title: 'Translate into: British English', content: 'Translate the following text into natural, idiomatic British English:', category: 'Writing', showInList: true, targetLang: 'British English', icon: 'Languages' },
  { id: '3', title: 'Improve writing', content: 'Polishing and enhance the clarity, tone, and flow of the following text:', category: 'Writing', showInList: true, icon: 'Edit3' },
  { id: '4', title: 'Fix spelling & grammar', content: 'Correct all spelling and grammatical errors while preserving original tone:', category: 'Writing', showInList: true, icon: 'CheckCircle' },
  { id: '5', title: 'Answer this question', content: 'Answer the question directly based on context and facts:', category: 'Chat/Ask', showInList: true, icon: 'HelpCircle' },
  { id: '6', title: 'Explain codes', content: 'Explain this code snippet line by line with clear examples:', category: 'Reading', showInList: true, icon: 'Code' },
  { id: '7', title: 'Find action items', content: 'Extract all actionable tasks, assignments, and follow-ups:', category: 'Reading', showInList: true, icon: 'ListCheck' },
  { id: '8', title: 'Make shorter', content: 'Condense this message into half its current length without losing key facts:', category: 'Writing', showInList: true, icon: 'Minimize2' },
  { id: '9', title: 'For YouTube', content: 'Generate YouTube video titles, description, and key chapter timestamps:', category: 'Chat/Ask', showInList: false, icon: 'Youtube' },
  { id: '10', title: 'Paragraph about...', content: 'Write a compelling paragraph explaining:', category: 'Writing', showInList: false },
  { id: '11', title: 'Social media post...', content: 'Create an engaging social media post with hashtags:', category: 'Writing', showInList: false },
  { id: '12', title: 'Press release', content: 'Draft a professional press release announcement:', category: 'Writing', showInList: false },
  { id: '13', title: 'Creative story', content: 'Write a creative short story based on these themes:', category: 'Writing', showInList: false },
  { id: '14', title: 'To-do list...', content: 'Turn this description into a categorized to-do list:', category: 'Writing', showInList: false },
  { id: '15', title: 'Meeting agenda...', content: 'Create a structured meeting agenda with time blocks:', category: 'Writing', showInList: false },
];

const DEFAULT_CONFIG: ProviderConfig = {
  serviceProvider: 'Custom API Key',
  activeProvider: 'openai',
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: false,
      proxyUrl: '',
      models: [
        { id: 'gemma-4-e2b-it-4bit', name: 'gemma-4-e2b-it-4bit', enabled: true },
        { id: 'gpt-4o', name: 'gpt-4o', enabled: false },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: false },
      ],
    },
    gemini: {
      id: 'gemini',
      name: 'Google (Gemini)',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: false,
      proxyUrl: 'https://generativelanguage.googleapis.com',
      models: [],
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: true,
      proxyUrl: 'http://localhost:11434',
      models: [],
    },
    claude: {
      id: 'claude',
      name: 'Anthropic (Claude)',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: false,
      proxyUrl: 'https://api.anthropic.com',
      models: [],
    },
  },
  openAiKey: '',
  openAiBaseUrl: 'http://localhost:12380/v1',
  geminiKey: '',
  selectedModel: 'gemma-4-e2b-it-4bit',
  fontSize: 'Auto',
  appTheme: 'System',
  themeMode: 'Auto',
  displayMode: 'auto',
  themeId: 'system',
  language: 'English',
  sidepanelPosition: 'Right',
  chatGptWebappEnabled: true,
  translateService: 'gemma-4-e2b-it-4bit',
  translateTargetLang: 'English',
  translateDisplayMode: 'Bilingual',
  translateDisplayStyle: 'Underline',
};

function computeActiveSession(sessions: ChatSession[], activeSessionId: string): ChatSession | null {
  return sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
}

interface ExtensionState {
  config: ProviderConfig;
  sessions: ChatSession[];
  activeSessionId: string;
  prompts: PromptItem[];
  activeAttachments: Attachment[];
  availableTabs: TabItem[];
  activeSession: ChatSession | null;
  updateConfig: (updates: Partial<ProviderConfig>) => void;
  setActiveSessionId: (id: string) => void;
  createNewSession: () => string;
  addMessageToActiveSession: (msg: Message) => void;
  updateLastAssistantMessage: (contentChunk: string, thoughtChunk?: string, isDone?: boolean) => void;
  regenerateMessageInActiveSession: (msgId: string) => void;
  switchMessageVersion: (msgId: string, delta: number) => void;
  toggleStarSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, newTitle: string) => void;
  clearAllSessions: (includeStarred?: boolean) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  setActiveAttachments: (attachments: Attachment[]) => void;
  addPrompt: (prompt: PromptItem) => void;
  updatePrompt: (id: string, updates: Partial<PromptItem>) => void;
  deletePrompt: (id: string) => void;
  toggleTabSelection: (tabId: string) => void;
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    immer((set, get) => {
      const recomputeActive = (sessions: ChatSession[], activeSessionId: string) => {
        return computeActiveSession(sessions, activeSessionId);
      };

      return {
        config: DEFAULT_CONFIG,
        sessions: [],
        activeSessionId: '',
        prompts: INITIAL_PROMPTS,
        activeAttachments: [],
        availableTabs: [],
        activeSession: null,

        updateConfig: (updates) => {
          set((state) => {
            Object.assign(state.config, updates);
          });
          if (updates.themeMode) {
            const targetMode = updates.themeMode.toLowerCase() as ThemeMode;
            if (useThemeStore.getState().mode !== targetMode) {
              useThemeStore.getState().setMode(targetMode);
            }
          }
        },

        setActiveSessionId: (id) => {
          set((state) => {
            state.activeSessionId = id;
            state.activeSession = computeActiveSession(state.sessions, id);
          });
        },

        createNewSession: () => {
          const currentActive = get().activeSession;
          if (currentActive && currentActive.messages.length === 0) {
            return currentActive.id;
          }
          const newId = 's_' + Date.now();
          const newSession: ChatSession = {
            id: newId,
            title: 'New Chat',
            preview: 'Ask anything...',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isStarred: false,
            group: 'Today',
            messages: [],
          };
          set((state) => {
            state.sessions = state.sessions.filter(s => s.messages.length > 0);
            state.sessions.unshift(newSession);
            state.activeSessionId = newId;
            state.activeSession = newSession;
            state.activeAttachments = [];
          });
          return newId;
        },

        addMessageToActiveSession: (msg) => {
          set((state) => {
            let session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session) {
              const newId = 's_' + Date.now();
              session = {
                id: newId,
                title: 'New Chat',
                preview: 'Ask anything...',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isStarred: false,
                group: 'Today',
                messages: [],
              };
              state.sessions.unshift(session);
              state.activeSessionId = newId;
            }
            session.messages.push(msg);
            if (session.messages.length === 1) {
              session.title = msg.content.slice(0, 35) || 'New Chat';
            }
            session.preview = msg.content.slice(0, 50);
            session.updatedAt = Date.now();
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        updateLastAssistantMessage: (contentChunk, thoughtChunk, isDone) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session || session.messages.length === 0) return;
            const lastMsg = session.messages[session.messages.length - 1];
            if (lastMsg.role !== 'assistant') return;

            if (contentChunk) lastMsg.content += contentChunk;
            if (thoughtChunk) lastMsg.thoughtProcess = (lastMsg.thoughtProcess || '') + thoughtChunk;

            if (!lastMsg.versions || lastMsg.versions.length === 0) {
              lastMsg.versions = [lastMsg.content];
            }
            const curIdx = lastMsg.currentVersionIndex ?? (lastMsg.versions.length - 1);
            lastMsg.versions[curIdx] = lastMsg.content;
            lastMsg.currentVersionIndex = curIdx;
            lastMsg.isThinking = !isDone;
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        regenerateMessageInActiveSession: (msgId) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session) return;
            const msg = session.messages.find(m => m.id === msgId && m.role === 'assistant');
            if (!msg) return;

            const existingVersions = msg.versions && msg.versions.length > 0 ? [...msg.versions] : [msg.content];
            const vNum = existingVersions.length + 1;
            const newContent = `Here is alternative response variant ${vNum} with a fresh perspective, highlighted key takeaways, and concise action steps tailored to your active query and context.`;
            existingVersions.push(newContent);
            msg.versions = existingVersions;
            msg.currentVersionIndex = existingVersions.length - 1;
            msg.content = newContent;
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        switchMessageVersion: (msgId, delta) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session) return;
            const msg = session.messages.find(m => m.id === msgId);
            if (!msg || !msg.versions || msg.versions.length === 0) return;

            const currentIdx = msg.currentVersionIndex ?? (msg.versions.length - 1);
            const nextIdx = Math.max(0, Math.min(msg.versions.length - 1, currentIdx + delta));
            msg.currentVersionIndex = nextIdx;
            msg.content = msg.versions[nextIdx];
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        toggleStarSession: (id) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === id);
            if (session) session.isStarred = !session.isStarred;
          });
        },

        deleteSession: (id) => {
          set((state) => {
            const idx = state.sessions.findIndex(s => s.id === id);
            if (idx === -1) return;
            state.sessions.splice(idx, 1);
            if (state.activeSessionId === id && state.sessions.length > 0) {
              state.activeSessionId = state.sessions[0].id;
              state.activeSession = state.sessions[0];
            } else if (state.sessions.length === 0) {
              state.activeSessionId = '';
              state.activeSession = null;
            }
          });
        },

        updateSessionTitle: (id, newTitle) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === id);
            if (session) session.title = newTitle;
          });
        },

        clearAllSessions: (includeStarred = true) => {
          set((state) => {
            if (includeStarred) {
              const newId = 's_' + Date.now();
              const newSession: ChatSession = {
                id: newId,
                title: 'New Chat',
                preview: 'Ask anything...',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isStarred: false,
                group: 'Today',
                messages: [],
              };
              state.sessions = [newSession];
              state.activeSessionId = newId;
              state.activeSession = newSession;
            } else {
              const remaining = state.sessions.filter(s => s.isStarred);
              if (remaining.length === 0) {
                const newId = 's_' + Date.now();
                const newSession: ChatSession = {
                  id: newId,
                  title: 'New Chat',
                  preview: 'Ask anything...',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  isStarred: false,
                  group: 'Today',
                  messages: [],
                };
                state.sessions = [newSession];
                state.activeSessionId = newId;
                state.activeSession = newSession;
              } else {
                state.sessions = remaining;
                if (!remaining.some(s => s.id === state.activeSessionId)) {
                  state.activeSessionId = remaining[0].id;
                  state.activeSession = computeActiveSession(remaining, remaining[0].id);
                }
              }
            }
            state.activeAttachments = [];
          });
        },

        addAttachment: (attachment) => {
          set((state) => {
            const existing = state.activeAttachments.findIndex(a => a.id === attachment.id);
            if (existing !== -1) state.activeAttachments.splice(existing, 1);
            state.activeAttachments.push(attachment);
          });
        },

        removeAttachment: (id) => {
          set((state) => {
            const idx = state.activeAttachments.findIndex(a => a.id === id);
            if (idx !== -1) state.activeAttachments.splice(idx, 1);
          });
        },

        setActiveAttachments: (attachments) => {
          set((state) => {
            state.activeAttachments = attachments;
          });
        },

        addPrompt: (prompt) => {
          set((state) => {
            state.prompts.unshift(prompt);
          });
        },

        updatePrompt: (id, updates) => {
          set((state) => {
            const prompt = state.prompts.find(p => p.id === id);
            if (prompt) Object.assign(prompt, updates);
          });
        },

        deletePrompt: (id) => {
          set((state) => {
            const idx = state.prompts.findIndex(p => p.id === id);
            if (idx !== -1) state.prompts.splice(idx, 1);
          });
        },

        toggleTabSelection: (tabId) => {
          set((state) => {
            const tab = state.availableTabs.find(t => t.id === tabId);
            if (tab) tab.selected = !tab.selected;
          });
        },
      };
    }),
    {
      name: 'np_store',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => {
        const { activeSession, activeAttachments, availableTabs, ...rest } = state;
        return rest;
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<ExtensionState>) };
        merged.activeSession = computeActiveSession(merged.sessions, merged.activeSessionId);
        merged.activeAttachments = [];
        merged.availableTabs = [];
        return merged;
      },
    },
  ),
);

if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['np_store']) {
      useExtensionStore.persist.rehydrate();
    }
  });
}
