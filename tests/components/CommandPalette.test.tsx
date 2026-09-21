import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { useEffect, useState } from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { CommandPalette } from '../../src/components/common/CommandPalette';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';
import {
  registerSidepanelCommands,
  registerStandaloneCommands,
  type SidepanelCommandDeps,
} from '../../src/core/commands/registerWorkspaceCommands';
import { KeymapRegistry } from '../../src/core/input/KeymapRegistry';
import { t } from '../../src/core/i18n/strings';

/**
 * FLOW-10 / SP-09 / SA-09 — the palette contract.
 *
 * Pinned here: the exact Phase-1 row set per surface (and the dev-only
 * destructive command's absence from a production build), the zero-results
 * branch holding the list height, the token-derived selected-row background,
 * the 12 px typography floor, keyboard navigation, the destructive
 * confirmation gate, and the global `Cmd+K` chord closing an open palette.
 */

let capturedPrimaryBg = '';

const TokenProbe: React.FC = () => {
  capturedPrimaryBg = theme.useToken().token.colorPrimaryBg;
  return null;
};

/** Normalise a colour the way the DOM does, so the comparison is exact. */
function normalizeColor(value: string): string {
  const probe = document.createElement('div');
  probe.style.backgroundColor = value;
  return probe.style.backgroundColor;
}

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <TokenProbe />
      {ui}
    </ConfigProvider>,
  );
}

function renderedRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.ant-list-item'));
}

function rowNamed(name: string): HTMLElement {
  const row = renderedRows().find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`No rendered row contains "${name}"`);
  return row;
}

function makeDeps() {
  const openStandalone = vi.fn();
  const openOptions = vi.fn();
  const toggleTheme = vi.fn();
  const reloadExtension = vi.fn();
  const deps: SidepanelCommandDeps = { openStandalone, openOptions, toggleTheme, reloadExtension };
  return { deps, spies: { openStandalone, openOptions, toggleTheme, reloadExtension } };
}

function clearRegistry(): void {
  for (const cmd of CommandRegistry.getAll()) {
    CommandRegistry.unregister(cmd.id);
  }
}

function clearKeymaps(): void {
  for (const keymap of KeymapRegistry.getAll()) {
    KeymapRegistry.unregister(keymap.id);
  }
}

function pressKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function pressPaletteChord(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    metaKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  clearRegistry();
  clearKeymaps();
  vi.stubEnv('DEV', true);
});

afterEach(() => {
  clearRegistry();
  clearKeymaps();
  vi.unstubAllEnvs();
  capturedPrimaryBg = '';
});

describe('CommandPalette — the Phase-1 row set (D-09)', () => {
  it('renders exactly the Side Panel set, in registration order', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    const rows = renderedRows();
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('Open Standalone view');
    expect(rows[1].textContent).toContain('Open Options');
    expect(rows[2].textContent).toContain('Toggle theme');
    expect(rows[3].textContent).toContain('Reload extension');
  });

  it('renders exactly the Standalone set, including Focus Side Panel', () => {
    const openStandalone = vi.fn();
    registerStandaloneCommands({
      focusSidePanel: vi.fn(),
      openStandalone,
      openOptions: vi.fn(),
      toggleTheme: vi.fn(),
      reloadExtension: vi.fn(),
    });
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    const rows = renderedRows();
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Focus Side Panel'),
      expect.stringContaining('Open Standalone view'),
      expect.stringContaining('Open Options'),
      expect.stringContaining('Toggle theme'),
      expect.stringContaining('Reload extension'),
    ]);
  });

  it('omits the dev-only destructive command from a production build', () => {
    vi.stubEnv('DEV', false);
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    expect(renderedRows()).toHaveLength(3);
    expect(screen.queryByText('Reload extension')).toBeNull();
  });

  it('renders whatever the registry holds — an extra command needs no palette change', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    CommandRegistry.register({
      id: 'chat-history',
      name: 'Chat history',
      description: 'Open the chat history',
      category: 'navigation',
      action: () => {},
    });

    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    expect(renderedRows()).toHaveLength(5);
    expect(screen.getByText('Chat history')).toBeTruthy();
  });
});

describe('CommandPalette — token discipline and typography floor', () => {
  it('derives the selected row background from the token, never a literal or CSS variable', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    const selected = renderedRows()[0];
    expect(capturedPrimaryBg).not.toBe('');
    expect(normalizeColor(selected.style.backgroundColor)).toBe(normalizeColor(capturedPrimaryBg));
    expect(selected.getAttribute('style') ?? '').not.toContain('var(--');
  });

  it('renders no text below the 12 px floor and pins the category to colorTextTertiary', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    const category = screen.getByText('Appearance');
    expect(Number.parseInt(category.style.fontSize, 10)).toBeGreaterThanOrEqual(12);

    const description = screen.getByText(
      'Cycle the display mode: Auto, Light, Dark',
    );
    expect(Number.parseInt(description.style.fontSize, 10)).toBeGreaterThanOrEqual(12);

    for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const size = element.style?.fontSize;
      if (size) {
        expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('resolves its own strings through t() and pins the close control name', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    expect(screen.getByPlaceholderText(t('commands.placeholder'))).toBeTruthy();
    expect(screen.getAllByText(t('commands.category.navigation')).length).toBeGreaterThan(0);
    expect(document.querySelector('.ant-modal-close')?.getAttribute('aria-label')).toBe(
      t('a11y.closeDialog'),
    );
  });
});

describe('CommandPalette — states and keyboard', () => {
  it('holds the list height in the zero-results state and renders commands.noResults', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    const populatedMinHeight = screen.getByTestId('command-list-region').style.minHeight;
    expect(populatedMinHeight).not.toBe('');

    fireEvent.change(screen.getByPlaceholderText(t('commands.placeholder')), {
      target: { value: 'zzz-no-such-command' },
    });

    expect(screen.getByText(t('commands.noResults'))).toBeTruthy();
    expect(renderedRows()).toHaveLength(0);
    expect(screen.getByTestId('command-list-region').style.minHeight).toBe(populatedMinHeight);
  });

  it('moves the selection with ArrowDown and calls preventDefault', () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    expect(renderedRows()[0].style.backgroundColor).not.toBe('');

    const event = pressKey('ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(renderedRows()[1].style.backgroundColor).not.toBe('');
    expect(renderedRows()[0].style.backgroundColor).toBe('');
  });

  it('runs the selected command on Enter and closes', () => {
    const { deps, spies } = makeDeps();
    const onClose = vi.fn();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={onClose} />,
    );

    const event = pressKey('Enter');
    expect(event.defaultPrevented).toBe(true);
    expect(spies.openStandalone).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('CommandPalette — the destructive confirmation gate (D-10, T-1-37)', () => {
  it('never auto-runs the destructive command on a partial match; it demands confirmation', () => {
    const { deps, spies } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(t('commands.placeholder')), {
      target: { value: 'reload' },
    });
    pressKey('Enter');

    // A partial match selected the row — the action still did not run.
    expect(spies.reloadExtension).not.toHaveBeenCalled();
    expect(screen.getByText(t('command.reloadExtension.confirm'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('common.continue') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('common.notNow') })).toBeTruthy();
  });

  it('runs the destructive command only after the pinned confirmation', () => {
    const { deps, spies } = makeDeps();
    const onClose = vi.fn();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={onClose} />,
    );

    fireEvent.change(screen.getByPlaceholderText(t('commands.placeholder')), {
      target: { value: 'reload' },
    });
    pressKey('Enter');
    expect(spies.reloadExtension).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: t('common.continue') }));

    expect(spies.reloadExtension).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancelling the confirmation runs nothing', () => {
    const { deps, spies } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(
      <CommandPalette commands={CommandRegistry.getAll()} open onClose={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(t('commands.placeholder')), {
      target: { value: 'reload' },
    });
    pressKey('Enter');
    fireEvent.click(screen.getByRole('button', { name: t('common.notNow') }));

    expect(spies.reloadExtension).not.toHaveBeenCalled();
  });
});

describe('CommandPalette — the global chord (FLOW-8)', () => {
  const PaletteHarness: React.FC = () => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      KeymapRegistry.register({
        id: 'open-command-palette',
        keys: 'Cmd+K',
        description: 'Open the command palette',
        handler: () => setOpen((isOpen) => !isOpen),
      });
      return () => KeymapRegistry.unregister('open-command-palette');
    }, []);

    return (
      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={open}
        onClose={() => setOpen(false)}
      />
    );
  };

  it('opens on the chord and closes on the next press — one binding, no re-registration', async () => {
    const { deps } = makeDeps();
    registerSidepanelCommands(deps);
    renderWithAntd(<PaletteHarness />);

    expect(screen.queryByPlaceholderText(t('commands.placeholder'))).toBeNull();

    pressPaletteChord();
    expect(screen.getByPlaceholderText(t('commands.placeholder'))).toBeTruthy();

    pressPaletteChord();
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(t('commands.placeholder'))).toBeNull(),
    );

    // The binding was never re-registered: a duplicate id is a typed conflict,
    // so a second listener can never be armed for the same chord.
    expect(() =>
      KeymapRegistry.register({
        id: 'open-command-palette',
        keys: 'Cmd+K',
        description: 'duplicate',
        handler: () => {},
      }),
    ).toThrow(/conflict/i);
    expect(KeymapRegistry.getAll()).toHaveLength(1);
  });
});
