import { describe, it, expect } from 'vitest';
import { buildNavConfig, navConfig } from '../../src/core/navigation/navConfig';
import { selectNavItems, findNavItem } from '../../src/core/navigation/navigationSelectors';

describe('Canonical nav model', () => {
  it('buildNavConfig returns items with all required fields', () => {
    const items = buildNavConfig();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(['A', 'B', 'footer', 'utility']).toContain(item.group);
      expect(Array.isArray(item.surfaces)).toBe(true);
      expect(item.surfaces.length).toBeGreaterThan(0);
      expect(typeof item.order).toBe('number');
    }
  });

  it('surface strings are restricted to sidepanel/standalone/popup', () => {
    for (const item of navConfig) {
      for (const surface of item.surfaces) {
        expect(['sidepanel', 'standalone', 'popup']).toContain(surface);
      }
    }
  });

  it('no item uses legacy fullapp / sidePanel / sidepanel variants', () => {
    const stringified = JSON.stringify(navConfig);
    expect(stringified).not.toMatch(/"fullapp"/);
    expect(stringified).not.toMatch(/"full-app"/);
    expect(stringified).not.toMatch(/"sidePanel"/);
    expect(stringified).not.toMatch(/"Sidepanel"/);
    expect(stringified).not.toMatch(/"FullApp"/);
  });

  it('IDs are unique across the canonical nav config', () => {
    const ids = navConfig.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('selectNavItems for sidepanel group A returns expected primary items', () => {
    const items = selectNavItems({ surface: 'sidepanel', group: 'A' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.group)).toEqual(items.map(() => 'A'));
  });

  it('selectNavItems for standalone group B excludes sidepanel-only items', () => {
    const items = selectNavItems({ surface: 'standalone', group: 'B' });
    for (const item of items) {
      expect(item.surfaces).toContain('standalone');
      expect(item.surfaces).not.toContain('standalone-only');
    }
  });

  it('selectNavItems excludes popup from nav', () => {
    const items = selectNavItems({ surface: 'popup' });
    expect(items).toEqual([]);
  });

  it('findNavItem returns the canonical item by id', () => {
    const item = findNavItem('chat');
    expect(item).toBeDefined();
    expect(item?.id).toBe('chat');
    expect(item?.surfaces).toContain('sidepanel');
    expect(item?.surfaces).toContain('standalone');
  });

  it('findNavItem returns undefined for unknown id', () => {
    expect(findNavItem('does-not-exist')).toBeUndefined();
  });

  it('Group A primary workspace items include chat, agent, write', () => {
    const ids = navConfig.filter((i) => i.group === 'A').map((i) => i.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('agent');
    expect(ids).toContain('write');
  });

  it('Group B secondary items include tasks/teamgqm/code/ask/search', () => {
    const ids = navConfig.filter((i) => i.group === 'B').map((i) => i.id);
    expect(ids).toContain('tasks');
    expect(ids).toContain('teamgqm');
    expect(ids).toContain('code');
    expect(ids).toContain('ask');
    expect(ids).toContain('search');
  });
});
