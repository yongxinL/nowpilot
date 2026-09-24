import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import {
  PHASE2_NOTICE_KEYS,
  Phase2Notices,
} from '../../src/components/common/Phase2Notices';
import { t } from '../../src/core/i18n/strings';
import {
  requestRefocus,
  setActiveWriterElection,
  type ElectionOutcome,
  type WriterElection,
} from '../../src/core/workspace/WriterElection';
import { useExtensionStore } from '../../src/store/useExtensionStore';
import {
  DB_NAME,
  DB_VERSION,
  __test__ as dbTest,
  closeDb,
  getDb,
  onBlockedOpen,
} from '../../src/core/storage/NowPilotDB';

/**
 * `Phase2Notices` suite (plan `02-10`, Task 2) — the notice contract and its
 * redaction (02-UI-SPEC § Phase 2 UI Surface Contracts item 4; T-02-51…T-02-55).
 *
 * Every failure is driven through its **real** source, never a mock of the
 * component's seam:
 *
 *   - the migration / degraded notices through the store's typed failure state
 *     (02-08),
 *   - the blocked half of the degraded notice through the database module's own
 *     §19.10 signal, fired by a real blocked IndexedDB upgrade,
 *   - the election notice through the production `requestRefocus()` and the
 *     02-09 failure channel.
 *
 * The app-scoped notification API is captured from a sibling component so the
 * suite can assert the exact configuration the component passes, while the
 * notices still render for real (the spy calls through).
 */

/** The surface's pinned notification configuration (see each entrypoint root). */
const ANT_NOTIFICATION_CONFIG = { duration: 0 };

const COMPONENT_PATH = path.join(
  process.cwd(),
  'src',
  'components',
  'common',
  'Phase2Notices.tsx',
);

type NotificationApi = ReturnType<typeof AntdApp.useApp>['notification'];

let notificationApi: NotificationApi | null = null;

/** Captures the app-scoped API `Phase2Notices` itself resolves. */
const CaptureNotificationApi: React.FC = () => {
  notificationApi = AntdApp.useApp().notification;
  return null;
};

function renderNotices() {
  notificationApi = null;
  return render(
    <AntdApp notification={ANT_NOTIFICATION_CONFIG}>
      <CaptureNotificationApi />
      <Phase2Notices />
    </AntdApp>,
  );
}

const noticeNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.ant-notification-notice'));

const noticeTitles = (): (string | null)[] =>
  Array.from(document.querySelectorAll('.ant-notification-notice-title')).map(
    (node) => node.textContent,
  );

const noticeActions = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.ant-notification-notice-actions'));

/** One typed failure publication, exactly as the hydration path publishes it. */
function publishHydrationError(code: string): void {
  act(() => {
    useExtensionStore.setState({ hydrationStatus: 'failed', hydrationError: { code } });
  });
}

function clearHydrationError(): void {
  act(() => {
    useExtensionStore.setState({ hydrationStatus: 'idle', hydrationError: null });
  });
}

/** A structurally-real election whose one interesting method reports a failure. */
function failingElection(code: 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'): WriterElection {
  return {
    surface: 'sidepanel',
    tabId: 7,
    elect: async (): Promise<ElectionOutcome> => ({ kind: 'error', code, message: 'failed' }),
    startHeartbeat: vi.fn(),
    stop: vi.fn(),
    assertStillPrimary: async () => ({ ok: true }),
    coordinationState: () => ({ state: 'election-in-progress', startedAt: 0 }),
  };
}

/** A raw connection with no `versionchange` handler, so it blocks an upgrade. */
function openRawConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fire the real §19.10 blocked-open signal: hold an older connection, then ask
 * for a newer version. The database module's `blocked` callback is the signal
 * `Phase2Notices` subscribes to; it is also what `debugLog`s the blocked code.
 *
 * Firing is all this helper does — whether a notice appears is the caller's
 * assertion, so the unmount case can prove that nothing does.
 */
async function fireBlockedOpenSignal(): Promise<void> {
  await getDb();
  closeDb();

  const rawHolder = await openRawConnection();
  const blocked = new Promise<void>((resolve) => {
    const unsubscribe = onBlockedOpen(() => {
      unsubscribe();
      resolve();
    });
  });
  const pending = dbTest.openWithVersion(DB_VERSION + 1);

  try {
    await act(async () => {
      await blocked;
    });
  } finally {
    rawHolder.close();
    const requester = await pending;
    requester.close();
  }
}

/** Every diagnostic a Phase-2 failure payload could carry — none may render. */
const DIAGNOSTIC_TOKENS = [
  'rec-8f31c2', // a record id
  'np_workspace_primary', // a storage key
  'write-np-workspace', // a journal stage name
  '/Users/operator/nowpilot/np_db', // a file path
  'c2VjcmV0LWNpcGhlcnRleHQ=', // ciphertext
  'IDB_MIGRATION_FAILED', // an error code (migration)
  'IDB_OPEN_FAILED', // an error code (open)
  'ELECTION_TIMEOUT', // an error code (election)
  'STORAGE_UNAVAILABLE', // an error code (election)
];

beforeEach(() => {
  (globalThis as unknown as { __resetIndexedDB?: () => void }).__resetIndexedDB?.();
});

afterEach(() => {
  act(() => {
    useExtensionStore.setState({ hydrationStatus: 'idle', hydrationError: null });
  });
  setActiveWriterElection(null);
  dbTest.reset();
  closeDb();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Phase2Notices — one keyed notice per failure kind', () => {
  it('raises one notice per source, each with its own stable key and pinned sentence', async () => {
    renderNotices();
    const errorSpy = vi.spyOn(notificationApi!, 'error');

    publishHydrationError('IDB_OPEN_FAILED');
    await waitFor(() => expect(noticeNodes()).toHaveLength(1));
    expect(noticeTitles()).toEqual([t('storage.degraded')]);

    clearHydrationError();
    publishHydrationError('IDB_MIGRATION_FAILED');
    await waitFor(() => expect(noticeNodes()).toHaveLength(2));
    expect(noticeTitles()).toContain(t('storage.migrationFailed'));

    setActiveWriterElection(failingElection('ELECTION_TIMEOUT'));
    await act(async () => {
      await requestRefocus();
    });
    await waitFor(() => expect(noticeNodes()).toHaveLength(3));
    expect(noticeTitles()).toContain(t('workspace.electionFailed'));

    expect(errorSpy.mock.calls.map((call) => call[0].key)).toEqual([
      PHASE2_NOTICE_KEYS.degraded,
      PHASE2_NOTICE_KEYS.migrationFailed,
      PHASE2_NOTICE_KEYS.electionFailed,
    ]);
  });

  it('raises the degraded notice for the blocked-open signal', async () => {
    renderNotices();
    const errorSpy = vi.spyOn(notificationApi!, 'error');

    await fireBlockedOpenSignal();

    await waitFor(() => expect(noticeTitles()).toContain(t('storage.degraded')));
    expect(errorSpy.mock.calls.map((call) => call[0].key)).toEqual([
      PHASE2_NOTICE_KEYS.degraded,
    ]);
  });

  it('raises nothing for a failure code no Phase-2 notice owns', async () => {
    renderNotices();
    const errorSpy = vi.spyOn(notificationApi!, 'error');

    // A conversation-level failure is the conversation region's inline
    // presentation (storage.hydrationFailed + Retry) — never a second surface.
    publishHydrationError('CHAT_HISTORY_INVALID_RECORD');
    await act(async () => {
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(noticeNodes()).toHaveLength(0);
  });

  it('updates one notice instead of stacking when the same failure repeats', async () => {
    renderNotices();
    const errorSpy = vi.spyOn(notificationApi!, 'error');

    publishHydrationError('IDB_MIGRATION_FAILED');
    await waitFor(() => expect(noticeNodes()).toHaveLength(1));

    publishHydrationError('IDB_MIGRATION_FAILED');
    publishHydrationError('IDB_MIGRATION_FAILED');
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(3));

    // Three reports, one keyed notice.
    expect(noticeNodes()).toHaveLength(1);
    expect(new Set(errorSpy.mock.calls.map((call) => call[0].key))).toEqual(
      new Set([PHASE2_NOTICE_KEYS.migrationFailed]),
    );
  });
});

describe('Phase2Notices — acknowledgement, actions and redaction', () => {
  it('requires acknowledgement on every notice and never auto-closes', async () => {
    renderNotices();
    const errorSpy = vi.spyOn(notificationApi!, 'error');

    publishHydrationError('IDB_OPEN_FAILED');
    setActiveWriterElection(failingElection('STORAGE_UNAVAILABLE'));
    await act(async () => {
      await requestRefocus();
    });
    await waitFor(() => expect(noticeNodes()).toHaveLength(2));

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls.every((call) => call[0].duration === 0)).toBe(true);

    // The behavioural half: a notice with a non-zero duration would close on
    // its own timer, and ten seconds is well past the platform default.
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(noticeNodes()).toHaveLength(2);
    vi.useRealTimers();
  });

  it('gives only the election notice an action, carrying the pinned reload label', async () => {
    renderNotices();

    publishHydrationError('IDB_OPEN_FAILED');
    await waitFor(() => expect(noticeNodes()).toHaveLength(1));
    clearHydrationError();
    publishHydrationError('IDB_MIGRATION_FAILED');
    setActiveWriterElection(failingElection('STORAGE_UNAVAILABLE'));
    await act(async () => {
      await requestRefocus();
    });
    await waitFor(() => expect(noticeNodes()).toHaveLength(3));

    const actions = noticeActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent).toBe(t('shell.errorReload'));

    for (const node of noticeNodes()) {
      const isElectionNotice = (node.textContent ?? '').includes(
        t('workspace.electionFailed'),
      );
      expect(
        node.querySelector('.ant-notification-notice-actions') !== null,
        node.textContent ?? '',
      ).toBe(isElectionNotice);
    }
  });

  it('renders the pinned sentence only: no diagnostic token from any failure payload', async () => {
    renderNotices();

    publishHydrationError('IDB_MIGRATION_FAILED');
    await waitFor(() => expect(noticeNodes()).toHaveLength(1));
    await fireBlockedOpenSignal();
    await waitFor(() => expect(noticeTitles()).toContain(t('storage.degraded')));
    setActiveWriterElection(failingElection('STORAGE_UNAVAILABLE'));
    await act(async () => {
      await requestRefocus();
    });
    await waitFor(() => expect(noticeNodes()).toHaveLength(3));

    const pinned = [
      t('storage.degraded'),
      t('storage.migrationFailed'),
      t('workspace.electionFailed'),
    ];

    // Every title is byte-equal to one of the three pinned sentences…
    for (const title of noticeTitles()) {
      expect(pinned).toContain(title);
    }

    // …and the rendered notices carry no record id, storage key, journal stage
    // name, file path, ciphertext or error code.
    const rendered = noticeNodes()
      .map((node) => node.textContent ?? '')
      .join('\n');
    for (const token of DIAGNOSTIC_TOKENS) {
      expect(rendered, token).not.toContain(token);
    }
  });
});

describe('Phase2Notices — lifecycle and API discipline', () => {
  it('removes every subscription on unmount: a later failure raises nothing', async () => {
    const { unmount } = renderNotices();
    const errorSpy = vi.spyOn(notificationApi!, 'error');

    unmount();

    publishHydrationError('IDB_MIGRATION_FAILED');
    setActiveWriterElection(failingElection('STORAGE_UNAVAILABLE'));
    await act(async () => {
      await requestRefocus();
    });
    await fireBlockedOpenSignal();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(noticeNodes()).toHaveLength(0);
  });

  it('renders no markup of its own', () => {
    renderNotices();

    expect(document.body.textContent).toBe('');
  });

  it('reaches the notification API only through App.useApp()', () => {
    const source = fs
      .readFileSync(COMPONENT_PATH, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const antdImport = source.split('\n').find((line) => line.includes("from 'antd'"));
    expect(antdImport).toBeDefined();
    // The static imperative APIs stay forbidden: only the App wrapper and
    // presentational components may be imported from antd here.
    expect(antdImport).not.toContain('notification');
    expect(antdImport).not.toContain('message');
    expect(source).toContain('AntdApp.useApp()');
  });
});
