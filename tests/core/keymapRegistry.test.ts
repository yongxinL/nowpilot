import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeymapRegistry } from '../../src/core/commands/keymapRegistry';

describe('KeymapRegistry', () => {
  let registry: KeymapRegistry;

  beforeEach(() => {
    registry = new KeymapRegistry();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('register adds a command with id, label, and handler', () => {
    const handler = vi.fn();
    registry.register({ id: 'test', label: 'Test Command', handler });
    expect(registry.getCommand('test')).toBeDefined();
  });

  it('register with duplicate id throws an error', () => {
    registry.register({ id: 'dup', label: 'First', handler: vi.fn() });
    expect(() => {
      registry.register({ id: 'dup', label: 'Second', handler: vi.fn() });
    }).toThrow('dup');
  });

  it('getCommand returns the registered command or undefined', () => {
    expect(registry.getCommand('nonexistent')).toBeUndefined();
    const handler = vi.fn();
    registry.register({ id: 'cmd', label: 'My Command', handler });
    const cmd = registry.getCommand('cmd');
    expect(cmd?.label).toBe('My Command');
    expect(cmd?.handler).toBe(handler);
  });

  it('getAllCommands returns all commands in registration order', () => {
    registry.register({ id: 'a', label: 'A', handler: vi.fn() });
    registry.register({ id: 'b', label: 'B', handler: vi.fn() });
    registry.register({ id: 'c', label: 'C', handler: vi.fn() });
    const all = registry.getAllCommands();
    expect(all.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('unregisterCommand removes the command', () => {
    registry.register({ id: 'rm', label: 'Remove Me', handler: vi.fn() });
    expect(registry.getCommand('rm')).toBeDefined();
    registry.unregister('rm');
    expect(registry.getCommand('rm')).toBeUndefined();
  });

  it('handleCommand invokes the handler', () => {
    const handler = vi.fn();
    registry.register({ id: 'exec', label: 'Execute', handler });
    registry.handleCommand('exec');
    expect(handler).toHaveBeenCalled();
  });

  it('handleCommand for unknown id logs warning without throwing', () => {
    expect(() => registry.handleCommand('unknown')).not.toThrow();
  });

  it('unregister on nonexistent id is a no-op', () => {
    expect(() => registry.unregister('nope')).not.toThrow();
  });
});
