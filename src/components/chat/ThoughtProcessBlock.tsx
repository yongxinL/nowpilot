import React, { useState } from 'react';
import { RightOutlined, DownOutlined } from '@ant-design/icons';

interface ThoughtProcessBlockProps {
  thoughtText?: string;
  isThinking?: boolean;
}

export const ThoughtProcessBlock: React.FC<ThoughtProcessBlockProps> = ({
  thoughtText,
  isThinking = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!thoughtText && !isThinking) return null;

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ fontWeight: 600, color: 'var(--foreground)' }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} style={{ fontStyle: 'italic', color: 'var(--muted-foreground)' }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  const renderFormattedLines = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} style={{ height: 4 }} />;

      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        return (
          <div
            key={idx}
            style={{
              marginTop: 4,
              marginBottom: 4,
              fontStyle: 'italic',
              color: 'var(--muted-foreground)',
              fontSize: 11.5,
              lineHeight: 1.625,
            }}
          >
            {trimmed}
          </div>
        );
      }

      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
      if (numMatch) {
        const num = numMatch[1];
        const rest = numMatch[2];
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              marginTop: 4,
              marginBottom: 4,
              color: 'var(--muted-foreground)',
              fontSize: 12,
              lineHeight: 1.625,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--foreground)', minWidth: 16 }}>{num}</span>
            <div style={{ flex: 1 }}>{parseInlineMarkdown(rest)}</div>
          </div>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const rest = trimmed.substring(2);
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginLeft: 10,
              marginTop: 2,
              marginBottom: 2,
              color: 'var(--muted-foreground)',
              fontSize: 12,
              lineHeight: 1.625,
            }}
          >
            <span style={{ color: 'var(--muted-foreground)' }}>•</span>
            <div style={{ flex: 1 }}>{parseInlineMarkdown(rest)}</div>
          </div>
        );
      }

      return (
        <div
          key={idx}
          style={{
            marginTop: 2,
            marginBottom: 2,
            color: 'var(--muted-foreground)',
            fontSize: 12,
            lineHeight: 1.625,
          }}
        >
          {parseInlineMarkdown(trimmed)}
        </div>
      );
    });
  };

  const rawContent = thoughtText || 'Analyzing prompt and formulating optimal step-by-step reasoning...';

  // Active Thinking State (Screenshot 1: snSGL1786969215cvm6y2at.png)
  if (isThinking) {
    return (
      <div
        style={{
          width: '100%',
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--muted-foreground)',
            fontSize: 12,
            marginBottom: 6,
            fontWeight: 400,
            userSelect: 'none',
          }}
        >
          <svg
            className="np-spin"
            style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" strokeDasharray="16 32" strokeLinecap="round" />
          </svg>
          <span style={{ fontStyle: 'italic', color: 'var(--muted-foreground)', fontWeight: 400 }}>Thinking...</span>
        </div>

        {/* Indented Left Border Stream block */}
        <div
          style={{
            borderLeft: '2px solid var(--border)',
            paddingLeft: 14,
            marginLeft: 4,
            marginTop: 4,
            marginBottom: 4,
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}
        >
          {renderFormattedLines(rawContent)}
        </div>
      </div>
    );
  }

  // Finished Thinking State (Screenshot 3: snSGL1786969760jtt8rghv.png)
  return (
    <div
      style={{
        width: '100%',
        marginTop: 6,
        marginBottom: 6,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          color: 'var(--muted-foreground)',
          fontSize: 12,
          fontWeight: 400,
          cursor: 'pointer',
          transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          userSelect: 'none',
          background: 'transparent',
          border: 'none',
        }}
      >
        <svg
          style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span style={{ fontWeight: 400, fontSize: 12 }}>Thought process</span>
        <span style={{ fontSize: 10, marginLeft: 2, color: 'var(--muted-foreground)' }}>
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
      </button>

      <div
        style={{
          display: 'grid',
          transition: 'all 200ms ease-in-out',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          opacity: expanded ? 1 : 0,
          marginTop: expanded ? 4 : 0,
          marginBottom: expanded ? 4 : 0,
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              borderLeft: '2px solid var(--border)',
              paddingLeft: 14,
              marginLeft: 4,
              paddingTop: 4,
              paddingBottom: 4,
              color: 'var(--muted-foreground)',
              fontSize: 12,
            }}
          >
            {renderFormattedLines(rawContent)}
          </div>
        </div>
      </div>
    </div>
  );
};
