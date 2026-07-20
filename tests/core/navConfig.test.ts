import { describe, it, expect } from 'vitest';
import { buildNavConfig, getNavConfig } from '../../src/core/navigation/navConfig';
import { selectNavItems, findNavItem } from '../../src/core/navigation/navigationSelectors';

describe('Canonical nav model', () => {
  it('buildNavConfig returns items with all required fields', () => {
    const items = buildNavConfig();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(['core', 'addons', 'footer', 'utility']).toContain(item.group);
      expect(Array.isArray(item.surfaces)).toBe(true);
      expect(item.surfaces.length).toBeGreaterThan(0);
      expect(typeof item.order).toBe('number');
    }
  });

  it('surface strings are restricted to sidepanel/standalone/popup', () => {
    for (const item of getNavConfig()) {
      for (const surface of item.surfaces) {
        expect(['sidepanel', 'standalone', 'popup']).toContain(surface);
      }
    }
  });

  it('no item uses legacy fullapp / sidePanel / sidepanel variants', () => {
    const stringified = JSON.stringify(getNavConfig());
    expect(stringified).not.toMatch(/"fullapp"/);
    expect(stringified).not.toMatch(/"full-app"/);
    expect(stringified).not.toMatch(/"sidePanel"/);
    expect(stringified).not.toMatch(/"Sidepanel"/);
    expect(stringified).not.toMatch(/"FullApp"/);
  });

  it('IDs are unique across the canonical nav config', () => {
    const ids = getNavConfig().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('selectNavItems for sidepanel group core returns expected primary items', () => {
    const items = selectNavItems({ surface: 'sidepanel', group: 'core' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.group)).toEqual(items.map(() => 'core'));
  });

  it('selectNavItems for standalone group addons excludes sidepanel-only items', () => {
    const items = selectNavItems({ surface: 'standalone', group: 'addons' });
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

  it('Core primary workspace items include chat, agent, write, note, tools', () => {
    const ids = getNavConfig().filter((i) => i.group === 'core').map((i) => i.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('agent');
    expect(ids).toContain('write');
    expect(ids).toContain('notes');
    expect(ids).toContain('tools');
    expect(ids).toHaveLength(5);
    // Verify Note label
    const note = getNavConfig().find((i) => i.id === 'notes');
    expect(note?.label).toBe('Note');
    // Verify Task label
    const task = getNavConfig().find((i) => i.id === 'tasks');
    expect(task?.label).toBe('Task');
  });

  it('Addons secondary items include task', () => {
    const ids = getNavConfig().filter((i) => i.group === 'addons').map((i) => i.id);
    expect(ids).toContain('tasks');
    expect(ids).toHaveLength(1);
  });

  it('Removed items no longer exist in nav config', () => {
    const ids = getNavConfig().map((i) => i.id);
    expect(ids).not.toContain('teamgqm');
    expect(ids).not.toContain('code');
    expect(ids).not.toContain('ask');
    expect(ids).not.toContain('search');
    expect(ids).not.toContain('chatpdf');
    expect(ids).not.toContain('ocr');
  });
});
