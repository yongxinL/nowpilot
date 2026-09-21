/**
 * Canonical Phase-1 string map.
 *
 * Every user-visible string reachable in Phase 1 resolves through `t('key')`
 * from this module. The values are pinned verbatim by
 * `01-UI-SPEC.md` § Copywriting Contract (which defers to `PRODUCT_SPEC`
 * Appendix B where a canonical `STR.*` value exists); `§0.2` forbids
 * paraphrasing them. Where the prototype diverged from Appendix B, the
 * canonical value replaced the prototype spelling rather than sitting beside it.
 *
 * The module is **pure data**: no side effects, no Chrome access, no `fetch`,
 * no storage read and no environment read. `strings` is frozen, so importing
 * this module twice — or from two suites at once — yields the same immutable
 * table.
 *
 * Bracket convention: inside a canonical string, a bracketed token
 * (`[Retry]`, `[Switch Provider]`) denotes an **action label** rendered as an
 * inline link or button carrying that exact word. The map stores the bracketed
 * form verbatim; the rendering component owns the substitution. Literal
 * brackets never reach the DOM.
 */

export const strings: Readonly<Record<string, string>> = Object.freeze({
  // ── Shells, states and errors ────────────────────────────────────────────
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
  // The preserved (unmounted) ThemeToggle's mode labels and accessible name.
  'theme.auto': 'Auto',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'shell.errorTitle': 'Something went wrong',
  'shell.errorBody': 'Reload NowPilot to continue.',
  'shell.errorReload': 'Reload',
  'provider.credentialsCleared':
    'Provider credentials must be configured again after secure credential storage is available.',
  'provider.credentialsClearedDismiss': 'Dismiss',

  // ── Onboarding (Flow 9) ──────────────────────────────────────────────────
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

  // Typed validation-failure labels — the `{error}` slot values. Each label
  // describes the FAILURE, never the credential that caused it (T-1-16).
  'provider.error.PROVIDER_AUTH': 'the provider rejected this key',
  'provider.error.PROVIDER_5XX': 'the provider is unavailable',
  'provider.error.NETWORK': 'the network is unavailable',
  'provider.error.PROVIDER_CHECK_FAILED': 'the connection could not be verified',

  // ── Accessible names (icon-only controls carry aria-label + tooltip) ─────
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
  'a11y.themeMode': 'Theme mode',

  // ── Command palette chrome ───────────────────────────────────────────────
  // Command label/description metadata is registry data (plan 01-08), not copy.
  'commands.placeholder': 'Search commands…',
  'commands.noResults': 'No matching commands — try a different search term',
  'commands.category.navigation': 'Navigation',
  'commands.category.theme': 'Appearance',
  'commands.category.system': 'System',

  // ── Fixture-backed & deferred marking (D-16) ─────────────────────────────
  'deferred.tag': 'Not available yet',
  'deferred.fixtureTag': 'Preview data',
  'deferred.reasonDeferred': 'This arrives in a later release.',
  'deferred.reasonFixture': 'This preview does not contact a provider.',
  'deferred.phaseBody': 'This page arrives in Phase {phase}.',

  // ── Common ───────────────────────────────────────────────────────────────
  'common.continue': 'Continue',
  'common.notNow': 'Not now',

  // ── Destructive confirmation (dev-only reload command, D-10) ─────────────
  'command.reloadExtension.confirm':
    'Reload extension: this restarts the extension and discards unsaved state. Continue?',

  // LEGACY — prototype-only keys, removed by the plan that deletes their last consumer (01-09 onboarding, 01-10 pages, 01-11 dev shell). Do not add keys here.
  // Kept only while a live `t(...)` call site still resolves through them: a
  // deleted key renders its own name on screen. No key here duplicates a
  // canonical value above.
  'app.name': 'NowPilot',
  'common.back': 'Back',
  'agent.empty': 'Describe a task and the agent will plan steps',
  'options.loading': 'Loading settings...',
  'notes.empty': 'No notes yet. Press + to create one.',
});

/**
 * Resolve a string key.
 *
 * A key that is absent from the map resolves to **its own name**, so a missing
 * key is visible on screen instead of rendering as an empty region.
 * `tests/core/i18n/strings.test.ts` asserts that every canonical Phase-1 key
 * resolves to a value that is not the key itself.
 */
export function t(key: string): string {
  return strings[key] ?? key;
}

/**
 * Resolve a key and substitute its `{token}` slots.
 *
 * Replaces **every** `{token}` occurrence with `String(params[token])`. A token
 * with no supplied param is left intact, so a missing param degrades to a
 * visible `{token}` rather than `undefined` reaching the DOM. Pure and total:
 * it never throws on a missing key or an empty params object.
 */
export function format(key: string, params: Record<string, string | number> = {}): string {
  return t(key).replace(/\{([^{}]+)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(params, token) ? String(params[token]) : match,
  );
}
