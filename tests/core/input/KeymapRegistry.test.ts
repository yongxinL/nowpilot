import { beforeEach, describe, expect, it } from 'vitest';
import { KeymapRegistry, registerDefaultKeymaps } from '@/core/input/KeymapRegistry';

describe('KeymapRegistry', () => {
  beforeEach(() => {
    KeymapRegistry.clear();
  });

  it('registers and resolves a combo to a handler id', () => {
    KeymapRegistry.register({
      id: 'k1',
      combo: 'mod+k',
      description: 'Open palette',
      handlerId: 'command-palette.open',
      when: 'always',
    });
    const resolved = KeymapRegistry.resolve('mod+k', 'sidepanel');
    expect(resolved?.handlerId).toBe('command-palette.open');
  });

  it('evaluates the when clause', () => {
    KeymapRegistry.register({
      id: 'k2',
      combo: 'mod+s',
      description: 'Side',
      handlerId: 'side.cmd',
      when: 'in-side-panel',
    });
    expect(KeymapRegistry.resolve('mod+s', 'sidepanel')).toBeDefined();
    expect(KeymapRegistry.resolve('mod+s', 'standalone')).toBeUndefined();
  });

  it('registers the Cmd+K default keymap', () => {
    registerDefaultKeymaps();
    const resolved = KeymapRegistry.resolve('mod+k', 'standalone');
    expect(resolved?.handlerId).toBe('command-palette.open');
  });
});
