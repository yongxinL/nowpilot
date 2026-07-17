import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { TagSuggestions } from '../../../src/components/notes/TagSuggestions';

describe('TagSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders suggested tags', () => {
    const { container } = render(
      <TagSuggestions
        suggestedTags={['react', 'hooks']}
        acceptedTags={new Set()}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );
    expect(container.textContent).toContain('react');
    expect(container.textContent).toContain('hooks');
  });

  it('shows green color for accepted tags', () => {
    const { container } = render(
      <TagSuggestions
        suggestedTags={['react']}
        acceptedTags={new Set(['react'])}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );
    const tag = container.querySelector('.ant-tag');
    expect(tag).toBeTruthy();
    expect(tag?.className).toContain('ant-tag-green');
  });

  it('shows default color for unaccepted tags', () => {
    const { container } = render(
      <TagSuggestions
        suggestedTags={['react']}
        acceptedTags={new Set()}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );
    const tag = container.querySelector('.ant-tag');
    expect(tag).toBeTruthy();
    expect(tag?.className).not.toContain('ant-tag-green');
  });

  it('calls onAccept when accept button is clicked', () => {
    const onAccept = vi.fn();
    const { container } = render(
      <TagSuggestions
        suggestedTags={['react']}
        acceptedTags={new Set()}
        onAccept={onAccept}
        onReject={() => {}}
      />,
    );
    const checkIcon = container.querySelector('.anticon-check');
    expect(checkIcon).toBeTruthy();
    fireEvent.click(checkIcon!.closest('button')!);
    expect(onAccept).toHaveBeenCalledWith('react');
  });

  it('calls onReject when tag close icon is clicked', () => {
    const onReject = vi.fn();
    const { container } = render(
      <TagSuggestions
        suggestedTags={['react']}
        acceptedTags={new Set()}
        onAccept={() => {}}
        onReject={onReject}
      />,
    );
    const closeIcon = container.querySelector('.ant-tag-close-icon');
    expect(closeIcon).toBeTruthy();
    fireEvent.click(closeIcon!);
    expect(onReject).toHaveBeenCalledWith('react');
  });

  it('shows loading spinner when loading is true', () => {
    const { container } = render(
      <TagSuggestions
        suggestedTags={[]}
        acceptedTags={new Set()}
        onAccept={() => {}}
        onReject={() => {}}
        loading={true}
      />,
    );
    expect(container.textContent).toContain('Analyzing tags...');
    expect(container.querySelector('.ant-spin')).toBeTruthy();
  });

  it('shows empty state when no suggestions and not loading', () => {
    const { container } = render(
      <TagSuggestions
        suggestedTags={[]}
        acceptedTags={new Set()}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );
    expect(container.textContent).toContain('No suggestions yet');
  });

  it('renders "Suggested tags" label when tags are present', () => {
    const { container } = render(
      <TagSuggestions
        suggestedTags={['react']}
        acceptedTags={new Set()}
        onAccept={() => {}}
        onReject={() => {}}
      />,
    );
    expect(container.textContent).toContain('Suggested tags');
  });
});
