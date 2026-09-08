import { beforeEach, describe, expect, it } from 'vitest';
import { SidePanelPageRegistry, type SidePanelPageRegistration } from '@/core/registry/SidePanelPageRegistry';
import { StandalonePageRegistry, type StandalonePageRegistration } from '@/core/registry/StandalonePageRegistry';

describe('Page registries', () => {
  beforeEach(() => {
    SidePanelPageRegistry.clear();
    StandalonePageRegistry.clear();
  });

  it('registers and looks up a side panel page', () => {
    const component = () => null;
    const reg: SidePanelPageRegistration = {
      id: 'sp-page',
      label: 'Side Page',
      icon: 'x',
      component,
      order: 1,
    };
    SidePanelPageRegistry.register(reg.id, reg);
    expect(SidePanelPageRegistry.get('sp-page')).toBeDefined();
    expect(SidePanelPageRegistry.getAll()).toHaveLength(1);
  });

  it('registers and looks up a standalone page', () => {
    const component = () => null;
    const reg: StandalonePageRegistration = {
      id: 'sa-page',
      label: 'Standalone Page',
      icon: 'y',
      routePath: '/standalone',
      component,
      order: 2,
    };
    StandalonePageRegistry.register(reg.id, reg);
    expect(StandalonePageRegistry.get('sa-page')).toBeDefined();
  });
});
