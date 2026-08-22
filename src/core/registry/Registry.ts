import type { AddonRegistration, SidePanelPageRegistration, StandalonePageRegistration } from './AddonRegistry';

const sidePanelPages = new Map<string, SidePanelPageRegistration>();
const standalonePages = new Map<string, StandalonePageRegistration>();
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

export const StandalonePageRegistry = {
  register(page: StandalonePageRegistration): void {
    standalonePages.set(page.id, page);
  },

  unregister(id: string): void {
    standalonePages.delete(id);
  },

  getAll(): StandalonePageRegistration[] {
    return Array.from(standalonePages.values());
  },

  get(id: string): StandalonePageRegistration | undefined {
    return standalonePages.get(id);
  },
};

export const AddonRegistry = {
  register(addon: AddonRegistration): void {
    addons.set(addon.id, addon);
    addon.sidePanelPages?.forEach((p) => SidePanelPageRegistry.register(p));
    addon.standalonePages?.forEach((p) => StandalonePageRegistry.register(p));
  },

  unregister(id: string): void {
    const addon = addons.get(id);
    if (addon) {
      addon.sidePanelPages?.forEach((p) => SidePanelPageRegistry.unregister(p.id));
      addon.standalonePages?.forEach((p) => StandalonePageRegistry.unregister(p.id));
    }
    addons.delete(id);
  },

  getAll(): AddonRegistration[] {
    return Array.from(addons.values());
  },
};
