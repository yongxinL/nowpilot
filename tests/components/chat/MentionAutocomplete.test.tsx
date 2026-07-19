import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MentionAutocomplete } from '../../../src/components/chat/MentionAutocomplete';

describe('MentionAutocomplete', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MentionAutocomplete value="Hello @" onSelect={vi.fn()} cursorPosition={7} />,
    );
    expect(container).toBeDefined();
  });

  it('does not render when no @ trigger', () => {
    const { container } = render(
      <MentionAutocomplete value="Hello" onSelect={vi.fn()} cursorPosition={5} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
