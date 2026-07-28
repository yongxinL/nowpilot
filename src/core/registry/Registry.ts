import type { AddonRegistration, SidePanelPageRegistration, FullAppPageRegistration } from './AddonRegistry';

const sidePanelPages = new Map<string, SidePanelPageRegistration>();
const fullAppPages = new Map<string, FullAppPageRegistration>();
const addons = new Map<string, AddonRegistration>();

export const SidePanelPageRegistry = {
  register(page: SidePanelPageRegistration): void {
    sidePanelPages.set(page.id, page);
  },

  unregister(id: string): void {
    sidePanelPages.delete(id);
  },

  getAll(): SidePanelPageRegistration[] {
    return Array.from(sidePanelPages.values());
  },

  get(id: string): SidePanelPageRegistration | undefined {
    return sidePanelPages.get(id);
  },
};

export const FullAppPageRegistry = {
  register(page: FullAppPageRegistration): void {
    fullAppPages.set(page.id, page);
  },

  unregister(id: string): void {
    fullAppPages.delete(id);
  },

  getAll(): FullAppPageRegistration[] {
    return Array.from(fullAppPages.values());
  },

  get(id: string): FullAppPageRegistration | undefined {
    return fullAppPages.get(id);
  },
};

export const AddonRegistry = {
  register(addon: AddonRegistration): void {
    addons.set(addon.id, addon);
    addon.sidePanelPages?.forEach((p) => SidePanelPageRegistry.register(p));
    addon.fullAppPages?.forEach((p) => FullAppPageRegistry.register(p));
  },

  unregister(id: string): void {
    const addon = addons.get(id);
    if (addon) {
      addon.sidePanelPages?.forEach((p) => SidePanelPageRegistry.unregister(p.id));
      addon.fullAppPages?.forEach((p) => FullAppPageRegistry.unregister(p.id));
    }
    addons.delete(id);
  },

  getAll(): AddonRegistration[] {
    return Array.from(addons.values());
  },
};
