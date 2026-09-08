import { describe, expect, it } from 'vitest';
import { Registry } from '@/core/registry/Registry';

describe('Registry', () => {
  it('registers and retrieves items', () => {
    const reg = new Registry<string>();
    reg.register('a', 'value');
    expect(reg.get('a')).toBe('value');
    expect(reg.has('a')).toBe(true);
    expect(reg.getAll()).toEqual(['value']);
  });

  it('throws on duplicate registration', () => {
    const reg = new Registry<string>();
    reg.register('a', 'v1');
    expect(() => reg.register('a', 'v2')).toThrow();
  });

  it('unregisters items', () => {
    const reg = new Registry<string>();
    reg.register('a', 'v');
    reg.unregister('a');
    expect(reg.has('a')).toBe(false);
  });

  it('clears all items', () => {
    const reg = new Registry<string>();
    reg.register('a', 'v');
    reg.clear();
    expect(reg.getAll()).toEqual([]);
  });
});
