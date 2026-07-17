import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AskNotesInput } from '../../../src/components/notes/AskNotesInput';
import type { LinkParser, Note } from '../../../src/core/notes/LinkParser';

// Mock Bubble from @ant-design/x
vi.mock('@ant-design/x', () => ({
  Bubble: ({ placement, content }: any) =>
    React.createElement('div', {
      'data-testid': 'bubble',
      'data-placement': placement,
    }, content),
}));

// Mock NoteQA — use vi.hoisted to avoid hoisting issues
const { mockAsk } = vi.hoisted(() => ({ mockAsk: vi.fn() }));
vi.mock('../../../src/core/notes/NoteQA', () => ({
  noteQA: {
    ask: mockAsk,
  },
}));

const mockLinkParser = {} as LinkParser;
const sampleNotes: Note[] = [
  { id: 'n1', title: 'React Hooks', content: 'Basic hooks content', created: 1000, updated: 1000, tags: ['react'] },
  { id: 'n2', title: 'Vue Guide', content: 'Vue composition API', created: 1001, updated: 1001, tags: ['vue'] },
];

describe('AskNotesInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Input.Search with placeholder', () => {
    const { container } = render(
      <AskNotesInput linkParser={mockLinkParser} allNotes={sampleNotes} />,
    );
    const input = container.querySelector('input');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe('Ask your notes...');
  });

  it('calls noteQA.ask() on search button click', async () => {
    mockAsk.mockResolvedValueOnce({
      answer: 'React hooks are functions.',
      citations: [{ noteId: 'n1', title: 'React Hooks', snippet: 'Basic hooks content' }],
    });

    const { container } = render(
      <AskNotesInput linkParser={mockLinkParser} allNotes={sampleNotes} />,
    );

    const input = container.querySelector('input')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'What are hooks?' } });
    });

    const searchBtn = container.querySelector('.ant-input-search-btn') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockAsk).toHaveBeenCalledWith('What are hooks?', sampleNotes, mockLinkParser);
  });

  it('shows answer and citations on success', async () => {
    mockAsk.mockResolvedValueOnce({
      answer: 'React hooks are functions.',
      citations: [{ noteId: 'n1', title: 'React Hooks', snippet: 'Basic hooks content' }],
    });

    const { container } = render(
      <AskNotesInput linkParser={mockLinkParser} allNotes={sampleNotes} />,
    );

    const input = container.querySelector('input')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'What are hooks?' } });
    });

    const searchBtn = container.querySelector('.ant-input-search-btn') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    // WaitFor handles async state updates from promise resolution
    await waitFor(() => {
      expect(container.textContent).toContain('React hooks are functions.');
    }, { timeout: 2000 });

    expect(container.textContent).toContain('Sources');
    expect(container.textContent).toContain('React Hooks');
  });

  it('shows loading state during QA', async () => {
    // Never-resolving promise to test loading state
    mockAsk.mockImplementationOnce(() => new Promise(() => {}));

    const { container } = render(
      <AskNotesInput linkParser={mockLinkParser} allNotes={sampleNotes} />,
    );

    const input = container.querySelector('input')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'What are hooks?' } });
    });

    const searchBtn = container.querySelector('.ant-input-search-btn') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(container.textContent).toContain('Searching notes...');
  });

  it('shows error state on failure', async () => {
    mockAsk.mockRejectedValueOnce(new Error('API error'));

    const { container } = render(
      <AskNotesInput linkParser={mockLinkParser} allNotes={sampleNotes} />,
    );

    const input = container.querySelector('input')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'What are hooks?' } });
    });

    const searchBtn = container.querySelector('.ant-input-search-btn') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Failed to get answer');
    }, { timeout: 2000 });
  });

  it('does not call noteQA for empty query', async () => {
    const { container } = render(
      <AskNotesInput linkParser={mockLinkParser} allNotes={sampleNotes} />,
    );

    const searchBtn = container.querySelector('.ant-input-search-btn') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('calls onSelectNote when citation Tag is clicked', async () => {
    const onSelectNote = vi.fn();

    mockAsk.mockResolvedValueOnce({
      answer: 'React hooks are functions.',
      citations: [{ noteId: 'n1', title: 'React Hooks', snippet: 'Basic hooks content' }],
    });

    const { container } = render(
      <AskNotesInput
        linkParser={mockLinkParser}
        allNotes={sampleNotes}
        onSelectNote={onSelectNote}
      />,
    );

    const input = container.querySelector('input')!;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'What are hooks?' } });
    });

    const searchBtn = container.querySelector('.ant-input-search-btn') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('React Hooks');
    }, { timeout: 2000 });

    // Click the citation tag
    const tags = container.querySelectorAll('.ant-tag');
    const reactTag = Array.from(tags).find(t => t.textContent?.includes('React Hooks'));
    expect(reactTag).toBeTruthy();
    fireEvent.click(reactTag!);
    expect(onSelectNote).toHaveBeenCalledWith('n1');
  });
});
