import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { ConfigProvider } from 'antd';

const renderWithAntd = (ui: React.ReactElement) =>
  render(<ConfigProvider>{ui}</ConfigProvider>);

// Mock templateBrowserService — use vi.hoisted for hoist-safe mock variables
const mockGetByCategory = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => vi.fn());
const mockTrackRecentUse = vi.hoisted(() => vi.fn());
const mockGetRecentlyUsed = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/prompts/TemplateBrowserService', () => ({
  templateBrowserService: {
    getByCategory: mockGetByCategory,
    search: mockSearch,
    trackRecentUse: mockTrackRecentUse,
    getRecentlyUsed: mockGetRecentlyUsed,
  },
}));

const makeMockTemplate = (id: string, name: string, description: string) => ({
  id,
  name,
  description,
  template: `${name} template content for {{userInput}}`,
  category: 'builtin',
  displayCategory: 'Writing',
  variables: ['userInput'],
  isBuiltin: true,
  scopes: ['chat', 'reading', 'writing'] as const,
  hidden: false,
  icon: 'fileText',
  order: 1,
});

const WRITING_TEMPLATES = [
  makeMockTemplate('improve-writing', 'Improve writing', 'Rewrite text to be more concise'),
  makeMockTemplate('continue-writing', 'Continue writing', 'Continue from this point'),
  makeMockTemplate('summarize', 'Summarize', 'Summarize content concisely'),
];

import { TemplateBrowser } from '../../../src/components/chat/TemplateBrowser';

describe('TemplateBrowser', () => {
  const onInsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByCategory.mockResolvedValue([
      { category: 'Writing', templates: WRITING_TEMPLATES },
    ]);
    mockSearch.mockResolvedValue([]);
    mockGetRecentlyUsed.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders SnippetsOutlined icon button with aria-label="Browse templates" (Test 1)', () => {
    renderWithAntd(<TemplateBrowser onInsert={onInsert} />);
    const button = screen.getByRole('button', { name: /browse templates/i });
    expect(button).toBeTruthy();
  });

  it('clicking icon opens popover with categorized sections (Test 2)', async () => {
    renderWithAntd(<TemplateBrowser onInsert={onInsert} />);

    const button = screen.getByRole('button', { name: /browse templates/i });
    fireEvent.click(button);

    // Wait for templates to load and render
    await screen.findByText('Improve writing');
    expect(screen.getByText('Continue writing')).toBeTruthy();

    // Category label should be rendered (original case in DOM, CSS uppercases)
    const categoryLabels = screen.getAllByText((_content, element) =>
      element?.tagName === 'SPAN' && element.textContent === 'Writing'
    );
    expect(categoryLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('recently-used section appears first when recent templates exist (Test 3)', async () => {
    mockGetByCategory.mockResolvedValue([
      {
        category: 'Recently used',
        templates: [WRITING_TEMPLATES[0]],
      },
      { category: 'Writing', templates: WRITING_TEMPLATES },
    ]);

    renderWithAntd(<TemplateBrowser onInsert={onInsert} />);
    const button = screen.getByRole('button', { name: /browse templates/i });
    fireEvent.click(button);

    await screen.findByText('Recently used');
    // "Improve writing" appears in both Recently used and Writing sections
    const improveEls = screen.getAllByText('Improve writing');
    expect(improveEls.length).toBe(2);
  });

  it('clicking a template calls onInsert(template) and tracks recent use (Test 4)', async () => {
    renderWithAntd(<TemplateBrowser onInsert={onInsert} />);

    const button = screen.getByRole('button', { name: /browse templates/i });
    fireEvent.click(button);

    await screen.findByText('Improve writing');
    fireEvent.click(screen.getByText('Improve writing'));

    expect(onInsert).toHaveBeenCalledWith(WRITING_TEMPLATES[0].template);
    expect(mockTrackRecentUse).toHaveBeenCalledWith('improve-writing');
  });

  it('typing in search shows search results as single category section (Test 5)', async () => {
    mockSearch.mockResolvedValue([WRITING_TEMPLATES[2]]);

    renderWithAntd(<TemplateBrowser onInsert={onInsert} />);

    const button = screen.getByRole('button', { name: /browse templates/i });
    fireEvent.click(button);

    await screen.findByText('Improve writing');

    const input = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(input, { target: { value: 'summarize' } });

    await screen.findByText('Search results');
    expect(screen.getByText('Summarize')).toBeTruthy();
  });
});
