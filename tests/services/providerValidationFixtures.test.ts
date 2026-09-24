import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ProviderId } from '../../src/types';
import type { ProviderValidationResult } from '../../src/services/ports/providerValidationPort';

/**
 * Fixture adapter + typed ports suite (plan `01-09`, Task 1 — D-05 / D-07 / D-08).
 *
 * Six properties are pinned:
 *   1. `ProviderId` is exactly the four canonical identifiers and the
 *      prototype's non-canonical `'claude'` spelling is not reintroduced in any
 *      new module (the legacy prototype types survive until plan `01-11`);
 *   2. the fixture adapter is a deterministic local stand-in — one canned
 *      result per selector, deep-equal across calls;
 *   3. every failure fixture maps to a canonical §21.6 / Appendix C.2 code and
 *      the cancelled fixture maps to a cancellation that carries no code at
 *      all, so no caller can read it as success or as failure;
 *   4. the adapter performs no network request and imports no provider SDK —
 *      proven by a zero-call global `fetch` spy and a source scan;
 *   5. `CredentialStorePort` is declared in its canonical Phase 2 module
 *      (`src/services/ports/credentialStorePort.ts`); Phase 1 ships no
 *      implementation and no call site, and no Phase-1 surface (fixtures,
 *      onboarding store, onboarding flow, options page) imports or names it.
 *      The original Phase-1 premise — "no implementation anywhere in `src/`" —
 *      was legitimately superseded by Phase 2's charter (D2-03/D2-04: Phase 2
 *      implements the port, Phase 3 wires it). The repository-wide credential
 *      boundary is enforced by `tests/isolation/credential-boundary.test.ts`;
 *   6. the persisted provider type carries no credential-bearing field and the
 *      transient credential input is referenced by no persisted-store type.
 *
 * Key hygiene (T-1-43): the credential argument is a synthetic sentinel and the
 * suite asserts it does not appear in any returned result.
 */

const REPO_ROOT = process.cwd();
const SERVICES_ROOT = path.join(REPO_ROOT, 'src', 'services');
const NEW_SERVICE_DIRS = ['ports', 'fixtures'].map((dir) => path.join(SERVICES_ROOT, dir));

/**
 * The four Phase-1 surfaces the credential port must never reach (D-05). The
 * post-Phase-2 invariant is scope-aware: the port is implemented in Phase 2, so
 * the honest assertion is that no Phase-1 presentation, onboarding or fixture
 * module imports or names it — not that the identifier is absent from `src/`.
 */
const PHASE_1_CREDENTIAL_SURFACES = [
  'services/fixtures',
  'core/onboarding',
  'components/onboarding',
  'components/options',
].map((dir) => path.join(REPO_ROOT, 'src', dir));

/** Strip comments before matching: prose that *names* the port is not an import. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The repository's synthetic-sentinel idiom — never a real credential. */
const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';

/**
 * Runtime loads of the modules under test.
 *
 * The modules are authored in this plan's GREEN half, so the suite is written
 * to collect before they exist: each case targets its own assertion rather
 * than the file failing as one module-load crash (the RED-evidence rule plan
 * `01-06` established).
 */
const loadTypes = () => import('../../src/types');
const loadPort = () => import('../../src/services/ports/providerValidationPort');
const loadFixtures = () => import('../../src/services/fixtures/providerValidationFixtures');

function sourceFiles(dir: string): { file: string; text: string }[] {
  if (!fs.existsSync(dir)) return [];
  const files: { file: string; text: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push({ file: full, text: fs.readFileSync(full, 'utf8') });
    }
  }
  return files;
}

/** The source block of one exported interface declaration. */
function interfaceBlock(text: string, name: string): string {
  const start = text.indexOf(`interface ${name} `);
  if (start === -1) return '';
  const end = text.indexOf('\n}', start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

/** Field names declared inside an interface block. */
function declaredFields(block: string): string[] {
  const names: string[] = [];
  const re = /^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\??\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) names.push(match[1]);
  return names;
}

/** Compile-time exactness check: the union is exactly the four literals. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const PROVIDER_ID_UNION_IS_CANONICAL: Exact<
  ProviderId,
  'openai' | 'anthropic' | 'gemini' | 'ollama'
> = true;

describe('provider identifiers — the canonical four', () => {
  it('exposes exactly the four canonical provider identifiers, in order', async () => {
    const { PROVIDER_IDS } = await loadTypes();

    expect(PROVIDER_IDS).toEqual(['openai', 'anthropic', 'gemini', 'ollama']);
    expect(PROVIDER_IDS).toHaveLength(4);
    expect(PROVIDER_IDS).not.toContain('claude');
    expect(PROVIDER_IDS).not.toContain('webapp');
    // The union and the runtime membership list are one source.
    expect(PROVIDER_ID_UNION_IS_CANONICAL).toBe(true);
  });

  it('reintroduces the prototype non-canonical identifier in no new module', () => {
    const offenders: string[] = [];
    for (const dir of NEW_SERVICE_DIRS) {
      for (const { file, text } of sourceFiles(dir)) {
        if (/['"]claude['"]/.test(text)) offenders.push(path.relative(REPO_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('fixture validation adapter — deterministic, typed, network-free', () => {
  // `any` is deliberate: the fixture selector union is authored in GREEN, and
  // the RED half of this suite must still collect per case.
  let createFixtureValidationPort: any;

  beforeEach(async () => {
    ({ createFixtureValidationPort } = await loadFixtures());
  });

  it('returns { ok: true } for the success fixture', async () => {
    const port = createFixtureValidationPort('success');

    const result: ProviderValidationResult = await port.validate({
      providerId: 'openai',
      credential: SENTINEL,
    });

    expect(result).toEqual({ ok: true });
  });

  it('returns the canonical authentication code for the invalid-credential fixture', async () => {
    const port = createFixtureValidationPort('invalid-credential');

    const result: ProviderValidationResult = await port.validate({
      providerId: 'anthropic',
      credential: SENTINEL,
    });

    expect(result).toEqual({ ok: false, code: 'PROVIDER_AUTH' });
  });

  it('returns the canonical upstream code for the provider-unavailable fixture', async () => {
    const port = createFixtureValidationPort('provider-unavailable');

    const result = await port.validate({ providerId: 'gemini', credential: SENTINEL });

    expect(result).toEqual({ ok: false, code: 'PROVIDER_5XX' });
  });

  it('returns the canonical network code for the network-unavailable fixture', async () => {
    const port = createFixtureValidationPort('network-unavailable');

    const result = await port.validate({ providerId: 'ollama', credential: SENTINEL });

    expect(result).toEqual({ ok: false, code: 'NETWORK' });
  });

  it('returns the canonical check-failed code for the unexpected-failure fixture', async () => {
    const port = createFixtureValidationPort('unexpected-failure');

    const result = await port.validate({ providerId: 'openai', credential: SENTINEL });

    expect(result).toEqual({ ok: false, code: 'PROVIDER_CHECK_FAILED' });
  });

  it('represents cancellation without an error code — never success, never failure', async () => {
    const port = createFixtureValidationPort('cancelled');

    const result = await port.validate({ providerId: 'openai', credential: SENTINEL });

    expect(result.ok).toBe(false);
    expect('cancelled' in result).toBe(true);
    // No canonical code is attached: a cancellation is not a failure reason.
    expect('code' in result).toBe(false);
    // ...and it is emphatically not a success claim.
    expect(result).not.toEqual({ ok: true });
  });

  it('is deterministic: the same selector yields deep-equal results twice', async () => {
    for (const selector of [
      'success',
      'invalid-credential',
      'provider-unavailable',
      'network-unavailable',
      'cancelled',
      'unexpected-failure',
    ]) {
      const first = await createFixtureValidationPort(selector).validate({
        providerId: 'openai',
        credential: SENTINEL,
      });
      const second = await createFixtureValidationPort(selector).validate({
        providerId: 'openai',
        credential: SENTINEL,
      });

      expect(second, `selector ${selector}`).toEqual(first);
    }
  });

  it('performs no network request: the global fetch spy records zero calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const port = createFixtureValidationPort('success');
    await port.validate({ providerId: 'openai', credential: SENTINEL });
    await createFixtureValidationPort('invalid-credential').validate({
      providerId: 'openai',
      credential: SENTINEL,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('returns a result carrying no trace of the credential argument', async () => {
    for (const selector of ['success', 'invalid-credential', 'cancelled', 'unexpected-failure']) {
      const result = await createFixtureValidationPort(selector).validate({
        providerId: 'openai',
        credential: SENTINEL,
      });

      expect(JSON.stringify(result), `selector ${selector}`).not.toContain(SENTINEL);
    }
  });
});

describe('services — no provider SDK is imported anywhere under src/services', () => {
  it('imports no provider SDK module', () => {
    // Every SDK family a "real" validation path would reach for. The fixture
    // adapter must be a plain module: no SDK, no client constructor.
    const SDK_PATTERN =
      /^(?:@?openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|ollama|langchain|@langchain\/|ai|@ai-sdk\/)/;
    const specRe = /from\s+['"]([^'"]+)['"]/g;
    const offenders: string[] = [];

    for (const { file, text } of sourceFiles(SERVICES_ROOT)) {
      specRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = specRe.exec(text)) !== null) {
        if (SDK_PATTERN.test(match[1])) {
          offenders.push(`${path.relative(REPO_ROOT, file)} -> ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('typed ports — the credential port stays out of the Phase-1 surface', () => {
  it('declares CredentialStorePort in its canonical module and imports it from no Phase-1 surface', () => {
    const portFile = path.join(SERVICES_ROOT, 'ports', 'credentialStorePort.ts');

    expect(fs.existsSync(portFile)).toBe(true);

    // Provenance: this case replaces the Phase-1 "declarations only, no
    // implementation" substring rule. Review-fix commit `18d206c6` (IN-05/IN-06)
    // added a doc comment at `src/core/security/KeyVault.ts:33` that merely names
    // the literal `CredentialStorePort`; the old comment-blind substring scan over
    // `src/**` counted that prose as a call site, so a documentation-only commit
    // turned `verify:phase-1` red. Phase 2's charter (D2-03/D2-04) legitimately
    // superseded the "no implementation anywhere" premise — Phase 2 implements
    // the port, Phase 3 wires it — so the invariant is restated scope-aware here.
    // The repository-wide boundary is owned by
    // `tests/isolation/credential-boundary.test.ts`.
    const offenders: string[] = [];
    let scanned = 0;

    for (const dir of PHASE_1_CREDENTIAL_SURFACES) {
      for (const { file, text } of sourceFiles(dir)) {
        scanned += 1;
        if (stripComments(text).includes('CredentialStorePort')) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }

    // Non-vacuity: a renamed directory cannot make this case pass silently.
    expect(scanned).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('declares the PortValidationResult union over the four canonical codes plus cancellation', async () => {
    const { PROVIDER_VALIDATION_ERROR_CODES } = await loadPort();

    expect([...PROVIDER_VALIDATION_ERROR_CODES].sort()).toEqual([
      'NETWORK',
      'PROVIDER_5XX',
      'PROVIDER_AUTH',
      'PROVIDER_CHECK_FAILED',
    ]);
  });
});

describe('types — no credential can reach a persisted shape', () => {
  const FORBIDDEN_FIELD_NAMES = [
    'apiKey',
    'api_key',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'credential',
    'password',
    'bearerToken',
  ];

  const typesSource = () =>
    fs.readFileSync(path.join(REPO_ROOT, 'src', 'types', 'index.ts'), 'utf8');

  it('PersistedProviderConfig carries no credential-bearing field', () => {
    const block = interfaceBlock(typesSource(), 'PersistedProviderConfig');

    // Positive control: the block is real and carries the non-secret metadata.
    expect(block).not.toBe('');
    expect(declaredFields(block).sort()).toEqual(
      ['enabled', 'id', 'isConfigured', 'models', 'name', 'proxyUrl', 'useCustomProxy'].sort(),
    );

    const offending = declaredFields(block).filter((name) =>
      FORBIDDEN_FIELD_NAMES.includes(name),
    );
    expect(offending).toEqual([]);
  });

  it('TransientCredentialInput is exactly { providerId, credential } and names no persisted-credential field', () => {
    const block = interfaceBlock(typesSource(), 'TransientCredentialInput');

    expect(block).not.toBe('');
    expect(declaredFields(block).sort()).toEqual(['credential', 'providerId']);

    // The recognised persisted-credential field names must not appear here:
    // an in-memory field spelled `apiKey` would be indistinguishable from a
    // forbidden persisted field (plans 01-10 / 01-11 scan for those names).
    const offending = declaredFields(block).filter((name) =>
      ['apiKey', 'token', 'accessToken', 'secret'].includes(name),
    );
    expect(offending).toEqual([]);
  });

  it('TransientCredentialInput is referenced by no persisted-store type', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          if (fs.readFileSync(full, 'utf8').includes('TransientCredentialInput')) {
            offenders.push(path.relative(REPO_ROOT, full));
          }
        }
      }
    };
    walk(path.join(REPO_ROOT, 'src'));

    // The persisted-store homes must never mention the transient input.
    expect(offenders.filter((file) => /^src[\\/](store|core)[\\/]/.test(file))).toEqual([]);
    // The persisted provider type itself must not reference it either.
    expect(interfaceBlock(typesSource(), 'PersistedProviderConfig')).not.toContain(
      'TransientCredentialInput',
    );
  });

  it('the prototype legacy provider types are gone after plan 01-11', () => {
    const source = typesSource();

    // Plan `01-11` deleted the prototype's two provider identifier unions and
    // the raw model option they fed, together with their last consumers
    // (`aiProvider.ts`, the prototype onboarding host, the chat host, the raw
    // model selector and the workflow selector). `ProviderId` is therefore the
    // only provider identifier union left in the repository, and no prototype
    // module imports a removed export.
    expect(source).not.toMatch(/export type ProviderType\b/);
    expect(source).not.toMatch(/export type CustomProviderId\b/);
    expect(source).not.toMatch(/export interface ModelOption\b/);
    expect(source).toContain('export type ProviderId = (typeof PROVIDER_IDS)[number]');
    // The teardown is recorded in the surviving prototype shapes' provenance.
    expect(source).toContain('01-11');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
