import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StandaloneSider } from '@/components/standalone/StandaloneSider';

afterEach(cleanup);

describe('StandaloneSider', () => {
  it('renders the five primary and two footer routes from the registry', () => {
    render(<StandaloneSider activeRoute="chat" onNavigate={() => {}} />);
    for (const label of ['Chat', 'Agent', 'Notes', 'Write', 'Tools', 'Options', 'Diagnostics']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('navigates to the clicked route id', () => {
    const onNavigate = vi.fn();
    render(<StandaloneSider activeRoute="chat" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Notes'));
    expect(onNavigate).toHaveBeenCalledWith('notes');
  });
});
