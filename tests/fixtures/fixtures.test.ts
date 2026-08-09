// tests/fixtures/fixtures.test.ts — D-20/D-21 determinism smoke test (Nyquist).
// Asserts per builder: two calls with identical args deep-equal (fixed
// IDs/timestamps, no real randomness), no NaN/undefined in required fields, and
// the redaction fixture's password field is a distinct key the redaction tests
// can assert absence of. Runs in the default jsdom-align environment (no IDB,
// no chrome.* needed — pure data builders).
import { describe, expect, it } from 'vitest';
import {
  buildCrossInstallFixture,
  buildJournalRecoveryFixture,
  buildMigrationFixture,
  buildQuotaShadowFixture,
  buildRedactionFixture,
  buildVaultRoundtripFixture,
} from './index';

describe('tests/fixtures — determinism (D-20/D-21)', () => {
  it('buildVaultRoundtripFixture is deterministic and well-formed', () => {
    const a = buildVaultRoundtripFixture();
    const b = buildVaultRoundtripFixture();
    expect(a).toEqual(b);
    expect(a.salt).toHaveLength(16);
    expect(a.iv).toHaveLength(12);
    expect(a.installSecret.length).toBeGreaterThan(0);
    expect(a.extensionId.length).toBeGreaterThan(0);
    expect(a.plaintext.length).toBeGreaterThan(0);
    // byte-level determinism for the fixed arrays
    expect([...a.salt]).toEqual([...b.salt]);
    expect([...a.iv]).toEqual([...b.iv]);
  });

  it('buildVaultRoundtripFixture honors overrides', () => {
    const a = buildVaultRoundtripFixture({ plaintext: 'sk-custom' });
    const b = buildVaultRoundtripFixture({ plaintext: 'sk-custom' });
    expect(a).toEqual(b);
    expect(a.plaintext).toBe('sk-custom');
    expect(b.installSecret).toBe(buildVaultRoundtripFixture().installSecret);
  });

  it('buildCrossInstallFixture is deterministic with distinct secrets', () => {
    const a = buildCrossInstallFixture();
    const b = buildCrossInstallFixture();
    expect(a).toEqual(b);
    expect(a.secretA).not.toBe(a.secretB);
    expect(a.envelopeA.salt).toHaveLength(16);
    expect(a.envelopeA.iv).toHaveLength(12);
    expect(a.envelopeA.ciphertext.length).toBeGreaterThan(0);
    expect([...a.envelopeA.ciphertext]).toEqual([...b.envelopeA.ciphertext]);
  });

  it('buildJournalRecoveryFixture is deterministic with all statuses present', () => {
    const a = buildJournalRecoveryFixture();
    const b = buildJournalRecoveryFixture();
    expect(a).toEqual(b);
    const statuses = new Set(a.entries.map((e) => e.status));
    expect(statuses.has('pending')).toBe(true);
    expect(statuses.has('applying')).toBe(true);
    expect(statuses.has('completed')).toBe(true);
    // every entry carries the same fixed workspaceId/version in targetIds,
    // except the intentional different-workspaceId edge variant (WR-10)
    for (const e of a.entries) {
      if (e.targetIds.workspaceId === 'ws-other') continue;
      expect(e.targetIds.workspaceId).toBe(a.workspaceId);
      expect(e.targetIds.version).toBe(a.version);
      expect(Number.isFinite(e.createdAt)).toBe(true);
      expect(Number.isFinite(e.updatedAt)).toBe(true);
      expect(Number.isInteger(e.attempts)).toBe(true);
      expect(e.id.length).toBeGreaterThan(0);
    }
    // edge variants first-class: a different-workspaceId entry + an unknown-op entry
    expect(a.entries.some((e) => e.targetIds.workspaceId === 'ws-other')).toBe(true);
    // forward-compat unknown op is modeled via a cast in the fixture (D-07 skip case)
    expect(a.entries.some((e) => e.operation === ('future-sync-op' as never))).toBe(true);
  });

  it('buildJournalRecoveryFixture honors workspaceId/version overrides', () => {
    const a = buildJournalRecoveryFixture({ workspaceId: 'ws-custom', version: '9' });
    const b = buildJournalRecoveryFixture({ workspaceId: 'ws-custom', version: '9' });
    expect(a).toEqual(b);
    for (const e of a.entries) {
      if (e.targetIds.workspaceId === 'ws-other') continue;
      expect(e.targetIds.workspaceId).toBe('ws-custom');
      expect(e.targetIds.version).toBe('9');
    }
  });

  it('buildMigrationFixture is deterministic with fixed legacy rows', () => {
    const a = buildMigrationFixture();
    const b = buildMigrationFixture();
    expect(a).toEqual(b);
    expect(a.dbName.length).toBeGreaterThan(0);
    expect(a.v1Rows.length).toBeGreaterThan(0);
    for (const row of a.v1Rows) {
      expect(row.id.length).toBeGreaterThan(0);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.body.length).toBeGreaterThan(0);
    }
    expect(a.expectedV2.carriedIds).toEqual(a.v1Rows.map((r) => r.id));
    expect(a.expectedV2.addStore.length).toBeGreaterThan(0);
    expect(a.expectedV2.addIndex.name.length).toBeGreaterThan(0);
    expect(a.expectedV2.addIndex.keyPath.length).toBeGreaterThan(0);
  });

  it('buildQuotaShadowFixture is deterministic and models a cosmetic sync key', () => {
    const a = buildQuotaShadowFixture();
    const b = buildQuotaShadowFixture();
    expect(a).toEqual(b);
    expect(['np_theme', 'np_theme_pack', 'np_language']).toContain(a.key);
    expect(a.value.length).toBeGreaterThan(0);
    expect(a.syncRejectError.name.length).toBeGreaterThan(0);
    expect(a.syncRejectError.message.length).toBeGreaterThan(0);
  });

  it('buildRedactionFixture is deterministic and exposes a distinct password key', () => {
    const a = buildRedactionFixture();
    const b = buildRedactionFixture();
    expect(a).toEqual(b);
    expect(a.messages.length).toBeGreaterThan(0);
    for (const m of a.messages) expect(m.length).toBeGreaterThan(0);
    // the password-like field is a distinct key the redaction tests assert ABSENCE of
    expect(a.passwordKey).toBe('password');
    expect(a.structured).toHaveProperty(a.passwordKey);
    expect(a.structured).toHaveProperty('apiKey');
  });
});
