import type { ComponentType } from 'react';
import { debugLog } from '../utils/debugLog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddonSkill {
  name: string;
  description: string;
  addonId: string;
  handler: (input: unknown) => Promise<unknown>;
  inputSchema?: Record<string, unknown>;
}

export interface AddonPage {
  id: string;
  addonId: string;
  label: string;
  icon?: ComponentType;
  component: ComponentType;
  order?: number;
  surface: 'sidepanel' | 'standalone' | 'both';
}

export interface AddonSettingsSchema {
  addonId: string;
  fields: Record<string, { type: string; label: string; default?: unknown }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENABLED_KEY = 'np_addon_enabled';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class AddonRegistry {
  #skills = new Map<string, AddonSkill>();
  #pages = new Map<string, AddonPage>();
  #settingsSchemas = new Map<string, AddonSettingsSchema>();
  #enabled = new Map<string, boolean>();

  constructor() {
    this.#loadEnabled().catch(() => {});
  }

  // --- Skill registration ------------------------------------------------

  registerSkill(addonId: string, skill: AddonSkill): void {
    const key = `${addonId}:${skill.name}`;
    if (this.#skills.has(key)) {
      throw new Error(`Skill "${key}" is already registered`);
    }
    this.#skills.set(key, skill);
  }

  unregisterSkill(addonId: string, name: string): void {
    this.#skills.delete(`${addonId}:${name}`);
  }

  getSkill(addonId: string, name: string): AddonSkill | undefined {
    return this.#skills.get(`${addonId}:${name}`);
  }

  hasSkill(addonId: string, name: string): boolean {
    return this.#skills.has(`${addonId}:${name}`);
  }

  listSkills(): AddonSkill[] {
    return Array.from(this.#skills.values());
  }

  getEnabledSkills(): AddonSkill[] {
    return Array.from(this.#skills.values()).filter(
      (s) => this.isEnabled(s.addonId),
    );
  }

  // --- Page registration ------------------------------------------------

  registerPage(addonId: string, page: AddonPage): void {
    const key = `${addonId}:${page.id}`;
    if (this.#pages.has(key)) {
      throw new Error(`Page "${key}" is already registered`);
    }
    this.#pages.set(key, page);
  }

  unregisterPage(addonId: string, id: string): void {
    this.#pages.delete(`${addonId}:${id}`);
  }

  getPage(addonId: string, id: string): AddonPage | undefined {
    return this.#pages.get(`${addonId}:${id}`);
  }

  hasPage(addonId: string, id: string): boolean {
    return this.#pages.has(`${addonId}:${id}`);
  }

  listPages(): AddonPage[] {
    return Array.from(this.#pages.values());
  }

  getEnabledPages(): AddonPage[] {
    return Array.from(this.#pages.values()).filter(
      (p) => this.isEnabled(p.addonId),
    );
  }

  // --- Settings schema registration -------------------------------------

  registerSettingsSchema(schema: AddonSettingsSchema): void {
    const key = schema.addonId;
    if (this.#settingsSchemas.has(key)) {
      throw new Error(`Settings schema for addon "${key}" is already registered`);
    }
    this.#settingsSchemas.set(key, schema);
  }

  getSettingsSchema(addonId: string): AddonSettingsSchema | undefined {
    return this.#settingsSchemas.get(addonId);
  }

  listSettingsSchemas(): AddonSettingsSchema[] {
    return Array.from(this.#settingsSchemas.values());
  }

  // --- Enable / disable -------------------------------------------------

  async enable(addonId: string): Promise<void> {
    this.#enabled.set(addonId, true);
    await this.#persistEnabled();
  }

  async disable(addonId: string): Promise<void> {
    this.#enabled.set(addonId, false);
    await this.#persistEnabled();
  }

  isEnabled(addonId: string): boolean {
    return this.#enabled.get(addonId) ?? false;
  }

  listEnabled(): string[] {
    return Array.from(this.#enabled.entries())
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  // --- Persistence ------------------------------------------------------

  async #loadEnabled(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(ENABLED_KEY);
      const persisted = (result[ENABLED_KEY] ?? {}) as Record<string, boolean>;
      for (const [addonId, enabled] of Object.entries(persisted)) {
        this.#enabled.set(addonId, enabled);
      }
    } catch (err) {
      debugLog('error', '[AddonRegistry] loadEnabled failed', { error: err });
    }
  }

  async #persistEnabled(): Promise<void> {
    try {
      const enabled = Object.fromEntries(this.#enabled);
      await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    } catch (err) {
      debugLog('error', '[AddonRegistry] persistEnabled failed', { error: err });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const addonRegistry = new AddonRegistry();
