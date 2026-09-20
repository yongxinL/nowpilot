import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../../../src/core/commands/CommandRegistry';
import type { Command } from '../../../src/core/commands/CommandRegistry';

describe('CommandRegistry', () => {
  const createCmd = (overrides?: Partial<Command>): Command => ({
    id: 'test-1',
    name: 'Test Command',
    description: 'A test command description',
    category: 'System',
    action: () => {},
    ...overrides,
  });

  beforeEach(() => {
    // Clear all registered commands before each test
    // We do this by iterating getAll() and unregistering each
    const all = CommandRegistry.getAll();
    for (const cmd of all) {
      CommandRegistry.unregister(cmd.id);
    }
  });

  describe('register / get', () => {
    it('register(cmd) adds command, get("id") returns it', () => {
      const cmd = createCmd();
      CommandRegistry.register(cmd);
      const result = CommandRegistry.get('test-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('test-1');
      expect(result?.name).toBe('Test Command');
      expect(result?.description).toBe('A test command description');
      expect(result?.category).toBe('System');
    });

    it('get("unknown") returns undefined', () => {
      const result = CommandRegistry.get('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('register duplicate', () => {
    it('throws Error when registering duplicate id', () => {
      const cmd = createCmd();
      CommandRegistry.register(cmd);
      expect(() => CommandRegistry.register(cmd)).toThrow('Command already registered: test-1');
      // Verify the error message contains the id for debugging
      expect(() => CommandRegistry.register(cmd)).toThrow(/test-1/);
    });
  });

  describe('unregister', () => {
    it('unregister("id") removes command', () => {
      const cmd = createCmd();
      CommandRegistry.register(cmd);
      expect(CommandRegistry.get('test-1')).toBeDefined();

      CommandRegistry.unregister('test-1');
      expect(CommandRegistry.get('test-1')).toBeUndefined();
    });

    it('unregister with non-existent id is a no-op', () => {
      expect(() => CommandRegistry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      CommandRegistry.register(createCmd({ id: 'theme-1', name: 'Toggle Theme', description: 'Switch between light, dark, and auto', category: 'Appearance' }));
      CommandRegistry.register(createCmd({ id: 'nav-1', name: 'Open Full App', description: 'Open the full application in a new tab', category: 'Navigation' }));
      CommandRegistry.register(createCmd({ id: 'sys-1', name: 'Reload Extension', description: 'Reload the Chrome extension', category: 'System' }));
    });

    it('search("theme") returns commands whose name or description includes "theme" (case-insensitive)', () => {
      const results = CommandRegistry.search('theme');
      // Should match "Toggle Theme" (name) and "Switch between light, dark, and auto" (description — no "theme" there but name has it)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.id)).toContain('theme-1');
    });

    it('search is case-insensitive', () => {
      const results = CommandRegistry.search('THEME');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.id)).toContain('theme-1');
    });

    it('search matches description content', () => {
      // "reload" is in "Reload the Chrome extension" description but not in the command name "Reload Extension"
      const results = CommandRegistry.search('chrome');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.id)).toContain('sys-1');
    });

    it('search("") returns all registered commands', () => {
      const results = CommandRegistry.search('');
      expect(results.length).toBe(3);
    });

    it('search("nonexistent") returns empty array', () => {
      const results = CommandRegistry.search('zzzznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('execute', () => {
    it('execute("id") calls the command\'s action function', () => {
      let called = false;
      const cmd = createCmd({
        id: 'exec-test',
        action: () => { called = true; },
      });
      CommandRegistry.register(cmd);
      CommandRegistry.execute('exec-test');
      expect(called).toBe(true);
    });

    it('execute("unknown") throws Error', () => {
      expect(() => CommandRegistry.execute('non-existent')).toThrow('Command not found: non-existent');
    });
  });

  describe('getAll', () => {
    it('getAll() returns all registered commands as array', () => {
      const cmd1 = createCmd({ id: 'a', name: 'Alpha' });
      const cmd2 = createCmd({ id: 'b', name: 'Beta' });
      CommandRegistry.register(cmd1);
      CommandRegistry.register(cmd2);

      const all = CommandRegistry.getAll();
      expect(all.length).toBe(2);
      expect(all.map(c => c.id)).toContain('a');
      expect(all.map(c => c.id)).toContain('b');
    });

    it('getAll() returns empty array when no commands registered', () => {
      const all = CommandRegistry.getAll();
      expect(all).toEqual([]);
    });
  });
});
