import type { ComponentType } from 'react';
import { Registry } from './Registry';

export interface StandalonePageRegistration {
  id: string;
  label: string;
  icon: string;
  routePath: string;
  component: ComponentType;
  order: number;
  showInSider?: boolean;
  addonId?: string;
}

export const StandalonePageRegistry = new Registry<StandalonePageRegistration>();
