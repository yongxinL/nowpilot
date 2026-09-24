import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HANDOFF_DRAFT_MAX_CHARS,
  HANDOFF_MAX_RETRIES,
  HANDOFF_SCHEMA_VERSION,
  HANDOFF_TIMEOUT_MS,
  buildHandoffUrl,
  createHandoffInitiator,
  createHandoffRequestId,
  parseHandoffUrl,
  validateHandoffEnvelope,
  type HandoffEnvelope,
  type HandoffInitiator,
  type HandoffInitiatorRequest,
  type Phase1HandoffProjection,
} from '../../src/core/workspace/handoff/protocol';
import { useHandoffComposerDraftStore } from '../../src/core/workspace/handoff/composerDraft';
import { PRIMARY_RECORD_KEY } from '../../src/core/workspace/WriterElection';
import {
  WORKSPACE_STORAGE_KEY,
  readWorkspaceState,
  writeWorkspaceState,
} from '../../src/core/workspace/WorkspacePersistence';
import { createInitialWorkspaceState } from '../../src/core/workspace/WorkspaceState';
import type { ChatSessionRecord, MessageRecord } from '../../src/core/storage/ChatHistoryDB';
import {
  SYNTHETIC_CREDENTIAL_SENTINEL,
  WORKSPACE_STATE_ONLY_FIELDS,
  createTwoSurfaceHarness,
  flush,
  publishedOf,
  type TwoSurfaceHarness,
} from '../harness/twoSurface';

/**
 * Suite A — the WINDOWS #5 cross-surface handoff contract (D2-31, plan 02-11).
 *
 * One named case per D2-31 clause, each case naming its clause, so the
 * traceability mapping is mechanical (D2-31.22 asserts it). The suite drives
 * the **real** handoff controllers through the harness's injected loopback
 * transport, the real `WriterElection`, the real `WorkspacePersistence` write
 * path, the real `ChatHistoryDB` records and the real envelope/URL validators;
 * only the environmental boundaries D2-30 lists are faked.
 *
 * This suite satisfies Phase 2 **automated contract coverage only**. It does
 * not close the deferred Real-Chrome WINDOW #5 observation: it claims no
 * observed UI behaviour, and WINDOWS #5 stays `open` for the Phase 15
 * consolidated acceptance cycle.
 */

type TransferEnvelope = Extract<HandoffEnvelope, { type: 'WORKSPACE_HANDOFF' }>;
type AckEnvelope = Extract<HandoffEnvelope, { type: 'HANDOFF_ACK' }>;

const SENTINEL = SYNTHETIC_CREDENTIAL_SENTINEL;

/**
 * The clause → named-case mapping (D2-31). One row per clause; the traceability
 * case asserts every `test` value names a case that exists in this file.
 */
const CLAUSE_MAP = [
  {
    clause: 'cold Standalone target initialisation',
    test: 'D2-31.1 cold Standalone target initialisation — the document comes up from the validated URL bootstrap and announces readiness',
  },
  {
    clause: 'target-ready notification before transfer',
    test: 'D2-31.2 target-ready notification before transfer — no transfer is published before the correlated ready arrives',
  },
  {
    clause: 'ready/transfer/acknowledgement ordering',
    test: 'D2-31.3 ready/transfer/acknowledgement ordering — the three correlated envelopes cross in that order, each schema-valid',
  },
  {
    clause: 'acknowledgement required before reporting success',
    test: 'D2-31.4 acknowledgement required before reporting success — success is withheld until the validated ack lands',
  },
  {
    clause: 'reuse and focus of an existing Standalone target',
    test: 'D2-31.5 reuse and focus of an existing Standalone target — the warm path focuses and re-points the same tab',
  },
  {
    clause: 'duplicate-tab prevention',
    test: 'D2-31.6 duplicate-tab prevention — repeated and concurrent opens never create a second Standalone tab',
  },
  {
    clause: 'stable workspace and request identifiers',
    test: 'D2-31.7 stable workspace and request identifiers — one request id per attempt, stable across retries and surfaces',
  },
  {
    clause: 'idempotent duplicate requests',
    test: 'D2-31.8 idempotent duplicate requests — a repeated transfer is acknowledged again and applied exactly once',
  },
  {
    clause: 'safe handoff projection',
    test: 'D2-31.9 safe handoff projection — exactly the allowlist crosses and an over-wide request leaks nothing',
  },
  {
    clause: 'composer-draft transfer',
    test: 'D2-31.10 composer-draft transfer — the draft rides the projection, lands consume-once and never the URL',
  },
  {
    clause: 'no complete WorkspaceState broadcast',
    test: 'D2-31.11 no complete WorkspaceState broadcast — no envelope carries a state object and the real validator rejects one',
  },
  {
    clause: 'no credential or secret in URL, envelope, message, journal or log',
    test: 'D2-31.12 no credential or secret in URL, envelope, message, journal or log — the sentinel never crosses',
  },
  {
    clause: 'timeout behaviour',
    test: 'D2-31.13 timeout behaviour — a silent target fails on the harness clock and never claims success',
  },
  {
    clause: 'bounded retry',
    test: 'D2-31.14 bounded retry — the attempt count is bounded and a late acknowledgement cannot resurrect success',
  },
  {
    clause: 'rejection of an invalid source or target',
    test: 'D2-31.15 rejection of an invalid source or target — forged surfaces fail the real URL and envelope validators',
  },
  {
    clause: 'rejection of an unsupported schema version',
    test: 'D2-31.16 rejection of an unsupported schema version — a future version is refused by both validators',
  },
  {
    clause: 'persistence and authoritative read-back where required',
    test: 'D2-31.17 persistence and authoritative read-back — the transferred state persists journaled and reads back',
  },
  {
    clause: 'crash between handoff stages',
    test: 'D2-31.18 crash between handoff stages — a lost acknowledgement leaves durable state consistent and the retry completes',
  },
  {
    clause: 'reload and recovery',
    test: 'D2-31.19 reload and recovery — a reloaded document rebuilds from durable storage and the next handoff still completes',
  },
  {
    clause: 'failure preserving the original writer',
    test: 'D2-31.20 failure preserving the original writer — a failed handoff leaves authority with the original writer',
  },
  {
    clause: 'stale-writer rejection after the election becomes authoritative',
    test: 'D2-31.21 stale-writer rejection after the election becomes authoritative — the superseded surface cannot write',
  },
  {
    clause: 'traceability: one named case per clause',
    test: 'D2-31.22 traceability — the suite declares exactly one named case per D2-31 clause',
  },
] as const;

let harness: TwoSurfaceHarness;

beforeEach(() => {
  harness = createTwoSurfaceHarness();
});

afterEach(async () => {
  await harness.dispose();
});

const request = (overrides: Partial<HandoffInitiatorRequest> = {}): HandoffInitiatorRequest => ({
  workspaceId: harness.workspaceId,
  conversationId: harness.conversationId,
  page: 'chat',
  composerDraft: 'a handed-over draft',
  sourceSurface: 'sidepanel',
  targetSurface: 'standalone',
  ...overrides,
});

const newSource = (overrides: Partial<Parameters<typeof createHandoffInitiator>[0]> = {}): HandoffInitiator =>
  createHandoffInitiator({ openTarget: harness.openTarget, transport: harness.transport, ...overrides });

const projectionFor = (
  requestId: string,
  overrides: Partial<Phase1HandoffProjection> = {},
): Phase1HandoffProjection => ({
  workspaceId: harness.workspaceId,
  conversationId: harness.conversationId,
  sourceSurface: 'sidepanel',
  targetSurface: 'standalone',
  activeRoute: 'chat',
  composerDraft: 'a handed-over draft',
  requestId,
  schemaVersion: HANDOFF_SCHEMA_VERSION,
  ...overrides,
});

const transfersOf = (): TransferEnvelope[] =>
  harness.transport
    .published()
    .filter((envelope): envelope is TransferEnvelope => envelope.type === 'WORKSPACE_HANDOFF');

const acksOf = (): AckEnvelope[] =>
  harness.transport
    .published()
    .filter((envelope): envelope is AckEnvelope => envelope.type === 'HANDOFF_ACK');

/** Has `promise` settled after the current microtask queue has drained? */
async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  await flush();
  const winner = await Promise.race([
    promise.then(
      () => 'settled' as const,
      () => 'settled' as const,
    ),
    Promise.resolve('pending' as const),
  ]);
  return winner === 'settled';
}

describe('Suite A — the WINDOWS #5 handoff contract (D2-31)', () => {
  it('D2-31.1 cold Standalone target initialisation — the document comes up from the validated URL bootstrap and announces readiness', async () => {
    const source = newSource();
    const started = source.start(request());

    await expect(started).resolves.toEqual({ ok: true });

    expect(harness.tabs.list()).toHaveLength(1);
    expect(harness.standalone.bootstrap).toMatchObject({
      workspaceId: harness.workspaceId,
      requestId: source.requestId,
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
    });
    expect(harness.standalone.url).toBe(
      buildHandoffUrl({
        workspaceId: harness.workspaceId,
        requestId: source.requestId,
        conversationId: harness.conversationId,
        route: 'chat',
        sourceSurface: 'sidepanel',
        targetSurface: 'standalone',
      }),
    );
    expect(harness.standalone.appliedRequestIds()).toEqual([source.requestId]);
    expect(harness.transport.published()[0]?.type).toBe('HANDOFF_READY');
    source.dispose();
  });

  it('D2-31.2 target-ready notification before transfer — no transfer is published before the correlated ready arrives', async () => {
    const publishSpy = vi.spyOn(harness.transport, 'publish');
    // The target is deliberately not opened yet: no ready can have arrived.
    const source = newSource({ openTarget: async () => {} });
    const started = source.start(request());
    await flush();

    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(0);
    expect(publishedOf(publishSpy, 'HANDOFF_READY')).toHaveLength(0);

    // The target announces readiness under this attempt's correlation id.
    harness.bringUpStandalone(source.requestId);
    await flush();

    expect(publishedOf(publishSpy, 'HANDOFF_READY')).toHaveLength(1);
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(1);
    await expect(started).resolves.toEqual({ ok: true });
    publishSpy.mockRestore();
    source.dispose();
  });

  it('D2-31.3 ready/transfer/acknowledgement ordering — the three correlated envelopes cross in that order, each schema-valid', async () => {
    const source = newSource();
    await expect(source.start(request())).resolves.toEqual({ ok: true });

    expect(harness.transport.published().map((envelope) => envelope.type)).toEqual([
      'HANDOFF_READY',
      'WORKSPACE_HANDOFF',
      'HANDOFF_ACK',
    ]);
    for (const envelope of harness.transport.published()) {
      expect(validateHandoffEnvelope(envelope)).toEqual({ ok: true, value: envelope });
      expect(envelope.requestId).toBe(source.requestId);
    }
    source.dispose();
  });

  it('D2-31.4 acknowledgement required before reporting success — success is withheld until the validated ack lands', async () => {
    const source = newSource();
    // The target applies the projection, but its acknowledgement is lost.
    harness.transport.dropNext('HANDOFF_ACK');
    const started = source.start(request());
    await flush();

    expect(harness.standalone.appliedCount()).toBe(1);
    expect(await isSettled(started)).toBe(false);

    // The retry's acknowledgement is what turns the handoff into a success.
    await harness.advanceMs(HANDOFF_TIMEOUT_MS);
    await expect(started).resolves.toEqual({ ok: true });
    source.dispose();
  });

  it('D2-31.5 reuse and focus of an existing Standalone target — the warm path focuses and re-points the same tab', async () => {
    const first = newSource();
    await expect(first.start(request())).resolves.toEqual({ ok: true });
    const tabId = harness.standalone.tabId;
    harness.tabs.blur();

    const second = newSource();
    await expect(second.start(request())).resolves.toEqual({ ok: true });

    expect(harness.tabs.list()).toHaveLength(1);
    expect(harness.tabs.focused()?.id).toBe(tabId);
    expect(harness.standalone.url).toContain(second.requestId);
    expect(harness.standalone.appliedRequestIds()).toEqual([first.requestId, second.requestId]);
    first.dispose();
    second.dispose();
  });

  it('D2-31.6 duplicate-tab prevention — repeated and concurrent opens never create a second Standalone tab', async () => {
    const first = newSource();
    await expect(first.start(request())).resolves.toEqual({ ok: true });
    const createdTabId = harness.tabs.list()[0]?.id;
    expect(createdTabId).toBe(harness.standalone.tabId);

    const second = newSource();
    await expect(second.start(request())).resolves.toEqual({ ok: true });
    expect(harness.tabs.list()).toHaveLength(1);
    expect(harness.tabs.list()[0]?.id).toBe(createdTabId);

    // A concurrent pair opened while the tab already exists creates nothing new.
    const third = newSource();
    const fourth = newSource();
    void third.start(request());
    void fourth.start(request());
    await flush();
    expect(harness.tabs.list()).toHaveLength(1);

    third.dispose();
    fourth.dispose();
    first.dispose();
    second.dispose();
  });

  it('D2-31.7 stable workspace and request identifiers — one request id per attempt, stable across retries and surfaces', async () => {
    const source = newSource();
    harness.transport.dropNext('HANDOFF_ACK');
    const started = source.start(request());
    await flush();
    await harness.advanceMs(HANDOFF_TIMEOUT_MS); // exactly one retry
    await expect(started).resolves.toEqual({ ok: true });

    const envelopes = harness.transport.published();
    expect(envelopes.filter((envelope) => envelope.type === 'WORKSPACE_HANDOFF')).toHaveLength(2);
    for (const envelope of envelopes) {
      expect(envelope.requestId).toBe(source.requestId);
    }
    for (const transfer of transfersOf()) {
      expect(transfer.projection.requestId).toBe(source.requestId);
      expect(transfer.projection.workspaceId).toBe(harness.workspaceId);
    }
    expect(harness.standalone.bootstrap?.workspaceId).toBe(harness.workspaceId);

    // Request ids are never reused: a fresh attempt introduces a fresh identity.
    expect(createHandoffRequestId()).not.toBe(source.requestId);
    source.dispose();
  });

  it('D2-31.8 idempotent duplicate requests — a repeated transfer is acknowledged again and applied exactly once', async () => {
    harness.bringUpStandalone('req-duplicate');
    harness.transport.reset();

    const transfer: HandoffEnvelope = {
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-duplicate',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projectionFor('req-duplicate'),
    };
    harness.transport.publish(transfer);
    harness.transport.publish(transfer);
    await flush();

    expect(harness.standalone.appliedCount()).toBe(1);
    expect(harness.standalone.appliedRequestIds()).toEqual(['req-duplicate']);
    expect(acksOf()).toHaveLength(2);
  });

  it('D2-31.9 safe handoff projection — exactly the allowlist crosses and an over-wide request leaks nothing', async () => {
    const overWide = {
      ...request(),
      apiKey: SENTINEL,
      workspaceState: createInitialWorkspaceState(),
      messages: ['a message body that must not cross'],
    } as unknown as HandoffInitiatorRequest;

    const source = newSource();
    await expect(source.start(overWide)).resolves.toEqual({ ok: true });

    const transfer = transfersOf()[0];
    expect(transfer).toBeDefined();
    expect(Object.keys(transfer.projection).sort()).toEqual(
      [
        'activeRoute',
        'composerDraft',
        'conversationId',
        'requestId',
        'schemaVersion',
        'sourceSurface',
        'targetSurface',
        'workspaceId',
      ].sort(),
    );
    const serialised = JSON.stringify(transfer);
    expect(serialised).not.toContain(SENTINEL);
    expect(serialised).not.toContain('workspaceState');
    expect(serialised).not.toContain('message body');
    source.dispose();
  });

  it('D2-31.10 composer-draft transfer — the draft rides the projection, lands consume-once and never the URL', async () => {
    const draft = 'DRAFT-TOKEN-9931 handed over to the composer';
    const source = newSource();
    await expect(source.start(request({ composerDraft: draft }))).resolves.toEqual({ ok: true });

    expect(harness.standalone.url).not.toContain('DRAFT-TOKEN-9931');
    expect(harness.standalone.url).not.toContain('composerDraft');
    expect(transfersOf()[0]?.projection.composerDraft).toBe(draft);
    expect(harness.draft()).toBe(draft);

    // Consume-once (WR-09): the slot clears in the same step it is read.
    expect(useHandoffComposerDraftStore.getState().consumeDraft()).toBe(draft);
    expect(harness.draft()).toBe('');

    // A draft beyond the projection bound fails the strict schema on receipt.
    expect(
      validateHandoffEnvelope({
        type: 'WORKSPACE_HANDOFF',
        requestId: 'req-overlong',
        schemaVersion: HANDOFF_SCHEMA_VERSION,
        projection: projectionFor('req-overlong', {
          composerDraft: 'x'.repeat(HANDOFF_DRAFT_MAX_CHARS + 1),
        }),
      }).ok,
    ).toBe(false);
    source.dispose();
  });

  it('D2-31.11 no complete WorkspaceState broadcast — no envelope carries a state object and the real validator rejects one', async () => {
    const source = newSource();
    await expect(source.start(request())).resolves.toEqual({ ok: true });

    const serialised = JSON.stringify(harness.transport.published());
    for (const field of WORKSPACE_STATE_ONLY_FIELDS) {
      expect(serialised).not.toContain(`"${field}"`);
    }
    for (const envelope of harness.transport.published()) {
      expect(validateHandoffEnvelope(envelope).ok).toBe(true);
    }

    // A transfer carrying the whole state fails the strict projection schema…
    const smuggled = {
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-smuggled',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: { ...projectionFor('req-smuggled'), workspaceState: createInitialWorkspaceState() },
    };
    expect(validateHandoffEnvelope(smuggled).ok).toBe(false);

    // …and the running target ignores it: nothing new is applied or acked.
    const appliedBefore = harness.standalone.appliedCount();
    harness.transport.reset();
    harness.transport.publish(smuggled as unknown as HandoffEnvelope);
    await flush();
    expect(harness.standalone.appliedCount()).toBe(appliedBefore);
    expect(acksOf()).toHaveLength(0);
    source.dispose();
  });

  it('D2-31.12 no credential or secret in URL, envelope, message, journal or log — the sentinel never crosses', async () => {
    harness.credentials.store(SENTINEL);
    expect(harness.credentials.read()).toBe(SENTINEL);

    const overWide = {
      ...request(),
      apiKey: SENTINEL,
      credential: SENTINEL,
    } as unknown as HandoffInitiatorRequest;
    const source = newSource();
    await expect(source.start(overWide)).resolves.toEqual({ ok: true });

    // A real journaled workspace write on the same path, and a real error record
    // whose context carries the sentinel under a sensitive field name.
    const current = await readWorkspaceState();
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    const written = await writeWorkspaceState(
      {
        ...current.value,
        workspaceId: harness.workspaceId,
        version: current.value.version + 1,
        updatedAt: harness.now(),
      },
      { now: () => harness.now() },
    );
    expect(written.ok).toBe(true);
    await harness.advanceDebounce();
    await harness.db.recordError({ code: 'WORKSPACE_WRITE_FAILED', context: { apiKey: SENTINEL } });

    const scanned: Record<string, string> = {
      url: harness.standalone.url ?? '',
      envelopes: JSON.stringify(harness.transport.published()),
      journal: JSON.stringify(await harness.db.journalEntries()),
      errors: JSON.stringify(await harness.db.listErrors()),
      logs: JSON.stringify(harness.logs()),
      storage: harness.storage.serialised(),
    };
    for (const [surface, value] of Object.entries(scanned)) {
      expect(`${surface}:${value}`).not.toContain(SENTINEL);
    }

    // Positive controls: the stand-in still holds the sentinel, the stand-in
    // refuses a non-synthetic value, and the scan is not vacuous.
    expect(harness.credentials.read()).toBe(SENTINEL);
    expect(() => harness.credentials.store('sk-live-real-credential')).toThrow();
    expect(`planted:${SENTINEL}`).toContain(SENTINEL);
    source.dispose();
  });

  it('D2-31.13 timeout behaviour — a silent target fails on the harness clock and never claims success', async () => {
    const source = newSource({ openTarget: async () => {} });
    const started = source.start(request());
    await flush();

    // Nothing has settled and nothing was transferred: the wait is on the clock.
    expect(await isSettled(started)).toBe(false);
    expect(transfersOf()).toHaveLength(0);

    await harness.advanceMs(HANDOFF_TIMEOUT_MS);
    await expect(started).resolves.toMatchObject({ ok: false, code: 'WORKSPACE_HANDOFF_FAILED' });
    expect(transfersOf()).toHaveLength(0);

    // A ready target that never acknowledges exhausts the same bounded wait.
    const silent = newSource();
    harness.transport.dropNext('HANDOFF_ACK', 1 + HANDOFF_MAX_RETRIES);
    const silentStarted = silent.start(request());
    await flush();
    expect(await isSettled(silentStarted)).toBe(false);
    await harness.advanceMs(HANDOFF_TIMEOUT_MS * (1 + HANDOFF_MAX_RETRIES));
    await flush();
    await expect(silentStarted).resolves.toMatchObject({
      ok: false,
      code: 'WORKSPACE_HANDOFF_FAILED',
    });
    source.dispose();
    silent.dispose();
  });

  it('D2-31.14 bounded retry — the attempt count is bounded and a late acknowledgement cannot resurrect success', async () => {
    const source = newSource();
    harness.transport.dropNext('HANDOFF_ACK', 1 + HANDOFF_MAX_RETRIES);
    const started = source.start(request());
    await flush();

    for (let attempt = 0; attempt <= HANDOFF_MAX_RETRIES; attempt += 1) {
      expect(transfersOf()).toHaveLength(attempt + 1);
      await harness.advanceMs(HANDOFF_TIMEOUT_MS);
    }
    await expect(started).resolves.toMatchObject({ ok: false, code: 'WORKSPACE_HANDOFF_FAILED' });
    expect(transfersOf()).toHaveLength(1 + HANDOFF_MAX_RETRIES);

    // A late acknowledgement after the budget is exhausted changes nothing.
    harness.transport.publish({
      type: 'HANDOFF_ACK',
      requestId: source.requestId,
      appliedSchemaVersion: HANDOFF_SCHEMA_VERSION,
      result: { ok: true },
    });
    await flush();
    await expect(started).resolves.toMatchObject({ ok: false, code: 'WORKSPACE_HANDOFF_FAILED' });
    expect(harness.standalone.appliedCount()).toBe(1);
    source.dispose();
  });

  it('D2-31.15 rejection of an invalid source or target — forged surfaces fail the real URL and envelope validators', async () => {
    const badSource = parseHandoffUrl(
      'standalone.html?workspaceId=ws-1&requestId=r&schemaVersion=1&source=popup',
    );
    const badTarget = parseHandoffUrl(
      'standalone.html?workspaceId=ws-1&requestId=r&schemaVersion=1&target=options.html',
    );
    expect(badSource.ok).toBe(false);
    expect(badTarget.ok).toBe(false);

    harness.bringUpStandalone('req-forged');
    harness.transport.reset();

    const forgedSource = {
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-forged',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: { ...projectionFor('req-forged'), sourceSurface: 'popup' },
    };
    const forgedTarget = {
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-forged',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: { ...projectionFor('req-forged'), targetSurface: 'options.html' },
    };
    expect(validateHandoffEnvelope(forgedSource).ok).toBe(false);
    expect(validateHandoffEnvelope(forgedTarget).ok).toBe(false);

    harness.transport.publish(forgedSource as unknown as HandoffEnvelope);
    harness.transport.publish(forgedTarget as unknown as HandoffEnvelope);
    await flush();
    expect(harness.standalone.appliedCount()).toBe(0);
    expect(acksOf()).toHaveLength(0);

    // A schema-valid projection for the wrong target surface is ignored by the
    // target's own bootstrap identity check.
    harness.transport.publish({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-forged',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: { ...projectionFor('req-forged'), targetSurface: 'sidepanel' },
    });
    await flush();
    expect(harness.standalone.appliedCount()).toBe(0);
    expect(acksOf()).toHaveLength(0);
  });

  it('D2-31.16 rejection of an unsupported schema version — a future version is refused by both validators', async () => {
    const future = HANDOFF_SCHEMA_VERSION + 98;
    const parsed = parseHandoffUrl(
      `standalone.html?workspaceId=ws-1&requestId=r&schemaVersion=${future}`,
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe('unsupported_schema_version');

    harness.bringUpStandalone('req-future');
    harness.transport.reset();

    const futureTransfer = {
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-future',
      schemaVersion: future,
      projection: { ...projectionFor('req-future'), schemaVersion: future },
    };
    const futureReady = {
      type: 'HANDOFF_READY',
      requestId: 'req-future',
      workspaceId: harness.workspaceId,
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
      supportedSchemaVersion: future,
    };
    expect(validateHandoffEnvelope(futureTransfer).ok).toBe(false);
    expect(validateHandoffEnvelope(futureReady).ok).toBe(false);

    harness.transport.publish(futureTransfer as unknown as HandoffEnvelope);
    harness.transport.publish(futureReady as unknown as HandoffEnvelope);
    await flush();
    expect(harness.standalone.appliedCount()).toBe(0);
    expect(acksOf()).toHaveLength(0);
  });

  it('D2-31.17 persistence and authoritative read-back — the transferred state persists journaled and reads back', async () => {
    const source = newSource();
    await expect(source.start(request())).resolves.toEqual({ ok: true });

    const current = await readWorkspaceState();
    expect(current.ok).toBe(true);
    if (!current.ok) return;

    const transferred = {
      ...current.value,
      workspaceId: harness.workspaceId,
      conversationId: 'conv-transferred',
      activeSurface: 'standalone' as const,
      version: current.value.version + 1,
      updatedAt: harness.now(),
    };
    const written = await writeWorkspaceState(transferred, { now: () => harness.now() });
    expect(written.ok).toBe(true);
    await harness.advanceDebounce();

    // Authoritative read-back through the real repository.
    const readBack = await readWorkspaceState();
    expect(readBack.ok).toBe(true);
    if (!readBack.ok) return;
    expect(readBack.value).toEqual(transferred);
    expect(harness.storage.local().has(WORKSPACE_STORAGE_KEY)).toBe(true);

    // §20.3's order, journaled: the entry is completed with both stages.
    const entry = (await harness.db.journalEntries()).find(
      (candidate) => candidate.id === `${harness.workspaceId}:${transferred.version}`,
    );
    expect(entry?.operation).toBe('update-workspace');
    expect(entry?.status).toBe('completed');
    expect(entry?.steps.map((step) => step.status)).toEqual(['completed', 'completed']);
    source.dispose();
  });

  it('D2-31.18 crash between handoff stages — a lost acknowledgement leaves durable state consistent and the retry completes', async () => {
    const source = newSource();

    await harness.crashDuring('ack', async () => {
      const started = source.start(request());
      await flush();

      // The document died after applying the projection and before its
      // acknowledgement left it: the source is still waiting.
      expect(harness.standalone.appliedCount()).toBe(1);
      expect(await isSettled(started)).toBe(false);

      // Once the crash has passed, the retry's acknowledgement completes the
      // handoff — and the duplicate transfer is not applied a second time.
      await harness.advanceMs(HANDOFF_TIMEOUT_MS);
      await expect(started).resolves.toEqual({ ok: true });
    });

    expect(transfersOf()).toHaveLength(2);
    expect(harness.standalone.appliedCount()).toBe(1);
    expect(harness.standalone.appliedRequestIds()).toEqual([source.requestId]);
    expect(harness.draft()).toBe('a handed-over draft');
    source.dispose();
  });

  it('D2-31.19 reload and recovery — a reloaded document rebuilds from durable storage and the next handoff still completes', async () => {
    const first = newSource();
    await expect(first.start(request())).resolves.toEqual({ ok: true });

    const current = await readWorkspaceState();
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    const written = await writeWorkspaceState(
      {
        ...current.value,
        workspaceId: harness.workspaceId,
        conversationId: 'conv-recovered',
        version: current.value.version + 1,
        updatedAt: harness.now(),
      },
      { now: () => harness.now() },
    );
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    await harness.advanceDebounce();

    const tabId = harness.standalone.tabId;
    await harness.restartSurface('standalone');

    // Same identity, rebuilt in-memory state, durable copy recovered.
    expect(harness.standalone.tabId).toBe(tabId);
    expect(harness.standalone.workspace().conversationId).toBe('conv-recovered');
    expect(harness.standalone.workspace().version).toBe(written.value.version);

    harness.transport.reset();
    const second = newSource();
    await expect(second.start(request())).resolves.toEqual({ ok: true });
    expect(harness.tabs.list()).toHaveLength(1);
    expect(harness.standalone.appliedRequestIds()).toContain(second.requestId);
    first.dispose();
    second.dispose();
  });

  it('D2-31.20 failure preserving the original writer — a failed handoff leaves authority with the original writer', async () => {
    expect((await harness.sidepanel.elect()).kind).toBe('primary');
    await harness.advanceMs(1);
    expect((await harness.standalone.elect()).kind).toBe('secondary');
    expect((await harness.sidepanel.assertStillPrimary()).ok).toBe(true);
    expect((await harness.standalone.assertStillPrimary()).ok).toBe(false);

    // A handoff whose target never announces readiness.
    const source = newSource({ openTarget: async () => {} });
    const started = source.start(request());
    await flush();
    await harness.advanceMs(HANDOFF_TIMEOUT_MS);
    await expect(started).resolves.toMatchObject({ ok: false, code: 'WORKSPACE_HANDOFF_FAILED' });

    // Authority did not move: the original writer still passes the gate, the
    // target still fails it, and the durable record still names the source.
    expect((await harness.sidepanel.assertStillPrimary()).ok).toBe(true);
    expect((await harness.standalone.assertStillPrimary()).ok).toBe(false);
    expect(harness.sidepanel.writer().writerState).toBe('primary');
    expect(harness.standalone.writer().writerState).toBe('mirror');
    expect(harness.storage.session().get(PRIMARY_RECORD_KEY)).toMatchObject({
      surface: 'sidepanel',
      tabId: harness.sidepanel.tabId,
    });
    source.dispose();
  });

  it('D2-31.21 stale-writer rejection after the election becomes authoritative — the superseded surface cannot write', async () => {
    expect((await harness.sidepanel.elect()).kind).toBe('primary');
    const sidepanelEpoch = harness.sidepanel.writer().writerEpoch;
    expect(sidepanelEpoch).not.toBeNull();

    // The Side Panel stops heartbeating; past two intervals its record is stale
    // and the Standalone takes authority through the real election.
    await harness.advanceHeartbeat(3);
    expect((await harness.standalone.elect()).kind).toBe('primary');
    expect((await harness.standalone.assertStillPrimary()).ok).toBe(true);

    const rejected = await harness.sidepanel.assertStillPrimary();
    expect(rejected).toEqual({ ok: false, code: 'WORKSPACE_WRITER_REJECTED' });
    expect(harness.sidepanel.writer().writerState).toBe('mirror');
    expect(harness.standalone.writer().writerState).toBe('primary');

    const record = harness.storage.session().get(PRIMARY_RECORD_KEY) as {
      surface: string;
      tabId: number;
      electedAt: number;
    };
    expect(record.surface).toBe('standalone');
    expect(record.electedAt).toBeGreaterThan(sidepanelEpoch ?? -1);
  });

  it('D2-31.22 traceability — the suite declares exactly one named case per D2-31 clause', async () => {
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const titles = [...source.matchAll(/\bit\(\s*'([^']+)'/g)].map((match) => match[1]);

    // Exactly one clause-named case per clause, and no duplicate case names.
    expect(titles.filter((title) => title.startsWith('D2-31.'))).toHaveLength(22);
    expect(new Set(titles).size).toBe(titles.length);

    const clauses = new Set<string>();
    for (const row of CLAUSE_MAP) {
      expect(clauses.has(row.clause)).toBe(false);
      clauses.add(row.clause);
      // The cited case name exists in this file — the mapping is mechanical.
      expect(titles).toContain(row.test);
    }
    expect(clauses.size).toBe(22);
    expect(new Set(CLAUSE_MAP.map((row) => row.test)).size).toBe(22);
  });
});

describe('Suite A — chat identity through the real ChatHistoryDB contract (D2-33)', () => {
  it('chat identity — minimal synthetic records persist across a restart, resolve by reference and never ride the handoff envelope', async () => {
    const session: ChatSessionRecord = {
      id: 'conv-synthetic-1',
      title: 'Synthetic conversation',
      created: 1_700_000_000_000,
      updated: 1_700_000_000_001,
      starred: false,
    };
    const messages: MessageRecord[] = [
      {
        sessionId: session.id,
        seq: 0,
        id: 'msg-0',
        role: 'user',
        content: 'synthetic body one',
        timestamp: 1_700_000_000_000,
      },
      {
        sessionId: session.id,
        seq: 1,
        id: 'msg-1',
        role: 'assistant',
        content: 'synthetic body two',
        timestamp: 1_700_000_000_001,
      },
    ];
    const written = await harness.db.writeConversation(session, messages);
    expect(written.ok).toBe(true);

    // Authoritative read-back through the real repository.
    const readBack = await harness.db.readConversation(session.id);
    expect(readBack.ok).toBe(true);
    if (!readBack.ok) return;
    expect(readBack.messages.map((message) => message.id)).toEqual(['msg-0', 'msg-1']);
    expect(await harness.db.readAllConversations()).toMatchObject({ ok: true, invalidIds: [] });

    // Persistence survives a restart of the surface document.
    await harness.restartSurface('standalone');
    expect((await harness.db.readConversation(session.id)).ok).toBe(true);

    // A handoff referencing the conversation carries the identifier and no body.
    const source = newSource();
    await expect(source.start(request({ conversationId: session.id }))).resolves.toEqual({ ok: true });
    const transfer = transfersOf()[0];
    expect(transfer?.projection.conversationId).toBe(session.id);
    const serialised = JSON.stringify(transfer);
    expect(serialised).not.toContain('synthetic body one');
    expect(serialised).not.toContain('synthetic body two');

    // The production read path is the database: no legacy `np_store` copy exists.
    expect(harness.storage.local().has('np_store')).toBe(false);
    source.dispose();
  });
});
