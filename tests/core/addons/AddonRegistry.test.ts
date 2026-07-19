import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddonRegistry } from '../../../src/core/registries/AddonRegistry';
import type { AddonSkill, AddonPage, AddonSettingsSchema } from './AddonRegistry.types';

const SKILL_KEY = 'np_addon_enabled';

const mockSkill = (overrides: Partial<AddonSkill> = {}): AddonSkill => ({
  name: 'test-skill',
  description: 'A test skill',
  addonId: 'test-addon',
  handler: vi.fn().mockResolvedValue('done'),
  ...overrides,
});

const mockPage = (overrides: Partial<AddonPage> = {}): AddonPage => ({
  id: 'test-page',
  addonId: 'test-addon',
  label: 'Test Page',
  component: vi.fn() as unknown as AddonPage['component'],
  surface: 'sidepanel',
  ...overrides,
});

const mockSettingsSchema = (overrides: Partial<AddonSettingsSchema> = {}): AddonSettingsSchema => ({
  addonId: 'test-addon',
  fields: {},
  ...overrides,
});

describe('AddonRegistry', () => {
  let registry: AddonRegistry;
  let localGetMock: ReturnType<typeof vi.fn>;
  let localSetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localGetMock = vi.mocked(chrome.storage.local.get) as unknown as ReturnType<typeof vi.fn>;
    localSetMock = vi.mocked(chrome.storage.local.set) as unknown as ReturnType<typeof vi.fn>;
    localGetMock.mockResolvedValue({});
    registry = new AddonRegistry();
  });

  it('registerSkill adds skill; getSkill retrieves; hasSkill returns true; listSkills includes it', () => {
    const skill = mockSkill({ name: 'my-skill', addonId: 'my-addon' });
    registry.registerSkill('my-addon', skill);

    expect(registry.getSkill('my-addon', 'my-skill')).toBe(skill);
    expect(registry.hasSkill('my-addon', 'my-skill')).toBe(true);
    expect(registry.listSkills()).toContain(skill);
  });

  it('registerSkill with duplicate addonId:name throws', () => {
    const skill = mockSkill({ name: 'dup-skill', addonId: 'dup-addon' });
    registry.registerSkill('dup-addon', skill);

    expect(() => registry.registerSkill('dup-addon', skill)).toThrow('already registered');
  });

  it('unregisterSkill removes skill; hasSkill returns false after', () => {
    const skill = mockSkill({ name: 'rm-skill', addonId: 'rm-addon' });
    registry.registerSkill('rm-addon', skill);
    expect(registry.hasSkill('rm-addon', 'rm-skill')).toBe(true);

    registry.unregisterSkill('rm-addon', 'rm-skill');
    expect(registry.hasSkill('rm-addon', 'rm-skill')).toBe(false);
    expect(registry.getSkill('rm-addon', 'rm-skill')).toBeUndefined();
  });

  it('registerPage / getPage / listPages work for AddonPage type', () => {
    const page = mockPage({ id: 'my-page', addonId: 'page-addon' });
    registry.registerPage('page-addon', page);

    expect(registry.getPage('page-addon', 'my-page')).toBe(page);
    expect(registry.listPages()).toContain(page);
  });

  it('registerSettingsSchema / getSettingsSchema work for settings schemas', () => {
    const schema = mockSettingsSchema({ addonId: 'schema-addon' });
    registry.registerSettingsSchema(schema);

    expect(registry.getSettingsSchema('schema-addon')).toBe(schema);
  });

  it('enable(addonId) persists to chrome.storage.local; isEnabled returns true after', async () => {
    localSetMock.mockResolvedValue(undefined);

    await registry.enable('my-addon');

    expect(localSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ [SKILL_KEY]: expect.any(Object) }),
    );
    expect(registry.isEnabled('my-addon')).toBe(true);
  });

  it('disable(addonId) persists to chrome.storage.local; isEnabled returns false after', async () => {
    localSetMock.mockResolvedValue(undefined);

    await registry.enable('my-addon');
    expect(registry.isEnabled('my-addon')).toBe(true);

    await registry.disable('my-addon');
    expect(localSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ [SKILL_KEY]: expect.any(Object) }),
    );
    expect(registry.isEnabled('my-addon')).toBe(false);
  });

  it('listEnabled returns only enabled addon IDs', async () => {
    localSetMock.mockResolvedValue(undefined);

    await registry.enable('enabled-addon');
    await registry.enable('also-enabled');

    const enabled = registry.listEnabled();
    expect(enabled).toContain('enabled-addon');
    expect(enabled).toContain('also-enabled');
    expect(enabled).not.toContain('disabled-addon');
  });

  it('constructor loads persisted enable state from chrome.storage.local', async () => {
    localGetMock.mockResolvedValue({
      [SKILL_KEY]: { 'pre-enabled': true, 'pre-disabled': false },
    });

    const r2 = new AddonRegistry();
    // After microtasks flush, the #loadEnabled promise should have resolved
    await vi.waitFor(() => {
      expect(r2.isEnabled('pre-enabled')).toBe(true);
      expect(r2.isEnabled('pre-disabled')).toBe(false);
    });
  });

  it('getEnabledSkills returns skills only from enabled addons', async () => {
    localSetMock.mockResolvedValue(undefined);

    const skillA = mockSkill({ name: 'a', addonId: 'enabled-addon' });
    const skillB = mockSkill({ name: 'b', addonId: 'disabled-addon' });

    registry.registerSkill('enabled-addon', skillA);
    registry.registerSkill('disabled-addon', skillB);

    await registry.enable('enabled-addon');

    const enabledSkills = registry.getEnabledSkills();
    expect(enabledSkills).toContain(skillA);
    expect(enabledSkills).not.toContain(skillB);
  });

  it('getEnabledPages returns pages only from enabled addons', async () => {
    localSetMock.mockResolvedValue(undefined);

    const pageA = mockPage({ id: 'page-a', addonId: 'enabled-addon' });
    const pageB = mockPage({ id: 'page-b', addonId: 'disabled-addon' });

    registry.registerPage('enabled-addon', pageA);
    registry.registerPage('disabled-addon', pageB);

    await registry.enable('enabled-addon');

    const enabledPages = registry.getEnabledPages();
    expect(enabledPages).toContain(pageA);
    expect(enabledPages).not.toContain(pageB);
  });
});
