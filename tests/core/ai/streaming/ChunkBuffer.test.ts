import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChunkBuffer } from '../../../../src/core/ai/streaming/ChunkBuffer';

describe('ChunkBuffer', () => {
  let onFlush: ReturnType<typeof vi.fn>;
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;

  beforeEach(() => {
    onFlush = vi.fn();
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    // Mock rAF to call the callback immediately via setTimeout(0)
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  it('single push flushes the text after one rAF cycle', async () => {
    const buffer = new ChunkBuffer(onFlush);
    buffer.push('hello');
    expect(onFlush).not.toHaveBeenCalled();
    // Wait for rAF to fire
    await vi.waitFor(() => {
      expect(onFlush).toHaveBeenCalledTimes(1);
    });
    expect(onFlush).toHaveBeenCalledWith('hello');
  });

  it('multiple pushes within same rAF frame are batched into a single flush', async () => {
    const buffer = new ChunkBuffer(onFlush);
    buffer.push('a');
    buffer.push('b');
    buffer.push('c');
    expect(onFlush).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(onFlush).toHaveBeenCalledTimes(1);
    });
    expect(onFlush).toHaveBeenCalledWith('abc');
  });

  it('pushes across separate rAF frames flush separately', async () => {
    const buffer = new ChunkBuffer(onFlush);
    buffer.push('x');
    await vi.waitFor(() => {
      expect(onFlush).toHaveBeenCalledTimes(1);
    });
    expect(onFlush).toHaveBeenCalledWith('x');

    buffer.push('y');
    await vi.waitFor(() => {
      expect(onFlush).toHaveBeenCalledTimes(2);
    });
    expect(onFlush).toHaveBeenCalledWith('y');
  });

  it('flush() immediately emits pending buffer without waiting for rAF', () => {
    const buffer = new ChunkBuffer(onFlush);
    buffer.push('immediate');
    buffer.flush();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith('immediate');
  });

  it('destroy() cancels pending rAF and prevents future callbacks', async () => {
    const buffer = new ChunkBuffer(onFlush);
    buffer.push('lost');
    buffer.destroy();
    // Wait a bit — the rAF should have been cancelled
    await new Promise((r) => setTimeout(r, 50));
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(onFlush).not.toHaveBeenCalled();
  });
});
