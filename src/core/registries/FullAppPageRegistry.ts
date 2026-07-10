import type { ComponentType } from 'react';

export interface PageDefinition {
  id: string;
  label: string;
  icon?: ComponentType;
  component: ComponentType;
  order?: number;
}

export class FullAppPageRegistry {
  private pages = new Map<string, PageDefinition>();

  register(page: PageDefinition): void {
    if (this.pages.has(page.id)) {
      throw new Error(`Page "${page.id}" is already registered`);
    }
    this.pages.set(page.id, page);
  }

  unregister(id: string): void {
    this.pages.delete(id);
  }

  getAll(): PageDefinition[] {
    return Array.from(this.pages.values()).sort((a, b) => {
      if (a.order == null && b.order == null) return 0;
      if (a.order == null) return 1;
      if (b.order == null) return -1;
      return a.order - b.order;
    });
  }
}

export const fullAppPageRegistry = new FullAppPageRegistry();
