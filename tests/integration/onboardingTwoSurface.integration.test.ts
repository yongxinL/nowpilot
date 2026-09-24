import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { createEnvelope } from '../../src/core/runtime/RuntimeEnvelope';
import { validateEnvelope } from '../../src/core/runtime/RuntimeEnvelopeValidation';
import {
  CREDENTIAL_KEY_PREFIX,
  createKeyVault,
  type InstallSecretReadResult,
  type StorageAreaLike,
} from '../../src/core/security/KeyVault';
import {
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
  readOnboardingState,
  shouldPresentOnboarding,
  shouldPresentOnboardingForWriter,
  subscribeToOnboardingState,
  writeOnboardingState,
  type OnboardingReadResult,
} from '../../src/core/onboarding/onboardingStateStore';
import {
  OnboardingFlow,
  type OnboardingCompletionSelection,
} from '../../src/components/onboarding/OnboardingFlow';
import { createFixtureValidationPort } from '../../src/services/fixtures/providerValidationFixtures';
import { createCredentialStorePort } from '../../src/services/ports/credentialStorePort';
import type { ProviderValidationPort } from '../../src/services/ports/providerValidationPort';
import {
  SYNTHETIC_CREDENTIAL_SENTINEL,
  createTwoSurfaceHarness,
  flush,
  type HarnessSurface,
  type TwoSurfaceHarness,
} from '../harness/twoSurface';

/**
 * Suite B — the WINDOWS #8 two-live-surface onboarding contract (D2-32, plan 02-12).
 *
 * One named case per D2-32 clause, each case naming its clause, so the
 * traceability mapping is mechanical (the traceability case asserts it). The
 * suite drives the **real** onboarding store (`readOnboardingState`,
 * `subscribeToOnboardingState`, `writeOnboardingState`), the **real**
 * writer-gated presentation predicate (`shouldPresentOnboardingForWriter`) and
 * the **real** `OnboardingFlow` component through the shared harness's two
 * simulated surface runtimes, the shared `chrome.storage` areas with their
 * change-event dispatcher, the real fixture validation port, the real journal,
 * `ErrorStore` and `debugLog`; only the environmental boundaries D2-30 lists
 * are faked.
 *
 * The per-surface presentation controller below is the harness-side mirror of
 * `useOnboardingGate` (a React hook cannot be mounted per simulated document in
 * one realm, and the harness deliberately keeps the module-level store
 * singleton out of the two-surface model): it reads the record through the real
 * store, subscribes through the real change-event path, and resolves its gate
 * with the real predicate against that surface's own writer projection. It
 * re-implements no coordination.
 *
 * The surface adapters passed to the flow mirror the entrypoints' own
 * `handleOnboardingComplete` / `handleOnboardingSkip` (both are component-local
 * and not exported): the completion write goes through the real store and
 * persists non-secret fields only.
 *
 * This suite satisfies Phase 2 **automated contract and security coverage
 * only**. It does not close the deferred Real-Chrome WINDOW #8 observation: it
 * claims no observed UI behaviour, and WINDOWS #8 stays `open` for the Phase 15
 * consolidated acceptance cycle.
 */

const SENTINEL = SYNTHETIC_CREDENTIAL_SENTINEL;

/** The canonical non-secret completion-record field set. */
const CANONICAL_RECORD_KEYS = [
  'legacyCleanupNoticeShown',
  'persona',
  'providerId',
  'schemaVersion',
  'uiComplete',
  'validationBacking',
].sort();

/** The four claim strings the flow must never render (§0.2 copy discipline). */
const FORBIDDEN_READINESS_CLAIMS = [
  'Credential stored',
  'Provider connected',
  'Provider validated',
  'Provider ready',
];

/** The install secret the authorised vault adapter injects (synthetic). */
const SYNTHETIC_INSTALL_SECRET = 'aW5zdGFsbC1zZWNyZXQtbWF0ZXJpYWwtMDAwMDAwMDA=';
const HARNESS_EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

/**
 * The clause → named-case mapping (D2-32). One row per clause; the traceability
 * case asserts every `test` value names a case that exists in this file.
 */
const CLAUSE_MAP = [
  {
    clause: 'Standalone-first onboarding state',
    test: 'D2-32.1 Standalone-first onboarding state — the Standalone opened first is the surface that presents the flow',
  },
  {
    clause: 'Side Panel joining while onboarding is active',
    test: 'D2-32.2 the Side Panel joining while onboarding is active — the joining surface renders the mirrored state and starts no competing flow',
  },
  {
    clause: 'exactly one authoritative onboarding attempt',
    test: 'D2-32.3 exactly one authoritative onboarding attempt — presentations counted across both surfaces total exactly one',
  },
  {
    clause: 'no competing flow controller',
    test: 'D2-32.4 no competing flow controller — a mirror claims nothing and concurrent presentations never exceed one',
  },
  {
    clause: 'non-secret completion-state persistence',
    test: 'D2-32.5 non-secret completion-state persistence — the completion write stores the canonical record and no credential field',
  },
  {
    clause: 'completion in one surface updating the other',
    test: 'D2-32.6 completion in one surface updating the other — the joining surface flips through the change event and stays hidden as the next writer',
  },
  {
    clause: 'update without a page reload',
    test: 'D2-32.7 update without a page reload — the update arrives through chrome.storage.onChanged with both documents untouched',
  },
  {
    clause: 'duplicate completion idempotency',
    test: 'D2-32.8 duplicate completion idempotency — a repeated completion stores the same record and produces no second state',
  },
  {
    clause: 'cancellation',
    test: 'D2-32.9 cancellation — an explicit incomplete state re-presents the flow on the next open',
  },
  {
    clause: 'recovery after one surface closes',
    test: 'D2-32.10 recovery after one surface closes — a completion survives the closing document and reads back after a restart',
  },
  {
    clause: 'schema-version handling',
    test: 'D2-32.11 schema-version handling — an unsupported version presents the flow rather than being accepted or discarded',
  },
  {
    clause: 'no false provider-ready state',
    test: 'D2-32.12 no false provider-ready state — the fixture-backed completion claims no readiness anywhere it is recorded',
  },
  {
    clause: 'no real provider call',
    test: 'D2-32.13 no real provider call — the fixture port performs no request and the validation is deterministic',
  },
  {
    clause: 'fixture validation remains separate from credential-storage status',
    test: 'D2-32.14 fixture validation remains separate from credential-storage status — validation success stores no credential',
  },
  {
    clause: 'API-key input remains local to the originating presentation controller',
    test: 'D2-32.15 API-key input remains local to the originating presentation controller — the sentinel stays in the field and crosses no boundary',
  },
  {
    clause: 'no API key in workspace state',
    test: 'D2-32.16 no API key in workspace state — both surface projections and the persisted workspace stay clean',
  },
  {
    clause: 'no API key in BroadcastBus or RuntimeEnvelope',
    test: 'D2-32.17 no API key in the broadcast bus or a runtime envelope — the flow publishes nothing and the strict envelope schema refuses the key',
  },
  {
    clause: 'no API key in WriteJournal',
    test: 'D2-32.18 no API key in the WriteJournal — the onboarding path journals nothing and every entry stays clean',
  },
  {
    clause: 'no API key in general chrome.storage data',
    test: 'D2-32.19 no API key in general chrome.storage data — every stored key and value stays clean',
  },
  {
    clause: 'no API key in logs, diagnostics, errors, snapshots or evidence',
    test: 'D2-32.20 no API key in logs, diagnostics, errors, snapshots or evidence — the ring buffer and a real redacted error record stay clean',
  },
  {
    clause: 'synthetic credentials reach CredentialStorePort only in tests that explicitly exercise the vault contract',
    test: 'D2-32.21 synthetic credentials reach the credential port only in vault-contract tests — the onboarding flow is fixture-backed and stores no credential',
  },
  {
    clause: 'onboarding UI completion remains distinct from credential stored, credential validated and provider ready',
    test: 'D2-32.22 onboarding UI completion remains distinct from credential stored, credential validated and provider ready — the four facts are separate and only the first is true',
  },
] as const;

/* -------------------------------------------------------------------------- */
/* The per-surface presentation controller (the harness mirror of the hook)   */
/* -------------------------------------------------------------------------- */

type OnboardingGate = 'reading' | 'present' | 'hidden';

interface SurfacePresentation {
  readonly surface: HarnessSurface;
  /** The gate as of the last refresh — the hook's rendered value. */
  gate(): OnboardingGate;
  /** Whether this surface is presenting the flow right now. */
  presenting(): boolean;
  /** How many times this surface has entered `present`. */
  presentations(): number;
  /** The gate this surface resolved at mount — before its record read. */
  firstGate(): OnboardingGate;
  /** The record the controller last applied. */
  record(): OnboardingReadResult | null;
  /** How many record reads were driven by the storage change subscription. */
  subscriptionRefreshes(): number;
  /** Re-evaluate the gate — the hook re-rendering on a writer-state change. */
  refresh(): OnboardingGate;
  dispose(): void;
}

/**
 * Build the gate controller for one simulated document. Its decision is the
 * real `shouldPresentOnboardingForWriter` against this surface's own writer
 * projection, and its record arrives through the real store and its change
 * subscription — exactly the three inputs `useOnboardingGate` uses.
 */
function createSurfacePresentation(surface: HarnessSurface): SurfacePresentation {
  let record: OnboardingReadResult | null = null;
  let gate: OnboardingGate;
  let presenting = false;
  let presentations = 0;
  let subscriptionRefreshes = 0;
  let alive = true;

  const compute = (): OnboardingGate => {
    const writerState = surface.writer().writerState;
    if (record === null) return writerState === 'primary' ? 'reading' : 'hidden';
    return shouldPresentOnboardingForWriter(record, writerState) ? 'present' : 'hidden';
  };

  const refresh = (): OnboardingGate => {
    gate = compute();
    if (gate === 'present' && !presenting) presentations += 1;
    presenting = gate === 'present';
    return gate;
  };

  // The hook's mount value: `reading` only for the authoritative writer, so a
  // mirror claims nothing at all (T-02-38, T-02-40).
  const firstGate = compute();
  gate = firstGate;

  const apply = async (): Promise<void> => {
    const result = await readOnboardingState();
    if (!alive) return;
    record = result;
    refresh();
  };

  void apply();
  const unsubscribe = subscribeToOnboardingState(() => {
    subscriptionRefreshes += 1;
    void apply();
  });

  return {
    surface,
    gate: () => gate,
    presenting: () => presenting,
    presentations: () => presentations,
    firstGate: () => firstGate,
    record: () => record,
    subscriptionRefreshes: () => subscriptionRefreshes,
    refresh,
    dispose: () => {
      alive = false;
      unsubscribe();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Harness state                                                              */
/* -------------------------------------------------------------------------- */

let harness: TwoSurfaceHarness;
let sidepanel: SurfacePresentation;
let standalone: SurfacePresentation;
const extraControllers: SurfacePresentation[] = [];
let maxConcurrentPresentations = 0;

beforeEach(() => {
  harness = createTwoSurfaceHarness();
  maxConcurrentPresentations = 0;
  extraControllers.length = 0;
  sidepanel = createSurfacePresentation(harness.sidepanel);
  standalone = createSurfacePresentation(harness.standalone);
});

afterEach(async () => {
  cleanup();
  for (const controller of extraControllers) controller.dispose();
  sidepanel.dispose();
  standalone.dispose();
  await harness.dispose();
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** A fresh mount of one surface, tracked for disposal. */
function tracked(surface: HarnessSurface): SurfacePresentation {
  const controller = createSurfacePresentation(surface);
  extraControllers.push(controller);
  return controller;
}

function presentationFor(surface: HarnessSurface): SurfacePresentation {
  return surface.name === 'sidepanel' ? sidepanel : standalone;
}

/**
 * Re-render both presentations (the hook re-renders when its surface writer
 * state changes) and track the maximum concurrent presentations — the
 * Pitfall 10 quantity.
 */
function refreshPresentations(): void {
  sidepanel.refresh();
  standalone.refresh();
  const concurrent = [sidepanel, standalone].filter((controller) => controller.presenting()).length;
  maxConcurrentPresentations = Math.max(maxConcurrentPresentations, concurrent);
}

/** Elect a surface through the real election and re-render both gates. */
async function elect(surface: HarnessSurface) {
  const outcome = await surface.elect();
  refreshPresentations();
  return outcome;
}

/** The post-skip record: an incomplete flow with a provider already selected. */
async function seedResumedRecord(): Promise<void> {
  await writeOnboardingState({ uiComplete: false, providerId: 'openai' });
  await flush();
}

const storedOnboardingRecord = (): Record<string, unknown> =>
  harness.storage.local().get(ONBOARDING_STORAGE_KEY) as Record<string, unknown>;

const credentialKeys = (): string[] =>
  [...harness.storage.local().keys()].filter((key) => key.startsWith(CREDENTIAL_KEY_PREFIX));

/* -------------------------------------------------------------------------- */
/* Driving the real flow                                                      */
/* -------------------------------------------------------------------------- */

interface MountedFlow {
  validationPort: ProviderValidationPort;
}

/**
 * Mount the real shared flow the way a presenting surface mounts it. The
 * adapters mirror the entrypoints' own handlers: completion and skip write the
 * real non-secret record through the real store.
 */
function mountFlow(
  surface: HarnessSurface,
  overrides: { validationPort?: ProviderValidationPort } = {},
): MountedFlow {
  const validationPort = overrides.validationPort ?? createFixtureValidationPort('success');
  render(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(OnboardingFlow, {
        open: true,
        surface: surface.name,
        validationPort,
        readOnboardingState,
        onComplete: (selection: OnboardingCompletionSelection) => {
          void writeOnboardingState({
            uiComplete: true,
            persona: selection.persona,
            providerId: selection.providerId,
            validationBacking: 'fixture',
          });
        },
        onSkip: () => {
          void writeOnboardingState({ uiComplete: false });
        },
      }),
    ),
  );
  return { validationPort };
}

const credentialInput = (): HTMLInputElement =>
  screen.getByTestId('onboarding-credential-input') as HTMLInputElement;

/**
 * Walk steps 1 → 2 → 3. Step 2 resumes the provider selection through the
 * flow's real `readOnboardingState` adapter, so the drive is deterministic and
 * reaches the credential field without an rc-select interaction.
 */
async function advanceToCredentialStep(credential: string = SENTINEL): Promise<void> {
  fireEvent.click(screen.getByTestId('onboarding-continue'));
  await act(async () => {});
  fireEvent.click(screen.getByTestId('onboarding-continue'));
  await act(async () => {});
  fireEvent.change(credentialInput(), { target: { value: credential } });
  await act(async () => {});
}

/** Walk step 3 → 4 → fixture validation → completion. */
async function completeFromCredentialStep(): Promise<void> {
  fireEvent.click(screen.getByTestId('onboarding-continue'));
  await act(async () => {});
  fireEvent.click(screen.getByTestId('onboarding-validate'));
  await act(async () => {});
  fireEvent.click(screen.getByTestId('onboarding-finish'));
  await act(async () => {});
  await flush();
}

async function driveFlowToCompletion(): Promise<void> {
  await advanceToCredentialStep();
  await completeFromCredentialStep();
}

/** Seed, elect, mount and complete the real flow on one surface. */
async function completeOnboardingOn(surface: HarnessSurface): Promise<void> {
  await seedResumedRecord();
  await elect(surface);
  await flush();
  expect(presentationFor(surface).gate()).toBe('present');
  mountFlow(surface);
  await act(async () => {});
  await driveFlowToCompletion();
}

/* -------------------------------------------------------------------------- */
/* The exposed-surface scan                                                   */
/* -------------------------------------------------------------------------- */

interface ScannedSurface {
  name: string;
  text: string;
}

/**
 * Every persisted, broadcast or logged surface the harness exposes — the D2-32
 * secret-absence targets: the workspace state (both projections and the
 * durable snapshot), the broadcast bus, the journal, the general storage
 * areas, the log ring buffer and the error records (with their evidence).
 */
async function exposedSurfaces(): Promise<ScannedSurface[]> {
  return [
    {
      name: 'workspace state (Side Panel projection)',
      text: JSON.stringify(harness.sidepanel.workspace()),
    },
    {
      name: 'workspace state (Standalone projection)',
      text: JSON.stringify(harness.standalone.workspace()),
    },
    { name: 'broadcast bus envelopes', text: JSON.stringify(harness.transport.published()) },
    { name: 'WriteJournal entries', text: JSON.stringify(await harness.db.journalEntries()) },
    { name: 'storage snapshot (local + session)', text: harness.storage.serialised() },
    { name: 'log ring buffer', text: JSON.stringify(harness.logs()) },
    {
      name: 'error records and evidence',
      text: JSON.stringify(await harness.db.listErrors()),
    },
  ];
}

/**
 * Assert the sentinel is absent from **every** exposed surface, with the
 * positive controls that keep the scan from passing vacuously.
 */
async function expectSentinelAbsentEverywhere(): Promise<void> {
  const surfaces = await exposedSurfaces();
  expect(surfaces).toHaveLength(7);
  for (const surface of surfaces) {
    expect(
      `${surface.name}:${surface.text}`,
      `the sentinel must not reach ${surface.name}`,
    ).not.toContain(SENTINEL);
  }
  // A planted occurrence is found by the same probe, and the scan target is
  // not empty: the workspace projection carries real identities.
  expect(`planted:${SENTINEL}`).toContain(SENTINEL);
  expect(JSON.stringify(harness.sidepanel.workspace())).toContain(harness.workspaceId);
}

/* -------------------------------------------------------------------------- */
/* The authorised vault adapter (D2-33)                                       */
/* -------------------------------------------------------------------------- */

/**
 * The authorised test adapter: the real `KeyVault` over the harness storage
 * area with an injected synthetic install secret. It exists for the synthetic
 * credential boundary case only — the onboarding flow never reaches it.
 */
function createVaultOverHarnessStorage() {
  const area = harness.storage.local();
  const storageArea: StorageAreaLike = {
    get: async (keys) => {
      if (keys === undefined || keys === null) return Object.fromEntries(area);
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of list) result[key] = area.get(key) ?? null;
      return result;
    },
    set: async (items) => {
      for (const [key, value] of Object.entries(items)) area.set(key, value);
    },
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) area.delete(key);
    },
  };
  return createKeyVault({
    extensionId: HARNESS_EXTENSION_ID,
    storage: storageArea,
    readInstallSecret: async (): Promise<InstallSecretReadResult> => ({
      ok: true,
      value: SYNTHETIC_INSTALL_SECRET,
    }),
  });
}

describe('Suite B — the WINDOWS #8 onboarding contract (D2-32)', () => {
  it('D2-32.1 Standalone-first onboarding state — the Standalone opened first is the surface that presents the flow', async () => {
    await flush();

    // Before any election no surface claims anything.
    expect(standalone.gate()).toBe('hidden');
    expect(sidepanel.gate()).toBe('hidden');

    // The cold Standalone is the first live surface and wins the election.
    expect((await elect(harness.standalone)).kind).toBe('primary');
    await flush();
    expect(standalone.gate()).toBe('present');
    expect(standalone.presentations()).toBe(1);
    expect(sidepanel.gate()).toBe('hidden');
    expect(sidepanel.presentations()).toBe(0);

    // A fresh mount of the presenting surface claims nothing (`reading`) until
    // its read lands, then presents the same record.
    const freshMount = tracked(harness.standalone);
    expect(freshMount.firstGate()).toBe('reading');
    await flush();
    expect(freshMount.gate()).toBe('present');

    // The record alone would present the flow — the writer gate is the decider.
    expect(shouldPresentOnboarding((await readOnboardingState()) as OnboardingReadResult)).toBe(
      true,
    );
  });

  it('D2-32.2 the Side Panel joining while onboarding is active — the joining surface renders the mirrored state and starts no competing flow', async () => {
    await flush();
    await elect(harness.standalone);
    await flush();
    expect(standalone.gate()).toBe('present');

    // The Side Panel joins the running session while onboarding is active.
    expect((await elect(harness.sidepanel)).kind).toBe('secondary');
    await flush();

    // It renders the mirrored state — hidden — and starts no competing flow.
    expect(sidepanel.gate()).toBe('hidden');
    expect(sidepanel.presentations()).toBe(0);
    expect(standalone.gate()).toBe('present');
    expect(standalone.presentations()).toBe(1);
    expect(maxConcurrentPresentations).toBe(1);
  });

  it('D2-32.3 exactly one authoritative onboarding attempt — presentations counted across both surfaces total exactly one', async () => {
    await flush();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();

    // Both surfaces read the same incomplete record: the record alone would
    // present the flow on either one.
    expect(sidepanel.record()).toEqual(standalone.record());
    const sharedRecord = standalone.record() as OnboardingReadResult;
    expect(shouldPresentOnboarding(sharedRecord)).toBe(true);
    expect(shouldPresentOnboardingForWriter(sharedRecord, 'primary')).toBe(true);
    expect(
      shouldPresentOnboardingForWriter(sharedRecord, sidepanel.surface.writer().writerState),
    ).toBe(false);

    // Counted across both surfaces, exactly one flow was presented. This case
    // fails if both surfaces present (Pitfall 10).
    const total = sidepanel.presentations() + standalone.presentations();
    expect(total).toBe(1);
    expect([sidepanel, standalone].filter((c) => c.presenting()).map((c) => c.surface.name)).toEqual(
      ['standalone'],
    );
  });

  it('D2-32.4 no competing flow controller — a mirror claims nothing and concurrent presentations never exceed one', async () => {
    await flush();

    // The Side Panel is the live writer first and presents the flow.
    expect((await elect(harness.sidepanel)).kind).toBe('primary');
    expect(sidepanel.gate()).toBe('present');
    expect(sidepanel.presentations()).toBe(1);

    // A fresh mount of the joining Standalone resolves hidden immediately —
    // never reading — so a mirror never waits on a competing flow.
    const joining = tracked(harness.standalone);
    await flush();
    expect(joining.firstGate()).toBe('hidden');
    expect(joining.presentations()).toBe(0);
    expect(joining.gate()).toBe('hidden');

    // The writer moves to the Standalone once the Side Panel record goes stale;
    // the superseded surface learns on its own authority check, exactly as the
    // production heartbeat path does.
    await harness.advanceHeartbeat(3);
    expect((await harness.standalone.elect()).kind).toBe('primary');
    expect((await harness.sidepanel.assertStillPrimary()).ok).toBe(false);
    await flush();
    refreshPresentations();

    expect(sidepanel.gate()).toBe('hidden');
    expect(standalone.gate()).toBe('present');
    expect(standalone.presentations()).toBe(1);
    // Across the whole timeline, two surfaces never presented at once.
    expect(maxConcurrentPresentations).toBe(1);
  });

  it('D2-32.5 non-secret completion-state persistence — the completion write stores the canonical record and no credential field', async () => {
    await completeOnboardingOn(harness.standalone);

    const stored = storedOnboardingRecord();
    expect(Object.keys(stored).sort()).toEqual(CANONICAL_RECORD_KEYS);
    expect(stored.uiComplete).toBe(true);
    expect(stored.providerId).toBe('openai');
    expect(stored.persona).toBeNull();
    expect(stored.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION);
    expect(stored.validationBacking).toBe('fixture');
    expect(JSON.stringify(stored)).not.toContain(SENTINEL);

    // Authoritative read-back through the real store.
    const readBack = await readOnboardingState();
    expect(readBack).toMatchObject({ status: 'ok', state: { uiComplete: true } });
    // The flow wrote exactly one key, and it is the non-secret record.
    expect([...harness.storage.local().keys()]).toEqual([ONBOARDING_STORAGE_KEY]);
  });

  it('D2-32.6 completion in one surface updating the other — the joining surface flips through the change event and stays hidden as the next writer', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();
    expect(standalone.gate()).toBe('present');

    mountFlow(harness.standalone);
    await act(async () => {});
    await driveFlowToCompletion();

    // The joining surface learned the completion through the storage change
    // event, without a reload, and never presented a flow.
    expect(sidepanel.record()).toMatchObject({ status: 'ok', state: { uiComplete: true } });
    expect(sidepanel.gate()).toBe('hidden');
    expect(sidepanel.presentations()).toBe(0);

    // It also stays hidden when it becomes the writer: the completion in one
    // surface closed the flow on the other.
    await harness.advanceHeartbeat(3);
    expect((await elect(harness.sidepanel)).kind).toBe('primary');
    await flush();
    expect(sidepanel.gate()).toBe('hidden');
    expect(sidepanel.presentations()).toBe(0);
  });

  it('D2-32.7 update without a page reload — the update arrives through chrome.storage.onChanged with both documents untouched', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();

    const sidepanelRef = harness.sidepanel;
    const standaloneRef = harness.standalone;
    const sidepanelBefore = sidepanel.subscriptionRefreshes();
    const standaloneBefore = standalone.subscriptionRefreshes();

    // A completion written by the writer reaches both documents through the
    // change event — no document is restarted and none re-reads at mount.
    await writeOnboardingState({
      uiComplete: true,
      persona: null,
      providerId: 'openai',
      validationBacking: 'fixture',
    });
    await flush();

    expect(sidepanel.subscriptionRefreshes()).toBeGreaterThan(sidepanelBefore);
    expect(standalone.subscriptionRefreshes()).toBeGreaterThan(standaloneBefore);
    expect(sidepanel.record()).toMatchObject({ status: 'ok', state: { uiComplete: true } });
    expect(standalone.record()).toMatchObject({ status: 'ok', state: { uiComplete: true } });

    // Both documents are the same instances with the same identities: nothing
    // was reloaded and the writer election was not disturbed.
    expect(harness.sidepanel).toBe(sidepanelRef);
    expect(harness.standalone).toBe(standaloneRef);
    expect(harness.standalone.tabId).toBe(standaloneRef.tabId);
    expect(harness.standalone.url).toBe(standaloneRef.url);
    expect(sidepanel.gate()).toBe('hidden');
    expect(standalone.gate()).toBe('hidden');
  });

  it('D2-32.8 duplicate completion idempotency — a repeated completion stores the same record and produces no second state', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();
    mountFlow(harness.standalone);
    await act(async () => {});
    await driveFlowToCompletion();

    const firstRecord = JSON.stringify(storedOnboardingRecord());
    const firstPresentations = standalone.presentations();
    expect(standalone.gate()).toBe('hidden');

    // The duplicate event: the same completion written again.
    await writeOnboardingState({
      uiComplete: true,
      persona: null,
      providerId: 'openai',
      validationBacking: 'fixture',
    });
    await flush();

    // The same record, no second presentation and no second state anywhere.
    expect(JSON.stringify(storedOnboardingRecord())).toBe(firstRecord);
    expect(standalone.gate()).toBe('hidden');
    expect(standalone.presentations()).toBe(firstPresentations);
    expect(sidepanel.gate()).toBe('hidden');
    expect(sidepanel.presentations()).toBe(0);
  });

  it('D2-32.9 cancellation — an explicit incomplete state re-presents the flow on the next open', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await flush();
    mountFlow(harness.standalone);
    await act(async () => {});

    // Walk to the credential step and cancel with the sentinel in the field.
    await advanceToCredentialStep();
    expect(credentialInput().value).toBe(SENTINEL);
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    await act(async () => {});
    await flush();

    // The skip records an explicit incomplete state; the provider selection
    // survives it (the merge cannot erase a completed step).
    expect(storedOnboardingRecord()).toMatchObject({ uiComplete: false, providerId: 'openai' });
    expect(shouldPresentOnboarding((await readOnboardingState()) as OnboardingReadResult)).toBe(
      true,
    );

    // The next open re-presents the flow.
    const nextOpen = tracked(harness.standalone);
    await flush();
    expect(nextOpen.gate()).toBe('present');

    // ...and the cancelled credential crossed no boundary.
    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.10 recovery after one surface closes — a completion survives the closing document and reads back after a restart', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();

    mountFlow(harness.standalone);
    await act(async () => {});
    await driveFlowToCompletion();

    // The Side Panel closes while the completion write is still in flight; the
    // durable record is not lost by the closure.
    expect(standalone.gate()).toBe('hidden');
    harness.sidepanel.dispose();
    sidepanel.dispose();
    await flush();

    // The Standalone restarts and reads the completion back: no re-presentation.
    await harness.restartSurface('standalone');
    await flush();
    const readBack = await readOnboardingState();
    expect(readBack).toMatchObject({ status: 'ok', state: { uiComplete: true } });
    expect(standalone.gate()).toBe('hidden');
    expect(standalone.presentations()).toBe(1);
  });

  it('D2-32.11 schema-version handling — an unsupported version presents the flow rather than being accepted or discarded', async () => {
    await flush();
    await elect(harness.standalone);
    await flush();

    // A record from an unsupported (future) version.
    const future = {
      uiComplete: true,
      persona: null,
      providerId: 'openai',
      schemaVersion: ONBOARDING_SCHEMA_VERSION + 7,
      validationBacking: 'fixture',
      legacyCleanupNoticeShown: false,
    };
    await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: future });
    await flush();

    // Not silently accepted: the read is unknown + incompatible and the flow
    // presents. Not silently discarded: the stored value is left untouched.
    expect(await readOnboardingState()).toEqual({ status: 'unknown', reason: 'incompatible' });
    expect(standalone.gate()).toBe('present');
    expect(harness.storage.local().get(ONBOARDING_STORAGE_KEY)).toEqual(future);

    // The known superseded shape (v1) is upgraded instead of re-presenting a
    // flow the user has already completed.
    await chrome.storage.local.set({
      [ONBOARDING_STORAGE_KEY]: {
        uiComplete: true,
        persona: null,
        providerId: 'openai',
        schemaVersion: ONBOARDING_SCHEMA_VERSION - 1,
        validationBacking: 'fixture',
      },
    });
    await flush();
    expect(standalone.gate()).toBe('hidden');
  });

  it('D2-32.12 no false provider-ready state — the fixture-backed completion claims no readiness anywhere it is recorded', async () => {
    await completeOnboardingOn(harness.standalone);

    // The completion is fixture-backed and says so: a later phase cannot read
    // it as production readiness (T-1-44).
    const stored = storedOnboardingRecord();
    expect(stored.validationBacking).toBe('fixture');
    expect(stored.validationBacking).not.toBe('provider');
    expect('providerReady' in stored).toBe(false);
    expect('providerValidated' in stored).toBe(false);
    expect('credentialStored' in stored).toBe(false);

    // The rendered flow keeps the fixture disclosure on screen through the
    // success state, and renders no readiness claim at any step.
    expect(screen.getByTestId('onboarding-fixture-notice')).toBeTruthy();
    const rendered = document.body.textContent ?? '';
    for (const claim of FORBIDDEN_READINESS_CLAIMS) {
      expect(rendered).not.toContain(claim);
    }

    // Nothing was stored in the credential key space, so no record can imply it.
    expect(credentialKeys()).toEqual([]);
  });

  it('D2-32.13 no real provider call — the fixture port performs no request and the validation is deterministic', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await flush();

    const fixture = createFixtureValidationPort('success');
    const validateSpy = vi.spyOn(fixture, 'validate');
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => {
      throw new Error('no request may be attempted during onboarding');
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      mountFlow(harness.standalone, { validationPort: fixture });
      await act(async () => {});
      await advanceToCredentialStep();
      fireEvent.click(screen.getByTestId('onboarding-continue'));
      await act(async () => {});
      fireEvent.click(screen.getByTestId('onboarding-validate'));
      await act(async () => {});

      // The flow exercised the port with the typed input...
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy.mock.calls[0]?.[0]).toMatchObject({ providerId: 'openai' });
      expect(screen.getByTestId('onboarding-success')).toBeTruthy();
      // ...and no request was attempted anywhere.
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }

    // The fixture result is deterministic across calls.
    const first = await fixture.validate({ providerId: 'openai', credential: SENTINEL });
    const second = await fixture.validate({ providerId: 'openai', credential: SENTINEL });
    expect(first).toEqual({ ok: true });
    expect(second).toEqual(first);
  });

  it('D2-32.14 fixture validation remains separate from credential-storage status — validation success stores no credential', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await flush();
    mountFlow(harness.standalone);
    await act(async () => {});
    await advanceToCredentialStep();
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    await act(async () => {});
    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await act(async () => {});

    // The fixture validation succeeded and is disclosed as fixture-backed.
    expect(screen.getByTestId('onboarding-success')).toBeTruthy();
    expect(storedOnboardingRecord()).toMatchObject({ uiComplete: false });
    expect(storedOnboardingRecord().validationBacking).toBe('fixture');

    // Validation success is not a credential-storage event: nothing exists in
    // the credential key space.
    expect(credentialKeys()).toEqual([]);
    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.15 API-key input remains local to the originating presentation controller — the sentinel stays in the field and crosses no boundary', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();
    mountFlow(harness.standalone);
    await act(async () => {});
    await advanceToCredentialStep();

    // Positive control: the value exists — in the originating presentation
    // controller only, where it was typed.
    expect(credentialInput().value).toBe(SENTINEL);
    expect(credentialInput().type).toBe('password');

    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.16 no API key in workspace state — both surface projections and the persisted workspace stay clean', async () => {
    await flush();
    await seedResumedRecord();
    await elect(harness.standalone);
    await elect(harness.sidepanel);
    await flush();
    mountFlow(harness.standalone);
    await act(async () => {});
    await advanceToCredentialStep();

    for (const name of ['sidepanel', 'standalone'] as const) {
      const projection = JSON.stringify(harness.surface(name).workspace());
      expect(projection, `${name} workspace state`).not.toContain(SENTINEL);
      // The scanned object carries real state, so the absence is meaningful.
      expect(projection).toContain(harness.workspaceId);
    }

    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.17 no API key in the broadcast bus or a runtime envelope — the flow publishes nothing and the strict envelope schema refuses the key', async () => {
    await completeOnboardingOn(harness.standalone);

    // The whole onboarding path published nothing to the bus.
    expect(harness.transport.published()).toHaveLength(0);
    await expectSentinelAbsentEverywhere();

    // The runtime envelope channel fails closed on a payload that carries the
    // key as an unexpected field: the real validator rejects it (T-1-26).
    const probe = createEnvelope(
      'EXTRACT_PAGE_CONTENT',
      { url: 'https://example.test/page', apiKey: SENTINEL },
      'background',
    );
    expect(validateEnvelope(probe).ok).toBe(false);
  });

  it('D2-32.18 no API key in the WriteJournal — the onboarding path journals nothing and every entry stays clean', async () => {
    await completeOnboardingOn(harness.standalone);

    // The onboarding path writes no journal entry at all — the strongest form
    // of the clause — and every entry the journal holds stays clean.
    const entries = await harness.db.journalEntries();
    expect(entries).toHaveLength(0);
    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.19 no API key in general chrome.storage data — every stored key and value stays clean', async () => {
    await completeOnboardingOn(harness.standalone);

    const storage = harness.storage.serialised();
    expect(storage).not.toContain(SENTINEL);
    expect(storage).toContain(ONBOARDING_STORAGE_KEY);
    // The only local key the onboarding flow wrote is the non-secret record.
    expect([...harness.storage.local().keys()]).toEqual([ONBOARDING_STORAGE_KEY]);
    expect(credentialKeys()).toEqual([]);
    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.20 no API key in logs, diagnostics, errors, snapshots or evidence — the ring buffer and a real redacted error record stay clean', async () => {
    await completeOnboardingOn(harness.standalone);

    // A real error record whose context carries the sentinel under a sensitive
    // field name: the store redacts before it persists.
    await harness.db.recordError({
      code: 'WORKSPACE_WRITE_FAILED',
      context: { apiKey: SENTINEL, stage: 'diagnostic' },
    });
    const listed = await harness.db.listErrors();
    expect(listed.ok).toBe(true);
    const errors = listed.ok ? listed.records : [];
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors)).not.toContain(SENTINEL);
    expect(JSON.stringify(harness.logs())).not.toContain(SENTINEL);

    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.21 synthetic credentials reach the credential port only in vault-contract tests — the onboarding flow is fixture-backed and stores no credential', async () => {
    await completeOnboardingOn(harness.standalone);

    // The flow's only port is the deterministic fixture: it exposes no
    // credential operation at all.
    const fixture = createFixtureValidationPort('success');
    expect(Object.keys(fixture)).toEqual(['validate']);

    // Nothing in the credential key space exists after the flow — the
    // credential port is reached only by the explicit vault-boundary case in
    // this file, never through the flow.
    expect(credentialKeys()).toEqual([]);
    expect(storedOnboardingRecord().validationBacking).toBe('fixture');
    await expectSentinelAbsentEverywhere();
  });

  it('D2-32.22 onboarding UI completion remains distinct from credential stored, credential validated and provider ready — the four facts are separate and only the first is true', async () => {
    await completeOnboardingOn(harness.standalone);

    const stored = storedOnboardingRecord();
    const facts = {
      uiComplete: stored.uiComplete === true,
      credentialStored: credentialKeys().length > 0,
      credentialValidated: stored.validationBacking === 'provider',
      providerReady:
        'providerReady' in stored || 'providerValidated' in stored || 'credentialStored' in stored,
    };
    expect(facts).toEqual({
      uiComplete: true,
      credentialStored: false,
      credentialValidated: false,
      providerReady: false,
    });

    // The record shape is the canonical one: no field can carry the other three.
    expect(Object.keys(stored).sort()).toEqual(CANONICAL_RECORD_KEYS);
  });

  it('D2-32.23 traceability — the suite declares exactly one named case per D2-32 clause', async () => {
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const titles = [...source.matchAll(/\bit\(\s*'([^']+)'/g)].map((match) => match[1]);

    // 22 clause-named cases plus this traceability case, and no duplicate names.
    expect(titles.filter((title) => title.startsWith('D2-32.'))).toHaveLength(23);
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

describe('Suite B — the credential boundary through an authorised vault adapter (D2-33)', () => {
  it('credential boundary — a synthetic credential round-trips through the real port over a KeyVault-backed adapter and nowhere else', async () => {
    const port = createCredentialStorePort(createVaultOverHarnessStorage());

    expect(await port.isConfigured('openai')).toBe(false);
    expect(await port.store('openai', SENTINEL)).toEqual({ ok: true });
    expect(await port.isConfigured('openai')).toBe(true);

    // The round trip returns the credential to the authorised consumer only.
    const retrieved = await port.retrieve('openai');
    expect(retrieved).toEqual({ ok: true, credential: SENTINEL });

    // The persisted envelope is ciphertext: the plaintext key is nowhere.
    const envelope = harness.storage.local().get(`${CREDENTIAL_KEY_PREFIX}openai`);
    expect(envelope).toBeTruthy();
    expect(JSON.stringify(envelope)).not.toContain(SENTINEL);
    await expectSentinelAbsentEverywhere();

    // Delete is the explicit supersede-to-absent path.
    expect(await port.delete('openai')).toEqual({ ok: true });
    expect(await port.isConfigured('openai')).toBe(false);
  });
});
