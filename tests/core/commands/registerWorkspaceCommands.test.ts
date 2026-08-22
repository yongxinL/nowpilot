import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from '../../../src/core/commands/CommandRegistry';
import {
  registerStandaloneCommands,
  type StandaloneCommandDeps,
} from '../../../src/core/commands/registerWorkspaceCommands';

const STANDALONE_COMMAND_IDS = [
  'focus-side-panel',
  'open-options',
  'toggle-theme',
  'reload-extension',
] as const;

describe('registerStandaloneCommands (D-08, REQ-F20)', () => {
  const makeDeps = (): {
    deps: StandaloneCommandDeps;
    spies: { [K in keyof StandaloneCommandDeps]: ReturnType<typeof vi.fn> };
  } => {
    const focusSidePanel = vi.fn();
    const openOptions = vi.fn();
    const toggleTheme = vi.fn();
    const reloadExtension = vi.fn();
    return {
      deps: { focusSidePanel, openOptions, toggleTheme, reloadExtension },
      spies: { focusSidePanel, openOptions, toggleTheme, reloadExtension },
    };
  };

  beforeEach(() => {
    // Reset CommandRegistry between tests.
    for (const cmd of CommandRegistry.getAll()) {
      CommandRegistry.unregister(cmd.id);
    }
  });

  it('registers exactly the 4-command Flow-10 base set in the documented order', () => {
    const { deps } = makeDeps();
    registerStandaloneCommands(deps);

    const ids = CommandRegistry.getAll().map((c) => c.id);
    expect(ids).toEqual(STANDALONE_COMMAND_IDS);
  });

  it('each registered command carries the name/category required by UI-SPEC Copywriting Contract', () => {
    const { deps } = makeDeps();
    registerStandaloneCommands(deps);

    const get = (id: string) => CommandRegistry.get(id);
    expect(get('focus-side-panel')?.name).toBe('Focus Side Panel');
    expect(get('focus-side-panel')?.category).toBe('Navigation');

    expect(get('open-options')?.name).toBe('Open Options');
    expect(get('open-options')?.category).toBe('Navigation');

    expect(get('toggle-theme')?.name).toBe('Toggle theme');
    expect(get('toggle-theme')?.category).toBe('Theme');

    expect(get('reload-extension')?.name).toBe('Reload extension');
    expect(get('reload-extension')?.category).toBe('Extension');
  });

  it('returned cleanup unregisters all 4 ids (no leftover registrations, no throw on subsequent register)', () => {
    const { deps } = makeDeps();
    const cleanup = registerStandaloneCommands(deps);
    expect(CommandRegistry.getAll()).toHaveLength(4);

    cleanup();

    expect(CommandRegistry.getAll()).toHaveLength(0);

    // RE-registration must NOT throw — the cleanup ran, so no duplicate.
    expect(() => registerStandaloneCommands(deps)).not.toThrow();
  });

  it('invoking focus-side-panel.action calls the deps.focusSidePanel callback exactly once', () => {
    const { deps, spies } = makeDeps();
    registerStandaloneCommands(deps);

    const cmd = CommandRegistry.get('focus-side-panel');
    expect(cmd).toBeDefined();
    cmd!.action();

    expect(spies.focusSidePanel).toHaveBeenCalledTimes(1);
    expect(spies.openOptions).not.toHaveBeenCalled();
    expect(spies.toggleTheme).not.toHaveBeenCalled();
    expect(spies.reloadExtension).not.toHaveBeenCalled();
  });

  it('invoking open-options.action calls deps.openOptions exactly once', () => {
    const { deps, spies } = makeDeps();
    registerStandaloneCommands(deps);
    CommandRegistry.get('open-options')!.action();
    expect(spies.openOptions).toHaveBeenCalledTimes(1);
  });

  it('invoking toggle-theme.action calls deps.toggleTheme exactly once', () => {
    const { deps, spies } = makeDeps();
    registerStandaloneCommands(deps);
    CommandRegistry.get('toggle-theme')!.action();
    expect(spies.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('invoking reload-extension.action calls deps.reloadExtension exactly once (destructive; explicit-only per REQ-F20)', () => {
    const { deps, spies } = makeDeps();
    registerStandaloneCommands(deps);
    CommandRegistry.get('reload-extension')!.action();
    expect(spies.reloadExtension).toHaveBeenCalledTimes(1);
  });

  it('registering twice without cleanup throws on the duplicate id (CommandRegistry contract)', () => {
    const { deps } = makeDeps();
    registerStandaloneCommands(deps);
    expect(() => registerStandaloneCommands(deps)).toThrow(/Command already registered/);
  });

  it('CommandRegistry.search("") returns the 4 commands in registration order', () => {
    const { deps } = makeDeps();
    registerStandaloneCommands(deps);
    const results = CommandRegistry.search('');
    expect(results.map((c) => c.id)).toEqual(STANDALONE_COMMAND_IDS);
  });
});
