import { describe, it, expect } from 'vitest';
import { SlashCommandRegistry } from '../../../src/core/slash/SlashCommandRegistry';
import type { SlashCommand } from '../../../src/core/slash/SlashCommandRegistry';

describe('SlashCommandRegistry', () => {
  // Note: constructor auto-registers 3 built-in commands (write, ask, research)

  it('register adds a command; get/has/list return it', () => {
    const registry = new SlashCommandRegistry();
    // list() should have 3 builtins initially
    expect(registry.list()).toHaveLength(3);
    const cmd: SlashCommand = { name: 'test', label: 'Test', description: 'A test command' };
    registry.register(cmd);
    expect(registry.get('test')).toBe(cmd);
    expect(registry.has('test')).toBe(true);
    expect(registry.list()).toHaveLength(4);
  });

  it('parseCommand returns command and rest text for built-in slash command', () => {
    const registry = new SlashCommandRegistry();
    const result = registry.parseCommand('/write hello world');
    expect(result).not.toBeNull();
    expect(result!.command.name).toBe('write');
    expect(result!.rest).toBe('hello world');
  });

  it('parseCommand returns null when input has no leading slash', () => {
    const registry = new SlashCommandRegistry();
    const result = registry.parseCommand('no slash here');
    expect(result).toBeNull();
  });

  it('parseCommand returns null for unknown slash command', () => {
    const registry = new SlashCommandRegistry();
    const result = registry.parseCommand('/unknown cmd');
    expect(result).toBeNull();
  });

  it('register with duplicate name throws', () => {
    const registry = new SlashCommandRegistry();
    expect(() => registry.register({ name: 'write', label: 'Already built-in' })).toThrow('already registered');
  });

  it('unregister removes a previously registered command', () => {
    const registry = new SlashCommandRegistry();
    const cmd: SlashCommand = { name: 'mycmd', label: 'My Command' };
    registry.register(cmd);
    expect(registry.has('mycmd')).toBe(true);
    registry.unregister('mycmd');
    expect(registry.get('mycmd')).toBeUndefined();
    expect(registry.has('mycmd')).toBe(false);
  });
});
