import type { ComponentType } from 'react';

export interface AddonSkill {
  name: string;
  description: string;
  addonId: string;
  handler: (input: unknown) => Promise<unknown>;
}

export interface AddonPage {
  id: string;
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
