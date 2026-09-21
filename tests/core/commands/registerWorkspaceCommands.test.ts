import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CommandRegistry } from '../../../src/core/commands/CommandRegistry';
import {
  registerStandaloneCommands,
  registerSidepanelCommands,
  type StandaloneCommandDeps,
  type SidepanelCommandDeps,
} from '../../../src/core/commands/registerWorkspaceCommands';
import { useThemeStore, cycleThemeMode } from '../../../src/core/theme/ThemeStore';
import { t } from '../../../src/core/i18n/strings';

/**
 * D-09 / D-10 — the Phase-1 command set, and the dev-only destructive command.
 *
 * The set is pinned exactly (ids, order, metadata), `reload-extension` is
 * proven absent from a production-mode registry, and the `Toggle theme`
 * command is proven to cycle through the single theme writer
 * (`cycleThemeMode`) rather than introducing a second theme path.
 */

const SIDEPANEL_PRODUCTION_IDS = ['open-standalone-view', 'open-options', 'toggle-theme'] as const;
const SIDEPANEL_DEV_IDS = [...SIDEPANEL_PRODUCTION_IDS, 'reload-extension'] as const;

const STANDALONE_PRODUCTION_IDS = [
  'focus-side-panel',
  'open-standalone-view',
  'open-options',
  'toggle-theme',
] as const;
const STANDALONE_DEV_IDS = [...STANDALONE_PRODUCTION_IDS, 'reload-extension'] as const;

function clearRegistry(): void {
  for (const cmd of CommandRegistry.getAll()) {
    CommandRegistry.unregister(cmd.id);
  }
}

function makeStandaloneDeps() {
  const focusSidePanel = vi.fn();
  const openStandalone = vi.fn();
  const openOptions = vi.fn();
  const toggleTheme = vi.fn();
  const reloadExtension = vi.fn();
  const deps: StandaloneCommandDeps = {
    focusSidePanel,
    openStandalone,
    openOptions,
    toggleTheme,
    reloadExtension,
  };
  return { deps, spies: { focusSidePanel, openStandalone, openOptions, toggleTheme, reloadExtension } };
}

function makeSidepanelDeps() {
  const openStandalone = vi.fn();
  const openOptions = vi.fn();
  const toggleTheme = vi.fn();
  const reloadExtension = vi.fn();
  const deps: SidepanelCommandDeps = { openStandalone, openOptions, toggleTheme, reloadExtension };
  return { deps, spies: { openStandalone, openOptions, toggleTheme, reloadExtension } };
}

beforeEach(() => {
  clearRegistry();
  vi.stubEnv('DEV', true);
});

afterEach(() => {
  clearRegistry();
  vi.unstubAllEnvs();
});

describe('registerSidepanelCommands — the D-09 Side Panel set', () => {
  it('registers exactly the D-09 set in order, plus the dev-only reload command', () => {
    const { deps } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    expect(CommandRegistry.getAll().map((c) => c.id)).toEqual([...SIDEPANEL_DEV_IDS]);
  });

  it('omits the destructive reload command from a production build', () => {
    vi.stubEnv('DEV', false);
    const { deps } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    expect(CommandRegistry.getAll().map((c) => c.id)).toEqual([...SIDEPANEL_PRODUCTION_IDS]);
    expect(CommandRegistry.get('reload-extension')).toBeUndefined();
  });

  it('carries the UI-SPEC label, description and resolved category for every command', () => {
    const { deps } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    const openStandalone = CommandRegistry.get('open-standalone-view');
    expect(openStandalone?.name).toBe('Open Standalone view');
    expect(openStandalone?.description).toBe(
      'Open the Standalone view in a new tab, or focus the existing one',
    );
    expect(t(`commands.category.${openStandalone?.category}`)).toBe('Navigation');

    const openOptions = CommandRegistry.get('open-options');
    expect(openOptions?.name).toBe('Open Options');
    expect(openOptions?.description).toBe('Open NowPilot settings in the Standalone view');
    expect(t(`commands.category.${openOptions?.category}`)).toBe('Navigation');

    const toggleTheme = CommandRegistry.get('toggle-theme');
    expect(toggleTheme?.name).toBe('Toggle theme');
    expect(toggleTheme?.description).toBe('Cycle the display mode: Auto, Light, Dark');
    expect(t(`commands.category.${toggleTheme?.category}`)).toBe('Appearance');

    const reload = CommandRegistry.get('reload-extension');
    expect(reload?.name).toBe('Reload extension');
    expect(reload?.description).toBe('Reload the extension to apply development changes');
    expect(t(`commands.category.${reload?.category}`)).toBe('System');
    expect(reload?.destructive).toBe(true);
  });

  it('never renders a prototype category literal (Theme / Extension)', () => {
    const { deps } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    const categories = CommandRegistry.getAll().map((c) => t(`commands.category.${c.category}`));
    expect(categories).not.toContain('Theme');
    expect(categories).not.toContain('Extension');
  });

  it('does not register focus-side-panel (the user is already in the Side Panel)', () => {
    const { deps } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    expect(CommandRegistry.get('focus-side-panel')).toBeUndefined();
  });

  it('routes each action to its injected dep exactly once', () => {
    const { deps, spies } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    CommandRegistry.get('open-standalone-view')!.action();
    CommandRegistry.get('open-options')!.action();
    CommandRegistry.get('toggle-theme')!.action();
    CommandRegistry.get('reload-extension')!.action();

    expect(spies.openStandalone).toHaveBeenCalledTimes(1);
    expect(spies.openOptions).toHaveBeenCalledTimes(1);
    expect(spies.toggleTheme).toHaveBeenCalledTimes(1);
    expect(spies.reloadExtension).toHaveBeenCalledTimes(1);
  });

  it('the returned cleanup unregisters every id it added', () => {
    const { deps } = makeSidepanelDeps();
    const cleanup = registerSidepanelCommands(deps);
    expect(CommandRegistry.getAll()).toHaveLength(SIDEPANEL_DEV_IDS.length);

    cleanup();
    expect(CommandRegistry.getAll()).toEqual([]);
    expect(() => registerSidepanelCommands(deps)).not.toThrow();
  });

  it('registering twice without cleanup throws on the duplicate id', () => {
    const { deps } = makeSidepanelDeps();
    registerSidepanelCommands(deps);
    expect(() => registerSidepanelCommands(deps)).toThrow(/Command already registered/);
  });
});

describe('registerStandaloneCommands — the D-09 Standalone set', () => {
  it('registers focus-side-panel plus the shared set, plus the dev-only reload', () => {
    const { deps } = makeStandaloneDeps();
    registerStandaloneCommands(deps);

    expect(CommandRegistry.getAll().map((c) => c.id)).toEqual([...STANDALONE_DEV_IDS]);
  });

  it('omits the destructive reload command from a production build', () => {
    vi.stubEnv('DEV', false);
    const { deps } = makeStandaloneDeps();
    registerStandaloneCommands(deps);

    expect(CommandRegistry.getAll().map((c) => c.id)).toEqual([...STANDALONE_PRODUCTION_IDS]);
    expect(CommandRegistry.get('reload-extension')).toBeUndefined();
  });

  it('carries the UI-SPEC metadata for Focus Side Panel', () => {
    const { deps } = makeStandaloneDeps();
    registerStandaloneCommands(deps);

    const focus = CommandRegistry.get('focus-side-panel');
    expect(focus?.name).toBe('Focus Side Panel');
    expect(focus?.description).toBe('Open the side panel for the current tab');
    expect(t(`commands.category.${focus?.category}`)).toBe('Navigation');
  });

  it('routes each action to its injected dep exactly once', () => {
    const { deps, spies } = makeStandaloneDeps();
    registerStandaloneCommands(deps);

    CommandRegistry.get('focus-side-panel')!.action();
    CommandRegistry.get('open-standalone-view')!.action();
    CommandRegistry.get('open-options')!.action();
    CommandRegistry.get('toggle-theme')!.action();
    CommandRegistry.get('reload-extension')!.action();

    expect(spies.focusSidePanel).toHaveBeenCalledTimes(1);
    expect(spies.openStandalone).toHaveBeenCalledTimes(1);
    expect(spies.openOptions).toHaveBeenCalledTimes(1);
    expect(spies.toggleTheme).toHaveBeenCalledTimes(1);
    expect(spies.reloadExtension).toHaveBeenCalledTimes(1);
  });

  it('the returned cleanup unregisters every id it added', () => {
    const { deps } = makeStandaloneDeps();
    const cleanup = registerStandaloneCommands(deps);
    expect(CommandRegistry.getAll()).toHaveLength(STANDALONE_DEV_IDS.length);

    cleanup();
    expect(CommandRegistry.getAll()).toEqual([]);
    expect(() => registerStandaloneCommands(deps)).not.toThrow();
  });
});

describe('toggle-theme — one theme write path (D-15)', () => {
  it('cycles Auto -> Light -> Dark through cycleThemeMode and no second theme path', () => {
    useThemeStore.getState().setMode('auto');

    const { deps } = makeSidepanelDeps();
    deps.toggleTheme = () => {
      cycleThemeMode();
    };
    registerSidepanelCommands(deps);

    const action = CommandRegistry.get('toggle-theme')!.action;
    action();
    expect(useThemeStore.getState().mode).toBe('light');
    action();
    expect(useThemeStore.getState().mode).toBe('dark');
    action();
    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('invokes only the injected theme callback — the command owns no theme state', () => {
    useThemeStore.getState().setMode('auto');
    const { deps, spies } = makeSidepanelDeps();
    registerSidepanelCommands(deps);

    CommandRegistry.get('toggle-theme')!.action();

    expect(spies.toggleTheme).toHaveBeenCalledTimes(1);
    // The command itself never touched the store: only the injected dep can.
    expect(useThemeStore.getState().mode).toBe('auto');
  });
});

