import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { ProviderId } from '../../../src/types';
import {
  CREDENTIAL_MAX_LENGTH,
  createCredentialStorePort,
  type CredentialStorePort,
  type CredentialVaultInspectResult,
  type CredentialVaultLike,
  type CredentialVaultResult,
  type CredentialVaultRetrieveResult,
} from '../../../src/services/ports/credentialStorePort';
import type { KeyVault } from '../../../src/core/security/KeyVault';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * The D2-03 credential port contract (plan `02-04`, Task 1).
 *
 * Four properties are pinned:
 *   1. the surface is exactly the six authorised operations — no list-all, no
 *      export, no preview/reveal, no generic arbitrary-secret setter;
 *   2. blank and malformed credential input is rejected **before** any vault
 *      call, so a blank field can never create or overwrite a credential
 *      (T-02-19);
 *   3. every vault failure is translated into the port's own redacted code and
 *      a thrown vault never reaches the caller (T-02-20);
 *   4. no file under `src/components/**` imports `KeyVault`, `EncryptedStorage`
 *      or any module that re-exports them — proved by a source scan, not by
 *      convention (T-02-18).
 *
 * The credential argument is always a synthetic sentinel (D2-06).
 */

const REPO_ROOT = process.cwd();
const SRC_ROOT = join(REPO_ROOT, 'src');
const COMPONENTS_ROOT = join(SRC_ROOT, 'components');
const PORT_MODULE = join(SRC_ROOT, 'services', 'ports', 'credentialStorePort.ts');

/** The repository's synthetic-sentinel idiom — never a real credential. */
const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';

/** The chrome.storage.local mock's backing map (see `tests/setup.ts`). */
const storageMap = (): Map<string, unknown> =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;

/** A recording vault. Every method is a spy; overrides replace one method. */
function createFakeVault(overrides: Partial<CredentialVaultLike> = {}): CredentialVaultLike {
  return {
    store: vi.fn(async () => ({ ok: true }) as CredentialVaultResult),
    replace: vi.fn(async () => ({ ok: true }) as CredentialVaultResult),
    retrieve: vi.fn(async () => ({ ok: true, credential: SENTINEL }) as CredentialVaultRetrieveResult),
    isConfigured: vi.fn(async () => true),
    delete: vi.fn(async () => ({ ok: true }) as CredentialVaultResult),
    inspectEnvelopeVersion: vi.fn(
      async () =>
        ({
          ok: true,
          value: { present: true, version: 1, providerId: 'openai' as ProviderId },
        }) as CredentialVaultInspectResult,
    ),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Source-scan helpers (modelled on tests/isolation/cross-entrypoint-imports.test.ts)
// ---------------------------------------------------------------------------

function walkSourceFiles(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkSourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const IMPORT_SPEC_RE = /from\s+['"]([^'"]+)['"]/g;
const RE_EXPORT_SPEC_RE = /export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;

/**
 * Resolve an import specifier to an absolute source path, or `null` for a bare
 * package specifier or a path that resolves to nothing on disk. Handles the
 * relative and `@/`-aliased spellings this repo uses.
 */
function resolveSpecifier(importerFile: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith('.')) base = resolve(dirname(importerFile), spec);
  else if (spec.startsWith('@/')) base = resolve(SRC_ROOT, spec.slice(2));
  if (base === null) return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The two vault modules no presentation component may reach. */
const VAULT_MODULE_PATHS: readonly string[] = [
  join(SRC_ROOT, 'core', 'security', 'KeyVault.ts'),
  join(SRC_ROOT, 'core', 'security', 'EncryptedStorage.ts'),
];

/**
 * The vault module set: the two seeds plus every module that re-exports one of
 * them (transitively). A component importing a re-export barrel is importing
 * the vault just the same.
 */
function collectVaultModules(): Set<string> {
  const vaultModules = new Set<string>(VAULT_MODULE_PATHS);
  const files = walkSourceFiles(SRC_ROOT);

  let grew = true;
  while (grew) {
    grew = false;
    for (const file of files) {
      if (vaultModules.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      RE_EXPORT_SPEC_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = RE_EXPORT_SPEC_RE.exec(source)) !== null) {
        const resolved = resolveSpecifier(file, match[1]);
        if (resolved !== null && vaultModules.has(resolved)) {
          vaultModules.add(file);
          grew = true;
          break;
        }
      }
    }
  }
  return vaultModules;
}

/** Every `src/components/**` import that resolves into the vault module set. */
function vaultImportsFromComponents(): string[] {
  const vaultModules = collectVaultModules();
  const offenders: string[] = [];

  for (const file of walkSourceFiles(COMPONENTS_ROOT)) {
    const source = readFileSync(file, 'utf8');
    IMPORT_SPEC_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_SPEC_RE.exec(source)) !== null) {
      const resolved = resolveSpecifier(file, match[1]);
      if (resolved !== null && vaultModules.has(resolved)) {
        offenders.push(`${relative(REPO_ROOT, file)} -> ${match[1]}`);
      }
    }
  }

  return offenders;
}

beforeEach(() => {
  storageMap()?.clear();
  clearLogs();
  vi.clearAllMocks();
});

describe('CredentialStorePort — the frozen D2-03 surface', () => {
  it('exposes exactly the six authorised operations', () => {
    const port = createCredentialStorePort(createFakeVault());

    expect(Object.keys(port).sort()).toEqual([
      'delete',
      'inspectEnvelopeVersion',
      'isConfigured',
      'replace',
      'retrieve',
      'store',
    ]);
  });

  it('exposes no list-all, export, preview, reveal or generic secret setter', () => {
    const port = createCredentialStorePort(createFakeVault());
    const keys = Object.keys(port);

    const forbidden = [
      'list',
      'listAll',
      'listAllCredentials',
      'getAll',
      'export',
      'exportCredential',
      'preview',
      'reveal',
      'show',
      'set',
      'setSecret',
      'storeSecret',
      'storeArbitrary',
      'dump',
      'snapshot',
      'get',
    ];
    for (const name of forbidden) {
      expect(keys, `forbidden member ${name}`).not.toContain(name);
    }
  });

  it('keeps the Phase-1 isConfigured and store shapes', async () => {
    const port: CredentialStorePort = createCredentialStorePort(createFakeVault());

    // Compile-time: the extended interface still satisfies the Phase-1 shapes.
    const configured: Promise<boolean> = port.isConfigured('openai');
    const stored: Promise<{ ok: true } | { ok: false; code: string }> = port.store(
      'openai',
      SENTINEL,
    );

    expect(await configured).toBe(true);
    expect(await stored).toEqual({ ok: true });
  });

  it('accepts the real KeyVault structurally, with no adapter module', () => {
    // Compile-time: `createKeyVault()`'s return value is a `CredentialVaultLike`
    // as-is. If this stopped being true, `tsc --noEmit` would fail here.
    const keyVaultIsAVault = (vault: KeyVault): CredentialVaultLike => vault;

    expect(typeof keyVaultIsAVault).toBe('function');
  });
});

describe('CredentialStorePort — delegation', () => {
  it('delegates every operation to the vault with its arguments', async () => {
    const vault = createFakeVault();
    const port = createCredentialStorePort(vault);

    expect(await port.store('openai', SENTINEL)).toEqual({ ok: true });
    expect(vault.store).toHaveBeenCalledWith('openai', SENTINEL);

    expect(await port.replace('anthropic', SENTINEL)).toEqual({ ok: true });
    expect(vault.replace).toHaveBeenCalledWith('anthropic', SENTINEL);

    expect(await port.retrieve('gemini')).toEqual({ ok: true, credential: SENTINEL });
    expect(vault.retrieve).toHaveBeenCalledWith('gemini');

    expect(await port.isConfigured('ollama')).toBe(true);
    expect(vault.isConfigured).toHaveBeenCalledWith('ollama');

    expect(await port.delete('openai')).toEqual({ ok: true });
    expect(vault.delete).toHaveBeenCalledWith('openai');

    expect(await port.inspectEnvelopeVersion('openai')).toEqual({
      ok: true,
      value: { present: true, version: 1, providerId: 'openai' },
    });
    expect(vault.inspectEnvelopeVersion).toHaveBeenCalledWith('openai');
  });
});

describe('CredentialStorePort — blank and malformed input never reaches the vault (T-02-19)', () => {
  const rejectedShapes: Array<[string, unknown]> = [
    ['an empty string', ''],
    ['a whitespace-only string', '   \n\t '],
    ['a non-string', 42],
    ['an over-long string', 'a'.repeat(CREDENTIAL_MAX_LENGTH + 1)],
  ];

  for (const [label, value] of rejectedShapes) {
    it(`rejects ${label} on store before any vault call`, async () => {
      const vault = createFakeVault();
      const port = createCredentialStorePort(vault);

      const result = await port.store('openai', value as string);

      expect(result).toEqual({ ok: false, code: 'CREDENTIAL_STORE_INVALID_CREDENTIAL' });
      expect(vault.store).not.toHaveBeenCalled();
    });

    it(`rejects ${label} on replace before any vault call`, async () => {
      const vault = createFakeVault();
      const port = createCredentialStorePort(vault);

      const result = await port.replace('openai', value as string);

      expect(result).toEqual({ ok: false, code: 'CREDENTIAL_STORE_INVALID_CREDENTIAL' });
      expect(vault.replace).not.toHaveBeenCalled();
    });
  }

  it('persists nothing when a credential is rejected', async () => {
    const port = createCredentialStorePort(createFakeVault());

    await port.store('openai', '');
    await port.store('openai', '   ');
    await port.replace('openai', 'a'.repeat(CREDENTIAL_MAX_LENGTH + 1));

    expect(storageMap().size).toBe(0);
  });

  it('accepts a credential at exactly the documented maximum length', async () => {
    const vault = createFakeVault();
    const port = createCredentialStorePort(vault);

    const result = await port.store('openai', 'k'.repeat(CREDENTIAL_MAX_LENGTH));

    expect(result).toEqual({ ok: true });
    expect(vault.store).toHaveBeenCalledTimes(1);
  });
});

describe('CredentialStorePort — typed redacted failures (T-02-20)', () => {
  it('translates the vault semantic codes into the port vocabulary', async () => {
    const cases: Array<[string, string]> = [
      ['KEY_VAULT_INVALID_PROVIDER', 'CREDENTIAL_STORE_INVALID_PROVIDER'],
      ['KEY_VAULT_INVALID_CREDENTIAL', 'CREDENTIAL_STORE_INVALID_CREDENTIAL'],
      ['KEY_VAULT_ALREADY_CONFIGURED', 'CREDENTIAL_STORE_ALREADY_CONFIGURED'],
      ['KEY_VAULT_NOT_CONFIGURED', 'CREDENTIAL_STORE_NOT_CONFIGURED'],
      ['KEY_VAULT_UNAVAILABLE', 'CREDENTIAL_STORE_UNAVAILABLE'],
      ['KEY_VAULT_SECRET_UNAVAILABLE', 'CREDENTIAL_STORE_UNAVAILABLE'],
      ['CREDENTIAL_DECRYPT_FAILED', 'CREDENTIAL_STORE_DECRYPT_FAILED'],
      ['KEY_VAULT_WRITE_FAILED', 'CREDENTIAL_STORE_FAILED'],
    ];

    for (const [vaultCode, portCode] of cases) {
      const port = createCredentialStorePort(
        createFakeVault({
          store: vi.fn(async () => ({ ok: false, code: vaultCode }) as CredentialVaultResult),
        }),
      );

      expect(await port.store('openai', SENTINEL), vaultCode).toEqual({
        ok: false,
        code: portCode,
      });
    }
  });

  it('degrades an unknown vault code to the generic port failure', async () => {
    const port = createCredentialStorePort(
      createFakeVault({
        delete: vi.fn(async () => ({ ok: false, code: 'SOME_FUTURE_CODE' }) as CredentialVaultResult),
      }),
    );

    const result = await port.delete('openai');

    expect(result).toEqual({ ok: false, code: 'CREDENTIAL_STORE_FAILED' });
  });

  it('never surfaces the vault internal code or its value', async () => {
    const port = createCredentialStorePort(
      createFakeVault({
        retrieve: vi.fn(
          async () => ({ ok: false, code: 'KEY_VAULT_READ_FAILED' }) as CredentialVaultRetrieveResult,
        ),
      }),
    );

    const result = await port.retrieve('openai');

    expect(JSON.stringify(result)).not.toContain('KEY_VAULT');
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('catches a throwing vault and reports an error name only', async () => {
    const port = createCredentialStorePort(
      createFakeVault({
        store: vi.fn(async () => {
          throw new DOMException(`vault exploded with ${SENTINEL}`, 'OperationError');
        }),
      }),
    );

    const result = await port.store('openai', SENTINEL);

    expect(result).toEqual({ ok: false, code: 'CREDENTIAL_STORE_FAILED' });

    const logged = JSON.stringify(getRecentLogs());
    expect(logged).toContain('OperationError');
    expect(logged).not.toContain(SENTINEL);
    expect(logged).not.toContain('exploded');
  });

  it('fails isConfigured closed to false when the vault throws', async () => {
    const port = createCredentialStorePort(
      createFakeVault({
        isConfigured: vi.fn(async () => {
          throw new TypeError('nope');
        }),
      }),
    );

    expect(await port.isConfigured('openai')).toBe(false);
  });

  it('returns a typed redacted failure for every operation when the vault throws', async () => {
    const boom = async (): Promise<never> => {
      throw new Error('boom');
    };
    const port = createCredentialStorePort(
      createFakeVault({
        store: vi.fn(boom),
        replace: vi.fn(boom),
        retrieve: vi.fn(boom),
        delete: vi.fn(boom),
        inspectEnvelopeVersion: vi.fn(boom),
      }),
    );

    expect(await port.store('openai', SENTINEL)).toEqual({
      ok: false,
      code: 'CREDENTIAL_STORE_FAILED',
    });
    expect(await port.replace('openai', SENTINEL)).toEqual({
      ok: false,
      code: 'CREDENTIAL_STORE_FAILED',
    });
    expect(await port.retrieve('openai')).toEqual({ ok: false, code: 'CREDENTIAL_STORE_FAILED' });
    expect(await port.delete('openai')).toEqual({ ok: false, code: 'CREDENTIAL_STORE_FAILED' });
    expect(await port.inspectEnvelopeVersion('openai')).toEqual({
      ok: false,
      code: 'CREDENTIAL_STORE_FAILED',
    });
  });

  it('returns a credential from retrieve and from no other operation', async () => {
    const port = createCredentialStorePort(createFakeVault());

    const others = [
      await port.store('openai', SENTINEL),
      await port.replace('openai', SENTINEL),
      await port.isConfigured('openai'),
      await port.delete('openai'),
      await port.inspectEnvelopeVersion('openai'),
    ];

    expect(JSON.stringify(others)).not.toContain(SENTINEL);
    expect(JSON.stringify(getRecentLogs())).not.toContain(SENTINEL);
    // The one authorised path — and it is a success arm, not an echo.
    expect(await port.retrieve('openai')).toEqual({ ok: true, credential: SENTINEL });
  });
});

describe('CredentialStorePort — presentation isolation (T-02-18)', () => {
  it('reads real component files and a non-empty vault set (positive control)', () => {
    expect(walkSourceFiles(COMPONENTS_ROOT).length).toBeGreaterThan(0);
    expect(collectVaultModules().size).toBeGreaterThanOrEqual(VAULT_MODULE_PATHS.length);
  });

  it('no file under src/components/** imports the vault or a module that re-exports it', () => {
    expect(vaultImportsFromComponents()).toEqual([]);
  });

  it('the scan catches a direct vault import (self-test)', () => {
    const importer = join(COMPONENTS_ROOT, 'chat', 'Synthetic.tsx');
    const vaultModules = collectVaultModules();

    const relativeImport = resolveSpecifier(importer, '../../core/security/KeyVault');
    const aliasedImport = resolveSpecifier(importer, '@/core/security/EncryptedStorage');

    expect(relativeImport).not.toBeNull();
    expect(aliasedImport).not.toBeNull();
    expect(vaultModules.has(relativeImport as string)).toBe(true);
    expect(vaultModules.has(aliasedImport as string)).toBe(true);
  });

  it('the scan does not flag the port or the shared leaf modules (self-test)', () => {
    const importer = join(COMPONENTS_ROOT, 'chat', 'Synthetic.tsx');
    const vaultModules = collectVaultModules();

    for (const spec of [
      '../../services/ports/credentialStorePort',
      '../../core/log/debugLog',
      '../../core/security/redactSensitive',
      '../../types',
    ]) {
      const resolved = resolveSpecifier(importer, spec);
      expect(resolved, spec).not.toBeNull();
      expect(vaultModules.has(resolved as string), spec).toBe(false);
    }
  });

  it('the port module itself imports no vault module', () => {
    const vaultModules = collectVaultModules();
    const source = readFileSync(PORT_MODULE, 'utf8');
    const offenders: string[] = [];

    IMPORT_SPEC_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_SPEC_RE.exec(source)) !== null) {
      const resolved = resolveSpecifier(PORT_MODULE, match[1]);
      if (resolved !== null && vaultModules.has(resolved)) offenders.push(match[1]);
    }

    expect(offenders).toEqual([]);
  });
});
