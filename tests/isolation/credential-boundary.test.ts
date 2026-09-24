import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Credential-boundary gate — the cross-phase invariant the Phase-1 substring
 * rule was reaching for (plan `02-14`).
 *
 * ## 1. The invariant
 *
 * No Phase-1 presentation, onboarding, fixture or content-script module reaches
 * `CredentialStorePort`, `KeyVault` or `EncryptedStorage`; no `src/` file other
 * than the canonical declaration module imports the port; no `src/` file
 * imports the vault modules outside the single approved edge; no persisted-shape
 * module declares a credential-named field; and no credential-named value is
 * passed into a persistence call from a prohibited scope.
 *
 * ## 2. Why this replaced the Phase-1 substring rule
 *
 * The Phase-1 case at `tests/services/providerValidationFixtures.test.ts`
 * ("declarations only, no Phase-1 implementation") walked `src/**` and failed
 * any file whose *text* contained `CredentialStorePort` — a comment-blind
 * substring scan. Review-fix commit `18d206c6` (IN-05/IN-06) added a doc comment
 * at `src/core/security/KeyVault.ts:33` that merely *names* the port, and the
 * substring rule counted that prose as a call site. The old rule measured the
 * wrong thing: what matters is an import edge, not a name.
 *
 * ## 3. The honest restatement
 *
 * The Phase-1 premise "declarations only, no implementation" was legitimately
 * superseded by D2-03/D2-04: Phase 2 implements the port in
 * `src/services/ports/credentialStorePort.ts`, Phase 3 wires it. The invariant
 * that still holds — and that this gate enforces — is "no production import of
 * the port outside its declaration module", plus the boundary rules above.
 *
 * ## 4. Collection
 *
 * Both `pnpm run verify:phase-1` and `pnpm run verify:phase-2` enumerate
 * `tests/isolation` as a directory, so this one file is collected by both
 * cross-phase gates with no `package.json` change.
 *
 * ## 5. Extension point
 *
 * `APPROVED_VAULT_EDGES` is an exact-pair allowlist. Nothing is approved to
 * import `KeyVault` today because Phase 2 deliberately ships no production
 * composition root (D2-01). Phase 3's composition root must add its own edge
 * here deliberately, in the commit that wires it.
 *
 * ## 6. Read-only by construction
 *
 * The suite scans and asserts; it writes nothing.
 */

const SRC_ROOT = join(process.cwd(), 'src');
const PORT_MODULE = join(SRC_ROOT, 'services', 'ports', 'credentialStorePort.ts');
const KEY_VAULT_MODULE = join(SRC_ROOT, 'core', 'security', 'KeyVault.ts');
const ENCRYPTED_STORAGE_MODULE = join(SRC_ROOT, 'core', 'security', 'EncryptedStorage.ts');

/** The three modules whose reach defines the credential boundary. */
export const BOUNDARY_SEEDS = Object.freeze([
  PORT_MODULE,
  KEY_VAULT_MODULE,
  ENCRYPTED_STORAGE_MODULE,
] as const);

/**
 * The Phase-1 presentation / onboarding / fixture / content-script surfaces that
 * must never reach the boundary.
 */
export const PROHIBITED_SCOPES = Object.freeze([
  join(SRC_ROOT, 'components'),
  join(SRC_ROOT, 'core', 'onboarding'),
  join(SRC_ROOT, 'services', 'fixtures'),
  join(SRC_ROOT, 'entrypoints', 'content'),
] as const);

/**
 * The exact `[importer, imported]` edges approved to cross the vault boundary.
 * Exactly one: KeyVault's own import of the envelope codec — the live Phase 2
 * edge. Nothing is approved to import `KeyVault` because Phase 2 has no
 * production composition root by D2-01; Phase 3's composition root adds its edge
 * here, deliberately, in the commit that wires it.
 */
export const APPROVED_VAULT_EDGES = Object.freeze([
  Object.freeze([KEY_VAULT_MODULE, ENCRYPTED_STORAGE_MODULE] as const),
] as const);

/** The persisted-shape modules the credential-field rule covers. */
export const PERSISTED_SHAPE_MODULES = Object.freeze([
  join(SRC_ROOT, 'core', 'workspace', 'WorkspaceState.ts'),
  join(SRC_ROOT, 'core', 'runtime', 'RuntimeEnvelope.ts'),
  join(SRC_ROOT, 'core', 'storage', 'WriteJournal.ts'),
  join(SRC_ROOT, 'core', 'messaging', 'MessageBus.ts'),
  join(SRC_ROOT, 'core', 'workspace', 'handoff', 'protocol.ts'),
  join(SRC_ROOT, 'store', 'useExtensionStore.ts'),
] as const);

/**
 * The repository's persisted-credential vocabulary — the same list the Phase-1
 * suite (`tests/services/providerValidationFixtures.test.ts`) already uses.
 */
export const FORBIDDEN_FIELD_NAMES = Object.freeze([
  'apiKey',
  'api_key',
  'credential',
  'token',
  'accessToken',
  'refreshToken',
  'bearerToken',
  'password',
  'secret',
] as const);

/** The violation codes the predicate emits. */
export const VIOLATION = Object.freeze({
  GATE_TARGET_MISSING: 'GATE_TARGET_MISSING',
  BOUNDARY_MODULE_IMPORT: 'BOUNDARY_MODULE_IMPORT',
  PORT_IMPORT_OUTSIDE_DECLARATION: 'PORT_IMPORT_OUTSIDE_DECLARATION',
  CREDENTIAL_FIELD_IN_PERSISTED_SHAPE: 'CREDENTIAL_FIELD_IN_PERSISTED_SHAPE',
  CREDENTIAL_INTO_PERSISTENCE: 'CREDENTIAL_INTO_PERSISTENCE',
  UNRESOLVED_PROJECT_SPECIFIER: 'UNRESOLVED_PROJECT_SPECIFIER',
  EMPTY_SCAN: 'EMPTY_SCAN',
} as const);

/** The extensions a project specifier may resolve to (WXT/Vite/TS resolution). */
const RESOLUTION_SUFFIXES = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'] as const;

/** The project aliases that resolve into `src/` (tsconfig `paths`, vitest alias). */
const SRC_ALIASES = ['@/', '~/'] as const;

/** The persistence callees a prohibited scope must never pass a credential into. */
const PERSISTENCE_CALLEES = [
  'setItem',
  'writeWorkspaceState',
  'runJournaled',
  'writeConversationWithMessages',
  'persist',
] as const;

/**
 * The credential-named identifiers the persistence rule looks for. `token` and
 * `key` are deliberately absent here: they are too common to be usable as
 * argument signals.
 */
const CREDENTIAL_ARGUMENT_NAMES = [
  'apiKey',
  'api_key',
  'credential',
  'secret',
  'password',
  'bearerToken',
  'accessToken',
  'refreshToken',
] as const;

/** Strip comments before scanning: prose that *names* a construct is not usage. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every module specifier in the comment-stripped source: static, re-export, side-effect and dynamic. */
export function moduleSpecifiers(source: string): string[] {
  const stripped = stripComments(source);
  const specs = new Set<string>();

  const patterns = [
    /from\s+['"]([^'"]+)['"]/g, // import/export … from '…'
    /^\s*import\s+['"]([^'"]+)['"]/gm, // side-effect import '…'
    /import\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('…')
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) specs.add(match[1]);
  }
  return [...specs];
}

/**
 * Every specifier a file *re-exports* from (`export … from '…'`). This is what
 * makes the taint set transitive: a barrel that re-exports a boundary module is
 * itself a boundary module.
 */
export function reExportSpecifiers(source: string): string[] {
  const stripped = stripComments(source);
  const specs = new Set<string>();
  const re = /^\s*export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) specs.add(match[1]);
  return [...specs];
}

/** A specifier the gate is expected to resolve: relative or a `src/` alias. */
const isProjectSpecifier = (spec: string): boolean =>
  spec.startsWith('.') || SRC_ALIASES.some((prefix) => spec.startsWith(prefix));

/** The candidate base path for a relative or aliased specifier, else null. */
function resolveBase(fromFile: string, spec: string): string | null {
  const alias = SRC_ALIASES.find((prefix) => spec.startsWith(prefix));
  if (alias) return join(SRC_ROOT, spec.slice(alias.length));
  if (spec.startsWith('.')) return resolve(dirname(fromFile), spec);
  return null;
}

/** Resolve one specifier against the importing file, or null when it is external/unresolved. */
export function resolveSpecifier(
  fromFile: string,
  spec: string,
  exists: (path: string) => boolean,
): string | null {
  const base = resolveBase(fromFile, spec);
  if (base === null) return null;
  if (exists(base)) return base;
  for (const suffix of RESOLUTION_SUFFIXES) {
    if (exists(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  return null;
}

/**
 * The text inside the first balanced parenthesis group starting at `openIndex`.
 * String literals are respected, so a `)` inside a string does not close the
 * group. Returns null when `openIndex` is not an opening parenthesis or the
 * group never closes.
 */
export function callArguments(source: string, openIndex: number): string | null {
  if (source[openIndex] !== '(') return null;
  let depth = 0;
  let quote: string | null = null;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== null) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }
  return null;
}

/**
 * The transitive taint set: the three seeds plus every module that re-exports a
 * tainted module (a specifier appearing after an `export` keyword), computed to
 * a fixpoint so a barrel of a barrel is caught too. An indirect import through a
 * barrel file cannot evade the gate because the barrel joins the set.
 *
 * Takes the candidate file set rather than a bare reader: the rule quantifies
 * over *every* module ("every module that re-exports a tainted module"), so the
 * candidates must be enumerable.
 */
export function collectBoundaryModules(
  files: ReadonlyArray<{ path: string; source: string }>,
): Set<string> {
  const byPath = new Map(files.map((file) => [file.path, file.source] as const));
  const tainted = new Set<string>(BOUNDARY_SEEDS);

  let changed = true;
  while (changed) {
    changed = false;
    for (const file of files) {
      if (tainted.has(file.path)) continue;
      for (const spec of reExportSpecifiers(file.source)) {
        const resolved = resolveSpecifier(file.path, spec, (candidate) => byPath.has(candidate));
        if (resolved !== null && tainted.has(resolved)) {
          tainted.add(file.path);
          changed = true;
          break;
        }
      }
    }
  }

  return tainted;
}

const isUnder = (path: string, dir: string): boolean => path === dir || path.startsWith(dir + sep);

const relative = (path: string): string =>
  path.startsWith(process.cwd()) ? path.slice(process.cwd().length + 1) : path;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Credential-named field declarations inside a persisted-shape module. The
 * pattern is line-anchored so a prose mention or an unrelated identifier that
 * merely contains the name as a substring is not flagged.
 */
function forbiddenFieldHits(stripped: string): string[] {
  return FORBIDDEN_FIELD_NAMES.filter((name) =>
    new RegExp(`^\\s*(?:readonly\\s+)?${escapeRegExp(name)}\\s*\\??\\s*:`, 'm').test(stripped),
  );
}

/**
 * Calls to a persistence callee whose balanced argument text carries a
 * credential-named identifier — inside a prohibited scope, the shape that would
 * let a credential reach a persisted store.
 */
function credentialIntoPersistenceHits(stripped: string): string[] {
  const hits = new Set<string>();
  for (const callee of PERSISTENCE_CALLEES) {
    const re = new RegExp(`\\b${callee}\\s*\\(`, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(stripped)) !== null) {
      const openIndex = match.index + match[0].length - 1;
      const args = callArguments(stripped, openIndex);
      if (args === null) continue;
      for (const name of CREDENTIAL_ARGUMENT_NAMES) {
        if (new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(name)}([^A-Za-z0-9_$]|$)`).test(args)) {
          hits.add(`${callee}(${name})`);
        }
      }
    }
  }
  return [...hits];
}

export interface BoundaryInput {
  files: ReadonlyArray<{ path: string; source: string }>;
}

/**
 * The whole gate as one pure predicate. Deterministic: violations are deduped
 * and sorted by code then path, so assertions are stable.
 */
export function credentialBoundaryViolations(input: BoundaryInput): string[] {
  const violations = new Set<string>();
  const byPath = new Map(input.files.map((file) => [file.path, file.source] as const));
  const tainted = collectBoundaryModules(input.files);

  // A renamed, deleted or misspelled canonical module must fail the gate
  // rather than silently pass it.
  for (const target of [...BOUNDARY_SEEDS, ...PERSISTED_SHAPE_MODULES]) {
    if (!byPath.has(target)) {
      violations.add(`${VIOLATION.GATE_TARGET_MISSING}: ${relative(target)}`);
    }
  }

  // Non-vacuity: a gate whose target path stops resolving must fail.
  if (!input.files.some((file) => isUnder(file.path, SRC_ROOT))) {
    violations.add(`${VIOLATION.EMPTY_SCAN}: no file under ${relative(SRC_ROOT)}`);
  }
  for (const scope of PROHIBITED_SCOPES) {
    if (!input.files.some((file) => isUnder(file.path, scope))) {
      violations.add(`${VIOLATION.EMPTY_SCAN}: no file under ${relative(scope)}`);
    }
  }

  for (const file of input.files) {
    const stripped = stripComments(file.source);
    const inSrc = isUnder(file.path, SRC_ROOT);
    const inProhibitedScope = PROHIBITED_SCOPES.some((scope) => isUnder(file.path, scope));

    // The gate scans `src/` only: a tests/ entry in the input is out of scope
    // (the Phase 2 port suites reference the port legitimately).
    if (inSrc) {
      for (const spec of moduleSpecifiers(file.source)) {
        const resolved = resolveSpecifier(file.path, spec, (candidate) => byPath.has(candidate));
        if (resolved === null) {
          // An unresolved specifier is a gate hole, not a pass.
          if (inProhibitedScope && isProjectSpecifier(spec)) {
            violations.add(
              `${VIOLATION.UNRESOLVED_PROJECT_SPECIFIER}: ${relative(file.path)} -> ${spec}`,
            );
          }
          continue;
        }
        if (tainted.has(resolved)) {
          const approved = APPROVED_VAULT_EDGES.some(
            ([from, to]) => from === file.path && to === resolved,
          );
          if (!approved) {
            violations.add(
              `${VIOLATION.BOUNDARY_MODULE_IMPORT}: ${relative(file.path)} -> ${relative(resolved)}`,
            );
          }
        }
        if (resolved === PORT_MODULE && file.path !== PORT_MODULE) {
          violations.add(
            `${VIOLATION.PORT_IMPORT_OUTSIDE_DECLARATION}: ${relative(file.path)} -> ${relative(resolved)}`,
          );
        }
      }
    }

    if ((PERSISTED_SHAPE_MODULES as readonly string[]).includes(file.path)) {
      for (const name of forbiddenFieldHits(stripped)) {
        violations.add(
          `${VIOLATION.CREDENTIAL_FIELD_IN_PERSISTED_SHAPE}: ${relative(file.path)}: ${name}`,
        );
      }
    }

    if (inProhibitedScope) {
      for (const hit of credentialIntoPersistenceHits(stripped)) {
        violations.add(`${VIOLATION.CREDENTIAL_INTO_PERSISTENCE}: ${relative(file.path)} -> ${hit}`);
      }
    }
  }

  return [...violations].sort();
}

/* ------------------------------------------------------------------ */
/* In-memory fixtures for the control groups                           */
/* ------------------------------------------------------------------ */

const WORKSPACE_STATE_MODULE = join(SRC_ROOT, 'core', 'workspace', 'WorkspaceState.ts');
const RUNTIME_ENVELOPE_MODULE = join(SRC_ROOT, 'core', 'runtime', 'RuntimeEnvelope.ts');
const WRITE_JOURNAL_MODULE = join(SRC_ROOT, 'core', 'storage', 'WriteJournal.ts');
const MESSAGE_BUS_MODULE = join(SRC_ROOT, 'core', 'messaging', 'MessageBus.ts');
const HANDOFF_PROTOCOL_MODULE = join(SRC_ROOT, 'core', 'workspace', 'handoff', 'protocol.ts');
const EXTENSION_STORE_MODULE = join(SRC_ROOT, 'store', 'useExtensionStore.ts');

const COMPONENT_ONBOARDING_FLOW = join(SRC_ROOT, 'components', 'onboarding', 'OnboardingFlow.tsx');
const COMPONENT_OPTIONS_PAGE = join(SRC_ROOT, 'components', 'options', 'OptionsPage.tsx');
const COMPONENT_WIDGET = join(SRC_ROOT, 'components', 'common', 'Widget.tsx');
const CORE_ONBOARDING_STORE = join(SRC_ROOT, 'core', 'onboarding', 'onboardingStateStore.ts');
const FIXTURE_PORT = join(SRC_ROOT, 'services', 'fixtures', 'providerValidationFixtures.ts');
const CONTENT_ENTRY = join(SRC_ROOT, 'entrypoints', 'content', 'core.content.ts');
const SERVICES_BARREL = join(SRC_ROOT, 'services', 'index.ts');
const APP_SERVICE = join(SRC_ROOT, 'core', 'workspace', 'SomeService.ts');
const TEST_PORT_SUITE = join(process.cwd(), 'tests', 'core', 'security', 'credentialStorePort.test.ts');

const PORT_SOURCE = [
  'export interface CredentialStorePort {',
  '  isConfigured(providerId: string): Promise<boolean>;',
  '}',
  'export function createCredentialStorePort(vault: unknown) {',
  '  return vault;',
  '}',
].join('\n');

const KEY_VAULT_SOURCE = [
  "import { encryptCredential } from './EncryptedStorage';",
  'export function createKeyVault() {',
  '  return { encryptCredential };',
  '}',
].join('\n');

const ENCRYPTED_STORAGE_SOURCE = ['export function encryptCredential() {', '  return null;', '}'].join(
  '\n',
);

/**
 * A well-formed fixture set: all three seeds, every persisted-shape module and
 * at least one file per prohibited scope — so an empty violation list is
 * meaningful rather than vacuous.
 */
function fixtureFiles(overrides: Record<string, string> = {}): { path: string; source: string }[] {
  const files: Record<string, string> = {
    [PORT_MODULE]: PORT_SOURCE,
    [KEY_VAULT_MODULE]: KEY_VAULT_SOURCE,
    [ENCRYPTED_STORAGE_MODULE]: ENCRYPTED_STORAGE_SOURCE,
    [WORKSPACE_STATE_MODULE]: 'export interface WorkspaceState {\n  workspaceId: string;\n}\n',
    [RUNTIME_ENVELOPE_MODULE]: 'export const createEnvelope = () => null;\n',
    [WRITE_JOURNAL_MODULE]: 'export const JOURNAL_TERMINAL_ENTRY_LIMIT = 50;\n',
    [MESSAGE_BUS_MODULE]: 'export const dispatch = () => null;\n',
    [HANDOFF_PROTOCOL_MODULE]: "export const HANDOFF_CHANNEL = 'np_workspace';\n",
    [EXTENSION_STORE_MODULE]: 'export const useExtensionStore = () => null;\n',
    [COMPONENT_ONBOARDING_FLOW]: 'export const OnboardingFlow = () => null;\n',
    [CORE_ONBOARDING_STORE]: 'export const readOnboardingState = () => null;\n',
    [FIXTURE_PORT]: 'export const createFixtureValidationPort = () => null;\n',
    [CONTENT_ENTRY]: 'export default defineContentScript({});\n',
    [TEST_PORT_SUITE]:
      "import { createCredentialStorePort } from '../../../src/services/ports/credentialStorePort';\n",
    ...overrides,
  };
  return Object.entries(files).map(([path, source]) => ({ path, source }));
}

/* ------------------------------------------------------------------ */
/* The control groups                                                  */
/* ------------------------------------------------------------------ */

describe('credential boundary — the gate predicate (self-test)', () => {
  describe('negative controls — the gate still fails', () => {
    it('(a) a presentation module importing the port directly is flagged', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [COMPONENT_ONBOARDING_FLOW]: [
            "import { createCredentialStorePort } from '../../services/ports/credentialStorePort';",
            'export const OnboardingFlow = () => null;',
          ].join('\n'),
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.PORT_IMPORT_OUTSIDE_DECLARATION}: src/components/onboarding/OnboardingFlow.tsx -> src/services/ports/credentialStorePort.ts`,
      );
    });

    it('(b) a presentation component importing KeyVault is flagged', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [COMPONENT_OPTIONS_PAGE]: [
            "import { createKeyVault } from '../../core/security/KeyVault';",
            'export const OptionsPage = () => null;',
          ].join('\n'),
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.BOUNDARY_MODULE_IMPORT}: src/components/options/OptionsPage.tsx -> src/core/security/KeyVault.ts`,
      );
    });

    it('(c) onboarding passing a credential-named value into a persistence call is flagged', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [COMPONENT_ONBOARDING_FLOW]: [
            'export function persistOnboarding(state: unknown, apiKey: string) {',
            '  writeWorkspaceState(state, apiKey);',
            '}',
          ].join('\n'),
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.CREDENTIAL_INTO_PERSISTENCE}: src/components/onboarding/OnboardingFlow.tsx -> writeWorkspaceState(apiKey)`,
      );
    });

    it('(d) a credential-named field in a persisted shape is flagged', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [WORKSPACE_STATE_MODULE]: [
            'export interface WorkspaceState {',
            '  workspaceId: string;',
            '  apiKey?: string;',
            '}',
          ].join('\n'),
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.CREDENTIAL_FIELD_IN_PERSISTED_SHAPE}: src/core/workspace/WorkspaceState.ts: apiKey`,
      );
    });

    it('(e) an unapproved application module importing KeyVault is flagged', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [APP_SERVICE]: [
            "import { createKeyVault } from '../../core/security/KeyVault';",
            'export const someService = () => null;',
          ].join('\n'),
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.BOUNDARY_MODULE_IMPORT}: src/core/workspace/SomeService.ts -> src/core/security/KeyVault.ts`,
      );
    });

    it('(f) a missing canonical module fails the gate instead of passing it', () => {
      const files = fixtureFiles().filter((file) => file.path !== PORT_MODULE);
      const violations = credentialBoundaryViolations({ files });

      expect(violations).toContain(
        `${VIOLATION.GATE_TARGET_MISSING}: src/services/ports/credentialStorePort.ts`,
      );
    });

    it('(g) a barrel re-export cannot evade the gate — the taint set catches it', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [SERVICES_BARREL]:
            "export { createCredentialStorePort } from './ports/credentialStorePort';",
          [COMPONENT_WIDGET]: [
            "import { createCredentialStorePort } from '../../services';",
            'export const Widget = () => null;',
          ].join('\n'),
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.BOUNDARY_MODULE_IMPORT}: src/components/common/Widget.tsx -> src/services/index.ts`,
      );
    });

    it('(h) an unresolved project specifier inside a prohibited scope is a gate hole, not a pass', () => {
      const violations = credentialBoundaryViolations({
        files: fixtureFiles({
          [COMPONENT_WIDGET]: "import './missing/module';\nexport const Widget = () => null;\n",
        }),
      });

      expect(violations).toContain(
        `${VIOLATION.UNRESOLVED_PROJECT_SPECIFIER}: src/components/common/Widget.tsx -> ./missing/module`,
      );
    });
  });

  describe('positive controls — the gate still allows', () => {
    it('(a) the canonical declaration module — interface and factory — is not a violation', () => {
      const files = fixtureFiles();
      const port = files.find((file) => file.path === PORT_MODULE);

      expect(port?.source).toContain('export interface CredentialStorePort');
      expect(port?.source).toContain('export function createCredentialStorePort');
      expect(credentialBoundaryViolations({ files })).toEqual([]);
    });

    it('(b) the approved KeyVault -> EncryptedStorage edge produces no violation', () => {
      const files = fixtureFiles();
      const keyVault = files.find((file) => file.path === KEY_VAULT_MODULE);

      expect(keyVault).toBeDefined();
      expect(moduleSpecifiers(keyVault?.source ?? '')).toContain('./EncryptedStorage');
      expect(APPROVED_VAULT_EDGES).toContainEqual([KEY_VAULT_MODULE, ENCRYPTED_STORAGE_MODULE]);
      expect(credentialBoundaryViolations({ files })).toEqual([]);
    });

    it('(c) approved Phase 2 application-layer use — the vault over the codec — is allowed', () => {
      expect(credentialBoundaryViolations({ files: fixtureFiles() })).toEqual([]);
    });

    it('(d) a test-suite entry referencing the port is out of scope (the gate scans src/ only)', () => {
      const files = fixtureFiles();
      const testEntry = files.find((file) => file.path === TEST_PORT_SUITE);

      expect(testEntry?.source).toContain('CredentialStorePort');
      expect(credentialBoundaryViolations({ files })).toEqual([]);
    });

    it('(e) a doc comment naming CredentialStorePort is not a call site (comment stripping)', () => {
      const keyVaultWithComment = [
        '/**',
        ' * Only `CredentialStorePort` (Phase 3) calls it.',
        ' *',
        " * import { createCredentialStorePort } from '../../services/ports/credentialStorePort'; // prose, not an import",
        ' */',
        "import { encryptCredential } from './EncryptedStorage';",
        'export function createKeyVault() {',
        '  return { encryptCredential };',
        '}',
      ].join('\n');

      const files = fixtureFiles({ [KEY_VAULT_MODULE]: keyVaultWithComment });

      // Without comment stripping the quoted specifier would resolve to the
      // port and this fixture would fail — the exact IN-05 regression shape.
      expect(credentialBoundaryViolations({ files })).toEqual([]);
    });
  });
});

/* ------------------------------------------------------------------ */
/* The real tree                                                       */
/* ------------------------------------------------------------------ */

describe('credential boundary — the real src/ tree', () => {
  const SCANNED_EXTENSIONS = /\.tsx?$/;

  function walkSrc(dir: string): { path: string; source: string }[] {
    const found: { path: string; source: string }[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...walkSrc(full));
      else if (SCANNED_EXTENSIONS.test(entry.name)) {
        found.push({ path: full, source: readFileSync(full, 'utf8') });
      }
    }
    return found;
  }

  const files = walkSrc(SRC_ROOT);
  const keyVault = files.find((file) => file.path === KEY_VAULT_MODULE);

  it('scans a non-empty src/ tree, every prohibited scope, and no tests/ path (non-vacuity)', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const scope of PROHIBITED_SCOPES) {
      expect(
        files.filter((file) => isUnder(file.path, scope)).length,
        `no file scanned under ${relative(scope)} — the scope claim would be vacuous`,
      ).toBeGreaterThan(0);
    }
    expect(files.every((file) => file.path.startsWith(SRC_ROOT + sep))).toBe(true);
    expect(files.filter((file) => isUnder(file.path, join(process.cwd(), 'tests')))).toEqual([]);
  });

  it('produces no violation over the real tree', () => {
    expect(credentialBoundaryViolations({ files })).toEqual([]);
  });

  it('IN-05 regression pin: the KeyVault doc comment still names CredentialStorePort, and that is not a violation', () => {
    // The pin cannot pass by the comment having been deleted to satisfy a gate.
    expect(keyVault?.source).toContain('CredentialStorePort');
    expect(credentialBoundaryViolations({ files })).toEqual([]);
  });

  it('approved-edge pin: the live KeyVault -> EncryptedStorage edge exists and is the only approved vault import', () => {
    expect(moduleSpecifiers(keyVault?.source ?? '')).toContain('./EncryptedStorage');
    expect(APPROVED_VAULT_EDGES).toEqual([[KEY_VAULT_MODULE, ENCRYPTED_STORAGE_MODULE]]);
    expect(credentialBoundaryViolations({ files })).toEqual([]);
  });

  it('Phase-1-surface pin: no file under any of the four prohibited scopes produces a violation', () => {
    const violations = credentialBoundaryViolations({ files });
    for (const scope of PROHIBITED_SCOPES) {
      expect(
        violations.filter((violation) => violation.includes(relative(scope))),
        relative(scope),
      ).toEqual([]);
    }
  });
});
