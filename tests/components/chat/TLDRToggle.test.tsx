import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TLDRToggle } from '../../../src/components/chat/TLDRToggle';

afterEach(cleanup);

describe('TLDRToggle', () => {
  it('renders content unchanged when content is short', () => {
    const { container } = render(<TLDRToggle content="Short text" />);
    expect(container.textContent).toBe('Short text');
    expect(screen.queryAllByText('Show More')).toHaveLength(0);
  });

  it('renders preview + Show More for long content', () => {
    const longContent = 'First sentence. ' + 'A'.repeat(500);
    render(<TLDRToggle content={longContent} />);
    expect(screen.queryAllByText('Show More').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show toggle during streaming', () => {
    const longContent = 'First sentence. ' + 'A'.repeat(500);
    render(<TLDRToggle content={longContent} streaming />);
    expect(screen.queryAllByText('Show More')).toHaveLength(0);
  });

  it('renders Show More button for long content', () => {
    const longContent = 'First sentence. ' + 'A'.repeat(500);
    render(<TLDRToggle content={longContent} />);
    expect(screen.queryAllByText('Show More').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show toggle at exactly 500 chars', () => {
    const content = 'X'.repeat(500);
    render(<TLDRToggle content={content} />);
    expect(screen.queryAllByText('Show More')).toHaveLength(0);
  });

  it('shows toggle at 501 chars', () => {
    const content = 'Y'.repeat(501);
    render(<TLDRToggle content={content} />);
    expect(screen.queryAllByText('Show More').length).toBeGreaterThanOrEqual(1);
  });
});
