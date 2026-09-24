import { PROVIDER_IDS, type ProviderId } from '../../types';
import { debugLog } from '../log/debugLog';
// Type-only: the single-controller gate reads the writer-state vocabulary
// without giving this module a runtime dependency on the workspace store (and
// therefore without dragging zustand/immer into the background worker's graph).
import type { WorkspaceWriterState } from '../workspace/WorkspaceStore';

/**
 * The onboarding completion record (D-06 / D-07).
 *
 * **One key, one typed non-secret record.** `chrome.storage.local.np_onboarding`
 * carries the onboarding UI-complete flag, the selected persona, the selected
 * provider identifier, the onboarding schema version and an explicitly separate
 * validation-backing marker. There is no second key, no temporary key for a
 * later phase to remove, and no boolean flag beside it: the prototype's bare
 * `onboardingComplete` key is absorbed and deleted.
 *
 * **The four D-06 distinctions are separate facts and this record holds only
 * the first two:**
 *   - `uiComplete` — the user finished the onboarding *interaction shell*;
 *   - `validationBacking` — how the validation step was backed (`'fixture'` in
 *     Phase 1, `'provider'` once Phase 3's real port lands).
 *   It is **not** "credential securely stored" (Phase 2 owns KeyVault; Phase 1
 *   stores no credential at all), **not** "provider validated" (Phase 3 owns
 *   real validation) and **not** "provider runtime ready" (Phase 3 owns the
 *   Requester/ProviderRouter). `validationBacking: 'fixture'` records that gap
 *   explicitly so no later phase can read Phase-1 completion as production
 *   readiness (T-1-44).
 *
 * The record is non-secret by construction: there is no field that can carry a
 * credential, a masked fragment, a fingerprint or a derived value.
 *
 * The record carries one more non-secret fact added by plan `01-10`:
 * `legacyCleanupNoticeShown` — whether D-07's neutral plaintext-cleanup notice
 * has been shown and dismissed. It is a field on this record rather than a
 * second storage key or a second flag, and it is a plain boolean: it records
 * that a *notice* was shown, never that a credential existed, so nothing here
 * can disclose whether the cleanup found anything.
 */
export const ONBOARDING_STORAGE_KEY = 'np_onboarding';

/**
 * The legacy prototype key. It held a bare boolean, seeded by the background on
 * install and read by the prototype chat host (which also fell back to a
 * per-origin `localStorage` copy — both are removed). Only this module names
 * the literal; `migrateLegacyOnboardingFlag()` absorbs its value and deletes it.
 */
export const LEGACY_ONBOARDING_FLAG_KEY = 'onboardingComplete';

/** The record shape version. Bump when the stored fields change. */
export const ONBOARDING_SCHEMA_VERSION = 2;

/**
 * The one superseded shape this reader still migrates.
 *
 * Version 1 carried the same fields without `legacyCleanupNoticeShown`. Adding
 * that field is additive and safely defaulted (it defaults to `false`, so the
 * notice shows once), so a v1 record is read and upgraded rather than rejected:
 * rejecting it would present the onboarding flow again to a user who has just
 * completed it, which is the failure the strict version rule exists to prevent,
 * not to cause. Any other version is still rejected as incompatible.
 */
const ONBOARDING_SCHEMA_VERSION_V1 = 1;

export interface OnboardingState {
  /** The user finished the onboarding interaction shell. */
  uiComplete: boolean;
  /** The selected persona. Phase 1 renders a preview card, so this stays null. */
  persona: string | null;
  /** The selected canonical provider identifier. Never a credential. */
  providerId: ProviderId | null;
  /** The record shape version this record was written with. */
  schemaVersion: number;
  /** How the validation step was backed. Phase 1 is `'fixture'`. */
  validationBacking: 'fixture' | 'provider';
  /**
   * Whether D-07's neutral plaintext-cleanup notice has been shown and
   * dismissed. `false` on a fresh record, so the notice presents once; the
   * dismissal marks it. Non-secret: it records a presentation, not a value.
   */
  legacyCleanupNoticeShown: boolean;
}

/** Why a read could not produce a usable record. */
export type OnboardingUnknownReason = 'missing' | 'incompatible' | 'unreadable';

/**
 * The read result. `unknown` is a first-class outcome — a missing record, an
 * incompatible schema version and a failed read are all "we do not know", which
 * presents the flow rather than suppressing it.
 */
export type OnboardingReadResult =
  | { status: 'ok'; state: OnboardingState }
  | { status: 'unknown'; reason: OnboardingUnknownReason };

/**
 * The render decision: present the flow unless a *complete* record was read.
 *
 * False, unknown, missing, schema-incompatible and an entirely failed read all
 * present the flow (D-06).
 */
export function shouldPresentOnboarding(result: OnboardingReadResult): boolean {
  return !(result.status === 'ok' && result.state.uiComplete);
}

/**
 * The single-controller gate (D2-32, RESEARCH Pitfall 10, OQ-4).
 *
 * Two live surfaces may both decide to present the onboarding flow; exactly one
 * may. Presentation therefore requires the **authoritative writer state**: only
 * `'primary'` presents, and every mirror-side state — `mirror`,
 * `election-pending`, `handoff-pending`, `handoff-failed`,
 * `writer-unavailable` — resolves hidden no matter what the record says, so a
 * mirror renders the mirrored completion state instead of a competing flow.
 *
 * Pure and total: every combination of the four read outcomes and the six
 * writer states returns a boolean and nothing throws. `'primary'` is compared
 * inline rather than through a store helper, because importing the store here
 * would make this module a runtime dependency of the workspace graph.
 */
export function shouldPresentOnboardingForWriter(
  result: OnboardingReadResult,
  writerState: WorkspaceWriterState,
): boolean {
  return writerState === 'primary' && shouldPresentOnboarding(result);
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The canonical empty record — the base every migration merges over. */
function createInitialOnboardingState(): OnboardingState {
  return {
    uiComplete: false,
    persona: null,
    providerId: null,
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    validationBacking: 'fixture',
    legacyCleanupNoticeShown: false,
  };
}

/**
 * Normalise one recognised value into the canonical record, or `null` when the
 * value is not a record this version understands.
 *
 * Total and throw-free: `null`, strings, numbers, arrays, records with unknown
 * fields and records written by another schema version all return `null`
 * instead of throwing or half-applying. `version` is the schema version of an
 * enclosing envelope, used when the record itself does not carry one.
 */
export function migrateOnboardingState(
  persisted: unknown,
  version: unknown,
): OnboardingState | null {
  // The prototype's bare boolean (read from the legacy key) maps onto the
  // UI-complete flag.
  if (typeof persisted === 'boolean') {
    return { ...createInitialOnboardingState(), uiComplete: persisted };
  }

  if (!isPlainObject(persisted)) return null;

  const recordVersion =
    typeof persisted.schemaVersion === 'number' ? persisted.schemaVersion : version;

  // An incompatible (or absent) schema version is never silently accepted: the
  // caller sees `null` and presents the flow. The one superseded shape (v1) is
  // a known version this reader upgrades rather than rejects.
  if (
    recordVersion !== ONBOARDING_SCHEMA_VERSION &&
    recordVersion !== ONBOARDING_SCHEMA_VERSION_V1
  ) {
    return null;
  }

  return {
    uiComplete: persisted.uiComplete === true,
    persona: typeof persisted.persona === 'string' ? persisted.persona : null,
    providerId: isProviderId(persisted.providerId) ? persisted.providerId : null,
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    validationBacking: persisted.validationBacking === 'provider' ? 'provider' : 'fixture',
    legacyCleanupNoticeShown: persisted.legacyCleanupNoticeShown === true,
  };
}

function hasLocalStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
}

/** Read both onboarding keys. `null` means the storage read itself failed. */
async function readStoredValues(): Promise<Record<string, unknown> | null> {
  if (!hasLocalStorage()) return {};
  try {
    return (await chrome.storage.local.get([
      ONBOARDING_STORAGE_KEY,
      LEGACY_ONBOARDING_FLAG_KEY,
    ])) as Record<string, unknown>;
  } catch (error) {
    debugLog('ONBOARDING_STORAGE_READ_FAILED', 'chrome.storage.local.get failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}

async function writeStoredRecord(record: OnboardingState): Promise<void> {
  if (!hasLocalStorage()) return;
  try {
    await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: record });
  } catch (error) {
    debugLog('ONBOARDING_STORAGE_WRITE_FAILED', 'chrome.storage.local.set failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
  }
}

/**
 * Remove the legacy prototype key. Import-free of any state: it deletes the key
 * whether or not a record exists, so no second source of truth survives.
 */
export async function deleteLegacyOnboardingFlag(): Promise<void> {
  if (!hasLocalStorage()) return;
  try {
    await chrome.storage.local.remove(LEGACY_ONBOARDING_FLAG_KEY);
  } catch (error) {
    debugLog('ONBOARDING_LEGACY_FLAG_DELETE_FAILED', 'chrome.storage.local.remove failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
  }
}

/**
 * Absorb the legacy boolean into the record and delete the legacy key.
 *
 * Idempotent: with no legacy boolean present it does nothing, and with a record
 * already in place it only removes the stale key (the record stays untouched).
 * The background runs this once on install and once on startup so an installed
 * prototype's flag is absorbed and the key removed.
 */
export async function migrateLegacyOnboardingFlag(): Promise<void> {
  const values = await readStoredValues();
  if (values === null) return;

  const legacy = values[LEGACY_ONBOARDING_FLAG_KEY];
  if (typeof legacy !== 'boolean') return;

  const existing = values[ONBOARDING_STORAGE_KEY];
  if (existing === undefined || existing === null) {
    const absorbed = migrateOnboardingState(legacy, undefined);
    if (absorbed) await writeStoredRecord(absorbed);
  }
  await deleteLegacyOnboardingFlag();
}

/**
 * Read the completion record.
 *
 * Total and throw-free: a missing record, garbage, an incompatible schema
 * version and a failed storage read all resolve to an `unknown` result (which
 * presents the flow) rather than throwing. A legacy boolean found under the
 * prototype key is absorbed into the record and the legacy key removed.
 */
export async function readOnboardingState(): Promise<OnboardingReadResult> {
  let values = await readStoredValues();
  if (values === null) return { status: 'unknown', reason: 'unreadable' };

  if (typeof values[LEGACY_ONBOARDING_FLAG_KEY] === 'boolean') {
    await migrateLegacyOnboardingFlag();
    values = await readStoredValues();
    if (values === null) return { status: 'unknown', reason: 'unreadable' };
  }

  const stored = values[ONBOARDING_STORAGE_KEY];
  if (stored === undefined || stored === null) {
    return { status: 'unknown', reason: 'missing' };
  }

  const state = migrateOnboardingState(stored, undefined);
  if (state === null) return { status: 'unknown', reason: 'incompatible' };

  return { status: 'ok', state };
}

/**
 * Write the completion record, merging the given fields over the stored one.
 *
 * The record is re-migrated first, so an unrecognised or schema-incompatible
 * stored value is replaced by the canonical shape rather than merged blindly,
 * and writing the same fields twice stores the same record (no clock, no
 * randomness). A surface never passes a credential here — the type has nowhere
 * to put one.
 */
export async function writeOnboardingState(
  partial: Partial<OnboardingState>,
): Promise<OnboardingState> {
  const values = await readStoredValues();
  const existing = values
    ? migrateOnboardingState(values[ONBOARDING_STORAGE_KEY], undefined)
    : null;

  const next: OnboardingState = {
    ...(existing ?? createInitialOnboardingState()),
    ...partial,
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    validationBacking:
      partial.validationBacking === 'provider' ? 'provider' : existing?.validationBacking ?? 'fixture',
  };

  await writeStoredRecord(next);
  return next;
}

/**
 * Subscribe to completion-record changes — the cross-surface propagation path
 * (D-06): a completion written in one surface reaches the other with no reload.
 *
 * Only the two onboarding keys are observed; an unrelated storage change is
 * ignored. Returns an unsubscribe function.
 */
export function subscribeToOnboardingState(
  listener: (result: OnboardingReadResult) => void,
): () => void {
  if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return () => {};

  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return;
    if (!(ONBOARDING_STORAGE_KEY in changes) && !(LEGACY_ONBOARDING_FLAG_KEY in changes)) return;
    void readOnboardingState().then(listener);
  };

  chrome.storage.onChanged.addListener(handler);
  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
}
