import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock XMarkdown component
vi.mock('@ant-design/x-markdown', () => ({
  XMarkdown: ({ content, streaming, openLinksInNewTab }: any) => 
    React.createElement('div', { 
      'data-testid': 'xmarkdown',
      'data-content': content,
      'data-streaming': String(!!streaming?.hasNextChunk),
      'data-open-links-new-tab': String(!!openLinksInNewTab),
    }, content),
}));

// Mock BunnyAvatar
vi.mock('../../../src/components/common/BunnyAvatar', () => ({
  BunnyAvatar: () => React.createElement('div', { 'data-testid': 'bunny-avatar' }, '🐰'),
}));

// Mock StructuredOutputActions
vi.mock('../../../src/components/chat/StructuredOutputActions', () => ({
  StructuredOutputActions: ({ content, hasTable }: any) =>
    hasTable
      ? React.createElement('div', { 'data-testid': 'structured-actions', 'data-content': content }, 'Copy as table / Export CSV')
      : null,
}));

// Mock Bubble from @ant-design/x — now supports avatar, header, footer
vi.mock('@ant-design/x', () => ({
  Bubble: ({ placement, content, avatar, header, footer }: any) =>
    React.createElement('div', {
      'data-testid': 'bubble',
      'data-placement': placement,
      'data-has-avatar': avatar ? 'true' : 'false',
      'data-has-header': header ? 'true' : 'false',
      'data-has-footer': footer ? 'true' : 'false',
    }, content, header ? React.createElement('div', { 'data-testid': 'bubble-header' }, header) : null, footer),
}));

import { ChatMessage } from '../../../src/components/chat/ChatMessage';

describe('ChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Bubble with assistant placement for assistant messages', () => {
    const { container } = render(
      React.createElement(ChatMessage, { content: 'Hello', role: 'assistant', streaming: false }),
    );
    
    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble).toBeTruthy();
    expect(bubble?.getAttribute('data-placement')).toBe('start');
  });

  it('renders Bubble with user placement for user messages', () => {
    const { container } = render(
      React.createElement(ChatMessage, { content: 'Hi', role: 'user', streaming: false }),
    );
    
    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble).toBeTruthy();
    expect(bubble?.getAttribute('data-placement')).toBe('end');
  });

  it('passes streaming prop to XMarkdown', () => {
    const { container } = render(
      React.createElement(ChatMessage, { content: 'Streaming text', role: 'assistant', streaming: true }),
    );

    const xmarkdown = container.querySelector('[data-testid="xmarkdown"]');
    expect(xmarkdown).toBeTruthy();
    expect(xmarkdown?.getAttribute('data-streaming')).toBe('true');
  });

  it('passes openLinksInNewTab=true to XMarkdown', () => {
    const { container } = render(
      React.createElement(ChatMessage, { content: 'Link check', role: 'assistant', streaming: false }),
    );

    const xmarkdown = container.querySelector('[data-testid="xmarkdown"]');
    expect(xmarkdown?.getAttribute('data-open-links-new-tab')).toBe('true');
  });

  // -----------------------------------------------------------------------
  // New tests: First-message branding (D-28) + Save-to-note (RICH-H-06)
  // -----------------------------------------------------------------------

  // Test 1: When isFirstMessage=true and role='assistant', avatar and header are passed
  it('renders BunnyAvatar + branded header on first assistant message', () => {
    const { container } = render(
      React.createElement(ChatMessage, {
        content: 'Hi there',
        role: 'assistant',
        streaming: false,
        isFirstMessage: true,
      }),
    );

    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble).toBeTruthy();
    // Has avatar and header
    expect(bubble?.getAttribute('data-has-avatar')).toBe('true');
    expect(bubble?.getAttribute('data-has-header')).toBe('true');
  });

  // Test 2: When isFirstMessage=false, no avatar or header
  it('does not render avatar/header when isFirstMessage is false', () => {
    const { container } = render(
      React.createElement(ChatMessage, {
        content: 'Regular message',
        role: 'assistant',
        streaming: false,
        isFirstMessage: false,
      }),
    );

    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble).toBeTruthy();
    expect(bubble?.getAttribute('data-has-avatar')).toBe('false');
    expect(bubble?.getAttribute('data-has-header')).toBe('false');
  });

  // Test 3: Save-to-note button visible in footer when onSaveToNote provided
  it('shows Save-to-note in footer when onSaveToNote provided', () => {
    const onSave = vi.fn();
    const { container } = render(
      React.createElement(ChatMessage, {
        content: 'Save me',
        role: 'assistant',
        streaming: false,
        onSaveToNote: onSave,
      }),
    );

    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble?.getAttribute('data-has-footer')).toBe('true');
    // Footer should contain Save button text
    expect(container.textContent).toContain('Save to note');
  });

  // Test 4: Save-to-note hidden during streaming
  it('hides footer entirely during streaming', () => {
    const { container } = render(
      React.createElement(ChatMessage, {
        content: 'Streaming...',
        role: 'assistant',
        streaming: true,
        onSaveToNote: vi.fn(),
      }),
    );

    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble?.getAttribute('data-has-footer')).toBe('false');
  });

  // Test 5: StructuredOutputActions rendered when content has markdown table
  it('renders StructuredOutputActions when content has table', () => {
    const { container } = render(
      React.createElement(ChatMessage, {
        content: '| col1 | col2 |\n| --- | --- |\n| a | b |',
        role: 'assistant',
        streaming: false,
      }),
    );

    const actions = container.querySelector('[data-testid="structured-actions"]');
    expect(actions).toBeTruthy();
  });

  // Test 6: User messages unaffected by isFirstMessage flag
  it('does not show avatar/header for user messages even when isFirstMessage=true', () => {
    const { container } = render(
      React.createElement(ChatMessage, {
        content: 'User text',
        role: 'user',
        streaming: false,
        isFirstMessage: true,
      }),
    );

    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble).toBeTruthy();
    expect(bubble?.getAttribute('data-has-avatar')).toBe('false');
    expect(bubble?.getAttribute('data-has-header')).toBe('false');
  });
});
