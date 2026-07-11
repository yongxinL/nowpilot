import { describe, it, expect } from 'vitest';
import { SidepanelPageRegistry } from '../../src/core/registries/SidepanelPageRegistry';
import { StandalonePageRegistry } from '../../src/core/registries/StandalonePageRegistry';

describe('Page Registries', () => {
  it('both registries start empty', () => {
    const side = new SidepanelPageRegistry();
    const standalone = new StandalonePageRegistry();
    expect(side.getAll()).toEqual([]);
    expect(standalone.getAll()).toEqual([]);
  });

  it('register adds a page with id, label, and component', () => {
    const registry = new SidepanelPageRegistry();
    const Component = () => null;
    registry.register({ id: 'chat', label: 'Chat', component: Component });
    const pages = registry.getAll();
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe('chat');
    expect(pages[0].label).toBe('Chat');
  });

  it('register with duplicate id throws Error', () => {
    const registry = new StandalonePageRegistry();
    const Component = () => null;
    registry.register({ id: 'notes', label: 'Notes', component: Component });
    expect(() => {
      registry.register({ id: 'notes', label: 'Notes 2', component: Component });
    }).toThrow('notes');
  });

  it('getAll returns pages sorted by ascending order', () => {
    const registry = new SidepanelPageRegistry();
    const A = () => null;
    const B = () => null;
    const C = () => null;
    registry.register({ id: 'c', label: 'C', component: C, order: 3 });
    registry.register({ id: 'a', label: 'A', component: A, order: 1 });
    registry.register({ id: 'b', label: 'B', component: B, order: 2 });
    const pages = registry.getAll();
    expect(pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('pages with undefined order sort after numbered orders', () => {
    const registry = new StandalonePageRegistry();
    const A = () => null;
    const B = () => null;
    registry.register({ id: 'b', label: 'B', component: B });
    registry.register({ id: 'a', label: 'A', component: A, order: 1 });
    const pages = registry.getAll();
    expect(pages.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('independent registries do not affect each other', () => {
    const side = new SidepanelPageRegistry();
    const standalone = new StandalonePageRegistry();
    const Comp = () => null;
    side.register({ id: 'side-only', label: 'Side', component: Comp });
    standalone.register({ id: 'standalone-only', label: 'Standalone', component: Comp });
    expect(side.getAll()).toHaveLength(1);
    expect(side.getAll()[0].id).toBe('side-only');
    expect(standalone.getAll()).toHaveLength(1);
    expect(standalone.getAll()[0].id).toBe('standalone-only');
  });

  it('unregister removes page from getAll', () => {
    const registry = new SidepanelPageRegistry();
    const Comp = () => null;
    registry.register({ id: 'removable', label: 'Remove', component: Comp });
    expect(registry.getAll()).toHaveLength(1);
    registry.unregister('removable');
    expect(registry.getAll()).toHaveLength(0);
  });
});
