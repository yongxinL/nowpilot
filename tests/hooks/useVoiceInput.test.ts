import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useVoiceInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isSupported is true when SpeechRecognition is available', async () => {
    const mockRecognition = vi.fn();
    const origSpeechRecognition = window.SpeechRecognition;
    (window as any).SpeechRecognition = mockRecognition;

    const { useVoiceInput } = await import('../../src/hooks/useVoiceInput');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);

    (window as any).SpeechRecognition = origSpeechRecognition;
  });

  it('isSupported is false when SpeechRecognition is unavailable', async () => {
    const orig = (window as any).SpeechRecognition;
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    const { useVoiceInput } = await import('../../src/hooks/useVoiceInput');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(false);

    (window as any).SpeechRecognition = orig;
  });
});
