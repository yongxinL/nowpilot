import { CommandRegistry } from './CommandRegistry';

/**
 * Side-Panel Flow-10 base command set (D-08, REQ-F05, REQ-F12).
 *
 * Exactly 4 commands in this fixed registration order:
 *   1. open-standalone-view — delegates to deps.openStandalone (which calls
 *                              WorkspaceRouter.openStandalone with toasts).
 *   2. open-options          — chrome.tabs.create/update chrome-extension://.../options.html.
 *   3. toggle-theme          — cycles Auto/Light/Dark via ThemeStore.setMode.
 *   4. reload-extension      — chrome.runtime.reload() (DESTRUCTIVE — explicit
 *                              only, no partial-match auto-run per REQ-F12
 *                              prohibition).
 *
 * Intentionally does NOT include `focus-side-panel` (the user is already
 * inside the Side Panel — that command is Standalone-only, see
 * registerStandaloneCommands below).
 *
 * The set is never empty (REQ-F12 edge), and CommandRegistry.register throws
 * on duplicate id (REQ-F12 edge) — remounting without first calling the
 * returned cleanup throws, which is the intended strict behavior.
 */

export interface SidepanelCommandDeps {
  openStandalone: () => void;
  openOptions: () => void;
  toggleTheme: () => void;
  reloadExtension: () => void;
}

export function registerSidepanelCommands(deps: SidepanelCommandDeps): () => void {
  CommandRegistry.register({
    id: 'open-standalone-view',
    name: 'Open Standalone view',
    description: 'Open the Standalone view in a new tab (or focus the existing one)',
    category: 'Navigation',
    action: () => {
      deps.openStandalone();
    },
  });

  CommandRegistry.register({
    id: 'open-options',
    name: 'Open Options',
    description: 'Open the options page in a new tab',
    category: 'Navigation',
    action: () => {
      deps.openOptions();
    },
  });

  CommandRegistry.register({
    id: 'toggle-theme',
    name: 'Toggle theme',
    description: 'Cycle between auto, light, and dark theme modes',
    category: 'Theme',
    action: () => {
      deps.toggleTheme();
    },
  });

  CommandRegistry.register({
    id: 'reload-extension',
    name: 'Reload extension',
    description: 'Reload the extension to apply changes',
    category: 'Extension',
    action: () => {
      deps.reloadExtension();
    },
  });

  return () => {
    CommandRegistry.unregister('open-standalone-view');
    CommandRegistry.unregister('open-options');
    CommandRegistry.unregister('toggle-theme');
    CommandRegistry.unregister('reload-extension');
  };
}

/**
 * Standalone-side Flow-10 base command set (D-08, REQ-F20).
 *
 * Exactly 4 commands in this fixed registration order:
 *   1. focus-side-panel — gesture-safe chrome.sidePanel.open (T-01-18)
 *   2. open-options      — chrome.tabs.create/update chrome-extension://.../options.html
 *   3. toggle-theme      — cycles Auto/Light/Dark via ThemeStore.setMode
 *   4. reload-extension  — chrome.runtime.reload() (DESTRUCTIVE — explicit only,
 *                          no partial-match auto-run per REQ-F20 prohibition)
 *
 * The set is never empty (REQ-F20 edge), and CommandRegistry.register throws
 * on duplicate id (REQ-F20 edge) — remounting without first calling the
 * returned cleanup throws, which is the intended strict behavior.
 *
 * The Side Panel command set (open-standalone-view, focus-side-panel,
 * toggle-theme, reload-extension, open-options) lands in Plan 01-07 via
 * the sibling `registerSidepanelCommands` exported here.
 */

export interface StandaloneCommandDeps {
  focusSidePanel: () => void;
  openOptions: () => void;
  toggleTheme: () => void;
  reloadExtension: () => void;
}

export function registerStandaloneCommands(deps: StandaloneCommandDeps): () => void {
  CommandRegistry.register({
    id: 'focus-side-panel',
    name: 'Focus Side Panel',
    description: 'Open the side panel for the current tab',
    category: 'Navigation',
    action: () => {
      deps.focusSidePanel();
    },
  });

  CommandRegistry.register({
    id: 'open-options',
    name: 'Open Options',
    description: 'Open the options page in a new tab',
    category: 'Navigation',
    action: () => {
      deps.openOptions();
    },
  });

  CommandRegistry.register({
    id: 'toggle-theme',
    name: 'Toggle theme',
    description: 'Cycle between auto, light, and dark theme modes',
    category: 'Theme',
    action: () => {
      deps.toggleTheme();
    },
  });

  CommandRegistry.register({
    id: 'reload-extension',
    name: 'Reload extension',
    description: 'Reload the extension to apply changes',
    category: 'Extension',
    action: () => {
      deps.reloadExtension();
    },
  });

  return () => {
    CommandRegistry.unregister('focus-side-panel');
    CommandRegistry.unregister('open-options');
    CommandRegistry.unregister('toggle-theme');
    CommandRegistry.unregister('reload-extension');
  };
}
