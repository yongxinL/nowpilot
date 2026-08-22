import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../core/theme/chromeStorageAdapter';
import { useThemeStore, type ThemeMode } from '../core/theme/ThemeStore';
import { DEFAULT_PROMPTS_LIST } from '../components/options/defaultPromptsData';
import type {
  ChatSession,
  Message,
  ProviderConfig,
  PromptItem,
  Attachment,
  TabItem,
  WriteHistoryItem,
  NoteItem,
} from '../types';

const INITIAL_PROMPTS: PromptItem[] = DEFAULT_PROMPTS_LIST;

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
      useCustomProxy: true,
      proxyUrl: 'http://localhost:12380/v1',
      models: [
        { id: 'Qwen3.5-9B-OptiQ-4bit', name: 'Qwen3.5-9B-OptiQ-4bit', enabled: false },
        { id: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', name: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', enabled: true },
        { id: 'gemma-4-e2b-it-4bit', name: 'gemma-4-e2b-it-4bit', enabled: false },
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
  selectedModel: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx',
  fontSize: 'Auto',
  themeMode: 'Auto',
  language: 'English',
  sidepanelPosition: 'Right',
  chatGptWebappEnabled: true,
  translateService: 'MiniCPM5-1B-OptiQ-4bit',
  translateTargetLang: 'English',
  translateDisplayMode: 'Bilingual',
  translateDisplayStyle: 'Underline',
  // D-12: explicit flag controlling whether `simulateStreamResponse` (the
  // canned critical-thinking / "Good morning" response) is reachable.
  // DEMO_MODE is gated by `import.meta.env.DEV` at the simulator call sites —
  // neither flag alone is sufficient. Default: off (no demo).
  demoMode: false,
};

// D-11: fresh install starts empty — no demo seed data. The three constants
// below are kept (zero-length, typed) so any downstream code that imports
// them by name continues to compile; a legacy `np_store` blob from the
// pre-01-04 scaffold hydrates through `npStoreMigrate()` (Plan 01-01's
// no-op migrate) and is NOT clobbered.
const INITIAL_SESSIONS: ChatSession[] = [];

const INITIAL_WRITE_HISTORY: WriteHistoryItem[] = [];

const INITIAL_NOTES: NoteItem[] = [];

function computeActiveSession(sessions: ChatSession[], activeSessionId: string): ChatSession | null {
  return sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
}

interface ExtensionState {
  config: ProviderConfig;
  sessions: ChatSession[];
  activeSessionId: string;
  prompts: PromptItem[];
  writeHistory: WriteHistoryItem[];
  notes: NoteItem[];
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
  addWriteHistoryItem: (item: WriteHistoryItem) => void;
  updateWriteHistoryItem: (id: string, updates: Partial<WriteHistoryItem>) => void;
  deleteWriteHistoryItem: (id: string) => void;
  clearWriteHistory: () => void;
  addNote: (note: NoteItem) => void;
  updateNote: (id: string, updates: Partial<NoteItem>) => void;
  deleteNote: (id: string) => void;
  toggleFavoriteNote: (id: string) => void;
  saveTextAsNote: (text: string, titleHint?: string) => NoteItem;
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    immer((set, get) => {
      const recomputeActive = (sessions: ChatSession[], activeSessionId: string) => {
        return computeActiveSession(sessions, activeSessionId);
      };

      return {
        config: DEFAULT_CONFIG,
        sessions: INITIAL_SESSIONS,
        // D-11: empty active id — `computeActiveSession(sessions, '')` returns
        // `null` on the freshly-emptied `INITIAL_SESSIONS` (the existing
        // function in this file already handles this gracefully: `find` misses
        // and `sessions[0]` is `undefined`, which OR-folds to `null`). The
        // SidepanelChat mount-time `useEffect(() => createNewSession(), [])`
        // (when `activeSession` is falsy) is the path that produces the
        // user's first real session.
        activeSessionId: '',
        prompts: INITIAL_PROMPTS,
        writeHistory: INITIAL_WRITE_HISTORY,
        notes: INITIAL_NOTES,
        activeAttachments: [],
        availableTabs: [],
        activeSession: null,

        updateConfig: (updates) => {
          // D-10: duplicate theme-state bridge deleted. ThemeStore is the
          // single source of truth for the active theme; `config.themeMode`
          // is now a read-only field, no longer drives `useThemeStore.setMode`.
          set((state) => {
            Object.assign(state.config, updates);
          });
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

        addWriteHistoryItem: (item) => {
          set((state) => {
            if (!state.writeHistory) state.writeHistory = [];
            state.writeHistory.unshift(item);
          });
        },

        updateWriteHistoryItem: (id, updates) => {
          set((state) => {
            if (!state.writeHistory) return;
            const item = state.writeHistory.find(h => h.id === id);
            if (item) Object.assign(item, updates);
          });
        },

        deleteWriteHistoryItem: (id) => {
          set((state) => {
            if (!state.writeHistory) return;
            const idx = state.writeHistory.findIndex(h => h.id === id);
            if (idx !== -1) state.writeHistory.splice(idx, 1);
          });
        },

        clearWriteHistory: () => {
          set((state) => {
            state.writeHistory = [];
          });
        },

        addNote: (note) => {
          set((state) => {
            if (!state.notes) state.notes = [];
            state.notes.unshift(note);
          });
        },

        updateNote: (id, updates) => {
          set((state) => {
            if (!state.notes) return;
            const note = state.notes.find((n) => n.id === id);
            if (note) Object.assign(note, updates);
          });
        },

        deleteNote: (id) => {
          set((state) => {
            if (!state.notes) return;
            const idx = state.notes.findIndex((n) => n.id === id);
            if (idx !== -1) state.notes.splice(idx, 1);
          });
        },

        toggleFavoriteNote: (id) => {
          set((state) => {
            if (!state.notes) return;
            const note = state.notes.find((n) => n.id === id);
            if (note) note.isFavorite = !note.isFavorite;
          });
        },

        saveTextAsNote: (text, titleHint) => {
          const cleanText = text.trim();
          let title = titleHint?.trim() || '';
          if (!title) {
            const firstLine = cleanText.split('\n')[0].replace(/^[#*\-•\s]+/, '').trim();
            title = firstLine.length > 0 ? (firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine) : 'AI Note';
          }
          const excerpt = cleanText.slice(0, 140).replace(/\n+/g, ' ') + (cleanText.length > 140 ? '...' : '');
          const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
          const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          const newNote: NoteItem = {
            id: 'n_' + Date.now(),
            title,
            excerpt,
            category: 'AI Insights',
            folderPath: 'My Notes / AI Insights',
            tags: ['AI', 'Generated'],
            updatedAt: 'Just now',
            createdAt: dateStr,
            isFavorite: false,
            content: {
              summary: excerpt,
              sections: [
                {
                  title: '1. Overview & Content',
                  text: cleanText,
                },
              ],
            },
            wordCount,
            readTime,
            linkCount: 0,
            backlinkCount: 0,
          };

          set((state) => {
            if (!state.notes) state.notes = [];
            state.notes.unshift(newNote);
          });

          return newNote;
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
      // D-22: schema versioning. v1 IS the current schema — a no-op migrate.
      // NOTE: this zustand-persist `version` counter is SEPARATE from the
      // IndexedDB `DB_VERSION` (§20.4), which reaches v4 by Phase 9 — do not
      // conflate the two counters when numbering later migrations (A5).
      version: 1,
      migrate: npStoreMigrate,
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

/**
 * Pure, throw-free migration for useExtensionStore's persist config (D-22).
 * v1 IS the current schema; a v1 (or unversioned) blob is returned unchanged
 * so existing user data hydrates without disruption.
 *
 * A5 separation: this zustand-persist version counter is distinct from the
 * IndexedDB `DB_VERSION` (§20.4). IndexedDB migrations will live in a
 * separate adapter path and must NOT be wired through here.
 */
export function npStoreMigrate(persisted: unknown, version: number): unknown {
  if (persisted && typeof persisted === 'object') {
    return persisted;
  }
  // Unparseable / non-object blob — return {} so zustand's merge() handles
  // the empty shape against current state without throwing.
  return {};
}
