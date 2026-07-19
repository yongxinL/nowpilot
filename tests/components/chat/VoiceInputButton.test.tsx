import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoiceInputButton } from '../../../src/components/chat/VoiceInputButton';

describe('VoiceInputButton', () => {
  it('renders mic button when SpeechRecognition is available', () => {
    const orig = window.SpeechRecognition;
    (window as any).SpeechRecognition = vi.fn();

    render(<VoiceInputButton />);
    expect(screen.getByRole('button')).toBeDefined();

    (window as any).SpeechRecognition = orig;
  });

  it('returns null when SpeechRecognition is unavailable', () => {
    const orig = (window as any).SpeechRecognition;
    delete (window as any).SpeechRecognition;

    const { container } = render(<VoiceInputButton />);
    expect(container.innerHTML).toBe('');

    (window as any).SpeechRecognition = orig;
  });
});
