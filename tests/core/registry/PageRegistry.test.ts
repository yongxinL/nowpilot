// tests/core/registry/PageRegistry.test.ts — page-registry contract tests:
// PageRegistry (tab-keyed PageContext tracker: upsert/get/remove/list/clear,
// idempotent replace) + the UI-SPEC nav singletons (SidePanelPageRegistry =
// Chat/Agent/Notes, StandalonePageRegistry = Chat/Agent/Notes/Options) with
// register/get roundtrip and idempotent re-register. Pure Map logic — node env
// avoids the jsdom 30 TextEncoder/esbuild invariant break (01-01 Rule 3
// precedent).
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PageRegistry } from '@/core/registry/PageRegistry';
import {
  SidePanelPageRegistry,
  getSidePanelPageRegistry,
} from '@/core/registry/SidePanelPageRegistry';
import {
  StandalonePageRegistry,
  getStandalonePageRegistry,
} from '@/core/registry/StandalonePageRegistry';
import type { PageContext } from '@/core/content/PageContext';

function makePage(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com/',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Example',
    meta: {},
    extractedAt: 1710000000000,
    ...overrides,
  };
}

describe('PageRegistry (tab-keyed PageContext tracker)', () => {
  it('upsert + get roundtrip returns the page for the tab', () => {
    const registry = new PageRegistry();
    const page = makePage({ title: 'Tab 1' });
    registry.upsert(7, page);
    expect(registry.get(7)).toMatchObject({ title: 'Tab 1' });
  });

  it('upserting the same tab replaces the page atomically', () => {
    const registry = new PageRegistry();
    registry.upsert(7, makePage({ title: 'old' }));
    registry.upsert(7, makePage({ title: 'new' }));
    expect(registry.get(7)).toMatchObject({ title: 'new' });
    expect(registry.list()).toHaveLength(1);
  });

  it('remove deletes the tab entry', () => {
    const registry = new PageRegistry();
    registry.upsert(7, makePage());
    registry.remove(7);
    expect(registry.get(7)).toBeUndefined();
  });

  it('list returns {tabId, page} pairs', () => {
    const registry = new PageRegistry();
    registry.upsert(7, makePage({ title: 'A' }));
    registry.upsert(9, makePage({ title: 'B' }));
    expect(registry.list()).toEqual([
      { tabId: 7, page: expect.objectContaining({ title: 'A' }) },
      { tabId: 9, page: expect.objectContaining({ title: 'B' }) },
    ]);
  });

  it('clear empties the registry', () => {
    const registry = new PageRegistry();
    registry.upsert(7, makePage());
    registry.upsert(9, makePage());
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});

describe('SidePanelPageRegistry', () => {
  it('singleton is pre-registered with the UI-SPEC side-panel nav set (Chat/Agent/Notes)', () => {
    const registry = getSidePanelPageRegistry();
    expect(registry.list().map((p) => p.id)).toEqual(['chat', 'agent', 'notes']);
  });

  it('register + get roundtrip', () => {
    const registry = new SidePanelPageRegistry();
    registry.register({ id: 'x', label: 'X', component: 'XPage' });
    expect(registry.get('x')).toMatchObject({ label: 'X' });
  });

  it('re-registering the same id is idempotent — get returns the new entry', () => {
    const registry = new SidePanelPageRegistry();
    registry.register({ id: 'x', label: 'old', component: 'XPage' });
    registry.register({ id: 'x', label: 'new', component: 'XPage' });
    expect(registry.get('x')).toMatchObject({ label: 'new' });
    expect(registry.list()).toHaveLength(1);
  });
});

describe('StandalonePageRegistry', () => {
  it('singleton is pre-registered with the UI-SPEC standalone nav set (Chat/Agent/Notes/Options)', () => {
    const registry = getStandalonePageRegistry();
    expect(registry.list().map((p) => p.id)).toEqual(['chat', 'agent', 'notes', 'options']);
  });

  it('register + get roundtrip', () => {
    const registry = new StandalonePageRegistry();
    registry.register({ id: 'x', label: 'X', component: 'XPage' });
    expect(registry.get('x')).toMatchObject({ label: 'X' });
  });

  it('re-registering the same id is idempotent — get returns the new entry', () => {
    const registry = new StandalonePageRegistry();
    registry.register({ id: 'x', label: 'old', component: 'XPage' });
    registry.register({ id: 'x', label: 'new', component: 'XPage' });
    expect(registry.get('x')).toMatchObject({ label: 'new' });
    expect(registry.list()).toHaveLength(1);
  });

  it('invalid registration (empty id) is skipped without throwing', () => {
    const registry = new StandalonePageRegistry();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      registry.register({ id: '', label: 'bad', component: 'XPage' }),
    ).not.toThrow();
    expect(registry.list()).toHaveLength(0);
    spy.mockRestore();
  });
});
