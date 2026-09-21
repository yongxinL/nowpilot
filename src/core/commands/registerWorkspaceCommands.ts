import { CommandRegistry, type Command } from './CommandRegistry';

/**
 * The Phase-1 command set (D-09 / D-10, UI-SPEC § Command palette copy).
 *
 * Both surfaces register **shell/navigation commands only**; the palette
 * renders whatever `CommandRegistry` holds, so a later phase registers chat,
 * notes, tools or diagnostics commands with no palette change.
 *
 * Registration order is the palette's render order:
 *   Side Panel : open-standalone-view, open-options, toggle-theme
 *   Standalone : focus-side-panel, open-standalone-view, open-options,
 *                toggle-theme
 * followed — in a development build only — by the destructive
 * `reload-extension`.
 *
 * `reload-extension` is dev-only (D-10): it is registered behind
 * `import.meta.env.DEV`, it is marked `destructive` so the palette demands an
 * explicit confirmation, and it can never auto-run on a partial match. A
 * production build never reaches it.
 *
 * The deps-injection shape and the per-id unregister list in the returned
 * cleanup closure are the contract: a remount without calling the cleanup
 * throws on the duplicate id, which is the intended strict behaviour.
 */

const OPEN_STANDALONE_VIEW: Omit<Command, 'action'> = {
  id: 'open-standalone-view',
  name: 'Open Standalone view',
  description: 'Open the Standalone view in a new tab, or focus the existing one',
  category: 'navigation',
};

const OPEN_OPTIONS: Omit<Command, 'action'> = {
  id: 'open-options',
  name: 'Open Options',
  description: 'Open NowPilot settings in the Standalone view',
  category: 'navigation',
};

const TOGGLE_THEME: Omit<Command, 'action'> = {
  id: 'toggle-theme',
  name: 'Toggle theme',
  description: 'Cycle the display mode: Auto, Light, Dark',
  category: 'theme',
};

const FOCUS_SIDE_PANEL: Omit<Command, 'action'> = {
  id: 'focus-side-panel',
  name: 'Focus Side Panel',
  description: 'Open the side panel for the current tab',
  category: 'navigation',
};

const RELOAD_EXTENSION: Omit<Command, 'action'> = {
  id: 'reload-extension',
  name: 'Reload extension',
  description: 'Reload the extension to apply development changes',
  category: 'system',
  destructive: true,
};

function command(definition: Omit<Command, 'action'>, action: () => void): Command {
  return { ...definition, action };
}

/** The development-only gate for the destructive reload command (D-10). */
function isDevelopmentBuild(): boolean {
  return import.meta.env.DEV === true;
}

export interface SidepanelCommandDeps {
  openStandalone: () => void;
  openOptions: () => void;
  toggleTheme: () => void;
  reloadExtension: () => void;
}

export function registerSidepanelCommands(deps: SidepanelCommandDeps): () => void {
  const ids: string[] = [];
  const register = (entry: Command): void => {
    CommandRegistry.register(entry);
    ids.push(entry.id);
  };

  register(command(OPEN_STANDALONE_VIEW, () => deps.openStandalone()));
  register(command(OPEN_OPTIONS, () => deps.openOptions()));
  register(command(TOGGLE_THEME, () => deps.toggleTheme()));
  if (isDevelopmentBuild()) {
    register(command(RELOAD_EXTENSION, () => deps.reloadExtension()));
  }

  return () => {
    for (const id of ids) {
      CommandRegistry.unregister(id);
    }
  };
}

export interface StandaloneCommandDeps {
  focusSidePanel: () => void;
  openStandalone: () => void;
  openOptions: () => void;
  toggleTheme: () => void;
  reloadExtension: () => void;
}

export function registerStandaloneCommands(deps: StandaloneCommandDeps): () => void {
  const ids: string[] = [];
  const register = (entry: Command): void => {
    CommandRegistry.register(entry);
    ids.push(entry.id);
  };

  register(command(FOCUS_SIDE_PANEL, () => deps.focusSidePanel()));
  register(command(OPEN_STANDALONE_VIEW, () => deps.openStandalone()));
  register(command(OPEN_OPTIONS, () => deps.openOptions()));
  register(command(TOGGLE_THEME, () => deps.toggleTheme()));
  if (isDevelopmentBuild()) {
    register(command(RELOAD_EXTENSION, () => deps.reloadExtension()));
  }

  return () => {
    for (const id of ids) {
      CommandRegistry.unregister(id);
    }
  };
}
