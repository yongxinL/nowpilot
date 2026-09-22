import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as BroadcastBus from '../../../src/core/runtime/BroadcastBus';
import {
  HANDOFF_CHANNEL,
  HANDOFF_SCHEMA_VERSION,
  HANDOFF_TIMEOUT_MS,
  HANDOFF_MAX_RETRIES,
  HANDOFF_MAX_VALUE_CHARS,
  buildHandoffUrl,
  parseHandoffUrl,
  validateHandoffEnvelope,
  createHandoffInitiator,
  createHandoffTarget,
  handoffTransport,
  type HandoffEnvelope,
  type HandoffInitiatorRequest,
  type HandoffTransport,
} from '../../../src/core/workspace/handoff/protocol';

/**
 * Task 2 (01-07) — the ready → transfer → acknowledgement protocol, its URL
 * bootstrap and its projection allowlist (D-13, OQ6).
 *
 * Outbound messages are observed through a `BroadcastBus.publish` spy; inbound
 * messages are driven through the `__broadcast` helper `tests/setup.ts`
 * installs, which is how a real anti-clockwise message would arrive.
 */

const CHANNEL = HANDOFF_CHANNEL;
const SECRET_SENTINEL = 'sk-live-SENTINEL-do-not-publish';

const broadcast = (payload: unknown): void => {
  (globalThis as unknown as { __broadcast: (channel: string, data: unknown) => void }).__broadcast(
    CHANNEL,
    payload,
  );
};

const request = (overrides: Partial<HandoffInitiatorRequest> = {}): HandoffInitiatorRequest => ({
  workspaceId: 'ws-1',
  conversationId: 'conv-1',
  page: 'chat',
  composerDraft: 'hello there',
  sourceSurface: 'sidepanel',
  targetSurface: 'standalone',
  ...overrides,
});

const readyEnvelope = (requestId: string, overrides: Record<string, unknown> = {}) => ({
  type: 'HANDOFF_READY',
  requestId,
  workspaceId: 'ws-1',
  sourceSurface: 'sidepanel',
  targetSurface: 'standalone',
  supportedSchemaVersion: HANDOFF_SCHEMA_VERSION,
  ...overrides,
});

const ackEnvelope = (
  requestId: string,
  result: Record<string, unknown> = { ok: true },
) => ({
  type: 'HANDOFF_ACK',
  requestId,
  appliedSchemaVersion: HANDOFF_SCHEMA_VERSION,
  result,
});

const projection = (requestId: string, overrides: Record<string, unknown> = {}) => ({
  workspaceId: 'ws-1',
  conversationId: 'conv-1',
  sourceSurface: 'sidepanel',
  targetSurface: 'standalone',
  activeRoute: 'chat',
  composerDraft: 'hello there',
  requestId,
  schemaVersion: HANDOFF_SCHEMA_VERSION,
  ...overrides,
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

function publishedOf(spy: ReturnType<typeof vi.spyOn>, type: string): HandoffEnvelope[] {
  return spy.mock.calls
    .filter(
      ([channel, payload]) =>
        channel === CHANNEL &&
        typeof payload === 'object' &&
        payload !== null &&
        (payload as { type?: string }).type === type,
    )
    .map(([, payload]) => payload as HandoffEnvelope);
}

describe('handoff protocol — named constants (A10 / H-9)', () => {
  it('exports the pinned schema version, timeout and bounded retry budget', () => {
    expect(Number.isInteger(HANDOFF_SCHEMA_VERSION)).toBe(true);
    expect(HANDOFF_TIMEOUT_MS).toBe(3000);
    expect(HANDOFF_MAX_RETRIES).toBe(2);
    // Total attempts = the first attempt plus HANDOFF_MAX_RETRIES retries.
    expect(1 + HANDOFF_MAX_RETRIES).toBe(3);
    expect(HANDOFF_MAX_RETRIES).toBeLessThanOrEqual(3);
  });
});

describe('handoff URL bootstrap (D-13 / T-1-31)', () => {
  it('buildHandoffUrl produces exactly the allowed bootstrap parameter set', () => {
    const url = buildHandoffUrl({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      route: 'chat',
      requestId: 'req-1',
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
    });

    expect(url.startsWith('standalone.html?')).toBe(true);
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect([...params.keys()].sort()).toEqual(
      ['conversationId', 'requestId', 'schemaVersion', 'page', 'source', 'target', 'workspaceId'].sort(),
    );
    expect(params.get('workspaceId')).toBe('ws-1');
    expect(params.get('conversationId')).toBe('conv-1');
    expect(params.get('page')).toBe('chat');
    expect(params.get('requestId')).toBe('req-1');
    expect(params.get('schemaVersion')).toBe(String(HANDOFF_SCHEMA_VERSION));
  });

  it('buildHandoffUrl never emits a draft, a message body or a credential from an over-wide input', () => {
    const overWide = {
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      route: 'chat',
      requestId: 'req-1',
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
      composerDraft: 'a private draft',
      apiKey: SECRET_SENTINEL,
      messageHistory: ['secret message'],
    } as unknown as Parameters<typeof buildHandoffUrl>[0];

    const url = buildHandoffUrl(overWide);

    expect(url).not.toContain('a private draft');
    expect(url).not.toContain(SECRET_SENTINEL);
    expect(url).not.toContain('secret message');
    expect(url).not.toContain('composerDraft');
    expect(url).not.toContain('apiKey');
  });

  it('parseHandoffUrl accepts a well-formed handoff URL and normalises its values', () => {
    const parsed = parseHandoffUrl(
      'standalone.html?workspaceId=ws-1&conversationId=conv-1&page=chat&requestId=req-1&schemaVersion=1&source=sidepanel&target=standalone',
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.value === null) return;
    expect(parsed.value).toEqual({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      page: 'chat',
      requestId: 'req-1',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
    });
  });

  it('treats an empty or absent conversationId as null and a direct open as no bootstrap', () => {
    const emptyConversation = parseHandoffUrl(
      new URLSearchParams('workspaceId=ws-1&conversationId=&requestId=req-1&schemaVersion=1'),
    );
    expect(emptyConversation.ok).toBe(true);
    if (emptyConversation.ok && emptyConversation.value) {
      expect(emptyConversation.value.conversationId).toBeNull();
    }

    const directOpen = parseHandoffUrl(new URLSearchParams('page=chat'));
    expect(directOpen).toEqual({ ok: true, value: null });
  });

  it('rejects an unknown parameter with its own typed code and never throws', () => {
    const search = `workspaceId=ws-1&requestId=req-1&schemaVersion=1&token=${SECRET_SENTINEL}`;

    expect(() => parseHandoffUrl(search)).not.toThrow();
    const parsed = parseHandoffUrl(search);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('unknown_parameter');
  });

  it('rejects a malformed identifier', () => {
    const parsed = parseHandoffUrl('workspaceId=&requestId=req-1&schemaVersion=1');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('malformed_parameter');
  });

  it('rejects an oversized value rather than truncating it', () => {
    const oversized = 'w'.repeat(HANDOFF_MAX_VALUE_CHARS + 1);
    const parsed = parseHandoffUrl(
      new URLSearchParams({ workspaceId: oversized, requestId: 'req-1', schemaVersion: '1' }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('oversized_parameter');
  });

  it('rejects an unsupported schema version', () => {
    const parsed = parseHandoffUrl('workspaceId=ws-1&requestId=req-1&schemaVersion=99');

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('unsupported_schema_version');
  });

  it('rejects a URL whose declared source or target surface is not canonical', () => {
    const badSource = parseHandoffUrl(
      'workspaceId=ws-1&requestId=req-1&schemaVersion=1&source=popup',
    );
    const badTarget = parseHandoffUrl(
      'workspaceId=ws-1&requestId=req-1&schemaVersion=1&target=options.html',
    );

    for (const parsed of [badSource, badTarget]) {
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.code).toBe('invalid_surface');
    }
  });
});

describe('handoff envelope and projection validation (T-1-30, T-1-32)', () => {
  it('rejects a projection that carries the complete workspace state object', () => {
    const validated = validateHandoffEnvelope({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-1',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-1', {
        workspaceState: { activeProvider: 'openai', hiddenReasoning: 'x' },
      }),
    });

    expect(validated.ok).toBe(false);
  });

  it('rejects an unknown extra field in the projection and in the envelope', () => {
    const extraProjection = validateHandoffEnvelope({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-1',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-1', { surprise: 1 }),
    });
    const extraEnvelope = validateHandoffEnvelope({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-1',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-1'),
      surprise: 1,
    });

    expect(extraProjection.ok).toBe(false);
    expect(extraEnvelope.ok).toBe(false);
  });

  it('rejects a non-object and an unknown envelope type with distinct codes', () => {
    expect(validateHandoffEnvelope(null)).toEqual({ ok: false, code: 'not_an_object' });
    expect(validateHandoffEnvelope('WORKSPACE_HANDOFF')).toEqual({ ok: false, code: 'not_an_object' });

    const unknownType = validateHandoffEnvelope({ type: 'STANDALONE_OPEN' });
    expect(unknownType.ok).toBe(false);
    if (unknownType.ok) return;
    expect(unknownType.code).toBe('unknown_type');
  });

  it('accepts a strict ready envelope and a strict acknowledgement envelope', () => {
    expect(validateHandoffEnvelope(readyEnvelope('req-1')).ok).toBe(true);
    expect(validateHandoffEnvelope(ackEnvelope('req-1')).ok).toBe(true);
    expect(validateHandoffEnvelope(ackEnvelope('req-1', { ok: false, code: 'WORKSPACE_HANDOFF_FAILED', error: 'nope' })).ok).toBe(true);
  });
});

describe('handoff initiator — cold start, ordering and correlation (D-13)', () => {
  let publishSpy: ReturnType<typeof vi.spyOn>;
  const controllers: { dispose: () => void }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    publishSpy = vi.spyOn(BroadcastBus, 'publish');
    controllers.length = 0;
  });

  afterEach(() => {
    controllers.forEach((controller) => controller.dispose());
    publishSpy.mockRestore();
    vi.useRealTimers();
  });

  it('cold start: publishes the transfer only after a matching ready arrives', async () => {
    let releaseOpen: () => void = () => {};
    const opened = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseOpen = resolve;
        }),
    );
    const controller = createHandoffInitiator({ openTarget: opened, requestId: 'req-cold' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();

    // The cold tab announces readiness before the tab creation callback runs.
    broadcast(readyEnvelope('req-cold'));
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(0);

    releaseOpen();
    await flush();

    const transfers = publishedOf(publishSpy, 'WORKSPACE_HANDOFF');
    expect(transfers).toHaveLength(1);
    expect(opened).toHaveBeenCalledWith({ requestId: 'req-cold', workspaceId: 'ws-1', page: 'chat' });

    broadcast(ackEnvelope('req-cold'));
    await expect(started).resolves.toEqual({ ok: true });
  });

  it('ignores a ready whose requestId does not match the outstanding request', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-mine' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();

    broadcast(readyEnvelope('req-someone-else'));
    await flush();
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(0);

    broadcast(readyEnvelope('req-mine'));
    await flush();
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(1);

    broadcast(ackEnvelope('req-mine'));
    await expect(started).resolves.toEqual({ ok: true });
  });

  it('applies a duplicate ready at most once (a second ready starts no second transfer)', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-dup' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();

    broadcast(readyEnvelope('req-dup'));
    broadcast(readyEnvelope('req-dup'));
    await flush();

    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(1);
    broadcast(ackEnvelope('req-dup'));
    await expect(started).resolves.toEqual({ ok: true });
  });

  it('discards an acknowledgement whose requestId does not match', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-ack' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();
    broadcast(readyEnvelope('req-ack'));
    await flush();

    broadcast(ackEnvelope('req-other'));
    await flush();

    broadcast(ackEnvelope('req-ack'));
    await expect(started).resolves.toEqual({ ok: true });
  });

  it('returns a typed failure when the acknowledgement carries a failure code', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-fail' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();
    broadcast(readyEnvelope('req-fail'));
    await flush();

    broadcast(
      ackEnvelope('req-fail', {
        ok: false,
        code: 'WORKSPACE_HANDOFF_FAILED',
        error: 'Standalone could not apply the workspace',
      }),
    );

    await expect(started).resolves.toEqual({
      ok: false,
      code: 'WORKSPACE_HANDOFF_FAILED',
      error: 'Standalone could not apply the workspace',
    });
    // A definitive failure is not retried.
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(1);
  });

  it('retries the transfer after the timeout and resolves on a later acknowledgement', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-retry' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();
    broadcast(readyEnvelope('req-retry'));
    await flush();

    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
    await flush();
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(2);

    broadcast(ackEnvelope('req-retry'));
    await expect(started).resolves.toEqual({ ok: true });

    // At most one extra attempt is made after a late acknowledgement.
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(2);
  });

  it('fails after a bounded number of attempts when no acknowledgement ever arrives', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-none' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();
    broadcast(readyEnvelope('req-none'));
    await flush();

    for (let i = 0; i <= HANDOFF_MAX_RETRIES; i += 1) {
      await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
      await flush();
    }

    await expect(started).resolves.toMatchObject({ ok: false, code: 'WORKSPACE_HANDOFF_FAILED' });
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(1 + HANDOFF_MAX_RETRIES);
  });

  it('never claims success when readiness never arrives', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-noready' });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();
    await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
    await flush();

    await expect(started).resolves.toMatchObject({ ok: false, code: 'WORKSPACE_HANDOFF_FAILED' });
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(0);
  });

  it('reports STANDALONE_OPEN_FAILED and publishes nothing when the target cannot be opened', async () => {
    const controller = createHandoffInitiator({
      openTarget: async () => {
        throw new Error('fake query error');
      },
      requestId: 'req-nav',
    });
    controllers.push(controller);

    const started = controller.start(request());
    await flush();

    await expect(started).resolves.toEqual({
      ok: false,
      code: 'STANDALONE_OPEN_FAILED',
      error: 'fake query error',
    });
    expect(publishedOf(publishSpy, 'WORKSPACE_HANDOFF')).toHaveLength(0);
  });

  it('publishes exactly the projection allowlist and never a credential', async () => {
    const overWide = {
      ...request(),
      apiKey: SECRET_SENTINEL,
      workspaceState: { activeProvider: 'openai' },
    } as HandoffInitiatorRequest;

    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-allow' });
    controllers.push(controller);

    const started = controller.start(overWide);
    await flush();
    broadcast(readyEnvelope('req-allow'));
    await flush();

    const transfer = publishedOf(publishSpy, 'WORKSPACE_HANDOFF')[0] as Extract<
      HandoffEnvelope,
      { type: 'WORKSPACE_HANDOFF' }
    >;
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
    expect(JSON.stringify(transfer)).not.toContain(SECRET_SENTINEL);
    expect(JSON.stringify(transfer)).not.toContain('workspaceState');

    broadcast(ackEnvelope('req-allow'));
    await expect(started).resolves.toEqual({ ok: true });
  });

  it('treats an absent composer draft as an empty draft, never undefined', async () => {
    const controller = createHandoffInitiator({ openTarget: async () => {}, requestId: 'req-draft' });
    controllers.push(controller);

    const started = controller.start({ ...request(), composerDraft: undefined });
    await flush();
    broadcast(readyEnvelope('req-draft'));
    await flush();

    const transfer = publishedOf(publishSpy, 'WORKSPACE_HANDOFF')[0] as Extract<
      HandoffEnvelope,
      { type: 'WORKSPACE_HANDOFF' }
    >;
    expect(transfer.projection.composerDraft).toBe('');

    broadcast(ackEnvelope('req-draft'));
    await expect(started).resolves.toEqual({ ok: true });
  });
});

describe('handoff target — readiness, idempotent apply and acknowledgement (D-13)', () => {
  let publishSpy: ReturnType<typeof vi.spyOn>;
  const controllers: { dispose: () => void }[] = [];

  afterEach(() => {
    controllers.forEach((controller) => controller.dispose());
    publishSpy?.mockRestore();
  });

  beforeEach(() => {
    publishSpy = vi.spyOn(BroadcastBus, 'publish');
    controllers.length = 0;
  });

  const bootstrap = {
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    page: 'chat',
    requestId: 'req-target',
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    sourceSurface: 'sidepanel' as const,
    targetSurface: 'standalone' as const,
  };

  it('announces readiness on start and applies a matching projection exactly once', () => {
    const apply = vi.fn();
    const target = createHandoffTarget({ bootstrap, apply });
    controllers.push(target);

    target.start();

    const ready = publishedOf(publishSpy, 'HANDOFF_READY')[0];
    expect(ready).toMatchObject({
      requestId: 'req-target',
      workspaceId: 'ws-1',
      targetSurface: 'standalone',
      supportedSchemaVersion: HANDOFF_SCHEMA_VERSION,
    });

    broadcast({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-target',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-target'),
    });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(projection('req-target'));
    expect(publishedOf(publishSpy, 'HANDOFF_ACK')).toHaveLength(1);
    expect(target.appliedRequestIds()).toEqual(['req-target']);
  });

  it('ignores a projection for a different workspace or an unmatched request id', () => {
    const apply = vi.fn();
    const target = createHandoffTarget({ bootstrap, apply });
    controllers.push(target);
    target.start();

    broadcast({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-target',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-target', { workspaceId: 'ws-someone-else' }),
    });
    broadcast({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-other',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-other'),
    });

    expect(apply).not.toHaveBeenCalled();
    expect(publishedOf(publishSpy, 'HANDOFF_ACK')).toHaveLength(0);
  });

  it('does not apply a duplicate transfer twice but still acknowledges it', () => {
    const apply = vi.fn();
    const target = createHandoffTarget({ bootstrap, apply });
    controllers.push(target);
    target.start();

    const transfer = {
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-target',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-target'),
    };
    broadcast(transfer);
    broadcast(transfer);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(publishedOf(publishSpy, 'HANDOFF_ACK')).toHaveLength(2);
    expect(target.appliedRequestIds()).toEqual(['req-target']);
  });

  it('acknowledges a typed failure instead of throwing when the apply adapter rejects', () => {
    const target = createHandoffTarget({
      bootstrap,
      apply: () => {
        throw new Error('apply exploded');
      },
    });
    controllers.push(target);
    target.start();

    broadcast({
      type: 'WORKSPACE_HANDOFF',
      requestId: 'req-target',
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      projection: projection('req-target'),
    });

    const acks = publishedOf(publishSpy, 'HANDOFF_ACK');
    expect(acks).toHaveLength(1);
    expect(acks[0]).toMatchObject({ result: { ok: false, code: 'WORKSPACE_HANDOFF_FAILED' } });
  });

  it('announces nothing when the URL carried no handoff request id', () => {
    const target = createHandoffTarget({
      bootstrap: { ...bootstrap, requestId: null },
      apply: vi.fn(),
    });
    controllers.push(target);

    target.start();

    expect(publishedOf(publishSpy, 'HANDOFF_READY')).toHaveLength(0);
  });
});

describe('handoff transport — the real BroadcastBus publish → validate path (CR-02)', () => {
  const controllers: { dispose: () => void }[] = [];

  afterEach(() => {
    controllers.forEach((controller) => controller.dispose());
    controllers.length = 0;
    vi.restoreAllMocks();
  });

  it('completes ready → transfer → acknowledgement through the real bus, with no transport field reaching validation', async () => {
    // `BroadcastChannel` never delivers a message back to the channel object
    // that posted it, so a round trip is only observable across two bus
    // instances — exactly how the two extension documents are wired. The
    // source side therefore gets a second, independent module instance of
    // `BroadcastBus` + `protocol` (tests/setup.ts already models the
    // cross-instance delivery).
    vi.resetModules();
    const sourceSide = await import('../../../src/core/workspace/handoff/protocol');

    // Real delivery is a queued task; the jsdom mock delivers synchronously.
    // Deferring the target's posts by a microtask keeps the source's
    // acknowledgement window open the way the real bus does — the transport
    // implementation is still the real one (`handoffTransport.publish`).
    // `received` records exactly what the real bus handed to the target's
    // listener, so the transport decoration is observable.
    const received: unknown[] = [];
    const observingTargetTransport: HandoffTransport = {
      publish: (envelope) => {
        queueMicrotask(() => handoffTransport.publish(envelope));
      },
      subscribe: (listener) =>
        handoffTransport.subscribe((value) => {
          received.push(value);
          listener(value);
        }),
    };

    const apply = vi.fn();
    const target = createHandoffTarget({
      bootstrap: {
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        page: 'write',
        requestId: 'req-real-bus',
        schemaVersion: HANDOFF_SCHEMA_VERSION,
        sourceSurface: 'sidepanel',
        targetSurface: 'standalone',
      },
      apply,
      transport: observingTargetTransport,
    });
    controllers.push(target);

    const source = createHandoffInitiator({
      openTarget: async () => {},
      requestId: 'req-real-bus',
      transport: sourceSide.handoffTransport,
      timeoutMs: 1000,
    });
    controllers.push(source);

    const started = source.start({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      page: 'write',
      composerDraft: 'a handed-over draft',
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
    });

    target.start();

    await expect(started).resolves.toEqual({ ok: true });

    // The projection crossed the real publish path and was applied.
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        composerDraft: 'a handed-over draft',
      }),
    );

    // What the receiving listener saw is the app-owned envelope: the strict
    // handoff schema accepts it, and the transport's echo-suppression field is
    // not part of it (the CR-02 defect: `_sender` used to reach the `.strict()`
    // schemas and reject every inbound message).
    expect(received).toHaveLength(1);
    expect(validateHandoffEnvelope(received[0]).ok).toBe(true);
    expect(Object.keys(received[0] as Record<string, unknown>)).not.toContain('_sender');
  });
});
