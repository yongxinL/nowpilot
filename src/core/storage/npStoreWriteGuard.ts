import type { StateStorage } from 'zustand/middleware';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';
import { debugLog } from '../log/debugLog';
import { NP_STORE_V3_SCHEMA_VERSION } from './legacyChatMigration';

/**
 * The `np_store` write guard (CR-01, D2-07/D2-12/D2-14).
 *
 * ## The problem this module exists to prevent
 *
 * `np_store` has two writers: the zustand `persist` projection (`useExtensionStore`)
 * and the one-time legacy-chat migration (`legacyChatMigration`). The projection
 * is body-free **by construction** — `projectNpStoreV3` keeps only the four
 * allow-listed metadata fields. Replacing a pre-v3 blob with that projection
 * therefore deletes whatever message bodies the migration has not read yet, and
 * the migration cannot tell the difference afterwards: a v3 blob discovers as
 * `alreadySanitised`, the destination stages return early, and the entry is
 * marked `completed` with zero conversations. The loss would be silent,
 * unnoticeable and unrecoverable — exactly what D2-07 ("do not retain message
 * bodies in `np_store` **after their migration has been durably verified**"),
 * D2-12 ("do not delete the affected source body before destination
 * verification") and D2-14's reload-mid-migration case prohibit.
 *
 * ## The guard
 *
 * While the stored blob is a pre-v3 legacy envelope — or a value this module
 * cannot parse — the store **refuses to replace it**. The migration's own
 * `source-sanitised` stage is the only writer that may turn the legacy source
 * into the verified v3 blob, and only after the destination read-back has been
 * compared in memory (D2-10). Once the stored blob is absent, or its envelope
 * `version` has reached `NP_STORE_V3_SCHEMA_VERSION`, every write passes through
 * unchanged: there is nothing left to protect.
 *
 * ## Why this is deterministic rather than a race window
 *
 * The check is stateless — the raw stored value is re-read immediately before
 * every write — so it is independent of who wins the module-evaluation race
 * between the store's hydration write-back and the migration's `discovered`
 * stage. A suppressed write is not queued at all, so it cannot land after the
 * migration sanitises the source either, and the guard never re-introduces a
 * preserved body into a sanitised blob. D2-12's "do not silently discard data"
 * is preserved in both directions: nothing is deleted, and nothing deleted is
 * resurrected.
 *
 * The one deliberate cost: while a migration is unfinished (for example a
 * quarantined record blocks sanitisation, D2-13), non-chat metadata edited in
 * memory is not persisted across a reload. That is the correct trade — a
 * metadata edit is recoverable, an un-migrated message body is not.
 */

/**
 * True when a raw stored `np_store` value is a pre-v3 source the migration still
 * owns. `null`/`''` (no source at all) is safe to overwrite, and so is a v3
 * envelope — the migration has already sanitised the source or found nothing.
 *
 * Anything unreadable, unversioned or non-envelope-shaped is treated as a source
 * that must be preserved: `legacyChatMigration` refuses to guess at such a blob
 * (D2-13) and this guard refuses to overwrite it.
 */
export function isLegacyNpStoreSource(raw: string | null): boolean {
  if (raw === null || raw === '') return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Unparseable: preserve it, never overwrite blind (D2-13).
    return true;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return true;

  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    // An unversioned envelope is zustand-persist version 0 — the oldest legacy
    // shape there is, not a sanitised one.
    return true;
  }

  return version < NP_STORE_V3_SCHEMA_VERSION;
}

/**
 * The `StateStorage` the store's persist config uses for `np_store`. Reads,
 * removals and post-cutover writes delegate to the debounced
 * `chromeStorageAdapter` unchanged; only a write that would replace an
 * un-migrated legacy source is held back.
 */
export const npStoreStorage: StateStorage = {
  getItem: (name) => chromeStorageAdapter.getItem(name),

  setItem: async (name, value) => {
    let stored: string | null;
    try {
      stored = await chromeStorageAdapter.getItem(name);
    } catch (error) {
      // A source that cannot be read is a source that cannot be proven migrated:
      // hold the write rather than risk destroying un-migrated bodies.
      debugLog('NP_STORE_WRITE_HELD', 'The np_store write was held back: the source could not be read', {
        reason: error instanceof Error ? error.name : typeof error,
      });
      return;
    }

    if (isLegacyNpStoreSource(stored)) {
      debugLog(
        'NP_STORE_WRITE_HELD',
        'The np_store write was held back until the legacy migration owns the cutover',
      );
      return;
    }

    await chromeStorageAdapter.setItem(name, value);
  },

  removeItem: (name) => chromeStorageAdapter.removeItem(name),
};
