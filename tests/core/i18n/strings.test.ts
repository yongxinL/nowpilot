import { describe, it, expect } from 'vitest';
import { format, strings, t } from '../../../src/core/i18n/strings';

/**
 * Canonical string-map gate (plan `01-04`, Task 2).
 *
 * Copy exactness against `01-UI-SPEC.md` § Copywriting Contract is an
 * automated gate here, not a review habit: the shells resolve their
 * expectations through `t('…')` (`tests/components/*.test.tsx`), so this suite
 * is the only place the pinned *values* are asserted.
 *
 * Seven properties are pinned:
 *   1. every canonical key resolves to its pinned value (strict equality);
 *   2. no required key resolves to its own name (T-1-18 — a missing key would
 *      otherwise render `a11y.options` on screen silently);
 *   3. `{token}` interpolation is total and leaves an unsupplied token visible;
 *   4. no unrendered `{` survives outside the interpolation carriers, and the
 *      deprecated `chat.retry` / `chat.switchProvider` spellings are gone;
 *   5. every AntD locale default the phase overrides is pinned explicitly
 *      (T-1-19 — no framework default is reachable);
 *   6. no map value carries a provider-key shape (T-1-16 — the failure labels
 *      describe the failure, never the credential);
 *   7. the module is pure: two imports share one frozen table.
 */

/**
 * The full required-key list — every canonical Phase-1 key and its pinned
 * value. A sample would let a key regress unnoticed, so this table is the
 * complete set (cases 1, 2 and 4 all enumerate it).
 */
const CANONICAL_STRINGS: Record<string, string> = {
  // Shells, states and errors
  'chat.empty': 'Start a conversation',
  'chat.emptyBody':
    'Chat is not available in this release. Press ⌘K for available commands.',
  'chat.error': 'Provider error. [Retry] [Switch Provider]',
  'chat.noProvider': 'Configure an AI provider in Settings first.',
  'chat.composerPlaceholder': 'Ask anything, choose a workflow, or use / prompts',
  'workspace.handoffPending': 'Opening workspace in standalone view...',
  'workspace.handoffComplete': 'Workspace opened in standalone view.',
  'standalone.openFailed': 'Failed to open Standalone view',
  'standalone.minWidth':
    'This view is optimized for wider screens; open the side panel for narrow layouts.',
  'standalone.globalSearchPlaceholder': 'Search notes, tags, or content…',
  'theme.syncFailed': 'Theme sync failed — your display mode is still applied.',
  'theme.syncRetry': 'Retry sync',
  'shell.errorTitle': 'Something went wrong',
  'shell.errorBody': 'Reload NowPilot to continue.',
  'shell.errorReload': 'Reload',
  'provider.credentialsCleared':
    'Provider credentials must be configured again after secure credential storage is available.',
  'provider.credentialsClearedDismiss': 'Dismiss',

  // Onboarding
  'onboarding.step1Title': 'Meet NowPilot',
  'onboarding.step2Title': 'Pick a provider',
  'onboarding.step3Title': 'Enter your API key',
  'onboarding.step4Title': 'Validate connection',
  'onboarding.stepIndicator': 'Step {n} of 4',
  'onboarding.providerPlaceholder': 'Select an AI provider',
  'onboarding.testing': 'Testing connection...',
  'onboarding.validate': 'Check connection',
  'onboarding.connected': 'Connected',
  'onboarding.failed': 'Connection failed: {error}',
  'onboarding.retry': 'Retry',
  'onboarding.editKey': 'Edit key',
  'onboarding.finish': 'Finish setup',
  'onboarding.continue': 'Continue',
  'onboarding.back': 'Back',
  'onboarding.skip': 'Skip',
  'onboarding.switchToFullSetup': 'Switch to Full setup',
  'onboarding.showKey': 'Show API key',
  'onboarding.hideKey': 'Hide API key',
  'onboarding.keyPlaceholder': 'Paste your API key',
  'onboarding.step1Body': 'NowPilot is your workspace copilot. Setup takes four short steps.',
  'onboarding.step2Body':
    'Choose the AI provider NowPilot will use. You can change this later.',
  'onboarding.step3Body':
    'Paste your provider key. It stays in this screen and is not saved in this release.',
  'onboarding.step4Body': 'Check the connection before finishing setup.',

  // Typed validation-failure labels (the `{error}` slot values)
  'provider.error.PROVIDER_AUTH': 'the provider rejected this key',
  'provider.error.PROVIDER_5XX': 'the provider is unavailable',
  'provider.error.NETWORK': 'the network is unavailable',
  'provider.error.PROVIDER_CHECK_FAILED': 'the connection could not be verified',

  // Accessible names
  'a11y.options': 'Options',
  'a11y.switchToFullChat': 'Switch to Full chat',
  'a11y.attach': 'Attach',
  'a11y.chatHistory': 'Chat history',
  'a11y.newChat': 'New chat',
  'a11y.send': 'Send message',
  'a11y.help': 'Help',
  'a11y.feedback': 'Feedback',
  'a11y.globalSearch': 'Global search',
  'a11y.moreActions': 'More actions',
  'a11y.collapseSidebar': 'Collapse sidebar',
  'a11y.expandSidebar': 'Expand sidebar',
  'a11y.closeDialog': 'Close',

  // Command palette chrome
  'commands.placeholder': 'Search commands…',
  'commands.noResults': 'No matching commands — try a different search term',
  'commands.category.navigation': 'Navigation',
  'commands.category.theme': 'Appearance',
  'commands.category.system': 'System',

  // Fixture-backed & deferred marking
  'deferred.tag': 'Not available yet',
  'deferred.fixtureTag': 'Preview data',
  'deferred.reasonDeferred': 'This arrives in a later release.',
  'deferred.reasonFixture': 'This preview does not contact a provider.',
  'deferred.phaseBody': 'This page arrives in Phase {phase}.',

  // Common
  'common.continue': 'Continue',
  'common.notNow': 'Not now',

  // Destructive confirmation
  'command.reloadExtension.confirm':
    'Reload extension: this restarts the extension and discards unsaved state. Continue?',
};

const REQUIRED_KEYS = Object.keys(CANONICAL_STRINGS);

/**
 * The only keys whose pinned value legitimately carries a `{token}` slot.
 * (`onboarding.failed` interpolates the typed failure label; `deferred.phaseBody`
 * interpolates the owning roadmap phase.)
 */
const INTERPOLATION_CARRIERS = [
  'onboarding.stepIndicator',
  'onboarding.failed',
  'deferred.phaseBody',
];

describe('strings — value exactness', () => {
  it('resolves every canonical Phase-1 key to its pinned UI-SPEC value', () => {
    for (const [key, value] of Object.entries(CANONICAL_STRINGS)) {
      expect(t(key), `t('${key}')`).toBe(value);
    }
    // The table is the complete required set, not a sample.
    expect(REQUIRED_KEYS.length).toBeGreaterThanOrEqual(70);
  });

  it('pins the shell/state/error copy and the onboarding action labels verbatim', () => {
    // Shell / state / error keys — the copy a user meets on a failure path.
    const shellAndErrors = [
      'chat.empty',
      'chat.emptyBody',
      'chat.error',
      'chat.noProvider',
      'chat.composerPlaceholder',
      'workspace.handoffPending',
      'workspace.handoffComplete',
      'standalone.openFailed',
      'standalone.minWidth',
      'theme.syncFailed',
      'theme.syncRetry',
      'shell.errorTitle',
      'shell.errorBody',
      'shell.errorReload',
      'provider.credentialsCleared',
    ];
    for (const key of shellAndErrors) {
      expect(t(key), `t('${key}')`).toBe(CANONICAL_STRINGS[key]);
    }

    // Onboarding action labels — never a paraphrase of the prototype's.
    const onboardingActions = [
      'onboarding.step1Title',
      'onboarding.step2Title',
      'onboarding.step3Title',
      'onboarding.step4Title',
      'onboarding.providerPlaceholder',
      'onboarding.testing',
      'onboarding.validate',
      'onboarding.connected',
      'onboarding.failed',
      'onboarding.retry',
      'onboarding.editKey',
      'onboarding.finish',
      'onboarding.continue',
      'onboarding.back',
      'onboarding.skip',
      'onboarding.switchToFullSetup',
      'onboarding.showKey',
      'onboarding.hideKey',
      'onboarding.keyPlaceholder',
    ];
    for (const key of onboardingActions) {
      expect(t(key), `t('${key}')`).toBe(CANONICAL_STRINGS[key]);
    }

    // The bracket convention survives verbatim: both action-label tokens are
    // retained in the single canonical chat-error string.
    expect(t('chat.error')).toBe('Provider error. [Retry] [Switch Provider]');
    expect(t('chat.error')).toContain('[Retry]');
    expect(t('chat.error')).toContain('[Switch Provider]');
  });

  it('carries the copy hygiene rules: no exclamation mark, three ASCII periods', () => {
    for (const key of Object.keys(strings)) {
      expect(t(key).endsWith('!'), `t('${key}') must not end with '!'`).toBe(false);
    }

    // `Testing connection...` uses three ASCII periods, never U+2026.
    expect(t('onboarding.testing')).toBe('Testing connection...');
    expect(t('onboarding.testing').includes('\u2026')).toBe(false);
    expect((t('onboarding.testing').match(/\./g) ?? []).length).toBe(3);
  });
});

describe('strings — key coverage', () => {
  it('resolves every required key to something other than the key itself', () => {
    const selfResolving = REQUIRED_KEYS.filter((key) => t(key) === key);
    // A missing key renders its own name on screen; this must fail loudly.
    expect(selfResolving).toEqual([]);

    for (const key of REQUIRED_KEYS) {
      expect(t(key).length, `t('${key}') must not be empty`).toBeGreaterThan(0);
    }
  });

  it('returns the key itself for a key that is genuinely absent', () => {
    expect(t('a.key.that.does.not.exist')).toBe('a.key.that.does.not.exist');
  });
});

describe('strings — interpolation', () => {
  it('substitutes every {token} occurrence', () => {
    expect(format('onboarding.stepIndicator', { n: 1 })).toBe('Step 1 of 4');
    expect(format('onboarding.stepIndicator', { n: 4 })).toBe('Step 4 of 4');
    expect(format('onboarding.failed', { error: 'the provider rejected this key' })).toBe(
      'Connection failed: the provider rejected this key',
    );
    expect(format('deferred.phaseBody', { phase: 15 })).toBe('This page arrives in Phase 15.');
  });

  it('leaves an unsupplied token visible instead of rendering undefined', () => {
    expect(format('onboarding.stepIndicator', {})).toContain('{n}');
    expect(format('onboarding.stepIndicator', {})).not.toContain('undefined');
    expect(format('onboarding.failed', {})).toBe('Connection failed: {error}');
    expect(format('deferred.phaseBody', {})).toContain('{phase}');
  });

  it('is total: a missing key or an empty params object never throws', () => {
    expect(() => format('a.key.that.does.not.exist', {})).not.toThrow();
    expect(format('a.key.that.does.not.exist', {})).toBe('a.key.that.does.not.exist');
    expect(format('chat.empty', {})).toBe('Start a conversation');
  });
});

describe('strings — no unrendered interpolation, no deprecated spellings', () => {
  it('carries a { token only in the interpolation carriers', () => {
    const carriers = new Set(INTERPOLATION_CARRIERS);
    const unexpected = Object.entries(strings)
      .filter(([key, value]) => value.includes('{') && !carriers.has(key))
      .map(([key]) => key);

    expect(unexpected).toEqual([]);

    // Each carrier's slot is exactly the token its call site supplies.
    expect(t('onboarding.stepIndicator')).toMatch(/\{n\}/);
    expect(t('onboarding.failed')).toMatch(/\{error\}/);
    expect(t('deferred.phaseBody')).toMatch(/\{phase\}/);
  });

  it('retired the deprecated chat.retry / chat.switchProvider second spellings', () => {
    // They resolve to their own names, which is the proof that the keys were
    // deleted rather than kept alongside the canonical single key.
    expect(t('chat.retry')).toBe('chat.retry');
    expect(t('chat.switchProvider')).toBe('chat.switchProvider');
  });

  it('retains no prototype divergence value from the UI-SPEC corrections table', () => {
    const DIVERGENT_VALUES = [
      'Connected!',
      'Skip for now',
      'Try again',
      'Connect Provider',
      'Open in Full Tab',
      'Choose a provider',
      'Start chatting',
      'Something went wrong. Please reload the extension.',
      "Couldn't apply theme to other surface",
    ];

    const surviving = Object.entries(strings)
      .filter(([, value]) => DIVERGENT_VALUES.includes(value))
      .map(([key]) => key);
    expect(surviving).toEqual([]);
  });
});

describe('strings — AntD locale-default overrides', () => {
  /**
   * Each entry's `localeDefault` is the AntD `enUS` string the phase must not
   * let through. Three of the four pinned values replace a *different* word
   * (`OK`, `Cancel`, `Please select`). `a11y.closeDialog` is the deliberate
   * exception: the UI-SPEC pins `Close`, the same word AntD ships, so that the
   * value is explicit and translatable rather than sourced from a framework
   * default. What makes it safe is that the key is **explicitly present** — an
   * absent key would resolve to its own name — which is asserted below.
   */
  const LOCALE_OVERRIDES: Array<{ key: string; pinned: string; localeDefault: string }> = [
    { key: 'common.continue', pinned: 'Continue', localeDefault: 'OK' },
    { key: 'common.notNow', pinned: 'Not now', localeDefault: 'Cancel' },
    {
      key: 'onboarding.providerPlaceholder',
      pinned: 'Select an AI provider',
      localeDefault: 'Please select',
    },
    { key: 'a11y.closeDialog', pinned: 'Close', localeDefault: 'Close' },
  ];

  it('pins every overridden AntD default explicitly, never by locale fallback', () => {
    for (const { key, pinned } of LOCALE_OVERRIDES) {
      expect(t(key), `t('${key}')`).toBe(pinned);
      expect(t(key).length, `t('${key}') must not be empty`).toBeGreaterThan(0);
      // Explicitly present: the `?? key` fallback would have returned the key.
      expect(t(key), `t('${key}') must be an explicit entry`).not.toBe(key);
    }

    // The three values that must differ from the default they override.
    expect(t('common.continue')).not.toBe('OK');
    expect(t('common.notNow')).not.toBe('Cancel');
    expect(t('onboarding.providerPlaceholder')).not.toBe('Please select');
  });
});

describe('strings — credential-shape absence', () => {
  it('carries no provider-key shape in any value', () => {
    // A key-style prefix followed by an id-shaped run (e.g. `sk-…`).
    const KEY_PREFIX = /\b(?:sk|pk|rk|api[_-]?key|token|secret)[-_][A-Za-z0-9_-]{6,}/i;
    // An explicit credential assignment (`api_key: …`).
    const CREDENTIAL_ASSIGNMENT = /(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*\S+/i;
    // A 32+ character unbroken alphanumeric run — the shape of a raw key.
    const LONG_ALNUM_RUN = /[A-Za-z0-9]{32,}/;

    for (const [key, value] of Object.entries(strings)) {
      expect(KEY_PREFIX.test(value), `t('${key}') must not contain a key-shaped prefix`).toBe(
        false,
      );
      expect(
        CREDENTIAL_ASSIGNMENT.test(value),
        `t('${key}') must not contain a credential assignment`,
      ).toBe(false);
      expect(
        LONG_ALNUM_RUN.test(value),
        `t('${key}') must not contain a 32+ character alphanumeric run`,
      ).toBe(false);
    }
  });

  it('describes each validation failure without naming the credential', () => {
    const FAILURE_LABELS = [
      'provider.error.PROVIDER_AUTH',
      'provider.error.PROVIDER_5XX',
      'provider.error.NETWORK',
      'provider.error.PROVIDER_CHECK_FAILED',
    ];
    // Key-shaped material: `sk-…`, a 32+ character run, or base64-ish filler.
    const KEY_SHAPED = /sk-|[A-Za-z0-9]{32,}|[A-Za-z0-9+/]{20,}={0,2}/;

    for (const key of FAILURE_LABELS) {
      expect(t(key), `t('${key}')`).toBe(CANONICAL_STRINGS[key]);
      expect(KEY_SHAPED.test(t(key)), `t('${key}') must name no credential`).toBe(false);
    }
  });
});

describe('strings — purity', () => {
  it('shares one immutable table across two concurrent imports', async () => {
    const [first, second] = await Promise.all([
      import('../../../src/core/i18n/strings'),
      import('../../../src/core/i18n/strings'),
    ]);

    expect(second.strings).toBe(first.strings);
    expect(first.strings).toBe(strings);
    expect(Object.isFrozen(strings)).toBe(true);
  });

  it('cannot be mutated: a failed write leaves the next resolve unchanged', () => {
    // `Reflect.set` returns false on a frozen object rather than throwing.
    expect(Reflect.set(strings, 'chat.empty', 'tampered')).toBe(false);
    expect(t('chat.empty')).toBe('Start a conversation');

    // Two successive resolves are strictly equal — values are primitives, so a
    // caller cannot mutate what `t()` hands back.
    const first = t('chat.empty');
    expect(t('chat.empty')).toBe(first);
    expect(t('chat.empty')).toBe(t('chat.empty'));
  });
});
