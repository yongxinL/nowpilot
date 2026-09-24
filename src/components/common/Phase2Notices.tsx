import React, { useCallback, useEffect } from 'react';
import { App as AntdApp, Typography } from 'antd';
import { t } from '../../core/i18n/strings';
import { onBlockedOpen } from '../../core/storage/NowPilotDB';
import { subscribeToElectionFailure } from '../../core/workspace/WriterElection';
import { useExtensionStore } from '../../store/useExtensionStore';

/**
 * Phase 2's three persistent failure notices (02-UI-SPEC § Phase 2 UI Surface
 * Contracts item 4). Headless: the component renders no markup of its own, it
 * subscribes to the phase's failure signals and raises one notification per
 * kind through the surface's `App.useApp()` notification API.
 *
 * | Failure | Source | Copy | Action |
 * |---|---|---|---|
 * | IndexedDB unavailable / blocked (§19.10) | `onBlockedOpen` + the store's typed open-failure code | `storage.degraded` | none |
 * | Migration failure (§20.4) | the store's typed failure code | `storage.migrationFailed` | none |
 * | Election / refocus failure (§20.11) | `subscribeToElectionFailure` (02-09) | `workspace.electionFailed` | `shell.errorReload` |
 *
 * Every rule this component exists to keep:
 *
 *   - **Stable keys.** Each kind carries its own constant key, so a repeated
 *     failure updates one notification instead of stacking a second one
 *     (T-02-55). The surface-wide `maxCount` (applied at each surface root) caps
 *     the visible set.
 *   - **Acknowledgement required.** `duration: 0` on every call — these are
 *     errors that persist until dismissed (§17.4).
 *   - **No diagnostics.** The copy is the pinned sentence and nothing else: no
 *     interpolation of a code, a storage key, a journal stage, a record id, a
 *     path or any body text (T-02-52, D2-11/D2-13/D2-16). The failure payloads
 *     are read for their kind and then discarded.
 *   - **No second error surface, no blocking.** The notices never trap focus and
 *     are never the only affordance for a required action; the two storage
 *     notices carry no action at all, and the surface stays usable in memory.
 *
 * A repeated failure is observable as a republished store state or a second
 * channel report; both re-run the effect and re-issue the same key, which is
 * what makes "one notice per kind" true rather than incidental.
 */

/** The three stable notification keys — one per failure kind, never re-used. */
export const PHASE2_NOTICE_KEYS = {
  degraded: 'phase2-storage-degraded',
  migrationFailed: 'phase2-storage-migration-failed',
  electionFailed: 'phase2-workspace-election-failed',
} as const;

type Phase2NoticeKind = keyof typeof PHASE2_NOTICE_KEYS;

/**
 * The store's typed failure code → the notice that owns it, or `null` when no
 * Phase-2 notice does.
 *
 *   - §20.4's migration, both halves: the IndexedDB open/migration-abort code
 *     and every code the legacy chat migration itself reports.
 *   - §19.10's unavailable storage: the database could not be opened, or the
 *     stored schema is newer than this build supports.
 *   - Anything else (a conversation read or validation failure) belongs to the
 *     conversation region's own inline presentation, which already carries the
 *     retry action — raising a notice for it would be a second, competing error
 *     surface.
 */
function noticeKindForCode(code: string): Phase2NoticeKind | null {
  if (code === 'IDB_MIGRATION_FAILED' || code.startsWith('LEGACY_CHAT_MIGRATION_')) {
    return 'migrationFailed';
  }
  if (code === 'IDB_OPEN_FAILED' || code === 'IDB_UNSUPPORTED_VERSION') {
    return 'degraded';
  }
  return null;
}

export const Phase2Notices: React.FC = () => {
  const { notification } = AntdApp.useApp();

  const issue = useCallback(
    (kind: Phase2NoticeKind): void => {
      if (kind === 'electionFailed') {
        notification.error({
          key: PHASE2_NOTICE_KEYS.electionFailed,
          title: t('workspace.electionFailed'),
          duration: 0,
          // The pinned action label, reusing the Phase-1 key. Reloading the
          // surface document re-runs the startup sequence, which is the retry
          // the sentence promises.
          actions: [
            <Typography.Link key="reload" onClick={() => window.location.reload()}>
              {t('shell.errorReload')}
            </Typography.Link>,
          ],
        });
        return;
      }

      notification.error({
        key: PHASE2_NOTICE_KEYS[kind],
        title: t(kind === 'degraded' ? 'storage.degraded' : 'storage.migrationFailed'),
        duration: 0,
      });
    },
    [notification],
  );

  // The migration / degraded signal: the store's typed failure state (02-08).
  // A repeated failure republishes it, so the effect re-runs and updates the
  // same keyed notice rather than adding one.
  const hydrationError = useExtensionStore((state) => state.hydrationError);
  useEffect(() => {
    if (hydrationError === null) return;
    const kind = noticeKindForCode(hydrationError.code);
    if (kind !== null) issue(kind);
  }, [hydrationError, issue]);

  // §19.10's blocked-open signal. The database module owns the signal and
  // deliberately surfaces no UI itself; this is the caller.
  useEffect(() => onBlockedOpen(() => issue('degraded')), [issue]);

  // §20.11's election failure channel (02-09) — the only source of the election
  // notice. A refocus request that does not reach authoritative `primary`
  // reports here, so the notice never re-derives an outcome from the store.
  useEffect(() => subscribeToElectionFailure(() => issue('electionFailed')), [issue]);

  return null;
};
