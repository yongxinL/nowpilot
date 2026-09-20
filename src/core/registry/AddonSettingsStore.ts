const settings = new Map<string, Map<string, unknown>>();

export const AddonSettingsStore = {
  get<T>(addonId: string, key: string): T | undefined {
    return settings.get(addonId)?.get(key) as T | undefined;
  },

  set<T>(addonId: string, key: string, value: T): void {
    if (!settings.has(addonId)) {
      settings.set(addonId, new Map());
    }
    settings.get(addonId)!.set(key, value);
  },

  delete(addonId: string, key: string): void {
    settings.get(addonId)?.delete(key);
  },

  getAll(addonId: string): Record<string, unknown> {
    const map = settings.get(addonId);
    if (!map) return {};
    return Object.fromEntries(map);
  },
};
