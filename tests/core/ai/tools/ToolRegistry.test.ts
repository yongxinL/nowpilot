import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/core/ai/tools/ToolRegistry';
import type { ToolDefinition } from '../../../src/core/ai/tools/ToolDefinition';

function createMockTool(name: string): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    inputSchema: null as unknown as ToolDefinition['inputSchema'],
    outputSchema: null as unknown as ToolDefinition['outputSchema'],
    execute: async () => ({}),
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('register adds a tool to the registry', () => {
    const tool = createMockTool('echo');
    registry.register(tool);
    expect(registry.get('echo')).toBeDefined();
    expect(registry.get('echo')).toBe(tool);
  });

  it('register with duplicate name throws an error', () => {
    registry.register(createMockTool('echo'));
    expect(() => {
      registry.register(createMockTool('echo'));
    }).toThrow('Tool "echo" is already registered');
  });

  it('get returns the registered ToolDefinition', () => {
    const tool = createMockTool('echo');
    registry.register(tool);
    expect(registry.get('echo')).toBe(tool);
  });

  it('get returns undefined for unknown tool names (closed-enum validation)', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('has returns true for registered tool and false for unknown', () => {
    registry.register(createMockTool('echo'));
    expect(registry.has('echo')).toBe(true);
    expect(registry.has('fake')).toBe(false);
  });

  it('list returns array of all registered ToolDefinition objects', () => {
    const toolA = createMockTool('a');
    const toolB = createMockTool('b');
    registry.register(toolA);
    registry.register(toolB);
    const all = registry.list();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('unregister removes a tool; subsequent get returns undefined', () => {
    registry.register(createMockTool('echo'));
    expect(registry.get('echo')).toBeDefined();
    registry.unregister('echo');
    expect(registry.get('echo')).toBeUndefined();
  });

  it('unregister on nonexistent name is a no-op', () => {
    expect(() => registry.unregister('nope')).not.toThrow();
  });
});
