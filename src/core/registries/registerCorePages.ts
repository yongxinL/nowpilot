import type { ComponentType } from 'react';
import { sidepanelPageRegistry } from './SidepanelPageRegistry';
import { standalonePageRegistry } from './StandalonePageRegistry';

export interface RegisterCorePagesOptions {
  id: string;
  label: string;
  icon?: ComponentType;
  component: ComponentType;
  order?: number;
  registerOn: ('sidepanel' | 'standalone')[];
}

export function registerCorePages(options: RegisterCorePagesOptions): void {
  if (options.registerOn.includes('sidepanel')) {
    sidepanelPageRegistry.register({
      id: options.id,
      label: options.label,
      icon: options.icon,
      component: options.component,
      order: options.order,
    });
  }
  if (options.registerOn.includes('standalone')) {
    standalonePageRegistry.register({
      id: options.id,
      label: options.label,
      icon: options.icon,
      component: options.component,
      order: options.order,
    });
  }
}
