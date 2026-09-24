import { z } from 'zod';
import { debugLog } from '../log/debugLog';
import {
  MIGRATION_STAGE_NAMES,
  createJournalEntry,
  runJournaled,
  type JournalEntryStore,
  type JournalStep,
  type WriteJournalEntry,
} from './WriteJournal';
import { getDb } from './NowPilotDB';
import {
  readConversation,
  writeConversationWithMessages,
  type ChatSessionRecord,
  type MessageRecord,
  type ReadConversationResult,
  type WriteConversationResult,
} from './ChatHistoryDB';
import { recordError, type RecordErrorInput } from './ErrorStore';

/**
 * legacyChatMigration — the one-way, journaled, idempotent, restart-safe move of
 * the prototype's chat bodies out of `chrome.storage.local` and into
 * ChatHistoryDB, followed by the source sanitisation (D2-07 … D2-17).
 *
 * **What this module is for.** The prototype persisted `sessions[].messages[]`
 * — message bodies — inside the zustand-persist blob at `np_store`, and derived
 * `sessions[].preview` from a body (`msg.content.slice(0, 50)`). D2-08's target
 * split gives conversations, bodies, ordering, timestamps, roles and approved
 * message metadata to ChatHistoryDB, keeps only approved lightweight metadata
 * in `np_store`, and puts the conversation index in `np_conversation_meta`.
 * This is the one migration that enacts that split.
 *
 * **Seven rules this module exists to keep:**
 *
 *   1. **Journaled stages, never a shared transaction.** The seven D2-09 stage
 *      names are `steps[].name` values on ONE journal entry keyed on the
 *      deterministic migration id; `status` stays inside the canonical union.
 *      No atomicity is claimed across `chrome.storage.local` and IndexedDB —
 *      consistency comes from deterministic stages, idempotency keys and an
 *      authoritative read-back (D2-09).
 *   2. **Verify before destroying.** The source is rewritten **only** after the
 *      destination read-back has been compared in memory — ids, count,
 *      ordering, approved metadata and body integrity, never logged (D2-10).
 *   3. **Allow-list sanitisation.** `projectNpStoreV3` rebuilds the source from
 *      the surviving field set, so a body, a nested message structure and the
 *      body-derived excerpt field are dropped **without their values ever being
 *      read** — a body cannot leak into the sanitised record, a report or a log
 *      (D2-11). No backup copy of a body is written to another key.
 *   4. **Forward-only and resumable.** Every step is an idempotent upsert over
 *      deterministic keys, so an interruption at any stage resumes without
 *      duplicate work; a failure leaves the entry non-terminal with its stages
 *      intact, never deletes the source body and never duplicates a destination
 *      record (D2-12/D2-14).
 *   5. **Quarantine, never discard.** An unsupported or malformed record is
 *      recorded by safe id only, is excluded from the destination write, and
 *      blocks sanitisation — because discarding unrecoverable data requires a
 *      separate operator checkpoint that Phase 2 does not take (D2-13).
 *   6. **Redacted by construction.** No body, body excerpt or body-derived value
 *      enters the journal, an error record, a log or the sanitised source
 *      (D2-11/D2-16). Only safe identifiers are recorded.
 *   7. **Total and throw-free.** `runLegacyChatMigration` returns a typed result
 *      union on every path, including an unavailable storage area.
 *
 * **Boundary recorded (OQ-5).** This module writes canonical `ConversationMeta`
 * records to `np_conversation_meta` with `status: 'active'`; the LRU caps
 * (10 active + 100 archived) and `evict-conversation` journaling stay Phase 8's
 * (§15.3 puts eviction in MemoryEngine), so the index is written but never
 * evicted here.
 */

/** The `chrome.storage.local` key the prototype persisted its blob under. */
export const LEGACY_CHAT_SOURCE_KEY = 'np_store';

/** §15.1's conversation-index key — deliberately NOT `np_store` (D2-08). */
export const CONVERSATION_META_STORAGE_KEY = 'np_conversation_meta';

/** The §20.2 idempotency key: one deterministic entry for the whole migration. */
export const MIGRATION_ENTRY_ID = 'migrate-legacy-conversations';

/** The additive §20.3 operation member (declared once in `WriteJournal`). */
export const MIGRATION_OPERATION = 'migrate-legacy-conversations';

/** The seven D2-09 stage names — declared once in `WriteJournal`, re-exported. */
export { MIGRATION_STAGE_NAMES };

/** The `np_store` schema version this migration writes (D2-11). */
export const NP_STORE_V3_SCHEMA_VERSION = 3;

/**
 * The surviving `np_store` top-level fields (D2-08). The conversation
 * collection, the active-conversation id and every body-derived field are
 * absent by construction — this list is the whole allow-list, and 02-08's
 * `npStoreMigrate` imports `projectNpStoreV3` rather than restating it.
 */
export const NP_STORE_V3_FIELDS = ['config', 'prompts', 'writeHistory', 'notes'] as const;

/** The §21.3 conversation index record (canonical shape). */
export interface ConversationMeta {
  id: string;
  title: string;
  status: 'active' | 'archived';
  topic?: string;
  created: number;
  lastAccessed: number;
  messageCount: number;
}

export type LegacyChatMigrationFailureCode =
  | 'LEGACY_CHAT_MIGRATION_FAILED'
  | 'LEGACY_CHAT_MIGRATION_SOURCE_UNAVAILABLE'
  | 'LEGACY_CHAT_MIGRATION_UNSUPPORTED_SOURCE'
  | 'LEGACY_CHAT_MIGRATION_UNSUPPORTED_SCHEMA_VERSION'
  | 'LEGACY_CHAT_MIGRATION_QUARANTINED_RECORDS'
  | 'LEGACY_CHAT_MIGRATION_DESTINATION_WRITE_FAILED'
  | 'LEGACY_CHAT_MIGRATION_DESTINATION_VERIFY_FAILED'
  | 'LEGACY_CHAT_MIGRATION_SOURCE_SANITISE_FAILED'
  | 'LEGACY_CHAT_MIGRATION_JOURNAL_FAILED';

export type LegacyChatMigrationResult =
  | { ok: true; conversations: number; sanitised: boolean }
  | { ok: false; code: LegacyChatMigrationFailureCode; stage: string };

/** The redacted ErrorStore code for a migration failure (§20.4). */
const ERROR_STORE_MIGRATION_CODE = 'IDB_MIGRATION_FAILED';

/** How many quarantined safe ids one failure record may carry. */
const MAX_QUARANTINED_IDS = 20;

/** The `np_store` schema versions this migration recognises as legacy input. */
const SUPPORTED_LEGACY_NP_STORE_VERSIONS = new Set([0, 1, 2]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The redacted reason string for a caught error. IndexedDB rejects with a
 * `DOMException`, which is not `instanceof Error` in every environment, so the
 * name is read structurally — never the message, which can carry a body.
 */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

/**
 * Pure, total, throw-free allow-list rebuild of the persisted `np_store` state
 * (D2-08/D2-11).
 *
 * Only `NP_STORE_V3_FIELDS` survive. A field outside the list — the conversation
 * collection, the active-conversation id, or anything a later prototype build
 * added — is dropped rather than carried forward, and its value is **never
 * read**, so a message body cannot reach the sanitised record. `null`,
 * `undefined`, an array and a primitive all return `{}`, so the rebuild is
 * total for a malformed blob.
 */
export function projectNpStoreV3(persisted: unknown): Record<string, unknown> {
  if (!isPlainObject(persisted)) return {};

  const projected: Record<string, unknown> = {};
  for (const field of NP_STORE_V3_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(persisted, field)) {
      projected[field] = persisted[field];
    }
  }
  return projected;
}

// ---------------------------------------------------------------------------
// The recognised legacy shapes (D2-10 step 1)
// ---------------------------------------------------------------------------

/** The zustand-persist envelope the prototype wrote: `{ state, version }`. */
const legacyEnvelopeSchema = z
  .object({
    state: z.record(z.string(), z.unknown()),
    version: z.number().int().nonnegative().optional(),
  })
  .passthrough();

/** A recognised legacy conversation. Unknown keys are ignored, never required. */
const legacySessionSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    isStarred: z.boolean().optional(),
    messages: z.array(z.unknown()),
  })
  .passthrough();

/** A recognised legacy message. `content` is a body — never logged. */
const legacyMessageSchema = z
  .object({
    id: z.string().min(1).optional(),
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    timestamp: z.number().nonnegative(),
  })
  .passthrough();

/** A record this migration refuses to guess at, identified by safe id only. */
export interface QuarantinedLegacyRecord {
  kind: 'conversation' | 'message';
  conversationId: string;
  seq?: number;
}

/** One validated conversation, ready for the destination write. */
interface DerivedConversation {
  session: ChatSessionRecord;
  messages: MessageRecord[];
  meta: ConversationMeta;
}

interface Discovery {
  present: boolean;
  serialised: boolean;
  version: number;
  state: Record<string, unknown>;
  alreadySanitised: boolean;
}

type DiscoveryResult =
  | { ok: true; value: Discovery }
  | { ok: false; code: LegacyChatMigrationFailureCode };

/** Parse the stored blob into the envelope this migration recognises. */
function parseLegacyEnvelope(raw: unknown): { ok: true; value: Discovery } | { ok: false } {
  const serialised = typeof raw === 'string';
  let parsed: unknown = raw;

  if (serialised) {
    try {
      parsed = JSON.parse(raw as string);
    } catch {
      return { ok: false };
    }
  }

  const envelope = legacyEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) return { ok: false };

  const version = envelope.data.version ?? 0;
  return {
    ok: true,
    value: {
      present: true,
      serialised,
      version,
      state: envelope.data.state,
      alreadySanitised: version === NP_STORE_V3_SCHEMA_VERSION,
    },
  };
}

/**
 * `discovered`: read the source, parse it, and decide whether this build
 * recognises it at all. An unrecognised blob is never partially rewritten
 * (D2-13) — the caller records a redacted failure and leaves the source alone.
 */
function discoverLegacySource(raw: unknown): DiscoveryResult {
  if (raw === undefined || raw === null) {
    return {
      ok: true,
      value: {
        present: false,
        serialised: false,
        version: 0,
        state: {},
        alreadySanitised: false,
      },
    };
  }

  const parsed = parseLegacyEnvelope(raw);
  if (!parsed.ok) {
    return { ok: false, code: 'LEGACY_CHAT_MIGRATION_UNSUPPORTED_SOURCE' };
  }

  const discovery = parsed.value;
  if (discovery.alreadySanitised) return { ok: true, value: discovery };
  if (!SUPPORTED_LEGACY_NP_STORE_VERSIONS.has(discovery.version)) {
    return { ok: false, code: 'LEGACY_CHAT_MIGRATION_UNSUPPORTED_SCHEMA_VERSION' };
  }

  const sessions = discovery.state.sessions;
  if (sessions !== undefined && sessions !== null && !Array.isArray(sessions)) {
    // A `sessions` field that is not a list is a shape this build does not
    // recognise; guessing at it would risk dropping recoverable data.
    return { ok: false, code: 'LEGACY_CHAT_MIGRATION_UNSUPPORTED_SOURCE' };
  }

  return { ok: true, value: discovery };
}

/** A safe id for a record that failed validation: never a body, never a title. */
function safeConversationId(candidate: unknown, index: number): string {
  if (isPlainObject(candidate)) {
    const id = candidate.id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return `mig:session:${index}`;
}

function integerOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/**
 * `validated`: validate every conversation and message against the recognised
 * legacy schema, deriving the canonical ids deterministically.
 *
 *   - conversation id: the legacy `session.id`, or `mig:session:<index>` when
 *     absent;
 *   - message sequence: the array index — never a string sort (D2-25);
 *   - message id: the legacy identifier, or `mig:<conversationId>:<seq>`.
 *
 * A malformed record is quarantined by safe id only and excluded from the write.
 * Quarantined records are what block sanitisation: a body that did not reach a
 * verified destination must not be deleted from the source (T-02-26).
 */
function validateLegacyState(state: Record<string, unknown>): {
  conversations: DerivedConversation[];
  quarantined: QuarantinedLegacyRecord[];
} {
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const conversations: DerivedConversation[] = [];
  const quarantined: QuarantinedLegacyRecord[] = [];

  sessions.forEach((candidate, index) => {
    const parsedSession = legacySessionSchema.safeParse(candidate);
    if (!parsedSession.success) {
      quarantined.push({ kind: 'conversation', conversationId: safeConversationId(candidate, index) });
      return;
    }

    const id = parsedSession.data.id ?? `mig:session:${index}`;
    const messages: MessageRecord[] = [];

    parsedSession.data.messages.forEach((rawMessage, seq) => {
      const parsedMessage = legacyMessageSchema.safeParse(rawMessage);
      if (!parsedMessage.success) {
        // The affected conversation and message identifier only — never body
        // content, never the rejected value (D2-13).
        quarantined.push({ kind: 'message', conversationId: id, seq });
        return;
      }
      messages.push({
        sessionId: id,
        seq,
        id: parsedMessage.data.id ?? `mig:${id}:${seq}`,
        role: parsedMessage.data.role,
        content: parsedMessage.data.content,
        timestamp: Math.floor(parsedMessage.data.timestamp),
      });
    });

    const firstTimestamp = messages[0]?.timestamp ?? 0;
    const lastTimestamp = messages[messages.length - 1]?.timestamp ?? firstTimestamp;
    const created = integerOr(parsedSession.data.createdAt, firstTimestamp);
    const updated = integerOr(parsedSession.data.updatedAt, Math.max(created, lastTimestamp));
    const title = typeof parsedSession.data.title === 'string' ? parsedSession.data.title : '';

    conversations.push({
      session: {
        id,
        title,
        created,
        updated,
        starred: parsedSession.data.isStarred === true,
      },
      messages,
      meta: {
        id,
        title,
        status: 'active',
        created,
        lastAccessed: updated,
        messageCount: messages.length,
      },
    });
  });

  return { conversations, quarantined };
}

/** Confirm the source was actually rewritten without bodies (D2-10 step 9). */
function isSanitisedSource(raw: unknown): boolean {
  const parsed = parseLegacyEnvelope(raw);
  if (!parsed.ok) return false;
  if (parsed.value.version !== NP_STORE_V3_SCHEMA_VERSION) return false;

  const keys = Object.keys(parsed.value.state);
  const allowed = NP_STORE_V3_FIELDS as readonly string[];
  if (!keys.every((key) => allowed.includes(key))) return false;
  // The explicit D2-08 prohibition, stated as its own check.
  return !keys.includes('sessions') && !keys.includes('activeSessionId');
}

/** In-memory comparison of the destination read-back (D2-10 step 7). */
function destinationMatches(
  expected: DerivedConversation,
  actualSession: ChatSessionRecord,
  actualMessages: readonly MessageRecord[],
): boolean {
  const { session, messages } = expected;

  if (
    actualSession.id !== session.id ||
    actualSession.title !== session.title ||
    actualSession.created !== session.created ||
    actualSession.updated !== session.updated ||
    actualSession.starred !== session.starred
  ) {
    return false;
  }

  if (actualMessages.length !== messages.length) return false;

  for (let index = 0; index < messages.length; index += 1) {
    const wanted = messages[index];
    const got = actualMessages[index];
    if (
      got.seq !== wanted.seq ||
      got.id !== wanted.id ||
      got.sessionId !== wanted.sessionId ||
      got.role !== wanted.role ||
      got.timestamp !== wanted.timestamp ||
      // Body integrity, compared in memory and never logged.
      got.content !== wanted.content
    ) {
      return false;
    }
  }

  return true;
}

/** A typed step failure carrying the redacted code and the stage that failed. */
class LegacyChatMigrationStepError extends Error {
  readonly code: LegacyChatMigrationFailureCode;
  readonly stage: string;

  constructor(code: LegacyChatMigrationFailureCode, stage: string, options?: { cause?: unknown }) {
    super(`${code}@${stage}`, options);
    this.name = 'LegacyChatMigrationStepError';
    this.code = code;
    this.stage = stage;
  }
}

// ---------------------------------------------------------------------------
// Injected dependencies
// ---------------------------------------------------------------------------

/** The destination contract this migration needs (structurally 02-02's module). */
export interface LegacyChatHistoryPort {
  writeConversationWithMessages(
    session: ChatSessionRecord,
    messages: readonly MessageRecord[],
  ): Promise<WriteConversationResult>;
  readConversation(sessionId: string): Promise<ReadConversationResult>;
}

export interface LegacyChatMigrationDeps {
  /** Read the raw `np_store` value (string or object); `undefined` when absent. */
  readSource?(): Promise<unknown>;
  /** Write the raw `np_store` value back, preserving the stored representation. */
  writeSource?(value: unknown): Promise<void>;
  /** The ChatHistoryDB write path and its read-back. */
  chatHistory?: LegacyChatHistoryPort;
  /** The journal store the migration entry is persisted in. */
  journal?: JournalEntryStore;
  /** Deterministic clock seam. */
  now?(): number;
  /** Persist the conversation index. Defaults to a merge into `chrome.storage.local`. */
  writeConversationIndex?(records: readonly ConversationMeta[]): Promise<void>;
  /** Record a redacted failure. Defaults to `ErrorStore.recordError`. */
  recordFailure?(input: RecordErrorInput): Promise<unknown>;
}

function hasExtensionStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
}

async function defaultReadSource(): Promise<unknown> {
  if (!hasExtensionStorage()) return undefined;
  const stored = (await chrome.storage.local.get(LEGACY_CHAT_SOURCE_KEY)) as
    | Record<string, unknown>
    | undefined;
  return stored?.[LEGACY_CHAT_SOURCE_KEY];
}

async function defaultWriteSource(value: unknown): Promise<void> {
  if (!hasExtensionStorage()) throw new Error('chrome.storage.local is unavailable');
  await chrome.storage.local.set({ [LEGACY_CHAT_SOURCE_KEY]: value });
}

/** Merge the migrated index entries into the stored conversation index by id. */
async function defaultWriteConversationIndex(
  records: readonly ConversationMeta[],
): Promise<void> {
  if (!hasExtensionStorage()) throw new Error('chrome.storage.local is unavailable');
  const stored = (await chrome.storage.local.get(CONVERSATION_META_STORAGE_KEY)) as
    | Record<string, unknown>
    | undefined;
  const existing = stored?.[CONVERSATION_META_STORAGE_KEY];
  const merged = new Map<string, ConversationMeta>();

  if (Array.isArray(existing)) {
    for (const entry of existing) {
      if (isPlainObject(entry) && typeof entry.id === 'string') {
        merged.set(entry.id, entry as unknown as ConversationMeta);
      }
    }
  }
  for (const record of records) merged.set(record.id, record);

  await chrome.storage.local.set({ [CONVERSATION_META_STORAGE_KEY]: [...merged.values()] });
}

/** The journal store backed by the `entries` object store of `np_db`. */
const defaultJournalStore: JournalEntryStore = {
  async load(id) {
    const db = await getDb();
    return db.get('entries', id);
  },
  async persist(entry) {
    const db = await getDb();
    await db.put('entries', entry);
  },
};

const defaultChatHistoryPort: LegacyChatHistoryPort = {
  writeConversationWithMessages,
  readConversation,
};

// ---------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------

interface RunState {
  discovery: Discovery | null;
  conversations: DerivedConversation[];
  quarantined: QuarantinedLegacyRecord[];
  sanitised: boolean;
}

/** Build the seven D2-09 steps over one run's state. */
function buildSteps(state: RunState, deps: Required<Pick<LegacyChatMigrationDeps, 'readSource' | 'writeSource' | 'chatHistory' | 'writeConversationIndex'>>, entry: WriteJournalEntry): JournalStep[] {
  // Forward-only: a migration step never deletes a destination record or a
  // source body. A partial destination is repaired by replaying idempotent
  // upserts over deterministic keys, never by rolling back (D2-12).
  const rollback = async (): Promise<void> => undefined;

  const requireDiscovery = (): Discovery => {
    if (!state.discovery) {
      throw new LegacyChatMigrationStepError('LEGACY_CHAT_MIGRATION_FAILED', 'discovered');
    }
    return state.discovery;
  };

  return [
    {
      name: 'discovered',
      rollback,
      async apply() {
        let raw: unknown;
        try {
          raw = await deps.readSource();
        } catch (error) {
          throw new LegacyChatMigrationStepError(
            'LEGACY_CHAT_MIGRATION_SOURCE_UNAVAILABLE',
            'discovered',
            { cause: error },
          );
        }

        const discovery = discoverLegacySource(raw);
        if (!discovery.ok) {
          throw new LegacyChatMigrationStepError(discovery.code, 'discovered');
        }

        state.discovery = discovery.value;
        if (discovery.value.present) {
          // Safe identifiers only — never a body, never a title (D2-09).
          entry.targetIds = {
            sourceKey: LEGACY_CHAT_SOURCE_KEY,
            schemaVersion: String(discovery.value.version),
            alreadySanitised: String(discovery.value.alreadySanitised),
          };
        }
      },
    },
    {
      name: 'validated',
      rollback,
      async apply() {
        const discovery = requireDiscovery();
        const validated = validateLegacyState(discovery.state);
        state.conversations = validated.conversations;
        state.quarantined = validated.quarantined;

        entry.targetIds = {
          ...entry.targetIds,
          conversationCount: String(validated.conversations.length),
          quarantinedCount: String(validated.quarantined.length),
          conversationIds: validated.conversations
            .map((conversation) => conversation.session.id)
            .join(','),
        };
      },
    },
    {
      // The stage marks the transition into the destination write. ChatHistoryDB
      // opens (and commits) one `readwrite` transaction per conversation inside
      // the next stage — the stage split records the intent, it does not claim a
      // transaction spanning every conversation (D2-09/D2-20).
      name: 'destination-write-started',
      rollback,
      async apply() {
        requireDiscovery();
      },
    },
    {
      name: 'destination-written',
      rollback,
      async apply() {
        const discovery = requireDiscovery();
        if (discovery.alreadySanitised) return;

        for (const conversation of state.conversations) {
          let result: WriteConversationResult;
          try {
            result = await deps.chatHistory.writeConversationWithMessages(
              conversation.session,
              conversation.messages,
            );
          } catch (error) {
            throw new LegacyChatMigrationStepError(
              'LEGACY_CHAT_MIGRATION_DESTINATION_WRITE_FAILED',
              'destination-written',
              { cause: error },
            );
          }

          if (!result.ok) {
            throw new LegacyChatMigrationStepError(
              'LEGACY_CHAT_MIGRATION_DESTINATION_WRITE_FAILED',
              'destination-written',
            );
          }
        }
      },
    },
    {
      name: 'destination-verified',
      rollback,
      async apply() {
        const discovery = requireDiscovery();
        // The source is at v3 only after a previous run verified the
        // destination and sanitised the source, so there is nothing new to
        // compare against — the destination stays authoritative (D2-12).
        if (discovery.alreadySanitised) return;

        for (const conversation of state.conversations) {
          let readBack: ReadConversationResult;
          try {
            readBack = await deps.chatHistory.readConversation(conversation.session.id);
          } catch (error) {
            throw new LegacyChatMigrationStepError(
              'LEGACY_CHAT_MIGRATION_DESTINATION_VERIFY_FAILED',
              'destination-verified',
              { cause: error },
            );
          }

          if (
            !readBack.ok ||
            !destinationMatches(conversation, readBack.session, readBack.messages)
          ) {
            // The comparison read the bodies in memory; nothing about them is
            // logged, and the failure carries the stage only.
            throw new LegacyChatMigrationStepError(
              'LEGACY_CHAT_MIGRATION_DESTINATION_VERIFY_FAILED',
              'destination-verified',
            );
          }
        }
      },
    },
    {
      name: 'source-sanitised',
      rollback,
      async apply() {
        const discovery = requireDiscovery();
        if (!discovery.present || discovery.alreadySanitised) return;

        if (state.quarantined.length > 0) {
          // Unrecoverable records remain in the source, so the source must not
          // be sanitised: discarding them needs a separate operator checkpoint
          // this phase does not take (D2-13/T-02-26).
          throw new LegacyChatMigrationStepError(
            'LEGACY_CHAT_MIGRATION_QUARANTINED_RECORDS',
            'source-sanitised',
          );
        }

        try {
          if (state.conversations.length > 0) {
            await deps.writeConversationIndex(
              state.conversations.map((conversation) => conversation.meta),
            );
          }

          const projected = {
            state: projectNpStoreV3(discovery.state),
            version: NP_STORE_V3_SCHEMA_VERSION,
          };
          await deps.writeSource(
            discovery.serialised ? JSON.stringify(projected) : projected,
          );
        } catch (error) {
          throw new LegacyChatMigrationStepError(
            'LEGACY_CHAT_MIGRATION_SOURCE_SANITISE_FAILED',
            'source-sanitised',
            { cause: error },
          );
        }

        // Read-back confirmation: the source is at v3 and carries no body field.
        let readBack: unknown;
        try {
          readBack = await deps.readSource();
        } catch (error) {
          throw new LegacyChatMigrationStepError(
            'LEGACY_CHAT_MIGRATION_SOURCE_SANITISE_FAILED',
            'source-sanitised',
            { cause: error },
          );
        }

        if (!isSanitisedSource(readBack)) {
          throw new LegacyChatMigrationStepError(
            'LEGACY_CHAT_MIGRATION_SOURCE_SANITISE_FAILED',
            'source-sanitised',
          );
        }

        state.sanitised = true;
      },
    },
    {
      // The terminal stage. `runJournaled` moves the entry to `completed` once
      // this step returns, so the stage and the status agree.
      name: 'completed',
      rollback,
      async apply() {
        requireDiscovery();
      },
    },
  ];
}

function toFailure(error: unknown): { code: LegacyChatMigrationFailureCode; stage: string } {
  if (error instanceof LegacyChatMigrationStepError) {
    return { code: error.code, stage: error.stage };
  }
  return { code: 'LEGACY_CHAT_MIGRATION_FAILED', stage: 'unknown' };
}

/**
 * Run (or resume) the one-time legacy chat migration.
 *
 * Never throws. A failure leaves the journal entry **non-terminal** with its
 * stages intact — `runJournaled`'s terminal `rolled-back` is deliberately
 * overridden, because the migration is forward-only and the next start must
 * resume from the stages that completed rather than restart or roll back
 * (D2-12/D2-14) — and records one redacted `IDB_MIGRATION_FAILED` in the
 * ErrorStore when a database connection is available.
 */
export async function runLegacyChatMigration(
  deps: LegacyChatMigrationDeps = {},
): Promise<LegacyChatMigrationResult> {
  const now = deps.now ?? Date.now;
  const readSource = deps.readSource ?? defaultReadSource;
  const writeSource = deps.writeSource ?? defaultWriteSource;
  const chatHistory = deps.chatHistory ?? defaultChatHistoryPort;
  const journal = deps.journal ?? defaultJournalStore;
  const writeConversationIndex = deps.writeConversationIndex ?? defaultWriteConversationIndex;
  const recordFailure = deps.recordFailure ?? recordError;

  try {
    const created = await createJournalEntry(
      {
        id: MIGRATION_ENTRY_ID,
        operation: MIGRATION_OPERATION,
        targetIds: { sourceKey: LEGACY_CHAT_SOURCE_KEY },
        stageNames: MIGRATION_STAGE_NAMES,
        now: now(),
      },
      journal,
    );
    if (!created.ok) {
      return { ok: false, code: 'LEGACY_CHAT_MIGRATION_JOURNAL_FAILED', stage: 'discovered' };
    }

    const entry = created.entry;
    if (entry.status === 'completed') {
      // Already migrated: zero work, no destructive change (D2-14).
      return { ok: true, conversations: 0, sanitised: true };
    }

    const state: RunState = {
      discovery: null,
      conversations: [],
      quarantined: [],
      sanitised: false,
    };
    const steps = buildSteps(state, { readSource, writeSource, chatHistory, writeConversationIndex }, entry);
    const persist = (candidate: WriteJournalEntry): Promise<void> => journal.persist(candidate);

    try {
      await runJournaled(entry, steps, persist, { now });
    } catch (error) {
      const failure = toFailure(error);

      // D2-12: the entry stays non-terminal and resumable. `runJournaled` has
      // already persisted its terminal `rolled-back`; this is the deliberate
      // override, and the failing stage stays visible for the next attempt.
      entry.status = 'applying';
      entry.updatedAt = now();
      try {
        await persist(entry);
      } catch (persistError) {
        debugLog('LEGACY_CHAT_MIGRATION_JOURNAL_FAILED', 'The journal entry could not be persisted after a failure', {
          stage: failure.stage,
          reason: errorName(persistError),
        });
      }

      try {
        await recordFailure({
          id: `legacy-chat-migration:${failure.stage}`,
          code: ERROR_STORE_MIGRATION_CODE,
          attempts: entry.attempts,
          context: {
            stage: failure.stage,
            code: failure.code,
            sourceKey: LEGACY_CHAT_SOURCE_KEY,
            quarantinedConversations: state.quarantined.filter(
              (record) => record.kind === 'conversation',
            ).length,
            quarantinedMessages: state.quarantined.filter((record) => record.kind === 'message')
              .length,
            quarantinedIds: state.quarantined
              .slice(0, MAX_QUARANTINED_IDS)
              .map((record) =>
                record.kind === 'message'
                  ? `${record.conversationId}:${record.seq ?? ''}`
                  : record.conversationId,
              ),
          },
        });
      } catch (recordErrorValue) {
        // A failure to record a failure is logged, never thrown: the source is
        // still intact and the journal still carries the resumable state.
        debugLog('LEGACY_CHAT_MIGRATION_JOURNAL_FAILED', 'The migration failure could not be recorded', {
          stage: failure.stage,
          reason: errorName(recordErrorValue),
        });
      }

      debugLog(failure.code, 'Legacy chat migration failed; the entry stays non-terminal', {
        stage: failure.stage,
        reason: errorName(error),
      });
      return { ok: false, code: failure.code, stage: failure.stage };
    }

    return { ok: true, conversations: state.conversations.length, sanitised: state.sanitised };
  } catch (error) {
    debugLog('LEGACY_CHAT_MIGRATION_FAILED', 'Legacy chat migration threw; returning a typed failure', {
      reason: errorName(error),
    });
    return { ok: false, code: 'LEGACY_CHAT_MIGRATION_FAILED', stage: 'unknown' };
  }
}
