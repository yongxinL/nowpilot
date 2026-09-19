import { describe, expect, it } from 'vitest';
import { createStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';

const Dummy = () => null;

describe('standalone page registry', () => {
  it('registers and resolves components by route id', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', Dummy);
    expect(registry.get('chat')).toBe(Dummy);
    expect(registry.has('chat')).toBe(true);
    expect(registry.get('notes')).toBeUndefined();
  });

  it('rejects duplicate registration', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', Dummy);
    expect(() => registry.register('chat', Dummy)).toThrow();
  });

  it('lists entries in registration order', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', Dummy);
    registry.register('agent', Dummy);
    expect(registry.entries().map((entry) => entry.routeId)).toEqual(['chat', 'agent']);
  });
});
