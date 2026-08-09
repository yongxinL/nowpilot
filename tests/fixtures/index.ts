// tests/fixtures/index.ts — D-20/D-21 deterministic typed fixture builders.
// Rules: seeded pseudo-randomness or fixed constants ONLY — never real
// crypto.getRandomValues or Date.now (determinism). Parameterized on edges
// (workspaceId, version, secret); edge/failure variants are first-class.
// Direction (D-21): tests → fixtures → src/types — fixtures under tests/ only,
// never imported from src/. Type-only imports from src are the sole exception.
import type { WriteJournalEntry, WriteJournalOperation } from '@/types/storage';

// ---------------------------------------------------------------------------
// Fixed constants (deterministic — no real randomness anywhere in this module)
// ---------------------------------------------------------------------------

/** Fixed 32-byte installSecret pattern (0x33 × 32), base64 — decrypt posture (A-01). */
export const FIXED_INSTALL_SECRET_A = 'MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM=';
/** Fixed second 32-byte secret pattern (0x55 × 32), base64 — cross-install secret B. */
export const FIXED_INSTALL_SECRET_B = 'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
/** Deterministic fakeBrowser runtime.id (verified: 'test-extension-id'). */
export const FIXED_EXTENSION_ID = 'test-extension-id';
/** Per-key 16-byte salt: 0x11 × 16 (D-02: per-key 16-byte salt). */
export function fixedSalt(): Uint8Array {
  return new Uint8Array(16).fill(0x11);
}
/** Per-key 12-byte IV: 0x22 × 12 (D-02: 12-byte IV). */
export function fixedIv(): Uint8Array {
  return new Uint8Array(12).fill(0x22);
}
/** Fixed secret-shaped plaintext for vault roundtrips. */
export const FIXED_PLAINTEXT = 'sk-nowpilot-fixture-plaintext-0123456789';

// ---------------------------------------------------------------------------
// 1. vault-roundtrip — encrypt→decrypt under one secret (STORAGE-03 decrypt
// posture, A-01/A-04: pins PBKDF2-100k/SHA-256 parameters verbatim)
// ---------------------------------------------------------------------------

export interface VaultRoundtripFixture {
  installSecret: string;
  extensionId: string;
  plaintext: string;
  salt: Uint8Array;
  iv: Uint8Array;
}

export function buildVaultRoundtripFixture(
  overrides: Partial<VaultRoundtripFixture> = {},
): VaultRoundtripFixture {
  return {
    installSecret: FIXED_INSTALL_SECRET_A,
    extensionId: FIXED_EXTENSION_ID,
    plaintext: FIXED_PLAINTEXT,
    salt: fixedSalt(),
    iv: fixedIv(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 2. cross-install — encrypt A / decrypt B → PROVIDER_KEY_UNREADABLE, NO wipe
// (D-04 cross-install road; A-01 vault survival)
// ---------------------------------------------------------------------------

export interface CrossInstallEnvelope {
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface CrossInstallFixture {
  secretA: string;
  secretB: string;
  envelopeA: CrossInstallEnvelope;
}

export function buildCrossInstallFixture(
  overrides: Partial<CrossInstallFixture> = {},
): CrossInstallFixture {
  return {
    // envelopeA is fixed ciphertext "encrypted on install A" (0x33 × 48 bytes)
    secretA: FIXED_INSTALL_SECRET_A,
    secretB: FIXED_INSTALL_SECRET_B,
    envelopeA: {
      salt: fixedSalt(),
      iv: fixedIv(),
      ciphertext: new Uint8Array(48).fill(0x33),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 3. journal-recovery — crash mid-write → replay-once idempotent, workspace-
// scoped (D-05/D-07, WR-10). Returns the entry set PLUS the workspaceId/version
// edge parameters so replay tests can assert workspace scoping.
// ---------------------------------------------------------------------------

export interface JournalRecoveryFixture {
  workspaceId: string;
  version: string;
  entries: WriteJournalEntry[];
}

export function buildJournalRecoveryFixture(
  overrides: Partial<JournalRecoveryFixture> = {},
): JournalRecoveryFixture {
  const workspaceId = overrides.workspaceId ?? 'ws-fixture-01';
  const version = overrides.version ?? '5';
  const base = {
    createdAt: 1000,
    updatedAt: 1100,
    attempts: 1,
  };
  const entries: WriteJournalEntry[] = [
    // completed entry — the normal terminal state (never replayed)
    {
      id: 'jrn-completed',
      operation: 'update-workspace',
      status: 'completed',
      ...base,
      targetIds: { workspaceId, version },
      steps: [{ name: 'write-workspace', status: 'completed' }],
    },
    // crash-before-completed: status 'applying' → must be replayed once
    {
      id: 'jrn-crash-before-completed',
      operation: 'update-workspace',
      status: 'applying',
      ...base,
      targetIds: { workspaceId, version },
      steps: [{ name: 'write-workspace', status: 'completed' }],
    },
    // pending entry — never started → also replayed
    {
      id: 'jrn-pending',
      operation: 'update-workspace',
      status: 'pending',
      createdAt: 1000,
      updatedAt: 1000,
      attempts: 0,
      targetIds: { workspaceId, version },
      steps: [],
    },
    // different-workspaceId entry — replay must SKIP (workspace-scoped, WR-10)
    {
      id: 'jrn-other-workspace',
      operation: 'update-workspace',
      status: 'applying',
      ...base,
      targetIds: { workspaceId: 'ws-other', version },
      steps: [],
    },
    // unknown operation string — forward-compat skip-and-log case (D-07),
    // typed via assertion to model a future-version entry
    {
      id: 'jrn-unknown-op',
      operation: 'future-sync-op' as WriteJournalOperation,
      status: 'pending',
      createdAt: 1000,
      updatedAt: 1000,
      attempts: 0,
      targetIds: { workspaceId, version },
      steps: [],
    },
  ];
  return { workspaceId, version, entries };
}

// ---------------------------------------------------------------------------
// 4. migration — synthetic v1→v2 proof: add-store + add-index + data-carry
// (D-13/D-14). Fixed legacy rows + expected v2 schema facts.
// ---------------------------------------------------------------------------

export interface LegacyRow {
  id: string;
  title: string;
  body: string;
}

export interface MigrationFixture {
  dbName: string;
  v1Rows: LegacyRow[];
  expectedV2: {
    addStore: string;
    addIndex: { store: string; name: string; keyPath: string };
    carriedIds: string[];
  };
}

export function buildMigrationFixture(overrides: Partial<MigrationFixture> = {}): MigrationFixture {
  return {
    dbName: 'fixture-migrate-db',
    v1Rows: [
      { id: 'r1', title: 'survivor', body: 'carried row one' },
      { id: 'r2', title: 'second', body: 'carried row two' },
    ],
    expectedV2: {
      addStore: 'notes_v2',
      addIndex: { store: 'legacy', name: 'by_title', keyPath: 'title' },
      carriedIds: ['r1', 'r2'],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 5. quota-shadow — sync fail → local shadow → promote/clear, no divergence
// (D-15). Cosmetic keys only: np_theme | np_theme_pack | np_language.
// ---------------------------------------------------------------------------

export type CosmeticSyncKey = 'np_theme' | 'np_theme_pack' | 'np_language';

export interface SyncRejectError {
  name: string;
  message: string;
}

export interface QuotaShadowFixture {
  key: CosmeticSyncKey;
  value: string;
  syncRejectError: SyncRejectError;
}

export function buildQuotaShadowFixture(
  overrides: Partial<QuotaShadowFixture> = {},
): QuotaShadowFixture {
  return {
    key: 'np_theme',
    value: 'dark',
    syncRejectError: {
      name: 'QuotaExceededError',
      message: 'QUOTA_BYTES_PER_ITEM quota exceeded',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 6. redaction — sk-… / Bearer … / JSESSIONID= / sysparm_ck / g_ck strings plus
// a structured object with a password-like field that must be DROPPED, not
// masked (D-16/R-10; Appendix O.13 patterns).
// ---------------------------------------------------------------------------

export interface RedactionFixture {
  messages: string[];
  structured: Record<string, unknown>;
  /** Key of the password-like field — tests assert its ABSENCE after redaction. */
  passwordKey: string;
}

export function buildRedactionFixture(overrides: Partial<RedactionFixture> = {}): RedactionFixture {
  return {
    messages: [
      'auth failed for sk-abc123def456ghi789',
      'request with Bearer eyJhbGciOiJIUzI1NiJ9.abc',
      'session JSESSIONID=A1B2C3D4E5; path=/',
      'soap call sysparm_ck=xyz987 header g_ck=42',
    ],
    structured: {
      apiKey: 'sk-live-secret-987654321',
      token: 'Bearer abcdef.ghijkl',
      cookie: 'JSESSIONID=SESSIONTOKEN',
      sysparm: 'sysparm_ck=soap-session',
      gck: 'g_ck=glide-token',
      password: 'sup3r-secret-password',
    },
    passwordKey: 'password',
    ...overrides,
  };
}
