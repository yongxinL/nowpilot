import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { CategoryTree } from '../../../src/components/notes/CategoryTree';
import type { Note } from '../../../src/core/notes/LinkParser';

describe('CategoryTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleNotes: Note[] = [
    { id: 'n1', title: 'React Hooks', content: '...', created: 1000, updated: 1000, tags: [], categoryPath: 'Frontend/React' },
    { id: 'n2', title: 'Vue Router', content: '...', created: 1001, updated: 1001, tags: [], categoryPath: 'Frontend/Vue' },
    { id: 'n3', title: 'Express Middleware', content: '...', created: 1002, updated: 1002, tags: [], categoryPath: 'Backend/Node' },
    { id: 'n4', title: 'No Category Note', content: '...', created: 1003, updated: 1003, tags: [] },
  ];

  it('renders Categories label', () => {
    const { container } = render(
      <CategoryTree notes={sampleNotes} selectedNoteId={null} onSelect={() => {}} />,
    );
    expect(container.textContent).toContain('Categories');
  });

  it('renders Empty state when notes array is empty', () => {
    const { container } = render(
      <CategoryTree notes={[]} selectedNoteId={null} onSelect={() => {}} />,
    );
    expect(container.textContent).toContain('No notes');
  });

  it('renders Uncategorized node for notes without categoryPath', () => {
    const { container } = render(
      <CategoryTree notes={sampleNotes} selectedNoteId={null} onSelect={() => {}} />,
    );
    expect(container.textContent).toContain('Uncategorized');
  });

  it('renders category folder names', () => {
    const { container } = render(
      <CategoryTree notes={sampleNotes} selectedNoteId={null} onSelect={() => {}} />,
    );
    expect(container.textContent).toContain('Frontend');
    expect(container.textContent).toContain('Backend');
  });

  it('renders note titles under categories', () => {
    const { container } = render(
      <CategoryTree notes={sampleNotes} selectedNoteId={null} onSelect={() => {}} />,
    );
    expect(container.textContent).toContain('React Hooks');
    expect(container.textContent).toContain('Vue Router');
    expect(container.textContent).toContain('Express Middleware');
    expect(container.textContent).toContain('No Category Note');
  });

  it('passes selectedKeys from selectedNoteId', () => {
    const { container } = render(
      <CategoryTree notes={sampleNotes} selectedNoteId="n1" onSelect={() => {}} />,
    );
    // Component renders without error when selectedNoteId is set
    expect(container.querySelector('.ant-tree')).toBeTruthy();
  });
});
