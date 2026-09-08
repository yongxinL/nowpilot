import type { ComponentType } from 'react';
import { Registry } from './Registry';

export interface SidePanelPageRegistration {
  id: string;
  label: string;
  icon: string;
  urlPatterns?: string[];
  component: ComponentType;
  order: number;
}

export const SidePanelPageRegistry = new Registry<SidePanelPageRegistration>();
