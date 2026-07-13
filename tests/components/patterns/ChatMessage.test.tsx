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

// Mock Bubble from @ant-design/x
vi.mock('@ant-design/x', () => ({
  Bubble: ({ placement, content }: any) =>
    React.createElement('div', {
      'data-testid': 'bubble',
      'data-placement': placement,
    }, content),
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
});
