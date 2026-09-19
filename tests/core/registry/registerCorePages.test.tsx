import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CORE_PAGE_REGISTRY } from '@/core/registry/registerCorePages';
import { STANDALONE_ROUTE_IDS } from '@/core/registry/standaloneRoutes';

describe('core page registry', () => {
  it('registers a component for every route id', () => {
    for (const id of STANDALONE_ROUTE_IDS) {
      expect(CORE_PAGE_REGISTRY.has(id)).toBe(true);
    }
    expect(CORE_PAGE_REGISTRY.entries()).toHaveLength(STANDALONE_ROUTE_IDS.length);
  });

  it('renders each skeleton page with its canonical test id', () => {
    for (const id of STANDALONE_ROUTE_IDS) {
      const Page = CORE_PAGE_REGISTRY.get(id);
      expect(Page).toBeDefined();
      const { unmount } = render(Page ? <Page /> : null);
      expect(screen.getByTestId(`standalone-page-${id}`)).toBeInTheDocument();
      unmount();
    }
  });
});
