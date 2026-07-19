import { describe, it, expect, vi } from 'vitest';
import type { ReferenceToken } from '../../../src/core/references/ReferenceToken';
import type { AutocompleteResult, ReferenceResolver } from '../../../src/core/references/ReferenceResolver';
import { ReferenceResolverRegistry } from '../../../src/core/references/referenceResolverRegistry';

function createMockResolver(type: string, results: AutocompleteResult[]): ReferenceResolver {
  return {
    getType: () => type,
    search: vi.fn().mockResolvedValue(results),
    validate: vi.fn().mockImplementation(async (token: ReferenceToken) => {
      if (token.id.startsWith('deleted-') || token.id.startsWith('missing-')) {
        return { valid: false, reason: 'Resource not found' };
      }
      return { valid: true };
    }),
    resolve: vi.fn().mockImplementation(async (token: ReferenceToken) => {
      if (token.id.startsWith('deleted-') || token.id.startsWith('missing-')) {
        return null;
      }
      return { title: token.title, content: `Content for ${token.title}` };
    }),
  };
}

describe('ReferenceResolverRegistry', () => {
  it('register() adds a resolver; getResolverType returns it', () => {
    const registry = new ReferenceResolverRegistry();
    const mock = createMockResolver('note', []);
    registry.register('note', mock);
    expect(registry.getResolverType('note')).toBe(mock);
  });

  it('duplicate type registration throws', () => {
    const registry = new ReferenceResolverRegistry();
    registry.register('note', createMockResolver('note', []));
    expect(() => registry.register('note', createMockResolver('note', []))).toThrow();
  });

  it('unregister removes a resolver', () => {
    const registry = new ReferenceResolverRegistry();
    const mock = createMockResolver('note', []);
    registry.register('note', mock);
    expect(registry.unregister('note')).toBe(true);
    expect(registry.getResolverType('note')).toBeUndefined();
  });

  it('search merges results from multiple resolvers', async () => {
    const registry = new ReferenceResolverRegistry();
    const mock1 = createMockResolver('note', [
      { token: { type: 'note', id: '1', title: 'Note 1', displayLabel: '@note:Note 1' }, icon: 'FileTextOutlined', color: 'blue' },
    ]);
    const mock2 = createMockResolver('tab', [
      { token: { type: 'tab', id: '2', title: 'Tab 1', displayLabel: '@tab:Tab 1' }, icon: 'PushpinOutlined', color: 'cyan' },
    ]);
    registry.register('note', mock1);
    registry.register('tab', mock2);

    const results = await registry.search('test');
    expect(results).toHaveLength(2);
    expect(results[0].token.type).toBe('note');
    expect(results[1].token.type).toBe('tab');
  });

  it('validate returns { valid: false } for deleted resources', async () => {
    const registry = new ReferenceResolverRegistry();
    const mock = createMockResolver('note', []);
    registry.register('note', mock);

    const result = await registry.validate({ type: 'note', id: 'deleted-1', title: 'Gone', displayLabel: '@note:Gone' });
    expect(result.valid).toBe(false);
  });

  it('validate returns { valid: false } for unknown type', async () => {
    const registry = new ReferenceResolverRegistry();
    const result = await registry.validate({ type: 'unknown', id: '1', title: 'X', displayLabel: '@x:X' });
    expect(result.valid).toBe(false);
  });

  it('resolve returns null for unresolvable token', async () => {
    const registry = new ReferenceResolverRegistry();
    const mock = createMockResolver('note', []);
    registry.register('note', mock);

    const result = await registry.resolve({ type: 'note', id: 'missing-1', title: 'Missing', displayLabel: '@note:Missing' });
    expect(result).toBeNull();
  });

  it('resolve returns null for unregistered type', async () => {
    const registry = new ReferenceResolverRegistry();
    const result = await registry.resolve({ type: 'ghost', id: '1', title: 'X', displayLabel: '@ghost:X' });
    expect(result).toBeNull();
  });

  it('getTypes returns all registered type strings', () => {
    const registry = new ReferenceResolverRegistry();
    registry.register('note', createMockResolver('note', []));
    registry.register('tab', createMockResolver('tab', []));
    const types = registry.getTypes();
    expect(types).toContain('note');
    expect(types).toContain('tab');
    expect(types).toHaveLength(2);
  });
});
