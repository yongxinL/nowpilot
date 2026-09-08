import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingModal } from '@/components/OnboardingModal';

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

describe('OnboardingModal', () => {
  it('shows a static introduction placeholder on the first step', () => {
    render(<OnboardingModal open={true} onClose={() => {}} />);
    expect(screen.getByText('NowPilot — Your ServiceNow support co-pilot')).toBeInTheDocument();
  });

  it('walks through the provider and API key steps', () => {
    render(<OnboardingModal open={true} onClose={() => {}} />);
    next();
    expect(screen.getByLabelText('AI provider')).toBeInTheDocument();
    next();
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
  });

  it('clears the API key on close and never persists, logs or submits it', () => {
    const onClose = vi.fn();
    const debugSpy = vi.spyOn(console, 'debug');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { rerender } = render(<OnboardingModal open={true} onClose={onClose} />);
    next();
    next();
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-secret-123' } });
    expect(input.value).toBe('sk-secret-123');

    rerender(<OnboardingModal open={false} onClose={onClose} />);
    rerender(<OnboardingModal open={true} onClose={onClose} />);

    next();
    next();
    const inputAfter = screen.getByLabelText('API key') as HTMLInputElement;
    expect(inputAfter.value).toBe('');

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const call of debugSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('sk-secret-123');
    }
  });
});
