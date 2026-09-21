import { z } from 'zod';

/**
 * The canonical §8.4 / §21.5 `WorkspaceState` contract, frozen in Phase 1
 * (D-11) and validated by a strict Zod schema at every boundary.
 *
 * ## Versioning — three separate axes (H-4 / OQ3)
 *
 * - `schemaVersion` describes the **shape**. It is stamped by this module and
 *   by `migrateWorkspaceState`; a persisted object carrying another value is
 *   migrated, never trusted.
 * - `version` is the **monotonic write counter**. Phase 2's writer election
 *   needs a per-write number that only ever increases, so Phase 1 increments
 *   it on every authorised mutation.
 * - `updatedAt` carries **staleness** for a reader deciding whether a surface's
 *   copy is still current. The migration does not read the clock, so a
 *   migration is deterministic.
 *
 * ## Phase-1 authorisation (D-11)
 *
 * Only `schemaVersion`, `workspaceId`, `conversationId`, `activeSurface` and
 * `openedStandaloneTabId` have a Phase-1 producer. `activeProvider` and
 * `selectedModel` are resolved runtime metadata — no Phase-1 UI control writes
 * them, and a raw model selector must not be reintroduced (DEC-HTML-01). The
 * remaining fields are typed and inert: `pinnedTabs` / `selectedNotes` default
 * to an immutable empty collection, and the contextual objects
 * (`currentPageContext`, `activeAddonContext`, `activeSkillRun`) are `null`.
 * No placeholder secret, page body, note body, attachment or synthetic
 * production value is ever created to make a later-phase field look
 * implemented.
 *
 * ## Boundaries (T-1-33 / T-1-36)
 *
 * Phase 1 does **not** persist this state: it is not written to
 * `chrome.storage.*`, IndexedDB, `localStorage` or `sessionStorage`, and it is
 * never published whole over `BroadcastBus` (D-14). The schema is `.strict()`
 * so an unknown field is a typed failure rather than silently accepted
 * data, and `parseWorkspaceState` never throws.
 *
 * Transient UI state (modal/drawer visibility, hover/focus, spinners,
 * credential input, validation input, palette query, streaming buffers,
 * attachment bodies, onboarding form state, component-local selection) is
 * deliberately absent from the type.
 */

/** The shape version. `version` and `updatedAt` are separate axes — see above. */
export const WORKSPACE_STATE_SCHEMA_VERSION = 1;

/** Bounded lengths — every string field carries an explicit maximum. */
export const WORKSPACE_ID_MAX_CHARS = 128;
export const CONVERSATION_ID_MAX_CHARS = 128;
export const PROVIDER_ID_MAX_CHARS = 32;
export const MODEL_ID_MAX_CHARS = 64;
export const NOTE_ID_MAX_CHARS = 128;
export const TAB_TITLE_MAX_CHARS = 256;
export const TAB_URL_MAX_CHARS = 2048;
export const PINNED_TABS_MAX = 10;
export const SELECTED_NOTES_MAX = 32;

export type ActiveSurface = 'sidepanel' | 'standalone';

export interface TabContext {
  tabId: number;
  title: string;
  url: string;
  pinned: boolean;
}

export interface WorkspaceState {
  /** Shape version — see the module JSDoc's three-way distinction. */
  schemaVersion: number;
  workspaceId: string;
  conversationId: string | null;
  /** Later-phase resolved runtime metadata. No Phase-1 producer; no raw selector. */
  activeProvider: string | null;
  /** Later-phase resolved runtime metadata. No Phase-1 producer; no raw selector. */
  selectedModel: string | null;
  /** Later-phase inert field. Immutable empty collection in Phase 1. */
  pinnedTabs: TabContext[];
  /** Later-phase inert field. Pinned to `null` in Phase 1. */
  currentPageContext: null;
  /** Later-phase inert field. Immutable empty collection in Phase 1. */
  selectedNotes: string[];
  /** Later-phase inert field. Pinned to `null` in Phase 1. */
  activeAddonContext: null;
  /** Later-phase inert field. Pinned to `null` in Phase 1. */
  activeSkillRun: null;
  activeSurface: ActiveSurface;
  openedStandaloneTabId: number | null;
  /** Monotonic write counter — Phase 2's election reads it. */
  version: number;
  /** Staleness marker for a reader deciding whether its copy is current. */
  updatedAt: number;
}

export type WorkspaceStateParseErrorCode =
  | 'not_an_object'
  | 'unknown_field'
  | 'unsupported_schema_version'
  | 'invalid_shape';

export type WorkspaceStateParseResult =
  | { ok: true; value: WorkspaceState }
  | { ok: false; code: WorkspaceStateParseErrorCode };

const identifierSchema = z.string().min(1).max(WORKSPACE_ID_MAX_CHARS);
const conversationIdSchema = z.string().min(1).max(CONVERSATION_ID_MAX_CHARS);

/**
 * A provider identifier or a model identifier is a short slug, never a
 * credential. The prefix guard is the field's own constraint: a value shaped
 * like an API key fails even before a length bound could accept it, so no
 * field in the schema can carry a key (D-11, T-1-36).
 */
const CREDENTIAL_SHAPED = /^(sk|pk|api[_-]?key|key|token|bearer)[-_]/i;

function isSlug(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max && /^[A-Za-z][A-Za-z0-9._:/-]*$/.test(value);
}

const providerSchema = z
  .string()
  .max(PROVIDER_ID_MAX_CHARS)
  .refine((value) => isSlug(value, PROVIDER_ID_MAX_CHARS) && !CREDENTIAL_SHAPED.test(value), {
    message: 'activeProvider must be a bounded identifier, never a credential',
  });

const modelSchema = z
  .string()
  .max(MODEL_ID_MAX_CHARS)
  .refine((value) => isSlug(value, MODEL_ID_MAX_CHARS) && !CREDENTIAL_SHAPED.test(value), {
    message: 'selectedModel must be a bounded identifier, never a credential',
  });

const tabContextSchema = z
  .object({
    tabId: z.number().int(),
    title: z.string().max(TAB_TITLE_MAX_CHARS),
    url: z.string().max(TAB_URL_MAX_CHARS),
    pinned: z.boolean(),
  })
  .strict();

/**
 * The canonical strict schema. `.strict()` is load-bearing: an object with an
 * unrecognised field is rejected rather than silently accepted, which is the
 * defect class this schema exists to prevent.
 */
export const workspaceStateSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_STATE_SCHEMA_VERSION),
    workspaceId: identifierSchema,
    conversationId: conversationIdSchema.nullable(),
    activeProvider: providerSchema.nullable(),
    selectedModel: modelSchema.nullable(),
    pinnedTabs: z.array(tabContextSchema).max(PINNED_TABS_MAX),
    currentPageContext: z.null(),
    selectedNotes: z.array(z.string().min(1).max(NOTE_ID_MAX_CHARS)).max(SELECTED_NOTES_MAX),
    activeAddonContext: z.null(),
    activeSkillRun: z.null(),
    activeSurface: z.enum(['sidepanel', 'standalone']),
    openedStandaloneTabId: z.number().int().nullable(),
    version: z.number().int().min(0),
    updatedAt: z.number().int().min(0),
  })
  .strict();

/**
 * A safe empty state. `null` for every nullable identifier and contextual
 * object, and an immutable empty collection for every collection — never a
 * placeholder secret, page body, note body, attachment or synthetic value.
 */
export function createInitialWorkspaceState(): WorkspaceState {
  return {
    schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
    workspaceId: crypto.randomUUID(),
    conversationId: null,
    activeProvider: null,
    selectedModel: null,
    pinnedTabs: Object.freeze([]) as unknown as TabContext[],
    currentPageContext: null,
    selectedNotes: Object.freeze([]) as unknown as string[],
    activeAddonContext: null,
    activeSkillRun: null,
    activeSurface: 'sidepanel',
    openedStandaloneTabId: null,
    version: 0,
    updatedAt: Date.now(),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalise before validating: the persisted representation is a JSON string
 * (zustand's persist envelope), while an in-memory value is already an object.
 * Anything else is passed through so the schema can reject it.
 */
function normaliseUnknown(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed ?? value;
  } catch {
    return value;
  }
}

function classify(error: z.ZodError): WorkspaceStateParseErrorCode {
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') return 'unknown_field';
  }
  for (const issue of error.issues) {
    if (issue.path[0] === 'schemaVersion') return 'unsupported_schema_version';
  }
  return 'invalid_shape';
}

/**
 * Validate an unknown value against the canonical schema. Never throws: every
 * unrecognised input returns a typed failure, and an invalid field is never
 * partially accepted.
 */
export function parseWorkspaceState(value: unknown): WorkspaceStateParseResult {
  const normalised = normaliseUnknown(value);
  if (!isPlainObject(normalised)) {
    return { ok: false, code: 'not_an_object' };
  }

  const parsed = workspaceStateSchema.safeParse(normalised);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return { ok: false, code: classify(parsed.error) };
}

/**
 * Throw-free, total migration to the current shape (D-11, H-4).
 *
 * The migration merges the persisted object over the safe defaults, discards
 * unknown keys, stamps `schemaVersion` itself and salvages each recognised
 * field independently — one invalid field never discards the rest. It reads no
 * clock, so migrating the same input twice is deep-equal, and since its output
 * is always schema-valid, migrating its own output changes nothing.
 *
 * `persistedVersion` is the incoming persisted shape version. Phase 1 has a
 * single shape, so every incoming version migrates to it; the parameter is
 * kept so Phase 2 can branch on it deliberately.
 */
export function migrateWorkspaceState(persisted: unknown, persistedVersion: number): WorkspaceState {
  void persistedVersion;

  const base = migrationBase();
  const source = normaliseUnknown(persisted);
  if (!isPlainObject(source)) return base;

  const candidate: Record<string, unknown> = { ...base, schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION };
  for (const field of MIGRATABLE_FIELDS) {
    if (field in source) candidate[field] = source[field];
  }

  const whole = workspaceStateSchema.safeParse(candidate);
  if (whole.success) return whole.data;

  const salvaged: Record<string, unknown> = { ...base, schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION };
  for (const field of MIGRATABLE_FIELDS) {
    const single = workspaceStateSchema.safeParse({
      ...base,
      schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
      [field]: candidate[field],
    });
    if (single.success) salvaged[field] = candidate[field];
  }

  const final = workspaceStateSchema.safeParse(salvaged);
  return final.success ? final.data : base;
}

/** Every recognised field except `schemaVersion`, which the migration stamps. */
const MIGRATABLE_FIELDS = [
  'workspaceId',
  'conversationId',
  'activeProvider',
  'selectedModel',
  'pinnedTabs',
  'currentPageContext',
  'selectedNotes',
  'activeAddonContext',
  'activeSkillRun',
  'activeSurface',
  'openedStandaloneTabId',
  'version',
  'updatedAt',
] as const;

/**
 * One stable workspace id per process, so two migrations of the same input are
 * deep-equal. A persisted workspace id is always preferred when it is valid.
 */
const MIGRATION_WORKSPACE_ID = crypto.randomUUID();

/** The deterministic migration base: no clock reading, no write counter. */
function migrationBase(): WorkspaceState {
  return {
    ...createInitialWorkspaceState(),
    workspaceId: MIGRATION_WORKSPACE_ID,
    version: 0,
    updatedAt: 0,
  };
}
