import '@testing-library/jest-dom/vitest';
import { createChromeStorageMock } from './helpers/chromeMock';

if (typeof globalThis.chrome === 'undefined') {
  (globalThis as { chrome?: unknown }).chrome = {
    storage: createChromeStorageMock(),
    runtime: { id: 'test-extension-id' },
  };
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof globalThis.ResizeObserver;
}
