import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../core/theme/chromeStorageAdapter';
import { useThemeStore, type ThemeMode } from '../core/theme/ThemeStore';
import { DEFAULT_PROMPTS_LIST } from '../components/options/defaultPromptsData';
import {
  encryptProviderConfig,
  decryptProviderConfig,
  type EncryptedBlob,
  isEncryptedBlob,
} from '../core/storage/EncryptedStorage';
import { ensureInstallSecret, deriveKey, getExtensionId } from '../core/security/KeyVault';
import { debugLog } from '../core/log/debugLog';
import type {
  ChatSession,
  Message,
  ProviderConfig,
  PromptItem,
  Attachment,
  TabItem,
  WriteHistoryItem,
  NoteItem,
  CustomProviderId,
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
        // D-28 / Pitfall 10: the persisted np_store blob MUST NOT carry
        // plaintext secret fields. The in-memory `config` keeps plaintext
        // for Phase-1 consumers (A6); hydration re-populates the secrets
        // from the encrypted np_providers blob via
        // `hydrateProviderSecrets()` at surface boot.
        const { activeSession, activeAttachments, availableTabs, config, ...rest } = state;
        return {
          ...rest,
          config: stripProviderSecrets(config),
        };
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
 * Returns a ProviderConfig deep-clone with every secret-bearing field
 * emptied to ''. Used in two places:
 *   1. `partialize` — keeps plaintext out of the persisted np_store.
 *   2. The strip step inside `migrateProviderSecrets()` — clears legacy
 *      plaintext in-place after the encrypted np_providers blob has
 *      been committed first (Pattern 3, crash-safe ordering).
 */
export function stripProviderSecrets(config: ProviderConfig): ProviderConfig {
  const nextProviders = { ...config.providers };
  for (const id of Object.keys(nextProviders) as CustomProviderId[]) {
    const detail = nextProviders[id];
    if (detail && typeof detail.apiKey === 'string') {
      nextProviders[id] = { ...detail, apiKey: '' };
    }
  }
  return {
    ...config,
    providers: nextProviders,
    openAiKey: '',
    geminiKey: '',
  };
}

// --- Internal helpers ------------------------------------------------
// These live in this module because they are only used by the
// exportProviderSecrets migration/write/read paths. Production code MUST
// NOT touch these directly.

/** Force any pending chrome.storage writes to land synchronously. */
async function flushPendingWritesImmediate(): Promise<void> {
  // Use the import-bound flush to keep dependency direction clean
  // (chromeStorageAdapter -> adapters -> chrome.storage, no cycles).
  const { flushPendingWrites } = await import('../core/theme/chromeStorageAdapter');
  await flushPendingWrites();
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'));
}

async function decryptBlobWithKey(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const { decrypt } = await import('../core/storage/EncryptedStorage');
  return decrypt(blob, key);
}

/**
 * D-28 / Pattern 3: one-time migration from `np_store` (plaintext
 * secrets) to `np_providers` (encrypted).
 *
 * Order is crash-safe + idempotent (RESEARCH.md lines 339-345):
 *   1. Read np_store via chromeStorageAdapter.
 *   2. If np_providers already holds ciphertext AND np_store has no
 *      plaintext, skip the encrypt step (idempotent). Otherwise, walk
 *      the encrypt path so legacy plaintext is captured.
 *   3. ensureInstallSecret() — generate-or-read 32 random bytes.
 *   4. Derive one key (fresh 16-byte salt) for the migration snapshot.
 *   5. Write np_providers FIRST (encrypted ciphertext committed
 *      before any plaintext is removed).
 *   6. Strip plaintext from np_store and re-persist np_store SECOND.
 *
 * A process crash between steps 5 and 6 leaves np_providers committed
 * but np_store still carrying legacy plaintext; a re-run on the next
 * boot detects the legacy plaintext and completes the strip.
 */
export async function migrateProviderSecrets(): Promise<void> {
  let npStoreRaw: string | null;
  try {
    npStoreRaw = await chromeStorageAdapter.getItem('np_store');
  } catch (err: unknown) {
    debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    return;
  }

  interface ParsedNpStore {
    state?: { config?: ProviderConfig };
    version?: number;
  }
  let parsed: ParsedNpStore | null = null;
  if (npStoreRaw) {
    try {
      parsed = JSON.parse(npStoreRaw) as ParsedNpStore;
    } catch {
      parsed = null;
    }
  }

  const legacyConfig = parsed?.state?.config ?? null;
  const hasLegacyPlaintext = !!legacyConfig && (
    Object.values(legacyConfig.providers ?? {}).some(
      (p) => typeof (p as { apiKey?: unknown }).apiKey === 'string' && ((p as { apiKey: string }).apiKey.length > 0),
    ) ||
    (typeof legacyConfig.openAiKey === 'string' && legacyConfig.openAiKey.length > 0) ||
    (typeof legacyConfig.geminiKey === 'string' && legacyConfig.geminiKey.length > 0)
  );

  // Step 5: write np_providers FIRST if there is legacy plaintext.
  if (hasLegacyPlaintext && legacyConfig) {
    const installSecret = await ensureInstallSecret();
    const extensionId = getExtensionId();
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(installSecret, extensionId, saltBytes);
    const encrypted: ProviderConfig = await encryptProviderConfig(legacyConfig, key, saltBytes);
    try {
      await chromeStorageAdapter.setItem('np_providers', JSON.stringify(encrypted));
      await flushPendingWritesImmediate();
    } catch (err: unknown) {
      debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
      return;
    }
  }

  // Step 6: strip plaintext from np_store and re-persist (idempotent
  // — if no plaintext was present, this is a no-op persist of the
  // already-stripped blob).
  if (parsed && parsed.state && parsed.state.config) {
    const stripped = stripProviderSecrets(parsed.state.config);
    const nextBlob = { ...parsed, state: { ...parsed.state, config: stripped } };
    try {
      await chromeStorageAdapter.setItem('np_store', JSON.stringify(nextBlob));
      await flushPendingWritesImmediate();
    } catch (err: unknown) {
      debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    }
  }
}

/**
 * Encrypts the given config to `np_providers`. Throws on write failure
 * so the caller (e.g. OptionsPage save handler) can avoid claiming
 * false success (UI-SPEC E1 error row).
 *
 * Untouched ciphertext (EncryptedBlob passed straight through to the
 * in-memory config from a hydrate-and-save sequence) is preserved as
 * the same blob bytes so the post-save np_providers is byte-identical
 * to the pre-save blob. This is the A6/D-30 contract: a save with no
 * secret edit must not re-key the ciphertext.
 */
export async function persistProviderConfigEncrypted(config: ProviderConfig): Promise<void> {
  const installSecret = await ensureInstallSecret();
  const extensionId = getExtensionId();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(installSecret, extensionId, saltBytes);

  const { encrypt } = await import('../core/storage/EncryptedStorage');

  // providers.*.apiKey fields: re-encrypt plaintext, preserve Existing Blob.
  const nextProviders = { ...config.providers };
  for (const id of Object.keys(nextProviders) as CustomProviderId[]) {
    const detail = nextProviders[id];
    if (!detail) continue;
    if (isEncryptedBlob(detail.apiKey)) {
      // untouched ciphertext — preserve as-is
      continue;
    }
    if (typeof detail.apiKey === 'string' && detail.apiKey.length > 0) {
      nextProviders[id] = {
        ...detail,
        apiKey: await encrypt(detail.apiKey, key, saltBytes) as unknown as string,
      };
    }
  }

  let nextOpenAiKey: string | EncryptedBlob = config.openAiKey;
  if (isEncryptedBlob(config.openAiKey)) {
    nextOpenAiKey = config.openAiKey;
  } else if (typeof config.openAiKey === 'string' && config.openAiKey.length > 0) {
    nextOpenAiKey = await encrypt(config.openAiKey, key, saltBytes);
  }

  let nextGeminiKey: string | EncryptedBlob = config.geminiKey;
  if (isEncryptedBlob(config.geminiKey)) {
    nextGeminiKey = config.geminiKey;
  } else if (typeof config.geminiKey === 'string' && config.geminiKey.length > 0) {
    nextGeminiKey = await encrypt(config.geminiKey, key, saltBytes);
  }

  const next: ProviderConfig = {
    ...config,
    providers: nextProviders,
    openAiKey: nextOpenAiKey as string,
    geminiKey: nextGeminiKey as string,
  };

  try {
    await chromeStorageAdapter.setItem('np_providers', JSON.stringify(next));
    await flushPendingWritesImmediate();
  } catch (err: unknown) {
    debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Read path (RESEARCH Pattern 3 line 349): decrypt np_providers and
 * populate the in-memory config wherever the in-memory field is empty.
 *
 * Read-only — this function NEVER writes to chrome.storage. The
 * companion `persistProviderConfigEncrypted()` owns the write path.
 * A source-level regex assertion in `tests/core/security/secrets-
 * inspection.test.ts` enforces this read-only contract.
 */
export async function hydrateProviderSecrets(): Promise<void> {
  let raw: string | null;
  try {
    raw = await chromeStorageAdapter.getItem('np_providers');
  } catch (err: unknown) {
    debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    return;
  }
  if (!raw) return;

  let parsed: ProviderConfig;
  try {
    parsed = JSON.parse(raw) as ProviderConfig;
  } catch {
    return;
  }

  const installSecret = await ensureInstallSecret();
  const extensionId = getExtensionId();

  const state = useExtensionStore.getState();
  const current = state.config;
  const nextProviders = { ...current.providers };
  let nextOpenAiKey = current.openAiKey;
  let nextGeminiKey = current.geminiKey;
  let updates = 0;

  for (const id of Object.keys(nextProviders) as CustomProviderId[]) {
    const detail = nextProviders[id];
    if (!detail) continue;
    const stored = parsed.providers?.[id]?.apiKey;
    if (
      stored !== undefined &&
      isEncryptedBlob(stored) &&
      (typeof detail.apiKey !== 'string' || detail.apiKey.length === 0)
    ) {
      const saltBytes = base64ToBytes(stored.salt);
      const key = await deriveKey(installSecret, extensionId, saltBytes);
      try {
        const plain = await decryptBlobWithKey(stored, key);
        nextProviders[id] = { ...detail, apiKey: plain };
        updates++;
      } catch (err: unknown) {
        debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
      }
    }
  }

  const openAiRaw: unknown = parsed.openAiKey;
  if (
    openAiRaw !== undefined &&
    isEncryptedBlob(openAiRaw) &&
    nextOpenAiKey.length === 0
  ) {
    const saltBytes = base64ToBytes(openAiRaw.salt);
    const key = await deriveKey(installSecret, extensionId, saltBytes);
    try {
      nextOpenAiKey = await decryptBlobWithKey(openAiRaw, key);
      updates++;
    } catch (err: unknown) {
      debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  const geminiRaw: unknown = parsed.geminiKey;
  if (
    geminiRaw !== undefined &&
    isEncryptedBlob(geminiRaw) &&
    nextGeminiKey.length === 0
  ) {
    const saltBytes = base64ToBytes(geminiRaw.salt);
    const key = await deriveKey(installSecret, extensionId, saltBytes);
    try {
      nextGeminiKey = await decryptBlobWithKey(geminiRaw, key);
      updates++;
    } catch (err: unknown) {
      debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    }
  }

  if (updates > 0) {
    useExtensionStore.setState((s) => ({
      config: {
        ...s.config,
        providers: nextProviders,
        openAiKey: nextOpenAiKey,
        geminiKey: nextGeminiKey,
      },
    }));
  }
}

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
