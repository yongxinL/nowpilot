import React from 'react';
import { Card, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export interface SourceCardProps {
  /** Source title (clickable if url provided) */
  title: string;
  /** Optional URL to open in new tab */
  url?: string;
  /** Content snippet from the source */
  snippet: string;
}

/**
 * Renders a source reference card with title and snippet.
 * Used in agent ThoughtChain to show which sources were consulted
 * during tool execution, or in chat messages to cite references.
 */
export function SourceCard({ title, url, snippet }: SourceCardProps) {
  return (
    <Card
      size="small"
      style={{
        margin: '4px 0',
        background: 'var(--ant-color-bg-layout)',
      }}
      styles={{ body: { padding: '8px 12px' } }}
    >
      {/* Title with optional link */}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--ant-color-primary)',
            marginBottom: 4,
          }}
        >
          <LinkOutlined />
          {title}
        </a>
      ) : (
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
          {title}
        </Text>
      )}

      {/* Snippet */}
      <Paragraph
        type="secondary"
        style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}
        ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
      >
        {snippet}
      </Paragraph>
    </Card>
  );
}
