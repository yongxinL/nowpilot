import React from 'react';
import { Tag, Typography } from 'antd';
import { ThunderboltOutlined, CodeOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface SkillMessageRendererProps {
  /** Markdown content to render */
  content: string;
  /** Source type: 'skill' (skill output) or 'macro' (macro execution) */
  type: 'skill' | 'macro';
}

/**
 * Renders skill/macro output with a source badge.
 * Uses XMarkdown for rendering (if available) or falls back to plain text.
 *
 * Usage in chat/agent message lists to differentiate AI-generated
 * content from skill/macro execution outputs.
 */
export function SkillMessageRenderer({ content, type }: SkillMessageRendererProps) {
  const isSkill = type === 'skill';

  return (
    <div
      data-skill-message={type}
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        background: 'var(--ant-color-bg-layout)',
        border: '1px solid var(--ant-color-border-secondary)',
      }}
    >
      {/* Header badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--ant-color-border-secondary)',
        }}
      >
        {isSkill ? (
          <ThunderboltOutlined style={{ color: 'var(--ant-color-warning)' }} />
        ) : (
          <CodeOutlined style={{ color: 'var(--ant-color-info)' }} />
        )}
        <Tag color={isSkill ? 'warning' : 'blue'} style={{ margin: 0 }}>
          {isSkill ? 'Skill' : 'Macro'}
        </Tag>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {isSkill ? 'Skill execution output' : 'Macro execution result'}
        </Text>
      </div>

      {/* Content rendered as markdown */}
      <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {content}
      </div>
    </div>
  );
}
