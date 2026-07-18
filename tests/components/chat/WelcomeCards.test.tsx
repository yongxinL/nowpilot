import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock WelcomeCardService before importing component
// ---------------------------------------------------------------------------
const mockCards = vi.hoisted(() => [
  { id: 'summarize_page', title: 'Summarize This Page', description: 'Extract key points', icon: 'FileTextOutlined', category: 'Research', templateId: 'summarize_page', score: 150 },
  { id: 'research_topic', title: 'Research a Topic', description: 'Search and synthesize', icon: 'GlobalOutlined', category: 'Research', templateId: 'research', score: 129 },
  { id: 'draft_response', title: 'Draft a Response', description: 'Write a reply', icon: 'FormOutlined', category: 'Writing', templateId: 'draft', score: 98 },
  { id: 'explain_code', title: 'Explain Code or Errors', description: 'Understand code', icon: 'CodeOutlined', category: 'Coding', templateId: 'explain', score: 97 },
  { id: 'write_script', title: 'Write a Script', description: 'Generate code', icon: 'CodeOutlined', category: 'Coding', templateId: 'write_script', score: 96 },
  { id: 'analyze_data', title: 'Analyze Data', description: 'Extract insights', icon: 'FileTextOutlined', category: 'Analysis', templateId: 'analyze', score: 95 },
]);

const mockGetCards = vi.hoisted(() => vi.fn().mockResolvedValue(mockCards));

vi.mock('../../../src/core/ai/WelcomeCardService', () => ({
  welcomeCardService: { getCards: mockGetCards },
}));

// ---------------------------------------------------------------------------
import { WelcomeCards } from '../../../src/components/chat/WelcomeCards';

const PROMPT_TEXTS: Record<string, string> = {
  summarize_page: 'Summarize the content of this page.',
  research_topic: 'Research: {topic}',
  draft_response: 'Draft a response to:',
  explain_code: 'Explain this code/error:',
  write_script: 'Write a script that:',
  analyze_data: 'Analyze this data:',
};

describe('WelcomeCards', () => {
  const onSelectCard = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCards.mockResolvedValue(mockCards);
  });

  // Test 1: Renders 6 Card components in a grid
  it('renders 6 capability cards with title and description', async () => {
    render(<WelcomeCards onSelectCard={onSelectCard} onDismiss={onDismiss} />);

    // Wait for cards to load
    await waitFor(() => {
      expect(screen.getByText('Summarize This Page')).toBeTruthy();
    });

    expect(screen.getByText('Research a Topic')).toBeTruthy();
    expect(screen.getByText('Draft a Response')).toBeTruthy();
    expect(screen.getByText('Explain Code or Errors')).toBeTruthy();
    expect(screen.getByText('Write a Script')).toBeTruthy();
    expect(screen.getByText('Analyze Data')).toBeTruthy();
  });

  // Test 2: Clicking a WelcomeCard calls onSelectCard with templateId and promptText
  it('calls onSelectCard with templateId and promptText when card is clicked', async () => {
    render(<WelcomeCards onSelectCard={onSelectCard} onDismiss={onDismiss} />);

    // Wait for cards to load
    await waitFor(() => {
      expect(screen.getByText('Research a Topic')).toBeTruthy();
    });

    // Use getAllByText because antd renders text in both <span> and <strong>
    const titles = screen.getAllByText('Summarize This Page');
    expect(titles.length).toBeGreaterThan(0);
    // Click the parent Card element (closest .ant-card)
    const cardEl = titles[0].closest('.ant-card');
    expect(cardEl).toBeTruthy();
    fireEvent.click(cardEl!);

    expect(onSelectCard).toHaveBeenCalledWith(
      'summarize_page',
      PROMPT_TEXTS.summarize_page,
    );
  });

  // Test 3: "Don't show again" dismiss button calls onDismiss
  it('renders dismiss button that calls onDismiss when clicked', async () => {
    render(<WelcomeCards onSelectCard={onSelectCard} onDismiss={onDismiss} />);

    // Wait for cards to render (use text that doesn't duplicate heavily)
    await waitFor(() => {
      const descs = screen.getAllByText('Extract key points');
      expect(descs.length).toBeGreaterThan(0);
    });

    // antd Button renders text in multiple nested elements
    const dismissBtns = screen.getAllByText("Don't show again");
    expect(dismissBtns.length).toBeGreaterThan(0);
    // Click the actual button element (parent of the text span)
    const btn = dismissBtns[0].closest('button');
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  // Test 4: Shows loading state while cards are being fetched
  it('shows loading indicator while cards are fetching', () => {
    // Keep the promise pending so loading state stays active
    mockGetCards.mockReturnValue(new Promise(() => {}));

    render(<WelcomeCards onSelectCard={onSelectCard} onDismiss={onDismiss} />);

    // Should show a loading indicator
    expect(screen.getByTestId('welcome-cards-loading')).toBeTruthy();
  });
});
