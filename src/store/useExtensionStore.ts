import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../core/theme/chromeStorageAdapter';
import { debugLog } from '../core/log/debugLog';
import { DEFAULT_PROMPTS_LIST } from '../components/options/defaultPromptsData';
import {
  MIGRATION_OPERATION,
  NP_STORE_V3_FIELDS,
  projectNpStoreV3,
  runLegacyChatMigration,
  type LegacyChatMigrationResult,
} from '../core/storage/legacyChatMigration';
import { getDb } from '../core/storage/NowPilotDB';
import {
  readAllConversations,
  readConversation,
  type ChatSessionRecord,
  type MessageRecord,
  type ReadAllConversationsResult,
  type ReadConversationResult,
} from '../core/storage/ChatHistoryDB';
import { recoverJournal, type WriteJournalEntry } from '../core/storage/WriteJournal';
import type {
  ChatSession,
  Message,
  ProviderConfig,
  PromptItem,
  Attachment,
  TabItem,
  WriteHistoryItem,
  NoteItem,
  HistoryGroup,
} from '../types';

const INITIAL_PROMPTS: PromptItem[] = DEFAULT_PROMPTS_LIST;

// D-07 / D-08 / D-15 (plan `01-11`): the default configuration carries no
// credential field, no model identifier and no theme mode.
//   - Credentials belong to component memory only (the onboarding flow's
//     in-memory input type), and the recognised legacy plaintext names are
//     destroyed by the startup cleanup
//     (`src/core/storage/legacyCredentialCleanup.ts`, plan `01-10`).
//   - The model catalogue and every raw model selector are gone (DEC-HTML-01);
//     the surviving Workflow display is read-only and resolved per workflow.
//   - `np_theme` is the single theme source, so the store carries no theme mode.
// The provider map is keyed by the canonical `ProviderId` values.
const DEFAULT_CONFIG: ProviderConfig = {
  serviceProvider: 'Custom API Key',
  activeProvider: 'openai',
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: false,
      enabled: false,
      useCustomProxy: true,
      proxyUrl: 'http://localhost:12380/v1',
      models: [
        { id: 'Qwen3.5-9B-OptiQ-4bit', name: 'Qwen3.5-9B-OptiQ-4bit', enabled: false },
        { id: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', name: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', enabled: true },
        { id: 'gemma-4-e2b-it-4bit', name: 'gemma-4-e2b-it-4bit', enabled: false },
      ],
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic',
      isConfigured: false,
      enabled: false,
      useCustomProxy: false,
      proxyUrl: 'https://api.anthropic.com',
      models: [],
    },
    gemini: {
      id: 'gemini',
      name: 'Google (Gemini)',
      isConfigured: false,
      enabled: false,
      useCustomProxy: false,
      proxyUrl: 'https://generativelanguage.googleapis.com',
      models: [],
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama',
      isConfigured: false,
      enabled: false,
      useCustomProxy: true,
      proxyUrl: 'http://localhost:11434',
      models: [],
    },
  },
  openAiBaseUrl: 'http://localhost:12380/v1',
  fontSize: 'Auto',
  language: 'English',
  sidepanelPosition: 'Right',
  chatGptWebappEnabled: true,
  translateService: 'MiniCPM5-1B-OptiQ-4bit',
  translateTargetLang: 'English',
  translateDisplayMode: 'Bilingual',
  translateDisplayStyle: 'Underline',
  // D-12: explicit flag controlling whether a demo response is reachable.
  // The flag is gated by `import.meta.env.DEV` at the call sites — neither
  // flag alone is sufficient. Default: off (no demo).
  demoMode: false,
};

// D-11: fresh install starts empty — no demo seed data. The three constants
// below are kept (zero-length, typed) so any downstream code that imports
// them by name continues to compile.
//
// D2-08 / plan `02-08`: `INITIAL_SESSIONS` is also the runtime starting point
// for the conversation projection — after the cutover the in-memory sessions
// come from ChatHistoryDB through `hydrateChatHistory()`, never from the
// persisted blob (`npStoreMigrate` at v3 rebuilds from the non-chat allow-list
// and `merge` refuses the persisted conversation collection).
const INITIAL_SESSIONS: ChatSession[] = [];

const INITIAL_WRITE_HISTORY: WriteHistoryItem[] = [];

const INITIAL_NOTES: NoteItem[] = [];

function computeActiveSession(sessions: ChatSession[], activeSessionId: string): ChatSession | null {
  return sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
}

/** A list field is only a list: a number, a string or an object is not one. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** True when the value is a non-array object — the shape a record field needs. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A record field is only a record: an array or a primitive is not one. */
function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

// ---------------------------------------------------------------------------
// Hydration — the D2-17 read path and D2-18's frozen states (plan `02-08`)
// ---------------------------------------------------------------------------

/**
 * D2-18's frozen hydration states, verbatim. The surfaces render these through
 * the store contract and never touch IndexedDB, the journal or the legacy blob
 * (D2-20).
 *
 *   - `idle`               — nothing has been attempted yet.
 *   - `hydrating`          — the read path is running.
 *   - `ready`              — a successful read produced conversations.
 *   - `empty`              — a successful read produced none. Never any other
 *                            way: an error must not present as empty history.
 *   - `failed`             — a typed failure with no recoverable state.
 *   - `recovery required`  — a typed failure with resumable journal state left.
 */
export type HydrationStatus =
  | 'idle'
  | 'hydrating'
  | 'ready'
  | 'empty'
  | 'failed'
  | 'recovery required';

/** The typed, redacted failure state a surface renders (never a body, never a message). */
export interface HydrationError {
  code: string;
}

/**
 * The D2-17 read path's injectable seams, with production defaults below. Tests
 * inject them through this explicit adapter only (D2-20's fixtures clause); the
 * store itself never opens a store of its own and constructs no transaction.
 */
export interface ChatHydrationDeps {
  /** 1. Initialise the database. Defaults to `NowPilotDB.getDb()`. */
  ensureDatabase?(): Promise<unknown>;
  /** 2. Replay any resumable journal entry. Defaults to `WriteJournal.recoverJournal`. */
  recoverJournal?(): Promise<{ replayed: number; failed: number }>;
  /** 3. Run or resume the legacy migration. Defaults to `runLegacyChatMigration`. */
  runMigration?(): Promise<LegacyChatMigrationResult>;
  /** 4. Read the validated conversation list. Defaults to `readAllConversations`. */
  listConversations?(): Promise<ReadAllConversationsResult>;
  /** 5. Read one conversation and its messages. Defaults to `readConversation`. */
  readConversation?(sessionId: string): Promise<ReadConversationResult>;
}

/**
 * `recoverJournal`'s production call site (02-02's journal recovery, D2-17
 * step 2): the migration entry is the only known operation, and its replay is
 * `runLegacyChatMigration`, which resumes from the stages that completed. A
 * migration that still fails leaves the entry non-terminal and resumable.
 */
async function defaultRecoverJournal(): Promise<{ replayed: number; failed: number }> {
  return recoverJournal(
    async (): Promise<WriteJournalEntry[]> => {
      const db = await getDb();
      return db.getAll('entries');
    },
    async (entry) => {
      if (entry.operation !== MIGRATION_OPERATION) return;
      const result = await runLegacyChatMigration();
      if (!result.ok) throw new Error(result.code);
    },
  );
}

const DEFAULT_HYDRATION_DEPS: Required<ChatHydrationDeps> = {
  ensureDatabase: () => getDb(),
  recoverJournal: defaultRecoverJournal,
  runMigration: () => runLegacyChatMigration(),
  listConversations: () => readAllConversations(),
  readConversation: (sessionId) => readConversation(sessionId),
};

/**
 * The redacted code for a caught error: the typed `code` property only, never
 * the message, which can carry a value.
 */
function errorCode(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return fallback;
}

/** The prototype's history buckets, derived from the record's integer `updated`. */
function historyGroup(updatedAt: number, now = Date.now()): HistoryGroup {
  const day = 86_400_000;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (updatedAt >= startOfToday) return 'Today';
  if (updatedAt >= startOfToday - day) return 'Yesterday';
  if (updatedAt >= startOfToday - 7 * day) return 'This Week';
  if (updatedAt >= startOfToday - 30 * day) return 'This Month';
  return 'Older';
}

/**
 * Project a database record pair into the component-facing conversation shape.
 * `preview` is a body excerpt (D2-08) and is deliberately never derived — the
 * canonical home for conversation metadata is `np_conversation_meta` (§15.1),
 * which carries `title`, not a preview.
 */
function toChatSession(
  session: ChatSessionRecord,
  messages: readonly MessageRecord[],
): ChatSession {
  return {
    id: session.id,
    title: session.title,
    preview: '',
    createdAt: session.created,
    updatedAt: session.updated,
    isStarred: session.starred,
    group: historyGroup(session.updated),
    messages: messages.map((message): Message => ({
      id: message.id,
      // `MessageRecord` also models a 'tool' role; the component-facing
      // `Message` union does not, so a tool record projects as the neutral role.
      role: message.role === 'tool' ? 'system' : message.role,
      content: message.content,
      timestamp: message.timestamp,
    })),
  };
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
  hydrationStatus: HydrationStatus;
  hydrationError: HydrationError | null;
  /**
   * Run (or resume) the D2-17 read path. Production callers pass no arguments;
   * tests inject the seams through the explicit adapter (D2-20).
   */
  hydrateChatHistory: (deps?: ChatHydrationDeps) => Promise<HydrationStatus>;
  /** Re-drive a failed hydration without discarding recoverable journal state. */
  retryHydration: () => Promise<HydrationStatus>;
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

/** The current `np_store` persist schema version (D-22): v3 is the body-free schema (D2-08). */
export const NP_STORE_SCHEMA_VERSION = 3;

/** The in-flight hydration for this document (see `requestHydration`). */
let hydrationInFlight: Promise<HydrationStatus> | null = null;

export const useExtensionStore = create<ExtensionState>()(
  persist(
    immer((set, get) => {
      const recomputeActive = (sessions: ChatSession[], activeSessionId: string) => {
        return computeActiveSession(sessions, activeSessionId);
      };

      /**
       * One hydration per document: a double-invoked mount effect (React's
       * development double-effect) joins the in-flight run instead of starting
       * a second read path.
       */
      const requestHydration = (deps?: ChatHydrationDeps): Promise<HydrationStatus> => {
        if (!hydrationInFlight) {
          hydrationInFlight = runHydration(deps).finally(() => {
            hydrationInFlight = null;
          });
        }
        return hydrationInFlight;
      };

      /**
       * The D2-17 read path, in order: publish `hydrating`; initialise the
       * database; recover the journal; run or resume the legacy migration; read
       * conversations and messages; apply the projection; then publish the
       * status. Total and throw-free: every failure resolves a typed redacted
       * code, and `empty` is published only by a successful read that found
       * nothing.
       */
      const runHydration = async (deps: ChatHydrationDeps = {}): Promise<HydrationStatus> => {
        const port = { ...DEFAULT_HYDRATION_DEPS, ...deps };

        const publish = (status: HydrationStatus, code: string | null): HydrationStatus => {
          set((state) => {
            state.hydrationStatus = status;
            state.hydrationError = code === null ? null : { code };
          });
          return status;
        };

        set((state) => {
          state.hydrationStatus = 'hydrating';
          state.hydrationError = null;
        });

        try {
          // 1. Initialise the database. A database that cannot open is a typed
          //    failure — never `empty`, and never a fallback to the legacy
          //    source (D2-17 step 7).
          try {
            await port.ensureDatabase();
          } catch (error) {
            debugLog('IDB_OPEN_FAILED', 'The chat database could not be opened; hydration failed', {
              reason: errorCode(error, 'unknown'),
            });
            return publish('failed', errorCode(error, 'IDB_OPEN_FAILED'));
          }

          // 2. Replay resumable journal state. Entries that still fail replay
          //    leave recoverable state behind (D2-12/D2-14).
          let recoverable = false;
          try {
            const recovery = await port.recoverJournal();
            recoverable = recovery.failed > 0;
          } catch (error) {
            debugLog('WRITE_JOURNAL_RECOVERY_FAILED', 'Journal recovery failed; hydration continues', {
              reason: errorCode(error, 'unknown'),
            });
            // Unreadable journal state may still be recoverable, so it is not
            // reported as an unrecoverable failure.
            recoverable = true;
          }

          // 3. Run or resume the legacy migration. Its failure path always
          //    leaves the entry non-terminal and resumable.
          const migration = await port.runMigration();
          if (!migration.ok) recoverable = true;

          // 4. Read the conversation list at the database boundary. A database
          //    error is never a smaller conversation history.
          const list = await port.listConversations();
          if (!list.ok) {
            return publish(recoverable ? 'recovery required' : 'failed', list.code);
          }

          // 5. Read every conversation and message. One malformed record is
          //    reported by safe id only and never logged with body text, and
          //    the remaining conversations still hydrate (D2-13/D2-20).
          const sessions: ChatSession[] = [];
          let invalid = 0;

          for (const record of list.sessions) {
            const read = await port.readConversation(record.id);
            if (!read.ok) {
              if (read.code === 'CHAT_HISTORY_NOT_FOUND') continue;
              if (read.code !== 'CHAT_HISTORY_INVALID_RECORD') {
                return publish(recoverable ? 'recovery required' : 'failed', read.code);
              }
              invalid += 1;
              debugLog('CHAT_HISTORY_INVALID_RECORD', 'A malformed conversation was excluded from hydration', {
                conversationId: record.id,
              });
              continue;
            }
            sessions.push(toChatSession(read.session, read.messages));
          }

          for (const invalidId of list.invalidIds) {
            invalid += 1;
            debugLog('CHAT_HISTORY_INVALID_RECORD', 'A malformed conversation was excluded from hydration', {
              conversationId: invalidId,
            });
          }

          // 6. Apply the hydrated projection to the in-memory session
          //    collection — the store stays the rendering projection only.
          set((state) => {
            state.sessions = sessions;
            state.activeSessionId = sessions[0]?.id ?? '';
            state.activeSession = sessions[0] ?? null;
          });

          // 7. Publish the status.
          if (!migration.ok) {
            return publish(recoverable ? 'recovery required' : 'failed', migration.code);
          }
          if (invalid > 0) {
            return publish(recoverable ? 'recovery required' : 'failed', 'CHAT_HISTORY_INVALID_RECORD');
          }
          return publish(sessions.length > 0 ? 'ready' : 'empty', null);
        } catch (error) {
          // A seam that throws is a typed failure, never an unhandled rejection.
          debugLog('CHAT_HYDRATION_FAILED', 'Chat hydration threw; resolving a typed failure', {
            reason: errorCode(error, 'unknown'),
          });
          return publish('failed', errorCode(error, 'CHAT_HYDRATION_FAILED'));
        }
      };

      return {
        config: DEFAULT_CONFIG,
        sessions: INITIAL_SESSIONS,
        // D-11: empty active id — `computeActiveSession(sessions, '')` returns
        // `null` on the freshly-emptied `INITIAL_SESSIONS` (the existing
        // function in this file already handles this gracefully: `find` misses
        // and `sessions[0]` is `undefined`, which OR-folds to `null`). A mount
        // effect that calls `createNewSession()` when `activeSession` is falsy
        // is the path that produces a user's first real session.
        activeSessionId: '',
        prompts: INITIAL_PROMPTS,
        writeHistory: INITIAL_WRITE_HISTORY,
        notes: INITIAL_NOTES,
        activeAttachments: [],
        availableTabs: [],
        activeSession: null,
        hydrationStatus: 'idle',
        hydrationError: null,

        hydrateChatHistory: (deps) => requestHydration(deps),
        retryHydration: () => requestHydration(),

        // D-15 (plan `01-11`): the legacy theme bridge and its field are gone.
        // ThemeStore is the single source of truth for the active theme; this
        // store neither reads nor writes one.
        updateConfig: (updates) => {
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
        // APPR-03 / D-15 (plan `01-11`): `np_theme` is the single theme source
        // and the config carries no theme mode, no credential field and no
        // model identifier.
        // D2-08 / plan `02-08`: the persisted projection is the v3 allow-list
        // (`NP_STORE_V3_FIELDS`), so the conversation collection, the
        // active-conversation id, the body-derived `preview`, the transient UI
        // fields and the hydration status are all absent by construction — a
        // hydrated conversation can never be written back to `chrome.storage`.
        return projectNpStoreV3(state);
      },
      // D-22 / plan `01-11`, v3 / plan `02-08`: schema versioning. v2 was the
      // credential-free schema; v3 is the body-free schema (D2-08). The
      // migration rebuilds an older blob from the canonical field set so a
      // removed field cannot be carried forward.
      // NOTE: this zustand-persist `version` counter is SEPARATE from the
      // IndexedDB `DB_VERSION` (§20.4), which reaches v4 by Phase 9 — do not
      // conflate the two counters when numbering later migrations (A5).
      version: NP_STORE_SCHEMA_VERSION,
      migrate: npStoreMigrate,
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<ExtensionState>) };
        // WR-02: normalise every collection/identifier the merge and the UI
        // trust. `migrate` runs only when the stored version differs from the
        // configured one, so a corrupt blob at the *current* version reaches
        // this point with, e.g., a number where a list belongs —
        // `computeActiveSession` then threw inside `hydrate()`, where zustand
        // swallows it: the store stayed at the module defaults and `partialize`
        // overwrote the (partly recoverable) blob with them.
        // D2-17 step 7 / D2-08: the persisted blob is never a source of
        // conversations. The v3 projection cannot carry them, and a stale or
        // corrupt value must not become the runtime projection — ChatHistoryDB
        // is authoritative and `hydrateChatHistory()` is the only writer of
        // `sessions`. The in-memory collection is preserved as-is.
        merged.sessions = asArray<ChatSession>(current.sessions);
        merged.activeSessionId =
          typeof current.activeSessionId === 'string' ? current.activeSessionId : '';
        merged.prompts = asArray<PromptItem>(merged.prompts);
        merged.writeHistory = asArray<WriteHistoryItem>(merged.writeHistory);
        merged.notes = asArray<NoteItem>(merged.notes);
        // The hydration status is runtime state: a blob can never publish it.
        merged.hydrationStatus = current.hydrationStatus;
        merged.hydrationError = current.hydrationError;
        // Merge the persisted config over the in-memory defaults so a field
        // the projection omits can never leave a typed field undefined.
        merged.config = { ...current.config, ...asRecord(merged.config) };
        if (!isRecord(merged.config.providers)) {
          // A provider map that is not a map is replaced by the default
          // catalogue (not by an empty one), so the Options grid and the model
          // lookups keep the record shape they are typed for.
          merged.config.providers = current.config.providers;
        }
        merged.activeSession = computeActiveSession(merged.sessions, merged.activeSessionId);
        merged.activeAttachments = [];
        merged.availableTabs = [];
        return merged;
      },
      // WR-02: a future shape regression must be visible. Without this, a merge
      // failure is swallowed by `hydrate()` and the store silently stays at the
      // module defaults — and `partialize` then overwrites the blob with them.
      onRehydrateStorage: () => (_state, error) => {
        if (error) debugLog('NP_STORE_REHYDRATE_FAILED', String(error));
      },
    },
  ),
);

/** The `np_store` blob's surviving top-level fields (D2-08): the non-chat
 * metadata set. The list itself is owned by `legacyChatMigration`'s
 * `NP_STORE_V3_FIELDS` and imported here rather than restated, so the source
 * projection and the store projection cannot drift. The conversation
 * collection, the active-conversation id and every body-derived field are
 * absent — a field outside this list is dropped rather than carried forward. */
export const PERSISTED_BLOB_FIELDS = NP_STORE_V3_FIELDS;

/** The surviving non-secret provider-configuration fields. */
const PERSISTED_CONFIG_FIELDS = [
  'serviceProvider',
  'activeProvider',
  'providers',
  'openAiBaseUrl',
  'fontSize',
  'colorTheme',
  'language',
  'sidepanelPosition',
  'chatGptWebappEnabled',
  'demoMode',
  'translateService',
  'translateTargetLang',
  'translateDisplayMode',
  'translateDisplayStyle',
] as const;

/** The surviving non-secret per-provider fields. */
const PERSISTED_PROVIDER_FIELDS = [
  'id',
  'name',
  'isConfigured',
  'enabled',
  'useCustomProxy',
  'proxyUrl',
  'models',
] as const;

/** The surviving per-model fields. */
const PERSISTED_MODEL_FIELDS = ['id', 'name', 'enabled', 'isCustom'] as const;

function pickFields(record: unknown, fields: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  if (!record || typeof record !== 'object' || Array.isArray(record)) return picked;
  const source = record as Record<string, unknown>;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field];
    }
  }
  return picked;
}

/**
 * Pure, throw-free, total migration for `useExtensionStore`'s persist config
 * (D-22 / plan `01-11`, v3 / plan `02-08`).
 *
 * The blob is rebuilt **from an allow-list** rather than filtered by a
 * deny-list, and the top-level list is delegated to `projectNpStoreV3` — the
 * single owner of the surviving `np_store` field set (D2-08) — so the source
 * projection and this one cannot drift. Only the canonical non-secret,
 * non-chat field set survives: a field this schema no longer models — a
 * prototype credential field, a model identifier, a theme mode, the
 * conversation collection, the active-conversation id or a body-derived
 * excerpt — is dropped from an existing blob instead of being carried forward,
 * and its value is never read.
 *
 * The rebuild is idempotent and total: `null`, `undefined`, an array, a string
 * or a number returns `{}`, so zustand's `merge()` always receives an object
 * and a malformed blob can never throw during hydration.
 *
 * A5 separation: this zustand-persist version counter is distinct from the
 * IndexedDB `DB_VERSION` (§20.4). IndexedDB migrations live in a separate
 * adapter path (`src/core/storage/`) and are NOT wired through here.
 */
export function npStoreMigrate(persisted: unknown, version: number): unknown {
  void version; // The rebuild is version-independent: it is total and idempotent.
  if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) {
    return {};
  }

  const blob = projectNpStoreV3(persisted);
  const config = pickFields(blob.config, PERSISTED_CONFIG_FIELDS);

  if (config.providers && typeof config.providers === 'object' && !Array.isArray(config.providers)) {
    const providers: Record<string, unknown> = {};
    for (const [providerKey, detail] of Object.entries(
      config.providers as Record<string, unknown>,
    )) {
      const provider = pickFields(detail, PERSISTED_PROVIDER_FIELDS);
      if (Array.isArray(provider.models)) {
        provider.models = (provider.models as unknown[]).map((model) =>
          pickFields(model, PERSISTED_MODEL_FIELDS),
        );
      }
      providers[providerKey] = provider;
    }
    config.providers = providers;
  }

  blob.config = config;
  return blob;
}
