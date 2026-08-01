import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getPrimarySurfaceId,
  isPrimarySurface,
  publish,
  setPrimarySurfaceId,
  subscribe,
} from '../../../src/core/runtime/BroadcastBus';

/**
 * Minimal BroadcastChannel stub — delivers posts to the local listener so
 * the broadcast wiring of the primary-surface election is observable
 * (same pattern as MemoryEngine.test.ts).
 */
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  constructor(name: string) {
    this.name = name;
  }
  postMessage(data: unknown): void {
    this.posted.push(data);
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
  close(): void {
    this.onmessage = null;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

describe('BroadcastBus primary surface election (MEM-02)', () => {
  afterEach(() => {
    setPrimarySurfaceId(null);
  });

  it('treats every surface as primary before any election (null)', () => {
    expect(getPrimarySurfaceId()).toBeNull();
    expect(isPrimarySurface('sidepanel')).toBe(true);
    expect(isPrimarySurface('full-app')).toBe(true);
  });

  it('isPrimarySurface is true only for the elected surface after an election', () => {
    setPrimarySurfaceId('sidepanel');
    expect(isPrimarySurface('sidepanel')).toBe(true);
    expect(isPrimarySurface('full-app')).toBe(false);
  });

  it('clearing the election (null) restores the pre-election open gate', () => {
    setPrimarySurfaceId('sidepanel');
    setPrimarySurfaceId(null);
    expect(isPrimarySurface('full-app')).toBe(true);
  });

  it('setPrimarySurfaceId broadcasts a PRIMARY_SURFACE_ELECTED message (WR-04)', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe<{ surfaceId: string | null }>(
      'PRIMARY_SURFACE_ELECTED',
      listener,
    );
    try {
      setPrimarySurfaceId('sidepanel');
      expect(listener).toHaveBeenCalledWith({ surfaceId: 'sidepanel' });
    } finally {
      unsubscribe();
    }
  });

  it('applies a remote election published by another context — all contexts converge (WR-04)', () => {
    // Simulate an election broadcast arriving from another JS context
    // (the channel delivers it to every context's BroadcastChannel).
    publish('PRIMARY_SURFACE_ELECTED', { surfaceId: 'full-app' });
    expect(getPrimarySurfaceId()).toBe('full-app');
    expect(isPrimarySurface('full-app')).toBe(true);
    expect(isPrimarySurface('sidepanel')).toBe(false);
  });
});
