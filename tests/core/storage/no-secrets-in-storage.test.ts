// tests/core/storage/no-secrets-in-storage.test.ts — the 02-11 automated
// privacy gate (T-2-11-01/02; A-22/A-23/A-24 asserted as truths; the §18
// DONE-when "no message body in chrome.storage.local" is machine-checked
// here). Writes through the REAL KeyVault / store / journal paths, then DUMPS
// the chrome.storage areas and asserts:
//   1. no plaintext secret and no secret-shaped pattern (sk-… / Bearer … /
//      JSESSIONID=) anywhere in storage.local (A-22 — AES-GCM at rest);
//   2. installSecret + secrets never reach chrome.storage.sync (D-02/A-24);
//   3. chat + memory message bodies live in IndexedDB only — no np_* key in
//      storage.local holds a body, and the store DBs never appear as
//      chrome.storage.local keys (A-23/§0.2);
//   4. journaled workspace writes persist entries whose step errors/strings
//      carry no secret-shaped values (D-16 redaction at the journal boundary).
//
// Determinism (D-20/21): the install-bound secret is seeded from the FIXED
// vault-roundtrip fixture (a random secret could theoretically contain an
// sk-…-shaped substring and flake the secret-shaped scan); the vault envelope
// serializes as numeric byte arrays, which can never match a secret pattern.
//
// Env: default jsdom-align (chrome.* via fakeBrowser + IndexedDB via
// fake-indexeddb with a fresh IDBFactory per test — RESEARCH Pattern 8).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { IDBFactory } from 'fake-indexeddb';
import { KeyVault, NP_INSTALL_SECRET_KEY } from '@/core/security/KeyVault';
import { getMessagesForSession, openChatHistoryDB, putMessage } from '@/core/storage/ChatHistoryDB';
import { openMemoryDB, putMemoryMessage } from '@/core/storage/MemoryDB';
import { loadPendingEntries, persistJournalEntry } from '@/core/storage/WriteJournal';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import type { WriteJournalEntry } from '@/types/storage';
import { buildVaultRoundtripFixture } from '../../fixtures/index';

/** §16.5/O.13 secret-shaped patterns — the same vocabulary TraceRedactor scrubs. */
const SECRET_SHAPED_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]+/,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /JSESSIONID=[^;\s]+/i,
];

/** True when a dumped storage value (string or serialized) matches a secret shape. */
function hasSecretShape(value: unknown): boolean {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return SECRET_SHAPED_PATTERNS.some((pattern) => pattern.test(text));
}

function freshWorkspace(): void {
  useWorkspaceStore.setState({
    workspace: {
      workspaceId: 'ws-privacy',
      conversationId: 'conv-privacy',
      pinnedTabs: [],
      selectedNotes: [],
      activeSurface: 'sidepanel',
      version: 0,
      updatedAt: 1000,
    },
    isReady: false,
  });
}

beforeEach(() => {
  indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
});

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.getState().stop();
  freshWorkspace();
});

describe('no-secrets-in-storage — case 1/2: the vault at rest (A-22/A-24)', () => {
  it('case 1: an encrypted apiKey never appears plaintext in chrome.storage.local', async () => {
    const fixture = buildVaultRoundtripFixture();
    // Seed the install-bound secret with the FIXED fixture value (D-20:
    // deterministic — a random secret could theoretically contain an sk-…-
    // shaped substring and flake the secret-shaped scan below).
    await fakeBrowser.storage.local.set({ [NP_INSTALL_SECRET_KEY]: fixture.installSecret });

    // Write through the REAL vault path (02-03): encryptSecret generates the
    // per-key salt/IV and derives the AES-GCM key from the installSecret.
    const vault = new KeyVault();
    const envelope = await vault.encryptSecret(fixture.plaintext);
    await fakeBrowser.storage.local.set({ 'np_providers.provider-anthropic': envelope });

    const dump = await fakeBrowser.storage.local.get();
    // np_install_secret persisted (base64 install-bound, D-02) + the apiKey
    // ciphertext envelope exists under its key — the normal vault shape.
    expect(typeof dump[NP_INSTALL_SECRET_KEY]).toBe('string');
    expect(dump['np_providers.provider-anthropic']).toBeDefined();
    // The PLAINTEXT secret substring appears NOWHERE in the dump.
    expect(JSON.stringify(dump)).not.toContain(fixture.plaintext);
    // No secret-shaped pattern in ANY local value (the envelope serializes as
    // numeric byte arrays — it can never match sk-/Bearer/JSESSIONID shapes).
    for (const value of Object.values(dump)) {
      expect(hasSecretShape(value)).toBe(false);
    }
  });

  it('case 2: installSecret and the secret never reach chrome.storage.sync (D-02)', async () => {
    const fixture = buildVaultRoundtripFixture();
    await fakeBrowser.storage.local.set({ [NP_INSTALL_SECRET_KEY]: fixture.installSecret });
    const vault = new KeyVault();
    const envelope = await vault.encryptSecret(fixture.plaintext);
    await fakeBrowser.storage.local.set({ 'np_providers.provider-openai': envelope });

    // Populate sync with a cosmetic key so the dump is non-trivial — the
    // assertion is that sync holds settings but NEVER the secret material.
    await fakeBrowser.storage.sync.set({ np_theme: 'dark' });

    const syncDump = await fakeBrowser.storage.sync.get();
    expect(Object.keys(syncDump)).toContain('np_theme'); // the sync area IS live
    const serialized = JSON.stringify(syncDump);
    expect(serialized).not.toContain(fixture.plaintext);
    expect(serialized).not.toContain(fixture.installSecret);
    expect(serialized).not.toContain(NP_INSTALL_SECRET_KEY);
  });
});

describe('no-secrets-in-storage — case 3: bodies live in IndexedDB only (A-23/§0.2)', () => {
  it('chat + memory message bodies never appear in chrome.storage.local', async () => {
    const BODY_TEXT = 'PRIVACY-FIXTURE-BODY-9f3a7c1e-nowpilot';

    // Write through the REAL store paths (02-07): ChatHistoryDB.putMessage +
    // MemoryDB.putMemoryMessage.
    const chatDb = await openChatHistoryDB();
    await putMessage(chatDb, {
      id: 'm-privacy-1',
      sessionId: 's-privacy',
      role: 'user',
      content: BODY_TEXT,
      timestamp: 1000,
    });
    chatDb.close();
    const memoryDb = await openMemoryDB();
    await putMemoryMessage(memoryDb, {
      conversationId: 'c-privacy',
      seq: 1,
      role: 'user',
      content: BODY_TEXT,
      timestamp: 1000,
    });
    memoryDb.close();

    // The bodies ARE retrievable from IndexedDB (the write went where §0.2
    // demands — bodies never belong in the 10MB KV quota).
    const readBackDb = await openChatHistoryDB();
    const messages = await getMessagesForSession(readBackDb, 's-privacy');
    readBackDb.close();
    expect(messages.some((m) => m.content === BODY_TEXT)).toBe(true);

    const dump = await fakeBrowser.storage.local.get();
    const serialized = JSON.stringify(dump);
    // No chrome.storage.local entry holds the body text…
    expect(serialized).not.toContain(BODY_TEXT);
    // …the store DBs never appear as chrome.storage.local keys…
    expect(Object.keys(dump)).not.toContain('ChatHistoryDB');
    expect(Object.keys(dump)).not.toContain('MemoryDB');
    // …and no np_* key holds the body.
    for (const [key, value] of Object.entries(dump)) {
      if (key.startsWith('np_')) {
        expect(JSON.stringify(value)).not.toContain(BODY_TEXT);
      }
    }
  });
});

describe('no-secrets-in-storage — case 4: journal hygiene (D-16 at the write boundary)', () => {
  it('persisted journal entries carry no secret-shaped values', async () => {
    // Drive the 02-04 journaled workspace write (D-06: WorkspaceStore.start
    // routes the np_workspace write through runJournaled → persistJournalEntry
    // → redactSensitive BEFORE put).
    await useWorkspaceStore.getState().start('standalone');

    // A step error carrying a secret-shaped value must be scrubbed BEFORE put.
    const leaked: WriteJournalEntry = {
      id: 'jrn-secret-hygiene',
      operation: 'update-workspace',
      status: 'applying',
      createdAt: 1000,
      updatedAt: 1000,
      attempts: 1,
      targetIds: { workspaceId: 'ws-hygiene', version: '1' },
      steps: [
        {
          name: 'write-workspace',
          status: 'failed',
          error: 'auth failed for sk-journal-abc123def456',
        },
      ],
    };
    await persistJournalEntry(leaked);

    const entries = await loadPendingEntries();
    // The 02-04 write produced at least one entry; the leaked one is present.
    expect(entries.some((e) => e.id === 'jrn-secret-hygiene')).toBe(true);
    const serialized = JSON.stringify(entries);
    // No secret-shaped value survives the persist boundary — neither the raw
    // sk-… string nor any other secret shape in any step error/string.
    expect(serialized).not.toContain('sk-journal-abc123def456');
    for (const entry of entries) {
      for (const step of entry.steps) {
        if (step.error !== undefined) expect(hasSecretShape(step.error)).toBe(false);
      }
    }
    // The redaction hook replaced the secret with the canonical token.
    expect(serialized).toContain('[REDACTED]');
  });
});
