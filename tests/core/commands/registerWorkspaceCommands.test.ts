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
import { openSidePanelForCurrentTab } from '../../../src/entrypoints/standalone/main';

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

describe('openSidePanelForCurrentTab — SA-10 gesture ordering (Pitfall 4)', () => {
  type ChromeLike = {
    sidePanel?: { open?: (options: { tabId: number }) => Promise<void> | void };
    tabs?: {
      query?: (
        queryInfo: unknown,
        callback: (tabs: Array<{ id?: number }>) => void,
      ) => void;
    };
  };

  const g = globalThis as unknown as { chrome: ChromeLike };
  const originalSidePanel = g.chrome.sidePanel;
  const originalTabs = g.chrome.tabs;

  afterEach(() => {
    if (originalSidePanel === undefined) delete g.chrome.sidePanel;
    else g.chrome.sidePanel = originalSidePanel;
    if (originalTabs === undefined) delete g.chrome.tabs;
    else g.chrome.tabs = originalTabs;
  });

  function installQueryCallbackStyle(): {
    open: ReturnType<typeof vi.fn>;
    deliver: (tabs: Array<{ id?: number }>) => void;
  } {
    const open = vi.fn(() => Promise.resolve());
    let callback: ((tabs: Array<{ id?: number }>) => void) | undefined;
    g.chrome.sidePanel = { open };
    g.chrome.tabs = {
      query: (_queryInfo, cb) => {
        callback = cb;
      },
    };
    return {
      open,
      deliver: (tabs) => {
        if (!callback) throw new Error('chrome.tabs.query was never called');
        callback(tabs);
      },
    };
  }

  it('issues the tabId-variant open synchronously — no awaited boundary before the call', () => {
    const { open, deliver } = installQueryCallbackStyle();
    const failures: unknown[] = [];

    openSidePanelForCurrentTab((failure) => failures.push(failure));
    deliver([{ id: 42 }]);

    // Synchronous assertions: the open call already happened, so nothing
    // between the gesture and `open()` awaited a window lookup.
    expect(open).toHaveBeenCalledWith({ tabId: 42 });
    expect(failures).toEqual([]);
  });

  it('degrades an unavailable side-panel API to a typed, logged failure (never a rejection)', () => {
    g.chrome.sidePanel = undefined;
    g.chrome.tabs = { query: vi.fn() };
    const failures: Array<{ code: string; error: string }> = [];

    expect(() => openSidePanelForCurrentTab((failure) => failures.push(failure))).not.toThrow();

    expect(failures).toHaveLength(1);
    expect(failures[0].code).toBe('SIDE_PANEL_UNAVAILABLE');
    expect(g.chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('reports a missing active tab with its own typed code', () => {
    const { open, deliver } = installQueryCallbackStyle();
    const failures: Array<{ code: string }> = [];

    openSidePanelForCurrentTab((failure) => failures.push(failure));
    deliver([]);

    expect(failures.map((failure) => failure.code)).toEqual(['SIDE_PANEL_NO_ACTIVE_TAB']);
    expect(open).not.toHaveBeenCalled();
  });

  it('turns a rejected sidePanel.open promise into a typed failure, not an unhandled rejection', async () => {
    const open = vi.fn(() => Promise.reject(new Error('gesture required')));
    g.chrome.sidePanel = { open };
    g.chrome.tabs = { query: (_q, cb) => cb([{ id: 7 }]) };
    const failures: Array<{ code: string; error: string }> = [];

    openSidePanelForCurrentTab((failure) => failures.push(failure));
    await Promise.resolve();
    await Promise.resolve();

    expect(open).toHaveBeenCalledWith({ tabId: 7 });
    expect(failures.map((failure) => failure.code)).toEqual(['SIDE_PANEL_OPEN_FAILED']);
    expect(failures[0].error).toContain('gesture required');
  });

  it('carries no await between the handler body and the open call (source scan)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'entrypoints', 'standalone', 'main.tsx'),
      'utf8',
    );
    const start = source.indexOf('export function openSidePanelForCurrentTab');
    expect(start).toBeGreaterThan(-1);

    const body = source.slice(start);
    const openIndex = body.indexOf('sidePanel.open(');
    expect(openIndex).toBeGreaterThan(-1);
    expect(body.slice(0, openIndex)).not.toMatch(/\bawait\b/);
    // The prototype's awaited window lookup must not come back.
    expect(source).not.toMatch(/await\s+chrome\.windows\.getCurrent/);
  });
});
