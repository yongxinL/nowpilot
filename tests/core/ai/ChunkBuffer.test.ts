import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChunkBuffer } from '../../../src/core/ai/ChunkBuffer';

describe('ChunkBuffer', () => {
  let buffer: ChunkBuffer;

  beforeEach(() => {
    vi.useFakeTimers();
    buffer = new ChunkBuffer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates multiple text-delta events', () => {
    buffer.write('Hello ');
    buffer.write('World');
    const text = buffer.flush();
    expect(text).toBe('Hello World');
  });

  it('flush returns accumulated text and clears the buffer', () => {
    buffer.write('Test content');
    const text = buffer.flush();
    expect(text).toBe('Test content');
    expect(buffer.flush()).toBe('');
  });

  it('transition updates the stage', () => {
    buffer.transition('planning');
    expect(buffer.getStage()).toBe('planning');
  });

  it('follows valid stage sequence', () => {
    buffer.transition('reading-page');
    expect(buffer.getStage()).toBe('reading-page');

    buffer.transition('planning');
    expect(buffer.getStage()).toBe('planning');

    buffer.transition('generating');
    expect(buffer.getStage()).toBe('generating');

    buffer.transition('done');
    expect(buffer.getStage()).toBe('done');
  });

  it('rejects invalid stage transitions', () => {
    buffer.transition('planning');
    buffer.transition('generating');
    expect(buffer.getStage()).toBe('generating');

    buffer.transition('reading-page');
    expect(buffer.getStage()).toBe('generating');
  });

  it('tracks cumulative token count', () => {
    buffer.addTokens(10, 5);
    buffer.addTokens(5, 3);
    expect(buffer.getTokenCount()).toBe(23);
  });

  it('getStageLabel returns human-readable label', () => {
    expect(buffer.getStageLabel()).toBe('');
    buffer.transition('planning');
    expect(buffer.getStageLabel()).toBe('Planning response…');
    buffer.transition('generating');
    expect(buffer.getStageLabel()).toBe('Generating…');
  });

  it('reset clears state', () => {
    buffer.write('Some text');
    buffer.transition('generating');
    buffer.addTokens(10, 5);
    buffer.reset();
    expect(buffer.flush()).toBe('');
    expect(buffer.getStage()).toBe('idle');
    expect(buffer.getTokenCount()).toBe(0);
  });
});
