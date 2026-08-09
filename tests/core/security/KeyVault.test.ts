// tests/core/security/KeyVault.test.ts — installSecret lifecycle + the
// PROVIDER_KEY_UNREADABLE state machine (STORAGE-03, D-02/D-04). Uses the
// shared cross-install + vault-roundtrip fixture builders from 02-01 (D-20/21
// — the SAME deterministic builders the integration paths use). Determinism
// note (RESEARCH Pattern 3): fakeBrowser's runtime.id is the deterministic
// 'test-extension-id', so derived keys are stable across the test.
//
// Cases: np_install_secret generated once + persisted + immutable-once-set;
// cross-install (encrypt A / decrypt B → PROVIDER_KEY_UNREADABLE, ciphertext
// NOT wiped); all three unreadable roads (tampered / installSecret-cleared)
// converge on ONE shared state value; wipeProviderKey is the ONLY path that
// deletes ciphertext. Runs in the default jsdom-align environment.
import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { ERROR_CODES } from '@/core/error/errorCodes';
import {
  getKeyVault,
  KeyVault,
  NP_INSTALL_SECRET_KEY,
  PROVIDER_KEY_STATE,
} from '@/core/security/KeyVault';
import {
  buildCrossInstallFixture,
  buildVaultRoundtripFixture,
  FIXED_PLAINTEXT,
} from '../../fixtures/index';

describe('KeyVault — installSecret lifecycle (D-02)', () => {
  it('generates np_install_secret once, persists it to chrome.storage.local, and never regenerates', async () => {
    const vault = new KeyVault();

    const first = await vault.getInstallSecret();
    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(0);

    // persisted to chrome.storage.local — the ONLY area (never sync, D-02)
    const stored = await fakeBrowser.storage.local.get(NP_INSTALL_SECRET_KEY);
    expect(stored[NP_INSTALL_SECRET_KEY]).toBe(first);

    // write-if-absent never regenerates: a second read returns the SAME value
    const second = await vault.getInstallSecret();
    expect(second).toBe(first);
  });
});

describe('KeyVault — the three roads to unreadable converge on ONE state (D-04)', () => {
  it('cross-install: encrypt with secret A, decrypt with secret B → PROVIDER_KEY_UNREADABLE, ciphertext NOT wiped', async () => {
    const fixture = buildCrossInstallFixture();
    const ciphertextKey = 'np_providers.provider-anthropic';

    // install A: seed the install-bound secret, encrypt the fixture plaintext
    await fakeBrowser.storage.local.set({ [NP_INSTALL_SECRET_KEY]: fixture.secretA });
    const vaultA = new KeyVault();
    const envelope = await vaultA.encryptSecret(FIXED_PLAINTEXT);
    await fakeBrowser.storage.local.set({ [ciphertextKey]: envelope });

    // install B (restore on a new install, road a): a NEW KeyVault instance
    // with no seeded state — storage now holds a DIFFERENT install-bound secret
    await fakeBrowser.storage.local.set({ [NP_INSTALL_SECRET_KEY]: fixture.secretB });
    const vaultB = new KeyVault();

    await expect(vaultB.decryptSecret(envelope)).rejects.toMatchObject({
      code: ERROR_CODES.VAULT_DECRYPT_FAILED,
    });
    expect(vaultB.getProviderKeyState()).toBe(PROVIDER_KEY_STATE.PROVIDER_KEY_UNREADABLE);

    // NO wipe (D-04): the ciphertext key is STILL PRESENT in storage.local
    const after = await fakeBrowser.storage.local.get(ciphertextKey);
    expect(after[ciphertextKey]).toBeDefined();
  });

  it('tampered ciphertext (road c) and installSecret-cleared (road b) both converge on PROVIDER_KEY_UNREADABLE', async () => {
    const fixture = buildVaultRoundtripFixture();
    await fakeBrowser.storage.local.set({ [NP_INSTALL_SECRET_KEY]: fixture.installSecret });
    const vault = new KeyVault();
    const envelope = await vault.encryptSecret(fixture.plaintext);

    // road (c): tampered ciphertext byte → the same typed throw + shared state
    const tampered = new Uint8Array(envelope.ciphertext);
    tampered[0] ^= 0xff;
    const tamperedEnvelope = {
      salt: envelope.salt,
      iv: envelope.iv,
      ciphertext: tampered.buffer,
    };
    await expect(vault.decryptSecret(tamperedEnvelope)).rejects.toMatchObject({
      code: ERROR_CODES.VAULT_DECRYPT_FAILED,
    });
    expect(vault.getProviderKeyState()).toBe(PROVIDER_KEY_STATE.PROVIDER_KEY_UNREADABLE);

    // road (b): installSecret cleared → decrypt must NOT auto-regenerate (D-04)
    const vault2 = new KeyVault();
    await fakeBrowser.storage.local.remove(NP_INSTALL_SECRET_KEY);
    await expect(vault2.decryptSecret(envelope)).rejects.toMatchObject({
      code: ERROR_CODES.VAULT_DECRYPT_FAILED,
    });
    expect(vault2.getProviderKeyState()).toBe(PROVIDER_KEY_STATE.PROVIDER_KEY_UNREADABLE);

    // no auto-regenerate: np_install_secret is still absent after the attempt
    const after = await fakeBrowser.storage.local.get(NP_INSTALL_SECRET_KEY);
    expect(after[NP_INSTALL_SECRET_KEY]).toBeUndefined();
  });
});

describe('KeyVault — user-initiated wipe only (D-04)', () => {
  it('wipeProviderKey removes the ciphertext — no decrypt-failure path deletes it', async () => {
    const fixture = buildVaultRoundtripFixture();
    await fakeBrowser.storage.local.set({ [NP_INSTALL_SECRET_KEY]: fixture.installSecret });
    const vault = new KeyVault();
    const ciphertextKey = 'np_providers.provider-openai';
    const envelope = await vault.encryptSecret(fixture.plaintext);
    await fakeBrowser.storage.local.set({ [ciphertextKey]: envelope });
    expect((await fakeBrowser.storage.local.get(ciphertextKey))[ciphertextKey]).toBeDefined();

    await vault.wipeProviderKey(ciphertextKey);

    const after = await fakeBrowser.storage.local.get(ciphertextKey);
    expect(after[ciphertextKey]).toBeUndefined();
  });
});

describe('KeyVault — shared state + listener notifications (ProviderRegistry analog)', () => {
  it('getKeyVault() returns the lazy singleton', () => {
    expect(getKeyVault()).toBe(getKeyVault());
  });

  it('subscribe notifies listeners when setProviderKeyUnreadable converges on the shared state', () => {
    const vault = new KeyVault();
    const listener = vi.fn();
    const unsubscribe = vault.subscribe(listener);

    vault.setProviderKeyUnreadable('restore-on-new-install');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(vault.getProviderKeyState()).toBe(PROVIDER_KEY_STATE.PROVIDER_KEY_UNREADABLE);
    expect(vault.getProviderKeyUnreadableReason()).toBe('restore-on-new-install');

    unsubscribe();
    vault.setProviderKeyUnreadable('tampered-ciphertext');
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed — no further notifications
  });
});
